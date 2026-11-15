# Verifiziert veröffentlicht: 1.2.10 – Upgrades & Fair Racing, 15.11.2026

- 1.2.10 ist auf ausdrücklichen Nutzerauftrag veröffentlicht. /var/www/kartracer/public zeigt auf releases/1.2.10; kartracer.service ist aktiv. Kein GitHub-Push.
- Alle 204 Dateiprüfsummen stimmen mit dem neuen vollständigen Backup ../Backups/Kart Racer 1.2.10-upgrades-racing, dem Archiv und dem aktivierten Release überein. Backup und Serverrelease bleiben unverändert. Dieser nachträgliche Dokumentationsstand ist der Veröffentlichungsbeleg.
- Im Server-Staging 96 Modultests und drei echte HTTP-Tests bestanden. Neue private SQLite-Sicherung mit integrity_check; Initialisierung auf isolierter Kopie erhielt jede vorhandene Tabellenzeile. Produktive Integrität, Fremdschlüssel und bestehende Kontoidentitäten nach Aktivierung und QA-Bereinigung bestätigt.
- Öffentliche HTTPS-Prüfung: Versionsdateien/Changelog exakt zum Paket, Spielanmeldeschutz, Login, private/no-store, Glass speichern/neuladen, Times/Einstellungen, GT3-/Kart-Rennstart, Live-Fahrwerte, Cockpit Desktop/Mobil und Pause/Menü bestanden.
- Öffentlicher Zwei-Client-Test mit tatsächlich ausgelieferten Bundles: strikte Standardklasse, Hostrechte, gemischter Beitritt, Startblockade nach Abschalten und Klassenwechsel zur Freigabe bestanden. Kompetitiv mit Upgrades aus sowie Lucky Blocks mit Upgrades an gestartet; gemischtes GT3/Kart-Rennen mit eigenen Basiswerten 68/40 m/s, gemeinsamer Bereitschaft und Bewegung beider Fahrer geprüft. Mobile Lobby und beide Rennansichten visuell geprüft. Abschließende Läufe ohne JavaScript-Ausnahmen oder HTTP-Fehler.
- Frühere Live-Testläufe hatten eine falsche Bereitschaftsbedingung: Der Countdown zeigt anfangs kurz leeren Text. Der Runner wartet jetzt ausdrücklich auf die gemeinsame Startzeit plus 750 ms und leeren Countdown, liest beide Telemetrien vor der Rückkehr und akzeptiert eine bereits automatisch erfolgte Lobby-Rückkehr. Die dadurch ausgelösten Testfehler erforderten keine Änderung des veröffentlichten Spiels.
- 9 ausschließlich für diese Live-Prüfung erzeugte QA-Konten samt abhängigen Daten gezielt entfernt. Uploadarchiv auf dem Server entfernt. Vorheriges Release 1.2.9B und sämtliche vorhandenen Backups unverändert für Rollback/Archiv erhalten.
- Grenzen: vollständige Grasrunde und Käufe/Persistenz wurden in isolierten lokalen Browserprüfungen geprüft, nicht erneut mit Produktivkonten. Keine vollständig gefahrene Balanceprüfung aller Fahrzeuge/Strecken. Getunte Rennen bleiben von Serien-Bestenlisten ausgeschlossen; Gras allein entwertet sonst gültige Rekorde nicht. Keine Garantie für alle Netzwerk-/VPN-Verbindungen.
- Belege: ../Rest/Organisation/deployment-1210-result.json, live-1210-result.json und live-multiplayer1210-result.json. Die folgenden Einträge sind historische Vorbereitungsstände; frühere Uploadverbote oder offene Veröffentlichung gelten nicht als aktueller Status.

---

# Aktueller Auftrag und Stand – 1.2.10, 15.11.2026

- **1.2.10 – Upgrades & Fair Racing** ist lokal umgesetzt und geprüft. Der letzte Nutzerauftrag erlaubt ausdrücklich Serververöffentlichung und ersetzt das frühere Uploadverbot. Zum Paketbau noch kein Live-Nachweis; anschließend separaten Veröffentlichungsbeleg beachten. Kein GitHub-Push.
- Aktuelle Regeln: Upgrade-Schalter unabhängig von Kompetitiv/Lucky Blocks, offline kontogebunden und online Hostentscheidung. Vor jedem Rennen Kontostand laden und Fahrwerte unveränderlich berechnen. Bots bleiben Serie. Hauptwirkung je Stufe 10 %, Gewicht 3 %. Live-Telemetrie und aktive/gekaufte Stufen sichtbar.
- Gras entwertet vollständige Rundenzeiten und sonst gültige Serien-Bestenlistenrekorde nicht. Geordnete Sektoren, gerichtete Ziellinie und Schutz vor Positionssprüngen/Pendeln erhalten. Getunte Rennen bleiben von Serien-Bestenlisten ausgeschlossen; darauf wurde keine neue Freigabe erteilt.
- Lobbys standardmäßig eine Klasse Kart/GT3, optional gemischt. Hostregel beim Beitritt, Wechsel und Start auf Server/Host prüfen. Nach Regelwechsel erst starten, wenn alle passen. Im gemischten Rennen eigene Klassenphysik. Remote-Höhe/Neigung aus Senderzustand, keine lokale Straßenprojektion darüberlegen. Lobbyprotokoll 8; alle Clients neu laden.
- Testnachweise und Grenzen stehen im aktuellen changelog.md: 96 Modultests, drei HTTP-Tests, echte Käufe/Login, gefahrener Gras-Rekord und Zwei-Client-Rennen in allen vier Modus-/Upgrade-Kombinationen sowie gemischt bestanden. Keine Behauptung vollständig gefahrener Balancevergleiche oder umfassenden Anti-Cheats.
- Main bleibt Entwicklungs-/Deploymentwurzel. node build-client.cjs baut HTML und Bundles. Genau ein neues Backup ../Backups/Kart Racer 1.2.10-upgrades-racing; vorhandene historische 1.2.10 und alle übrigen Backups erhalten. Keine Zugangsdaten oder Testdaten veröffentlichen.
- Vor Server-Upload C:/Users/phils/Documents/ChatGPT/Server Access/UPLOAD-REGELN-KART-RACER.md lesen. SSH-Alias kartracer-game und bestätigten Hostschlüssel erhalten. Staging, Prüfsummen, neue SQLite-Sicherung, isolierte Initialisierung, atomarer Wechsel und öffentlicher HTTPS-Test erforderlich.

Die folgenden Einträge sind historische Aufzeichnungen; bei Widersprüchen gilt dieser aktuelle Stand.

---

# Verifiziert ver?ffentlicht: 1.2.9B ? Race Fixes, 15.11.2026

- 1.2.9B ist live best?tigt: /var/www/kartracer/public zeigt auf releases/1.2.9B; kartracer.service ist aktiv. Der eingerichtete SSH-Zugang funktionierte in diesem Auftrag. Fr?here Zugriffsblockaden unten sind historische Aufzeichnungen. Kein GitHub-Push.
- Alle 196 Dateien stimmen zwischen Main zum Uploadzeitpunkt, frischem Build, vorhandenem Backup, Uploadarchiv und aktiviertem Release per SHA-256 ?berein. Backup ../Backups/Kart Racer 1.2.9B und Serverrelease bleiben unver?ndert; dieser nachtr?gliche Dokumentationsstand geh?rt zum Ver?ffentlichungsnachweis.
- Erneut bestanden: test-fixes129b.cjs, test-race-finish.cjs, test-tuning.cjs und test-lobby.cjs; im Server-Staging 95 Python-Modultests und zwei echte HTTP-Tests. Neue private SQLite-Sicherung mit Integrit?tspr?fung; Initialisierung auf isolierter Datenbankkopie erhielt jede bestehende Tabellenzeile. Produktive Integrit?t und bestehende Kontoidentit?ten nach Aktivierung und QA-Bereinigung best?tigt.
- ?ffentlicher HTTPS-Browsertest: Versionsdateien inklusive eingebettetem Changelog exakt zum Paket, Anmeldeschutz, Login, private/no-store, Glass speichern/neuladen, Times/Einstellungen, GT3-/Kart-Rennstart, Pause/Men?, mobile Einstellungen sowie Cockpit mit Speed-/Max-Anzeige auf Desktop und Mobilger?t bestanden. Abschlie?ender Lauf ohne JavaScript-Ausnahmen und ohne HTTP-Fehler. Cockpit-Screenshots visuell gepr?ft.
- Die direkte changelog.md-URL ist nicht freigegeben (ohne Spielanmeldung 401, angemeldet 404). Ein erster Pr?flauf erwartete dort f?lschlich 200; der Runner wurde auf den tats?chlich ausgelieferten Changelog in release-notes.json korrigiert. Keine ?nderung an Serverberechtigungen.
- Beide ausschlie?lich f?r diese Pr?fung erzeugten QA-Konten samt abh?ngigen Daten entfernt; Uploadarchiv auf dem Server entfernt. Vorheriges Release 1.2.9 f?r Rollback erhalten. Keine bestehenden Backups gel?scht oder ?berschrieben.
- Grenzen: kein neuer vollst?ndig gefahrener Live-Rennlauf und kein neuer ?ffentlicher Zwei-Client-Test. Die dokumentierten isolierten lokalen Renn-/Mehrspielertests bleiben hierf?r der Nachweis; keine Aussage ?ber alle Strecken oder fremde Internet-/VPN-Verbindungen.
- Belege: ../Rest/Organisation/deployment-129b-result.json und live-129b-result.json. Die folgenden Eintr?ge dokumentieren den fr?heren Vorbereitungsstand.

