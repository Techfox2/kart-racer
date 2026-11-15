"""Short-lived coturn credentials; the shared secret never leaves the server."""
import base64
import hashlib
import hmac
import json
import os
import time
from pathlib import Path

STUN = [{'urls': 'stun:stun.l.google.com:19302'}, {'urls': 'stun:stun1.l.google.com:19302'}]

def configuration(uid, now=None):
    now = int(time.time() if now is None else now)
    result = {'iceServers': list(STUN), 'expires': now + 1800, 'relayAvailable': False}
    filename = Path(os.environ.get('KART_TURN_CONFIG', '/etc/kartracer/turn.json'))
    try:
        config = json.loads(filename.read_text())
        secret, urls = config['secret'], config['urls']
        if not isinstance(secret, str) or len(secret) < 32 or not isinstance(urls, list) or not urls:
            return result
        if any(not isinstance(u, str) or not u.startswith(('turn:', 'turns:')) for u in urls):
            return result
    except (OSError, ValueError, KeyError, TypeError):
        return result
    expires = now + 3600
    # Opaque account reference, without exposing username or internal database ID.
    reference = hmac.new(secret.encode(), str(uid).encode(), hashlib.sha256).hexdigest()[:16]
    username = f'{expires}:{reference}'
    credential = base64.b64encode(hmac.new(secret.encode(), username.encode(), hashlib.sha1).digest()).decode()
    result.update(expires=expires, relayAvailable=True)
    result['iceServers'].append({'urls': urls, 'username': username, 'credential': credential})
    return result
