# TURN einrichten

Der Spielprozess stellt unter `/api/ice` ausschließlich angemeldeten Konten
kurzlebige TURN-Zugangsdaten bereit. Das gemeinsame Geheimnis liegt nur in
`/etc/kartracer/turn.json`, niemals im Repository oder im Browser. Ohne diese
Datei bleiben direkte Web-Verbindungen aktiv. Lokal bleibt beim bisherigen
PeerJS-Verfahren; die alte Offline-Datei benutzt dagegen manuell kopierte
WebRTC-Angebote und Antworten ohne externen Vermittlungsdienst.

## Einmalige Installation durch den Administrator

`setup-turn.sh` benötigt root. Der aktuelle Spielzugang besitzt diese Rechte
nicht. Auf dem Spielserver liegt HTTPS bereits auf Port 443. Das Skript ändert
keine bestehenden Webserver und verweigert belegte Listener-Ports.

Auf dem Spielserver ausführen, mit vorhandenem DNS-Namen und dazu passendem
gültigen TLS-Zertifikat:

```sh
sudo bash setup-turn.sh relay.example.org PUBLIC_IPV4 /etc/letsencrypt/live/relay.example.org/fullchain.pem /etc/letsencrypt/live/relay.example.org/privkey.pem 5349
```

DNS muss auf die öffentliche IPv4 zeigen. Ports 3478 UDP/TCP, 5349 TCP und
49160–49259 UDP auch in der Firewall des Hosting-Anbieters freigeben. Die
Zertifikatspfade müssen dauerhaft gültig bleiben; ein Certbot-Erneuerungshook
wird angelegt, wenn das entsprechende Verzeichnis existiert.

Für Schulnetze, die nur TCP 443 erlauben, einen dedizierten Endpunkt auf Port
443 bereitstellen: zweite öffentliche IP oder eigener Relay-Server, alternativ
administrativ eingerichtetes SNI-Routing. Dann dessen `turns:…:443?transport=tcp`
in der privaten TURN-Konfiguration verwenden. Ein belegter HTTPS-Port lässt
sich nicht einfach zusätzlich von coturn verwenden. Auch TURN kann eine
Schulnetz-Sperre des gesamten Spieldienstes nicht garantiertermaßen lösen.

Bei einem extern verwalteten coturn-Server die Datei `/etc/kartracer/turn.json`
auf dem Spielserver mit `secret` und `urls` einrichten (root:kartracer, 0640).
Das Geheimnis muss mit dessen `static-auth-secret` übereinstimmen. Keine echten
Werte in dieses Dokument schreiben. Die Anwendung liest die Datei ohne Neustart.

## Prüfung vor Freigabe

1. `systemctl status kartracer-turn` und TLS-Zertifikat prüfen.
2. Unangemeldet muss `/api/ice` mit 401 antworten; angemeldet mit
   `relayAvailable: true`, temporärem Benutzer und Kennwort.
3. Zwei Browser mit `iceTransportPolicy: 'relay'` verbinden und Daten in beide
   Richtungen übertragen. In `getStats()` einen ausgewählten Relay-Kandidaten
   nachweisen. Separat TLS/TCP testen, indem nur die `turns:`-URL angeboten wird.
4. Danach im Schulnetz testen. Direkte Verbindungen bleiben im normalen Betrieb
   bevorzugt; TURN vermittelt nur bei Bedarf die verschlüsselten Datenpakete.

Quelle: https://github.com/coturn/coturn/blob/master/examples/etc/turnserver.conf