---

# Aktueller Auftrag und Stand – 1.2.9B, 15.11.2026

- **1.2.9B – Race Fixes** ist lokal umgesetzt und geprüft. Der Nutzer hat die Serververöffentlichung ausdrücklich beauftragt; sie ist wegen nicht lesbarer lokaler SSH-Konfiguration in diesem Ausführungskontext noch ausstehend. Kein Live-Nachweis und kein GitHub-Push. Nicht mit dem unten historisch bestätigten Live-Stand 1.2.9 verwechseln.
- Umfang: Rundenzählung bei Gras-Abkürzungen, physisch gerichtete Ziellinie, Upgrade-Refresh vor jedem Rennen und Upgrade-Wirkung in freigegebenen Onlinerennen, sichtbarer Speed-Testwert, freiere Cockpitsicht und versetzter Tacho. Bisherige Modusregeln bleiben: Kompetitiv Serie, online Host-Freigabe. Rekordvalidierung bleibt getrennt; getunte Rennen liefern keine Rekorde.
- RaceProgress darf keine vollständige Rennrunde wegen eines Sprungs der Streckenprojektion oder projizierten Höhe auf Gras verwerfen. Geordnete Sektoren plus tatsächliche Ziellinienüberquerung bleiben nötig. Rückwärts zieht eine gewertete Runde ab (Minimum null); reines Vorwärts-/Rückwärtspendeln verdient keine Runden.
- Fahrzeugwerte nach Kontorefresh pro Rennen neu berechnen und unveränderlich halten. Online-Raumklasse liefert Basisphysik, gekaufte Effekte werden darauf angewendet. Lobbyprotokoll jetzt 7. Details und tatsächlich ausgeführte Tests in changelog.md.
- Main bleibt Entwicklungs-/Deploymentwurzel. node build-client.cjs baut HTML und Bundles. Neues vollständiges Backup ../Backups/Kart Racer 1.2.9B; keine bestehenden Backups löschen oder überschreiben.
- Vor Veröffentlichung C:/Users/phils/Documents/ChatGPT/Server Access/UPLOAD-REGELN-KART-RACER.md erneut lesen. Vorgesehenen Zugang und bestätigten Hostschlüssel erhalten. Keine Zugangsdaten in Repository/Chat/Release kopieren. Kein Umgehen der Zugriffsgrenze und keine Behauptung, der Serverzugang selbst sei defekt.

Die folgenden Einträge sind historische Aufzeichnungen; bei Widersprüchen gilt dieser aktuelle Stand.

---

# Verifiziert veröffentlicht: 1.2.9 – UI & Race, 15.11.2026

- Der Nutzer hat den Server-Upload nach Abschluss der lokalen Umsetzung ausdrücklich beauftragt. 1.2.9 ist jetzt live bestätigt: `/var/www/kartracer/public` zeigt auf `releases/1.2.9`; `kartracer.service` ist aktiv. Kein GitHub-Push.
- Veröffentlicht wurde das bereits geprüfte vollständige Paket mit 193 Dateien, unverändert zum Backup `../Backups/Kart Racer 1.2.9-ui-race`. Alle SHA-256-Prüfsummen vor und nach Aktivierung bestätigt. Die folgenden lokalen Dokumentationsnachträge gehören zum Veröffentlichungsnachweis; das veröffentlichte Release und das bestehende Backup bleiben unverändert.
- Im Server-Staging: 95 Modultests und zwei echte HTTP-Tests bestanden. Neue private SQLite-Sicherung mit Integritätsprüfung; Initialisierung auf isolierter Kopie erhielt jede bestehende Tabellenzeile. Produktive Datenbankintegrität und bestehende Kontoidentitäten nach Veröffentlichung erneut bestätigt.
- Öffentlicher HTTPS-Browsertest: Versionsdateien, Anmeldeschutz, Login, private/no-store, Glass speichern und neu laden, Times/Einstellungen, Kart-/GT3-Rennstart, Pause/Menü und 390-px-Ansicht bestanden. Null JavaScript-Ausnahmen und null HTTP-Fehler in diesem Lauf. Kein neuer vollständig gefahrener Live-Rennlauf; die dokumentierte lokale Rennprüfung bleibt maßgeblich.
- Das ausschließlich für diesen Live-Test erzeugte QA-Konto samt abhängigen Daten wurde gezielt entfernt. Keine bestehenden Spielerkonten als Testdaten verwendet. Uploadarchiv entfernt, vorheriges Release 1.2.8P für Rollback erhalten. Keine alten Backups/BrokenVersions gelöscht oder überschrieben.
- Belege: `../Rest/Organisation/deployment-129-result.json` und `../Rest/Organisation/live-129-result.json`. Diese lokale Dokumentation ersetzt frühere Nur-lokal-/Uploadverbote als aktuellen Stand; die nachfolgenden Einträge bleiben historische Aufzeichnungen. Keine Behauptung, sporadische frühere 502-Fehler generell behoben zu haben.

---

# Aktueller Auftrag und Stand – 1.2.9, 15.11.2026

- **1.2.9 – UI & Race** ist ausschließlich lokal umgesetzt. Dieser Auftrag erlaubt weder Server-Upload noch GitHub-Push. Eine frühere Veröffentlichungsfreigabe gilt nicht für diesen Auftrag. Kein neuer Live-Nachweis wurde erhoben.
- Verifizierte Entwicklungsbasis: Main, Git-Commit `06e1f26` (1.2.8P), zu Arbeitsbeginn sauber. Keine Dateien aus zurückgezogenen Releases übernommen. Diese neue 1.2.9 ist nicht der alte zurückgezogene Archivstand gleichen Namens.
- Neuer gemeinsamer Auftrag: Ambient-Aktionsfarben, Einstellungstab-Animationen, kontogebundenes Glass, native Schalter, Account-Ausrichtung, Freund-Entfernen-Bestätigung, geschützter Außenklick, Rennende und abbrechbarer Rennaufbau, native Versionsauswahl. Keine neuen Helm-/Shopfunktionen, keine Physikänderung.
- Neueste ausdrückliche Rundenregel: Gras entwertet Rennrunden nicht; vollständiger Fortschritt über geordnete Sektoren ist nötig; Rückwärtsüberquerung zieht eine gewertete Runde ab, mindestens null. Pendeln erzeugt keine Runden. Strenge Rekordvalidierung bleibt unabhängig davon erhalten.
- Bestehende Backups und BrokenVersions unverändert erhalten. Frühere Löschaufträge weiter unten sind durch diese Anweisung überholt. Genau ein neues vollständiges Paket unter `../Backups/Kart Racer 1.2.9-ui-race`; vorhandenes `Kart Racer 1.2.9` niemals überschreiben.
- Main bleibt Git-/Entwicklungswurzel. `game-shell.html` und JS-Quellen bearbeiten; `node build-client.cjs` erzeugt HTML und Pakete. `ui-settings.js` muss vor `game.js` geladen werden. `ui-settings.css` ist nur im angemeldeten Spiel aktiv.
- Neue Glass-Einstellung serverseitig strikt Boolean, fehlend = true, explizites false und das Feld bei alten Clients erhalten. Admin-Inventar verwendet bestehende Rechte, Revision und Audit. Keine Produktivkonten oder echten Freundschaften für Tests verändern.
- Tests lokal mit temporärer Datenbank: `py test-ui129.py`; zusätzliche Browserfälle über `UI_TEST_SCRIPT=test-dialogs129.cjs`, `test-loading129.cjs` und `test-race-browser.cjs`. Der echte Browser-Rennlauf steuert nur normale Tasten, ohne Teleport oder Zeitbeschleunigung. Nachweise und offene Testgrenzen stehen am Anfang von changelog.md.
- Keine privaten Datenbanken, Testkonten, Sitzungen, Schlüssel, .git, .work oder Cacheverzeichnisse in das Versionspaket aufnehmen. Zugänge bleiben außerhalb von Main. Die benachbarten Uploadregeln wären erst bei einem später ausdrücklich beauftragten Upload zu lesen.

Die folgenden älteren Einträge sind historische Aufzeichnungen; bei Widersprüchen gilt der aktuelle Auftrag oben.

---

# Aktueller Auftrag und Stand – 1.2.8P, 15.11.2026

