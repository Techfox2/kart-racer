#!/usr/bin/env bash
# Run once as administrator on the Kart Racer host. Existing HTTPS services are untouched.
# Usage: sudo bash setup-turn.sh HOST PUBLIC_IPV4 CERTIFICATE PRIVATE_KEY [TLS_PORT]
set -euo pipefail
if [ "$(id -u)" != 0 ] || [ "$#" -lt 4 ]; then
  echo 'Usage: sudo bash setup-turn.sh HOST PUBLIC_IPV4 CERTIFICATE PRIVATE_KEY [TLS_PORT]'; exit 1
fi
relay_host=$1; relay_ip=$2; source_cert=$(realpath -s "$3"); source_key=$(realpath -s "$4"); tls_port=${5:-5349}
[[ "$relay_host" =~ ^[a-zA-Z0-9][a-zA-Z0-9.-]+$ ]] || exit 1
[[ "$tls_port" =~ ^[0-9]+$ ]] && [ "$tls_port" -ge 1 ] && [ "$tls_port" -le 65535 ] || exit 1
python3 -c 'import ipaddress,sys; assert ipaddress.ip_address(sys.argv[1]).version == 4' "$relay_ip"
test -f "$source_cert"; test -f "$source_key"
getent passwd kartracer >/dev/null
test ! -e /etc/kartracer/turn.json || { echo 'TURN is already configured; refusing to overwrite credentials.'; exit 1; }
if systemctl is-active --quiet coturn || systemctl is-active --quiet kartracer-turn; then echo 'Existing TURN service: configure it manually.'; exit 1; fi
for port in 3478 "$tls_port"; do
  if ss -H -lntu | awk '{print $5}' | grep -Eq ":${port}$"; then echo "Port ${port} is already in use. HTTPS configuration has not been changed."; exit 1; fi
done
openssl x509 -in "$source_cert" -noout -checkhost "$relay_host" >/dev/null
apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get install -y coturn
# Only the newly installed/default inactive service is stopped; use an isolated service below.
systemctl disable --now coturn
install -d -o root -g kartracer -m 0750 /etc/kartracer
install -d -o root -g turnserver -m 0750 /etc/kartracer-turn
install -o root -g turnserver -m 0640 "$source_cert" /etc/kartracer-turn/fullchain.pem
install -o root -g turnserver -m 0640 "$source_key" /etc/kartracer-turn/privkey.pem
export relay_host relay_ip tls_port source_cert source_key
python3 - <<'PY'
import json,os,secrets
from pathlib import Path
host,ip,port=(os.environ[k] for k in ('relay_host','relay_ip','tls_port'))
secret=secrets.token_hex(32)
config=f'''listening-port=3478
tls-listening-port={port}
external-ip={ip}
realm={host}
server-name={host}
fingerprint
use-auth-secret
static-auth-secret={secret}
cert=/etc/kartracer-turn/fullchain.pem
pkey=/etc/kartracer-turn/privkey.pem
min-port=49160
max-port=49259
user-quota=24
total-quota=140
max-bps=262144
bps-capacity=10000000
stale-nonce=600
no-cli
no-multicast-peers
no-tcp-relay
no-tlsv1
no-tlsv1_1
no-dtls
no-stdout-log
log-file=syslog
no-software-attribute
'''
for network in ['0.0.0.0-0.255.255.255','10.0.0.0-10.255.255.255','100.64.0.0-100.127.255.255','127.0.0.0-127.255.255.255','169.254.0.0-169.254.255.255','172.16.0.0-172.31.255.255','192.168.0.0-192.168.255.255','224.0.0.0-255.255.255.255','::1','fc00::-fdff:ffff:ffff:ffff:ffff:ffff:ffff:ffff','fe80::-febf:ffff:ffff:ffff:ffff:ffff:ffff:ffff']:
    config+=f'denied-peer-ip={network}\n'
Path('/etc/kartracer-turn/turnserver.conf').write_text(config)
Path('/etc/kartracer/turn.json').write_text(json.dumps(dict(secret=secret,urls=[f'turn:{host}:3478?transport=udp',f'turn:{host}:3478?transport=tcp',f'turns:{host}:{port}?transport=tcp'])))
# Persist the original paths, including live certificate symlinks, for future renewals.
import shlex
hook='#!/bin/sh\nset -eu\n'
for source,target in [(os.environ['source_cert'],'fullchain.pem'),(os.environ['source_key'],'privkey.pem')]:
    hook+='install -o root -g turnserver -m 0640 '+shlex.quote(source)+' /etc/kartracer-turn/'+target+'\n'
hook+='systemctl restart kartracer-turn.service\n'
Path('/etc/kartracer-turn/renew-cert.sh').write_text(hook)
PY
chown root:turnserver /etc/kartracer-turn/turnserver.conf
chmod 0640 /etc/kartracer-turn/turnserver.conf
chown root:kartracer /etc/kartracer/turn.json
chmod 0640 /etc/kartracer/turn.json
chmod 0700 /etc/kartracer-turn/renew-cert.sh
cat >/etc/systemd/system/kartracer-turn.service <<'UNIT'
[Unit]
Description=Kart Racer TURN relay
After=network-online.target
Wants=network-online.target
[Service]
User=turnserver
Group=turnserver
Type=simple
ExecStart=/usr/bin/turnserver -c /etc/kartracer-turn/turnserver.conf --pidfile=
Restart=on-failure
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
AmbientCapabilities=CAP_NET_BIND_SERVICE
CapabilityBoundingSet=CAP_NET_BIND_SERVICE
[Install]
WantedBy=multi-user.target
UNIT
if command -v ufw >/dev/null && ufw status | grep -q '^Status: active'; then
  ufw allow 3478/udp; ufw allow 3478/tcp; ufw allow "$tls_port"/tcp; ufw allow 49160:49259/udp
fi
if [ -d /etc/letsencrypt/renewal-hooks/deploy ]; then
  ln -s /etc/kartracer-turn/renew-cert.sh /etc/letsencrypt/renewal-hooks/deploy/kartracer-turn
fi
systemctl daemon-reload
systemctl enable --now kartracer-turn.service
systemctl is-active --quiet kartracer-turn.service
echo 'TURN installed. Also allow these ports in the hosting-provider firewall. Run an external forced-relay connection test before marking it ready.'
