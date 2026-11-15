# Grand Poly · 1.2.10

Dieser Ordner Main ist das vollständige aktuelle Projekt und die Git-Repositorywurzel. Backups und Rest liegen außerhalb des Repositories.

## Build und Tests

- `node build-client.cjs` erstellt die Browserpakete und kart_racer.html.
- `py server/run_unit_tests.py` führt die Modultests aus (Linux: python3).
- `py test-performance.py` prüft das Spiel in Edge mit Playwright, einem lokalen Testserver und einer isolierten temporären Datenbank. PLAYWRIGHT_MODULE kann den lokalen Pfad zu Playwright setzen.

## Server

Nur den Inhalt von Main in ein neues Release-Verzeichnis kopieren. Alle benötigten normalen und saisonalen Texturen, Fahrzeugvorschauen, Modelle, Skripte, Kataloge, Lizenzen und Python-Servermodule sind enthalten. Buildquellen und Tests bleiben zur Wartung dabei. deployment-manifest.json enthält die geprüfte Dateiliste mit Prüfsummen.

Das Spiel benötigt den Python-Backenddienst und den bestehenden HTTPS-Reverse-Proxy. Rein statisches Hosting genügt nicht für Konten und Multiplayer. server/start.sh verwendet die vorhandene Serverstruktur:

- GAME_ROOT: /var/www/kartracer/public
- ACCOUNT_DATA: /var/www/kartracer/data
- PUBLIC_ORIGIN: Inhalt von /var/www/kartracer/account-origin

Private Kontodaten, Datenbank samt WAL/SHM, Rollen-Seeds, Zugangsschutz und nginx-Konfiguration bleiben außerhalb des Webrelease erhalten. Sie dürfen beim Ersetzen der Spiel-Dateien nicht gelöscht oder durch Main überschrieben werden.

.git, .work, __pycache__, .env-Dateien, lokale Abhängigkeiten und private Daten niemals hochladen. Die .gitignore sorgt dafür, dass diese lokalen Dateien nicht in Git aufgenommen werden.

## GitHub Desktop

File → Add Local Repository → diesen Main-Ordner auswählen. Kein neues Repository erstellen oder klonen: Die vorhandene .git enthält den bisherigen Verlauf und die GitHub-Verbindung. Alternativ bei „Can't find“ den Button Locate benutzen und Main auswählen.

Der nächste Commit zeigt ältere, unbenutzte Asset-Dateien als gelöscht. Diese Löschungen gehören zur Aufräumung; die lokalen Archive stehen außerhalb des Repositories in Backups bzw. Rest. Es wurde noch nichts committed oder gepusht.

## Backups und Rest

Backups bewahrt alle vorhandenen vollständigen Versionen, einschließlich der ausdrücklich zurückgezogenen Versionen 1.2.9/1.2.10. Das neue Release-Backup 1.2.10-upgrades-racing enthält Upgrades & Fair Racing. Historische Kandidaten bleiben unverändert. Keine Beschränkung auf die letzten drei Versionen mehr.

Rest enthält unbenutzte Original-Assets, Entwürfe, alte Arbeitsdateien und den unveränderten Zwischenstand mit der früher irrtümlichen Bezeichnung 1.2.11. Rest gehört nicht zum aktuellen Spiel und nicht zu Git.

## Aktueller Release-Auftrag
1.2.10 – Upgrades & Fair Racing: wirksame Upgrades mit unabhängigem Schalter, Live-Fahrwerte, Gras-Rundenzeiten, Abstandsindikatoren, Klassenregeln und synchronisierte Fahrzeughöhe. Serververöffentlichung über HTTPS und zwei Clients bestätigt, kein GitHub-Push. Aktuellen geprüften Stand und Grenzen in changelog.md beachten. Private Zugänge/Uploadregeln liegen unter ../../Server Access.

Neue Regressionen: node test-upgrades1210.cjs, node test-classes1210.cjs, node test-host-classes1210.cjs. Browserprüfungen mit py test-ui129.py und UI_TEST_SCRIPT=test-upgrades1210-browser.cjs, test-grass1210-browser.cjs oder test-multiplayer1210.cjs verwenden jeweils eine isolierte Datenbank.