- Release **1.2.8P – Performance** enthält Performance-Punkte 1–5 und die vollständige Tutorial-Entfernung. Punkt 6 (Grafik/Rendering) bleibt ausgeschlossen. Serververöffentlichung ausdrücklich beauftragt; GitHub-Push nicht beauftragt. Tatsächlichen Live-Stand per SSH/HTTPS prüfen; Abschlussbeleg unter ../Rest/Organisation/deployment-128p-result.json.
- Main bleibt Git- und Deploymentwurzel. Backups und Rest bleiben daneben. ChatGPT/Server Access enthält private Zugangseinrichtung und UPLOAD-REGELN-KART-RACER.md; ChatGPT/Rest enthält sonstige übergeordnete Dateien. SSH-Alias kartracer-game bleibt unverändert.
- Tutorial nicht wieder einbauen: UI, Skripte, CSS, Katalog, Adminsteuerung und Renn-Sonderfälle entfernt. Server ignoriert nur das alte gespeicherte tutorial-Feld, damit bestehende Konten weiter funktionieren.
- Nutzer hat alle Pakete/Diagnosekopien von 1.2.9 und 1.2.10 ausdrücklich zur Löschung freigegeben, auch aus Backups. Keine weitere Fehleranalyse. Lokale Verzeichnislöschung wurde automatisch blockiert; Abschlussbeleg beachten. Andere bestehende Backups erhalten, niemals überschreiben. Neues Paket: Backups/Kart Racer 1.2.8P-release (vorhandener früherer P-Kandidat bleibt unverändert).
- Frühere widersprechende Tutorial-/Archiv-/Pfadregeln weiter unten sind historische Aufzeichnungen. Keine Kontodaten, Rückerstattungs-Ledger oder Git-Historie durch Versionsbereinigung verändern.

---

# Aktuelle Struktur und Version — verbindlich ab 15.11.2026

- Aktuelle Arbeitsversion: **1.2.8P**, P = Performance, auf Basis 1.2.8; lokal noch nicht veröffentlicht. Die vorläufige Bezeichnung 1.2.11 war falsch und ist ersetzt. Live bleibt 1.2.8.
- Main ist Arbeits-, Git- und Deploymentwurzel. Git-Metadaten gehören nach Main/.git. Backups und Rest sind Geschwister außerhalb des Repositories. Keine neue Versionsnummer nur für diese Strukturkorrektur.
- Bei Deployment ausschließlich Main-Inhalt in ein neues geprüftes Webrelease übernehmen, nie .git, .work, __pycache__, Datenbanken, lokale Umgebungsdateien oder private Schlüssel. Produktive Kontodaten und Serverkonfiguration bleiben getrennt erhalten.
- Backups enthält alle vorhandenen vollständigen Versionen; keine Begrenzung auf drei Versionen mehr. Zurückgezogene Versionen als solche kennzeichnen, unveränderte Dateien bewahren.
- Rest enthält unbenutzte Texturen/Quell-Assetpakete, Entwürfe, frühere Testdaten und unbestimmte Dateien. Keine Rest-Dateien veröffentlichen. PNG-Originale/Prompts und alte Rollback-Texturen müssen aufgrund des neuen Nutzerauftrags nicht mehr in Main liegen.
- node build-client.cjs aus Main baut die Pakete. Relative Laufzeitpfade bleiben innerhalb von Main unverändert.
- Vor jedem Server-Upload die gemeinsame Anleitung C:/Users/phils/Documents/ChatGPT/Server Access/UPLOAD-REGELN-KART-RACER.md lesen. Der aktuelle Nutzerauftrag hat Vorrang vor abweichenden historischen Struktur-, Archiv- und Paketregeln unten. Kein Server- oder GitHub-Push mit dieser Umordnung beauftragt.

---

# Kart Racer – Anleitung für Claude

## Gemeinsamer Serverzugang auf diesem Rechner
- Vor Serverarbeiten die gemeinsame Anleitung unter `C:\Users\phils\Documents\ChatGPT\Server Access\UPLOAD-REGELN-KART-RACER.md` lesen, auch aus anderen Worktrees.
- Lokaler SSH-Alias: `ssh kartracer-game`; Verbindungstest ohne Mutation: `ssh kartracer-game true`. Zentrale Konfiguration und bestätigter Hostschlüssel liegen im Benutzerordner `.ssh`, nicht mehr ausschließlich in `.work`. Private Schlüssel/Passwörter niemals in Projekt, Chat oder Build kopieren.
- Neue Chats im selben Windows-Benutzerkonto können diese Dateien verwenden, sofern ihre Werkzeuge/Datei- und Netzwerkberechtigungen es erlauben. Cloud und andere Geräte benötigen eigene sichere Einrichtung. Fehlende Netzwerkfreigabe nicht als falschen Schlüssel ausgeben. Aktueller Auftrag entscheidet über Veröffentlichung; ein eingerichteter Zugang ist keine pauschale Upload-Freigabe.


Lies zuerst AGENTS.md. Diese Datei enthält die wichtigsten Arbeitsregeln für Änderungen an diesem Projekt.

## Zusammenarbeit
- Aktuelle ausdrückliche Nutzerwünsche haben Vorrang vor diesen Projektregeln.
- Kurz und auf Deutsch kommunizieren. Keine zusätzlichen erklärenden UI-Texte ohne Auftrag ergänzen.
- Vor Änderungen AGENTS.md und den tatsächlichen Projektstand lesen. Fremde Änderungen erhalten.
- Neue Bedienelemente und aktuelle Update-Kurzfassungen in Deutsch, Englisch und Französisch pflegen.

## Arbeitsordner und Backups
- Direkt an den Dateien im Projektstamm arbeiten.
- Keine Ordner namens Experimental build oder Full releases mehr anlegen.
- Pro abgeschlossener Änderung genau eine neue Version unter Backups/Kart Racer <Version> ablegen, nicht nach jedem Zwischenschritt.
- Nur die drei neuesten vollständigen Versionen behalten, nach Versionsnummer sortiert. Vorhandene Backups niemals überschreiben.
- Vor dem Entfernen älterer Backups deren vollständige changelog.md in release-notes.json erhalten. Der Verlauf darf nicht auf drei Einträge schrumpfen.
- Vor rekursivem Löschen den absoluten Zielpfad prüfen: ausschließlich alte Versionsordner innerhalb dieses Projekts/Backups. Keine Links oder fremden Verzeichnisse verfolgen.
- Backups, BrokenVersions und .work niemals rekursiv in einen neuen Build kopieren. Für Builds eine ausdrücklich festgelegte Dateiliste verwenden.

## Version und Changelog
- Den lokalen Versionsmarker aus release-notes.json mit dem dokumentierten Live-/Rollback-Stand und dem aktuellen Auftrag abgleichen; nicht mit der Live-Version gleichsetzen. Bei einem neuen Spielupdate normalerweise die Patchversion erhöhen; zurückgezogene oder archivierte Versionspakete nicht überschreiben.
- Versionsanzeige in updates.js, CURRENT_VERSION in server/social.py und current/neuen Eintrag in release-notes.json zusammen aktualisieren.
- changelog.md im Projektstamm und im neuen Backup pflegen. Änderungen, tatsächlich ausgeführte Prüfungen und relevante Grenzen nennen.
- Neue Changelog-Kurzfassung auf DE/EN/FR ergänzen; ältere Einträge und ihre Originaltexte erhalten.
- Die kleine Versionsanzeige oben rechts und das Update-Popup mit serverseitig gespeichertem Lesestatus erhalten.

## Vollständige Builds
- kart_racer.html, assets.js, quality.js, art.js, scenery.js, web-rooms.js, friends.js, social.css, updates.js, release-notes.json und changelog.md mitnehmen.
- account-store.js, account.js, auth.js, auth.css, login.html und server/ mitnehmen.
- vendor/three.min.js sowie Materialien einschließlich textures.js, maps/ und Lizenz mitnehmen.
- assets/backgrounds/backgrounds.js, Hintergrund-PNGs und Prompt-Aufzeichnungen mitnehmen.
- assets/scenery/models.js, beide Szenerie-Lizenzen, SOURCES.md und selected/ einschließlich OBJ/MTL-Dateien mitnehmen.
- AGENTS.md, CLAUDE.md und CHATGPT.md mitnehmen.
- Downloadarchive, vollständige source-racing/source-nature-Pakete, temporäre Dateien, Datenbanken und Zugangsdaten gehören nicht in einen Build.

## Spielregeln und Oberfläche
- Lobby-Hintergrundbilder bleiben auf allen Grafikstufen gleich. Alle Grafikstufen verwenden die aktuellen Poly-Kulissen, Materialien und das aktuelle Fahrermodell. Alte Materialien und Modelle nicht für Niedrig reaktivieren; Auflösung, Schatten und Filterung bleiben abgestuft, 3D-Gras nur auf Hoch.
- Hover- und Klickanimationen bei neuen interaktiven Elementen ergänzen; deaktivierte Bedienelemente und reduzierte Bewegung berücksichtigen.
- Auswahl in Einstellungs- und Lokal/Web-Tabs durch Farbe anzeigen, ohne zusätzliche Häkchen.
- News-/Changelog-Inhalte behalten ihre Blau-/Türkis-Akzente; GUI-Flächen folgen der jeweils geltenden Ambient-Regel. Keine pauschal festgelegte lila Dialogfarbe; Ausnahmen für Hauptmenü und Profilkarte siehe „Menu Colour Fix – 1.2.10“.

## Konten und Mehrspieler
- Kontodaten, Fortschritt, Münzen, Musik und Einstellungen gehören auf den Server und zur unveränderlichen Kontoidentität.
- Öffentliche Player-IDs sind eindeutig, unveränderlich und sechs Zeichen lang, ausschließlich Großbuchstaben und Ziffern. Bestehende interne Identitäten erhalten.
- Aktuelle Benutzernamen sind ohne Beachtung der Groß-/Kleinschreibung eindeutig. Nach einer Änderung darf der freigegebene Name wieder vergeben werden.
- Eine tatsächliche Namensänderung kostet atomar 2.000 Münzen. Freundschaften müssen eine Namensänderung überstehen; nie Namen als dauerhaften Beziehungsschlüssel verwenden.
- Den Benutzernamenfilter auch bei Namensänderungen anwenden. Keine E-Mail-Adresse oder echten Namen verlangen.
- Spielstand-Import und -Export bleiben entfernt; den Account-Tab nicht wieder in Safe umbenennen.
- Maximal sieben Fahrerplätze pro Lobby, Menschen und Bots zusammen. Zuschauer belegen keine Fahrerplätze; öffentliche Zuschauer gehören erst zum zurückgezogenen Stand 1.2.9, dessen Grenze beträgt 16 Zuschauer. Lokale Codes: sechs Ziffern. Web-Codes: acht Buchstaben/Ziffern.
- Lokale Rennkommunikation bleibt beim bisherigen Peer-Verfahren. Web-Rennen laufen zwischen Clients; der Server vermittelt Verbindungen, nicht den Rennzustand. Konten, Freunde und Einladungen bleiben serverseitig.

## Prüfen und Bereitstellen
- Prüfungen passend zur Änderung wählen: Syntax, betroffene Servertests und bei UI-Änderungen Browserprüfung auf Desktop und Mobilgeräten.
- Nicht behaupten, etwas getestet oder veröffentlicht zu haben, bevor es tatsächlich geprüft wurde.
- Nur im vom Nutzer autorisierten Umfang auf den Server hochladen. Zugangsdaten aus dem externen Setup-Ordner verwenden und niemals in Antworten oder Protokollen offenlegen.
- Bestehende Accounts, Spielstände und andere Serverdienste erhalten. Vor Datenmigrationen die Datenbank sichern.
- Neue Version getrennt hochladen, Dateien prüfen, anschließend aktivieren und die tatsächlich über HTTPS ausgelieferte Version kontrollieren.

## GitHub und vertrauliche Dateien
- .gitignore erhalten: insbesondere Backups/, .work/, Zugangsdaten, private Schlüssel, Umgebungsdateien und Account-Datenbanken ausschließen.
- Der externe Ordner Kartracer-Setup und sein ZIP bleiben außerhalb des Repositorys.
- server/ enthält benötigten Programmcode und darf ins Repository; private Laufzeitdaten und Schlüssel dürfen nicht mit hinein.
- Bei manuellem Browserupload ausgeschlossene Ordner selbst abwählen; nicht auf .gitignore als Schutz für beliebige Uploadwege verlassen.
- Anleitungstexte dürfen keine Passwörter, Tokens, privaten Schlüssel oder privaten Zugangslinks enthalten.

## Diese Anleitungen pflegen
- AGENTS.md enthält die verbindlichen gemeinsamen Kurzregeln. CLAUDE.md und CHATGPT.md erklären denselben Ablauf für die jeweiligen Assistenten.
- Bei geänderten Nutzerregeln alle drei Dateien zusammen aktualisieren; widersprüchliche Anweisungen vermeiden.

## Bedarfsgerechtes Laden und Einladungen
- Texturen als separate Bilddateien belassen. Gemeinsame Poly-Assets auf allen Grafikstufen verwenden und nur die benötigte Oberfläche, Hintergründe und Streckendeko laden; zusätzliche Effekte wie 3D-Gras ausschließlich für die freigegebene Qualitätsstufe.
- Statische Dateien dürfen privat mit ETag validiert und Textdateien komprimiert werden. Konto-APIs und personalisiertes HTML bleiben no-store; Berechtigungen immer vor Cache-Antworten prüfen.
- Rennen ohne Neuladen der Webseite verlassen oder wiederholen; Szenen und Ereignisbehandler sauber freigeben.
- Der Host bestimmt, ob Gäste Freunde einladen dürfen. Im Web-Modus zusätzlich serverseitig prüfen; der Gastknopf steht unten in der Lobby.

- GT3 und Strecken: gt3.js, track-physics.js und assets/tracks/ einschließlich Quellen und MIT-Lizenz in jedes Backup aufnehmen. Kart- und GT3-Bestzeiten getrennt speichern; bestehende Konten verlustfrei ergänzen.
- TURN bleibt bis zur administrativen Einrichtung deaktiviert. server/ice.py, test_ice.py, setup-turn.sh und TURN.md mitliefern; Geheimnisse nur außerhalb des Projekts unter /etc/kartracer/turn.json. Web darf bei Bedarf verschlüsselte Rennpakete über TURN weiterleiten; Lokal nutzt kein eigenes Relay.

- Fahrzeugkäufe: Eigentum und Münzabzug serverseitig atomar prüfen. Fahrzeugauswahl in der Garage; assets/vehicles/ mit Vorschauen und Quellen in jedes Backup aufnehmen. Bestehende Fahrzeugfreischaltungen erhalten.
- Einzelspieler-Bots: Anzahl 0–6, Schwierigkeit, individuelle GT3-Fahrzeuge und Item-Schalter pro Konto speichern. Kompetitiv bleibt itemfrei; Mehrspieler-Bots sind seit 1.1.4 ausdrücklich erlaubt: zusammen mit Menschen höchstens sieben Teilnehmer.

- Profilgestaltung: Farben und Icons im Shop serverseitig kaufen; freigeschaltete Designs kostenlos wechseln. Eigentum und Auswahl pro unveränderlicher Account-ID speichern, bei alten Clients erhalten.

- Privacy: privacy.js in Builds aufnehmen. Sichtbarkeit von Online-Status, Strecke, Münzen und Freundesliste stets serverseitig prüfen. Standard: Status/Strecke nur Freunde, Münzen/Freundesliste privat. Aktivität läuft nach 90 Sekunden ohne Lebenszeichen ab; Kontodaten nie ungefiltert veröffentlichen.

- Rankings: rankings.js und server/rankings.py mitliefern. Top 100 je Strecke und Klasse; Bestzeiten an unveränderliche ID binden. Clientgemeldete Zeiten sind kein manipulationssicherer Rennnachweis.
- Administration: admin.js, server/admin.py und Tests mitliefern. Initial nur vorhandene Konten MrBucks, MrBucks2 und Anton einmalig nach ID berechtigen; niemals Rechte bei späterer Registrierung oder Namensübernahme vergeben. Jede Aktion serverseitig prüfen, letzten Admin erhalten, Änderungen protokollieren. Nur Web-Lobby-Metadaten anzeigen, keine Signalisierung, IPs, Sitzungen oder Passwörter. Lokale Lobbys bleiben unabhängig.
- Animationen respektieren prefers-reduced-motion; keine permanenten Menü-Animationsschleifen ergänzen.

- Admin-Münzen und Freischaltungen: Änderungen atomar mit Profilrevision prüfen und Vorher/Nachher protokollieren. Standardfreischaltungen erhalten; entzogene Ausrüstung auf Standard zurücksetzen. Keine Passwörter oder Sitzungen in der Konsole anzeigen.

- Bots ab 1.1.4: bots.js und bots-ui.js mitliefern. Schwierigkeit pro Bot speichern; Einzelspieler- und Mehrspieler-Konfiguration getrennt. Host bearbeitet, Gäste sehen nur zu. Simulation auf einem aktiven Rennclient, primär Host; nach dessen Rückkehr in die Lobby übernimmt ein aktiver Gast. Bot-Zustände nur vom gewählten Simulationsclient weiterleiten. Kompetitiv bleibt itemfrei, Lokal ohne eigenes Relay.

- Rollen: Anton ist Founder, MrBucks und MrBucks2 initial Head Admins, jeweils an die ursprüngliche Account-ID gebunden. Founder ist geschützt und vergibt Head-Admin-Rechte. Head Admins verwalten nur niedrigere Rollen; normale Admins können keine Admins sperren oder ernennen. Spielerfilter in der geschützten Admin-Konsole nutzt serverseitige Aktivität mit 90-Sekunden-Ablauf. Rollen-Seed-Datei bleibt außerhalb des Projekts im privaten Server-Datenordner.

- Rankings ab 1.1.5: neue Rekorde ausschließlich nach Strecke, Modus und tatsächlichem Fahrzeugmodell vergleichen. Die damalige Legacy-Aufbewahrung wurde mit dem ausdrücklich beauftragten Reset 1.1.6 aufgehoben; gelöschte Zeiten und Legacy-Ansicht nicht wiederherstellen. Rekordbonus gemäß der späteren Regel 1.2.6 nur beim Schlagen eines anderen bisherigen globalen All-time-Ersten derselben Kategorie: 100 je angefangener Sekunde, Maximum 400; erste Zeit, Gleichstand und Verbesserung des eigenen Spitzenrekords ohne Bonus. Auszahlung atomar serverseitig, Save-Requests idempotent halten. Clientgemeldete Zeiten bleiben ohne serverseitige Rennvalidierung manipulierbar.

- Rekordreset 1.1.6: Nutzer hat alle Bestzeiten und die Legacy-Ansicht ausdrücklich löschen lassen. Keine alten Zeiten aus Backups wieder importieren. Andere Kontodaten und Münzen erhalten.

- Boxenstopps 1.1.7: pit-stops.js mitliefern. Keine Straßenmittelstreifen oder Renntribünen auf irgendeiner Grafikstufe. Jede Karte hat eine zugängliche Reparaturbucht. Luckyblock-Motorschaden bleibt bis zu fünf ununterbrochenen Sekunden Stillstand bestehen; Kompetitiv bleibt itemfrei. Positionsquellen und vereinfachte Umsetzung in assets/tracks/SOURCES.md dokumentieren.

- Ladeoptimierung 1.1.8: Alte v1-Lobbybilder und prozedurale Lobbykulissen nicht wieder einbauen. Aktuelle v2-PNGs als Quellen samt Prompts behalten, Laufzeit verwendet die komprimierten WebP-Dateien. Nur benötigte Lobbybilder laden; unbenutzte Kenney-Tribünen/Garagen/Büros nicht erneut bündeln. Personalisierte HTML-Kompression darf Anmeldung oder private/no-store niemals umgehen.

- Quick Play 1.1.9: quick-play.js mitliefern. quickPlay getrennt von Custom-Race-Werten pro Konto speichern; alte Clients erhalten das Feld. Tageswechsel und Wochenwechsel (Montag) in UTC.

- Poly-Optik: stylized.js und assets/materials/stylized samt Quellen/Prompts mitliefern. Alle Grafikstufen nutzen dieselben Poly-Assets; Auflösung, Schatten und Filterung bleiben abgestuft. Keine alten Tribünen oder Mittelstreifen wieder einführen.
- Weihnachten: season.js und beide Weihnachtsbilder samt PNGs, WebP und Prompts sowie assets/vehicles/liveries mitliefern. Aktiv vom 1. bis einschließlich 31. Dezember UTC; normal ab 1. Januar. Die ursprüngliche Regel bezog sich auf eine Christmas-Kartlackierung; seit 1.2.6 ist „Kart-Christmas“ als kostenlose saisonale eigene Bauform geregelt, siehe 1.2.6. Original-Kart und frühere Textur als Rollback-Quelle bleiben erhalten. Auswahl pro Konto, alte Clients bewahren sie.

- Big November Update 1.2.0: kart-models.js, kart-designs.js, ambient.js/.css sowie neue Kartvorschauen und Materialatlas mit PNG/WebP/Prompt mitliefern. Kartdesigns und Ambient-Themes serverseitig atomar kaufen; Besitzerlisten bei alten Clients erhalten. Themes: Level 5/10/20/30, 3000/6000/12000/20000 Münzen, Wechsel kostenlos. Neue Karts bleiben physikalisch Kart-Klasse; Rankings zusätzlich nach tatsächlicher Kart-Bauform trennen. Feste Modelldetails nach Material bündeln. Vor Veröffentlichung alle angeforderten Arbeiten abschließen.

- News 1.2.1: Ankündigungen in release-notes.json unter announcements pflegen. News vereint Ankündigungen, aktuelles Update und Changelog-Archiv. Keine zusätzliche Update-Ankündigung im Hauptmenükopf. Versionsknopf und automatisches Update-Popup bleiben erhalten.

- Admin-Funktionsprüfung bei jedem Update: Neue kontobezogene Funktionen auf administrative Verwaltung prüfen und bei Bedarf Admin-Konsole, serverseitige Rechteprüfung, Revision, Audit und Tests gemeinsam erweitern. Level/XP, Kartdesigns, Ambient-Farben sowie sämtliche aktiven Profil- und Fahrzeugauswahlen sind administrativ verwaltbar. Fehlende neue Felder alter Admin-Clients bewahren; Standardfreischaltungen und unveränderliche IDs erhalten.
- Ambient-Farben ändern GUI-Flächen und den Farbverlauf der Wochenstrecke. Maßgeblich ist die zuletzt ausdrücklich festgelegte Farbzuordnung unter „Menu Colour Fix – 1.2.10“: Hauptmenü-Navigation und vier große Spielbuttons behalten ihre Einzelfarben im Glaslook, die Profilkarte nutzt ihre eigene Profilfarbe; Einstellungen und untere Menükarten bleiben Ambient-abhängig. Dies beschreibt die Gestaltungsvorgabe, keine Veröffentlichung des zurückgezogenen Arbeitsstands.

- Times vereint persönliche Bestzeiten und Top 100 unter einem Menüicon. Modus- und Fahrzeugmodell-Trennung auch für persönliche Zeiten erhalten; alte zurückgesetzte Legacy-Zeiten nicht anzeigen.

- Laden ab 1.2.1: Rennstart wartet auf den aktuellen Texturatlas und benötigte Poly-Kulissen; keine alten prozeduralen Streckentexturen als sichtbarer Zwischenstand. assets/materials/maps/, textures.js und legacy-track-textures.js als ungenutzte Rollback-Reserve in Backups behalten. Einstellungstabs bleiben einzeilig horizontal scrollbar, Auswahlfarben folgen Ambient.

- Nach jedem abgeschlossenen Server-Push einen kopierfertigen deutschen Discord-Update-Log liefern.
- Optik 1.2.2: Straßen, rot-weiße Barrieren und Kartdesigns folgen der weichen Poly-Optik des Lobbybildes. Neue v2-Atlanten samt PNG/WebP/Prompts mitliefern, alte Varianten für Rollbacks erhalten. 3D-Grascode ausschließlich bei hoher Grafik bedarfsgesteuert laden; bei Niedrig/Mittel ausblenden. Keine kleinen Flutlichter am Streckenrand. Einstellungstabs dürfen im Flex-Layout nicht auf Scrollleistenhöhe zusammenschrumpfen.

- Linke Navigation ab 1.2.2: Shop, Times, Missionen, News, Freunde (jeweils lokalisieren).

- Rennwelt 1.2.2: world-style.js und experimental-shaders.js mitliefern. Poly-Natur und Wolken gelten auf allen Grafikstufen; 3D-Gras wird nur auf Hoch geladen. Experimental-Shader ist standardmäßig aus, nur auf Hoch aktivierbar und pro Konto gespeichert; ältere Clients bewahren die Einstellung bei Hoch. Kein Wechsel der Lobbybilder.

- Garage 1.2.3: garage.js, gt3-extra.js, fünf neue GT3-Vorschauen und server/test_garage.py mitliefern. Customizer kostete bis 1.2.5 einmalig 2500 Münzen (ab 1.2.6: 15000), Käufe atomar serverseitig; eigene Farbe und bis zu acht Farbspeicher an Account-ID binden. Neue Fahrzeuge in Bots und Rankings berücksichtigen. Admin verwaltet Customizer, Farben und Fahrzeuge mit Revision/Rechteprüfung/Audit. Entzug setzt Lackmodus auf Standard; alte Clients bewahren neue Freischaltungen.

- Quick Patch 1.2.4: kart-tracks.js, cockpit.js, progression.js, assets/progression/catalog.json, winter.js, developer.js, server/progression.py, server/devtools.py und Tests mitliefern. Neue Kartkurse in Bots, Quick Play, Privacy und Rankings berücksichtigen. Missionen und Levelbelohnungen gemeinsam katalogisieren; Admin verwaltet abgeholte Belohnungen mit Revision/Audit.
- Weihnachtsrennen: generierten winter-surfaces-v1-Atlas samt PNG/WebP/Prompt erhalten und nur für winterliche Außenrennen laden. Schnee auf Straßen/Gelände, dekorierte Tannen, leichter Schneefall und begrenzter Reifenspuren-Pool; Indoor bleibt schneefrei. Saison 1.–31. Dezember UTC, Fahrphysik unverändert.
- Entwicklerrechte ergänzen Adminrollen: ursprüngliche IDs von Anton und MrBucks2 als Developer, MrBucks als Main Dev. Einmalige private developer-seeds.json außerhalb des Projekts. Nur Main Dev verwaltet Developer; Main Dev ist in dieser Verwaltung geschützt. Weihnachtsvorschau und Christmas-Kart serverseitig pro berechtigtem Konto prüfen, Änderungen protokollieren und beim Entzug Vorschau zurücksetzen. Keine lokale Rechtefreigabe.
- Branding 1.2.4: bereitgestelltes Grand-Poly-Logo samt Original unter assets/branding/ behalten; Login und Browser-Icons verwenden komprimierte Ableitungen. Auf Wunsch kein Logo im Hauptmenükopf. Nur benötigte öffentliche Branding-Dateien ohne Account ausliefern.

- Quick Patch 1.2.5: race-ready.js, lobby-vote.js und test-lobby.cjs mitliefern. Lokal/Web starten erst nach geladenem ersten Bild und manueller Bereitschaft aller menschlichen Fahrer; Host verteilt gemeinsamen Startzeitpunkt. Abbruch vor Grün beendet die Startfreigabe für alle, jede Runde beginnt unbestätigt. Historisch: Lobby-Protokoll 2 in 1.2.5, 3 in 1.2.6, 4 in 1.2.7 und 5 in 1.2.8; 1.2.9/1.2.10 verwenden 6, sind aber zurückgezogen. Inkompatible Protokollversionen ablehnen; dokumentierter Live-Stand siehe „Einstieg für den nächsten Chat“. Host wechselt Strecke oder lässt alle Menschen über 2–3 Strecken abstimmen; Gleichstand zufällig. Bots-Schalter nur beim Host.
- Multiplayer-Bild 1.2.5: tatsächlicher circuit-Start als leicht verfeinerte schräge Vogelperspektive, ohne Tor/Garage und ohne Experimental-Shader; passende Weihnachtsvariante. multiplayer-grid-v2 und multiplayer-grid-christmas-v2 als PNG/WebP samt track-reference-v2.png und prompts-grid-v2.md erhalten. Sieben Fahrzeugplätze der Fahrbahn und dem Bildausschnitt folgen lassen; alle Grafikstufen dasselbe Bild. Einzelspieler und Login unverändert. Stimmen/Bereitschaft bleiben flüchtige Lobbydaten, keine neuen Kontorechte.

- Versionswechsel: updates.js, release-notes.json und server/social.py gemeinsam aktualisieren. test_social prüft, dass der serverseitige Gelesen-Marker der aktuellen UI-Version entspricht.


## Friday the 13th – 1.2.6
- Rennlogik: racing.js, vehicle-geometry.js, track-terrain.js, bot-driving.js, race-hud.js und assets/tracks/race-rules.json mitliefern. Beschleunigungsboni verändern nicht die Höchstgeschwindigkeit. Runden benötigen geordnete Kontrollpunkte, plausible Bewegung und Mindestdauer aus der tatsächlichen spielinternen Streckenlänge. Client- und Serverprüfung bleiben ohne autoritative Rennsimulation kein vollständiger Cheat-Schutz. Vorhandene unplausible Zeiten nicht löschen; aus Wertung/Bonus ausschließen.
- Gelände: monaco-scenery.js nur bei Monaco laden. Fahrbahn und Gelände folgen derselben lokalen Höhenberechnung. Monaco nutzt vereinfachte selbst erstellte Stadt-/Hafen-Kulissen, keine exakten GIS-Gebäude. GT3-Geometrie bleibt selbst erstellt; offizielle Referenzfotos sind keine mitgelieferten Fahrzeugassets.
- Bots: individuelle Brems-/Linien-/Überholprofile, begrenzte Geschwindigkeiten und fünf Sekunden durchgehender Stillstand zur Reparatur. Nichtlokale Botzustände nur vom gewählten Simulationsclient übernehmen. Lobby-Protokoll 3 galt für 1.2.6; spätere Versionen siehe Protokollverlauf unter 1.2.5. Inkompatible Protokollversionen ablehnen.
- Einstellungen: rearIndicator pro Konto erhalten, neue Texte DE/EN/FR. Pause unterbricht Motor, Effekte und Musik. Reset startet das aktuelle Rennen mit derselben Konfiguration neu; Mehrspieler nur durch Host und erneute Bereitschaft aller Fahrer. Backspace fragt nach dem Verlassen.
- Rankings: Saison/All time getrennt, weiterhin Strecke + Modus + tatsächliches Fahrzeugmodell. Am 1. Dezember 2026 UTC einmaliger automatischer Saisonwechsel, weitere Wechsel durch geschützte Adminaktion mit Audit und Generationsprüfung. Spät eintreffende Runden der alten Saison nicht übernehmen. All-time-Daten bleiben erhalten. Eigene bestehende globale Bestzeit zu verbessern gibt keine Münzen; Bonus nur beim Schlagen eines anderen bisherigen globalen All-time-Ersten in derselben Kategorie. Keine zusätzliche doppelte Saison-Auszahlung.
- Web-Lobbys: Admins können freie Plätze regulär belegen oder auch volle/laufende Rennen beobachten. Zuschauer belegen keinen Fahrerplatz, stimmen nicht ab, bestätigen keine Bereitschaft, simulieren keine Bots und verdienen keine Belohnungen. Server prüft Beobachterrechte beim Beitritt und Polling; Beobachterzugänge protokollieren. Lokale Lobbys bleiben unabhängig.
- Custom Colour kostet 15000 Münzen. server/customizer_refund.py führt die einmalige Migration customizer-price-15000-v1 aus: bisherigen Besitz entziehen, Lackmodus auf Standard, frühere Käufe mit 2500 Münzen erstatten. Explizite Admin-Geschenke nicht erstatten. Vor 1.2.6 fehlen separate Kaufbelege; ohne gegenteiligen Audit-Nachweis wird bestehender Besitz als früherer Kauf behandelt. Ledger niemals für erneute Auszahlung löschen; übrige Kontodaten/Farbspeicher erhalten.
- Kart-Christmas ist eine kostenlose saisonale eigene Bauform mit Schlittenkörper, Kufen, Geschenken und Weihnachtsmütze; normale Kartphysik. Eigene Ranking-Kategorie kart-christmas. Außerhalb 1.–31. Dezember UTC nur über berechtigte serverseitige Entwicklervorschau aktiv; sonst Original anzeigen. Generierte christmas-sleigh-v2 PNG/WebP/Prompt und Vorschau mitliefern, vorherige Textur für Rollbacks behalten. Weihnachtsmaterial vor dem ersten Rennbild laden.
- Neue Verwaltungsfunktionen: Saisonwechsel, Zuschauerzugang und Christmas-Bauform gemeinsam mit Rechten, Audit, Inventarvalidierung und Tests pflegen. Admin-/Developer-Schaltflächen müssen auf schmalen Displays Abstand behalten.
- Prüfungen: node test-racing.cjs und node test-lobby.cjs; Python-Tests einschließlich test_release_126.py und test_release_126_http.py. In changelog.md nur tatsächlich ausgeführte Prüfungen nennen. Private Kontodaten, Schlüssel, Testdatenbanken und .work nicht veröffentlichen. Server-Datenbank vor Migration separat privat sichern; alte Software allein macht Datenmigrationen nicht rückgängig.


## Einstieg für den nächsten Chat
- Zuletzt dokumentierter Live-Stand nach Nutzer-Rollback vom 15.11.2026: 1.2.8, Lobbyprotokoll 5. Root-Arbeitsstand 1.2.10 ist zurückgezogen und nicht zur erneuten Veröffentlichung freigegeben. Vor Entwicklungs- oder Serverarbeiten changelog.md, Git-Stand und den für den Auftrag relevanten tatsächlichen Serverstand prüfen; ältere Aufträge nicht blind erneut ausführen. Die lokale Versionsnummer ist kein Live-Nachweis.
- Dokumentierter Archivstand nach der Verschiebung vom 15.11.2026: Backups/Kart Racer 1.2.8; BrokenVersions/Kart Racer 1.2.9 und BrokenVersions/Kart Racer 1.2.10. BrokenVersions dauerhaft unverändert erhalten und weder in die Drei-Versionen-Bereinigung noch in Builds aufnehmen. Vollständiger Verlauf in release-notes.json, ältere 1.2.7-Kandidaten unter buildHistory. Frühere Backup-Aufzählungen sind historische Bestände; der damalige Zusatz -release bezeichnete weiterhin Spielversion 1.2.7.
- Uncommittete Änderungen im Arbeitsordner erhalten. Ein Server-Push ist kein GitHub-Push; vor einer GitHub-Veröffentlichung die aktuelle Nutzerfreigabe beachten. Keine Zugangsdaten in Repository, Changelog oder Chat kopieren.
- Die letzten Tests und bekannten Grenzen stehen in changelog.md. TURN ist weiterhin nur vorbereitet. Keine Wiederherstellung alter Bestzeiten oder erneute Custom-Colour-Rückerstattung durchführen.
- Bei einem neuen Update Versionsmarker in updates.js, release-notes.json und server/social.py synchronisieren; Admin-Verwaltbarkeit prüfen; DE/EN/FR pflegen; genau ein vollständiges neues Backup erstellen und auf die neuesten drei begrenzen. Nach erfolgreichem Server-Push deutschen Discord-Text liefern.

- Renn-Bildschritte immer auf 0 bis 0,05 Sekunden begrenzen: Nach langem Aufbau kann der erste requestAnimationFrame-Zeitstempel älter als der Initialisierungszeitpunkt sein. Zuschauer-Kamera bei Zielwechsel/Positionssprung neu ansetzen, keine eigene Kollision/Lenkung oder irreführenden eigenen Rundenanzeigen.


## Tuning-Update – 1.2.7
- Admin-Konsole und Entwicklermodus in den Kontoeinstellungen untereinander anordnen.
- clipboard.js in jeden Build aufnehmen. Alle Copy-Bedienelemente nutzen dessen kurz eingeblendete Meldung am unteren Bildschirmrand, mit DE/EN/FR und prefers-reduced-motion. Keine dauerhafte Copy-Statuszeile im Konto oder in der Lobby.
- Die UI-Korrekturen allein ändern keine Kontorechte; Tutorial-/Tuning-Felder und deren Adminverwaltung siehe unten.
- Serververöffentlichung von 1.2.7 wurde am 14.11.2026 ausdrücklich beauftragt.
## The tuning-update – 1.2.7
- Exakter Name: „The tuning-update“, Version 1.2.7. UI, Tutorial und Tuning gemeinsam paketieren. Serverseitige Kaufroute /api/account/buy-upgrade muss auch in der POST-Freigabeliste stehen; test_release_127_http.py mitliefern.
- clipboard.js: Admin-/Developer-Schaltflächen übereinander; alle Copy-Bedienelemente zeigen eine kurze Meldung von unten, DE/EN/FR und reduced motion.
- tutorial.js, tutorial-rules.js, tutorial-race.js, tutorial.css, assets/tutorial/catalog.json, server/tutorial.py und Tests mitliefern. Original-Kart auf circuit; zehn Kapitel/49 Aufgaben; nur reale Spielmechaniken. Tutorialfortschritt kontogebunden, keine Rennbelohnungen/Rekorde und keine Zufallssteuerung außerhalb des Tutorials. Einstieg/Wiederholung in Einstellungen → Steuerung, kein neues linkes Icon.
- tuning-data.js, tuning-stats.js, tuning-visuals.js, tuning.js, tuning.css, assets/tuning/, server/tuning.py, server/tuning-prices.json, run_unit_tests.py und Tests mitliefern. Acht Teile/drei Stufen pro Fahrzeug. Preise serverseitig, Käufe atomar mit Besitz/Reihenfolge/Revision/Münzen; Duplikate ohne zweite Zahlung. Alte Clients bewahren Upgrades. Entzogene Fahrzeuge behalten ungenutzte Teile. Admin verwaltet Stufen und Tutorial mit Revision, Rechten und Audit.
- carStats liefert Serienwerte unverändert; Motor verändert nicht die Topspeed-Grenze. Kompetitiv/Tutorial immer Serie, Bots ohne Tuning. Online-Hostoption standardmäßig aus, wirkungslos in Kompetitiv. Getunte Einzelrennen und Online-Räume mit Tuning schreiben keinerlei Bestzeiten/Rankings/Rekordboni. Lobby-Protokoll für 1.2.7: 4; ab 1.2.8 gemeinsame Serienfahrwerte gemäß „Fair Play & Quick Play“ und dessen Protokoll 5 beachten.
- Werkstattgeometrie ausschließlich selbst gebaut, pro Teil/Material bündeln; nur bei Benutzung erzeugen, beim Schließen dispose. Geteilte Lenkradmaterialien schützen. Low ohne Transparenzschichten, reduced motion ohne Kamerafahrten/Rotation/Einbauanimation. Sichtbare Anbauteile ändern keine Hitbox oder Radposition.
- Prüfstandsmessungen stehen in assets/tuning/validation.json; Offline-Streckenberechnung nicht als gefahrenen Browserlauf ausgeben. Tatsächliche Browser-/HTTP-Prüfungen und verbleibende Grenzen stehen im aktuellen changelog.md. Vor Live-Migration private Datenbank separat sichern. Keine GitHub-Veröffentlichung ohne Nutzerfreigabe.

- Automatisches Update-Popup prüft nach asynchronem Laden erneut, dass kein anderer Dialog, keine Lobbyaktion und kein Rennen aktiv ist; Tutorialangebot niemals überdecken.

## Gemeinsame Upload-Regel außerhalb des Projekts
Vor jedem Server-Upload `../UPLOAD-REGELN-KART-RACER.md` lesen und anwenden (lokal: `C:\Users\phils\Documents\ChatGPT\Server Access\UPLOAD-REGELN-KART-RACER.md`). Die Anleitung enthält Zugangsermittlung ohne Offenlegung, Netzwerkfehler-Prüfung, Staging, private Datenbanksicherung, atomare Veröffentlichung, Live-Prüfung und Backup-Regeln. Sie bleibt außerhalb des Repositories. Fehlt sie auf einem anderen Gerät, die aktuelle Nutzeranweisung und diese Projektregeln anwenden und den fehlenden Leitfaden offen benennen; keine Zugangsdaten oder Serverpfade erfinden. Server-Push ist kein GitHub-Push.

## Fair Play & Quick Play – 1.2.8
- Unter 20 s: record_reviews bewahrt pending/approved/rejected; keine automatische oder eigene Freigabe. Adminentscheidung, Ranglistenänderung, Münzen und Audit in einer Transaktion; Idempotenz und Saison beachten. Rennzählung unverändert.
- Multiplayer-Serienwerte aus KartTuningStats.roomStats, Bots verwenden dieselbe Quelle. Optische Klasse getrennt von Host-Raumphysik, keine Client-Stats übernehmen; Protokoll 5. Keine autoritative Simulation behaupten.
- Quick-Play-Entwurf mit expliziter Cloud-Speicherung; Wochenrennen mit eigenen Startwerten. Update-Popup prüft auch sheetWrap.

## Helmets & Alpine Roads – 1.2.9

Status: zurückgezogener Release-Stand, seit dem Rollback nicht live. Die folgenden Funktionsvorgaben dokumentieren 1.2.9; sie sind kein Auftrag zur erneuten Veröffentlichung oder automatischen Übernahme in 1.2.8.
- helmet-data.js, helmet.js/.css, server/helmets.py und assets/helmets inklusive PNG/WebP/Prompts mitliefern. Bounded Malbefehle streng prüfen; ungültige Peers nutzen Standard. Persönlicher Helm ist Profilidentität, rein kosmetisch; alte Clients bewahren ihn. Admin-Reset mit Revision/Rechten/Audit. Weihnachtshelm saisonal oder berechtigte Vorschau. Neue Helm-Materialien nicht durch alte Kunsttexturen überschreiben.
- Einladungs-Popup in Ambient-Farbe: Annehmen verbindet direkt, Ablehnen entfernt die Einladung. Während Rennen/Lobby/anderen Dialogen warten. Keine privaten Kontodaten in Popups.
- Öffentlicher Zuschauermodus bei Lokal/Web-Beitritt; keine Fahrerplätze, Votes, Ready, Bots oder Belohnungen. Maximal 16 Zuschauer. Separater Admin-watch-Zugang bleibt geschützt. Lobbyprotokoll 6.
- Historische Farbregel von 1.2.9: alle Buttons als Ambient-Glasflächen. Für Hauptmenü-Navigation, vier große Spielbuttons und Profilkarte ausdrücklich durch „Menu Colour Fix – 1.2.10“ ersetzt; diese Elemente dürfen nicht pauschal Ambient-Farben übernehmen. Icon-Motive und Farbmuster bleiben unverändert.
- Monaco hat grünes Gelände und warme Fassaden, Schnee nur saisonal. Hairpin Heights ist ein neuer fiktiver Alpenkurs; Höhen/Geometrie und race-rules.json gemeinsam pflegen. Alte Zeiten nicht heimlich löschen.
- Upgrade-Rückerstattung: server/tuning_refund.py und tuning-prices-1.2.7.json mitliefern. Einmaliges Ledger upgrade-reset-prices-129-v1 niemals löschen. Bestandsupgrades entfernen, bisherige Stufenpreise erstatten, explizite Admin-Geschenke ausschließen; Annahme mangels alter Einzelbelege dokumentieren. Neue Käufe protokollieren. Vor Live-Migration neue private DB-Sicherung.
- Prüfungen/Restgrenzen im changelog.md; test-helmet-ui.cjs, test-online-helmet.cjs, test-invites-ui.cjs und server/test_release_129.py mitliefern. Keine vollständigen Balancefahrten behaupten.


## Historischer Veröffentlichungsnachweis 1.2.9 — 14.11.2026
- Am 14.11.2026 wurde 1.2.9 „Helmets & Alpine Roads“ auf dem Spielserver aktiviert; seit dem Rollback vom 15.11.2026 nicht mehr live; private SQLite-Sicherung vor der Migration und Integritätsprüfung erfolgreich. 275 Paketdateien in Staging per SHA-256 geprüft, dort 99 Servertests bestanden. Keine GitHub-Veröffentlichung.
- Upgrade-Migration einmalig durchgeführt: 2 Konten, insgesamt 3470 Münzen erstattet; bestehende Account-IDs erhalten. Migrationsledger niemals löschen oder Auszahlung erneut auslösen.
- Öffentliches HTTPS: Version/Changelog und Login-Datei entsprechen dem geprüften Paket; Spielassets ohne Spielkonto gesperrt, private/no-store erhalten. Live-Anmeldung, Helm zeichnen/speichern/neuladen, ungültige Daten abweisen, GT3-Menüglas und 8 Helm-WebPs erfolgreich geprüft.
- Zwei vorherige Browserläufe blieben beim Laden hängen; dokumentierte HTTP-502-Antworten für account-store.js und season.js. Abschließender Lauf mit Wiederholungsmöglichkeit für Dateiabrufe erfolgreich. Ursache der sporadischen 502 nicht nachgewiesen oder als behoben behaupten.
- Sämtliche eigens angelegten Live-QA-Konten gezielt entfernt; lokaler Testserver beendet. Damals behaltene Backups: 1.2.7-release, 1.2.8, 1.2.9; das unveränderte Paket 1.2.9 liegt seit dem 15.11.2026 unter BrokenVersions/Kart Racer 1.2.9.
- Dieser nachträgliche Veröffentlichungsnachweis steht in den Arbeitsdateien. Unveränderliches Serverrelease und Backup nicht dafür überschreiben. Vor künftigen Arbeiten tatsächlichen Serverstand erneut prüfen.


## Menu Colour Fix – 1.2.10

Status: zurückgezogener Release-Stand, seit dem Rollback nicht live. Die folgende ausdrücklich korrigierte Farbzuordnung ersetzt die widersprechende Farbregel aus 1.2.9; sie erteilt keine erneute Veröffentlichungsfreigabe.
- Aktuelle Nutzerkorrektur hat Vorrang: Hauptmenü-Navigation und vier große Spielbuttons behalten ihre ursprünglichen Einzelfarben bei transparentem Glaslook. Profilkarte nutzt ausschließlich die separat gekaufte/gewählte Profilfarbe. Einstellungen und untere Menükarten bleiben Ambient-abhängig. Keine neuen Accountrechte.
- Die damalige Veröffentlichung wurde am 14.11.2026 ausgeführt und am 15.11.2026 durch den Nutzer-Rollback abgelöst. Kein offener Auftrag zur erneuten Veröffentlichung. Aktueller dokumentierter Live- und Archivstand siehe „Einstieg für den nächsten Chat“.


## Historischer Veröffentlichungsnachweis 1.2.10 — 14.11.2026
- Serverrelease 1.2.10 war am 14.11.2026 aktiv; seit dem Rollback vom 15.11.2026 nicht mehr live. 275 Dateien geprüft, elf test_social-Tests lokal und in Staging bestanden. Browser-CSS-Prüfung über fünf Ambient-Themes und sechs Profilfarben bestanden. Öffentliche HTTPS-Version, Login, autorisierte HTML-/CSS-Auslieferung und private Caching-Header bestätigt.
- Private Datenbanksicherung und Integrität erfolgreich; IDs und Rückerstattungsledger unverändert. Eigenes Live-QA-Konto entfernt. Keine GitHub-Veröffentlichung.
- Damals behaltene Backups: 1.2.8, 1.2.9, 1.2.10. Das unveränderte veröffentlichte Paket 1.2.10 liegt seit dem 15.11.2026 unter BrokenVersions/Kart Racer 1.2.10; dieser nachträgliche Nachweis bleibt in den Arbeitsdokumenten.


## Rollback beauftragt und aktiviert — 15.11.2026
- Nutzer meldete die Website als nicht richtig ladend und verlangte ausdrücklich Version 1.2.8. Live wurde von 1.2.10 auf das unveränderte Backup 1.2.8 zurückgeschaltet. Keine neue Versionsnummer: ausdrücklich gewünschter Rollback. Vorhandenes Backup 1.2.8 unverändert wiederverwendet, nicht überschrieben.
- 254 Dateien per Prüfsumme geprüft. Aktuelle Datenbank vor Umschaltung separat privat gesichert; Start von 1.2.8 zuerst auf privater Kopie geprüft, Profile dabei unverändert. Keine alte Datenbank zurückgespielt; IDs und Rückerstattungsledger erhalten, Integrität OK. Keine Rückerstattung wiederholen.
- Öffentliche HTTPS-Version und Login-Datei entsprechen Backup 1.2.8; Anmeldeschutz geprüft. Weitergehende Browserprüfung siehe nachfolgenden Abschluss.
- Root-Arbeitsdateien bleiben zur Fehlersuche auf 1.2.10 und dürfen NICHT als aktuell freigegebenes Live-Release erneut veröffentlicht werden. Live: 1.2.8, Lobbyprotokoll 5. Vor weiterer Entwicklung zuerst tatsächlichen Stand und neue Nutzeranweisung prüfen. Unmittelbar nach dem Rollback lagen 1.2.8, 1.2.9 und 1.2.10 in Backups; anschließend wurden 1.2.9 und 1.2.10 ins Diagnosearchiv verschoben, siehe nächster Abschnitt.

- Rollback-Abschlussprüfung: echte öffentliche Anmeldung, initialisiertes Spiel, gerendertes Fahrzeug und sichtbare Einstellungstabs bestätigt. Erster Einstellungsversuch vom automatisch geöffneten Tutorial verdeckt; nach Überspringen bestanden. Beim zweiten Lauf wurden drei HTTP-502-Abrufe wiederholt (account-store.js, assets.js, Lobby-WebP); das Ladeproblem ist daher durch Rollback nicht als behoben nachgewiesen. Alle UI-Assertions bestanden; der Browserrunner meldete beim Schließen einen separaten noch laufenden route.fetch/TargetClosedError (kein fehlerfreier Runner-Gesamtlauf behaupten). Beide eigenen QA-Konten entfernt, Datenbankintegrität OK.


## Diagnosearchiv BrokenVersions — 15.11.2026
- Auf Nutzerwunsch die vollständigen unveränderten Release-Backups 1.2.9 und 1.2.10 nach `BrokenVersions/Kart Racer 1.2.9` und `BrokenVersions/Kart Racer 1.2.10` verschoben. Je 275 Dateien vor/nach Verschieben per SHA-256 identisch geprüft.
- Dieses Diagnosearchiv dauerhaft erhalten: nicht durch die Drei-Versionen-Aufräumregel löschen, nicht in neue Builds oder Serveruploads aufnehmen und nicht versehentlich erneut veröffentlichen. BrokenVersions ist wie Backups in .gitignore ausgeschlossen.
- In Backups bleibt aktuell Kart Racer 1.2.8. Live bleibt 1.2.8; Root-Arbeitsdateien unverändert auf dem zurückgezogenen neueren Stand. Reine Archivorganisation, kein neues Spielrelease oder Server-Push. Die Archivbezeichnung beweist keine Fehlerursache; sporadische HTTP 502 wurden auch mit 1.2.8 beobachtet.

## Aktueller lokaler Performance-Kandidat 1.2.8P — 15.11.2026
- Aktuelle Arbeitsdateien sind jetzt auf Basis 1.2.8 zu 1.2.8P weiterentwickelt. Frühere Aussagen „Root weiterhin 1.2.10“ beschreiben den historischen Rollback-Stand. Kein Upload beauftragt oder erfolgt; Live bleibt 1.2.8, Lobbyprotokoll 5. Diagnosearchive unverändert erhalten.
- Performance-Punkte 1–5 umgesetzt, Punkt 6 ausdrücklich ausgeschlossen. Keine Änderung an Lobby-Renderloop, Schatten oder Auflösung. Details/Prüfgrenzen in changelog.md.
- Build vor Test/Paket: node build-client.cjs. game-shell.html, game.js, network-runtime.js, localization.js, startup-*.js, assets.js, boot.js, optional-ui.js, social-cache.js, bundle-manifest.json, build-client.cjs sowie erzeugte assets/boot.js und assets/bundles/*.js mitliefern. test-performance.cjs/.py und server/test_performance_http.py mitliefern.
- HTTP-Tests auf Windows über server/run_unit_tests.py ausführen (GC vor Entfernen temporärer Datenbanken).
- Weitere Serverbereinigung nur nach Nutzerauftrag; Datenbank, WAL/SHM und private Rollen-/Seed-Dateien nicht als alte Versionsdateien behandeln. 502-Ursache nicht bewiesen.
