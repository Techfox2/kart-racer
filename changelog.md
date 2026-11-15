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

# 1.2.10 – Upgrades & Fair Racing, 15.11.2026

Status zum Paketbau: lokal umgesetzt und geprüft. Der letzte Nutzerauftrag erlaubt ausdrücklich den Server-Upload als 1.2.10 und ersetzt das frühere Uploadverbot. Veröffentlichung steht zum Paketbau noch aus; der anschließende Live-Nachweis wird separat dokumentiert. Kein GitHub-Push.

## Änderungen

- Gekaufte Upgrades werden nach abgeschlossenem Kontorefresh vor jedem Rennen aus einem unveränderlichen Spielstand berechnet. Alle acht Stufen erreichen die tatsächlich verwendeten Fahrzeugwerte. Motor, Topspeed, Getriebe, Reifen, Lenkreaktion, Bremsen und Abtrieb erhalten 10 % je Stufe; Gewichtsreduktion 3 % je Stufe, mit passenden Nebeneffekten und erweiterten Grenzen. Kaufpreise bleiben erhalten. Bots übernehmen keine Spieler-Upgrades und passen ihre Grundwerte nicht an den Spieler an.
- „Upgrades erlaubt“ ist unabhängig von Kompetitiv und Lucky Blocks. Einzelspieler und Schnellstart speichern den Schalter im Konto, online entscheidet der Host. Ein ausgeschalteter Schalter deaktiviert die Wirkung, nicht den gespeicherten Besitz. Ein Wechsel gilt für den nächsten Rennstart.
- Aufklappbare Live-Fahrwerte zeigen Tempo, Basis-Topspeed, aktuelles Geschwindigkeitslimit, echte Beschleunigung, Grip, Lenkreaktion und alle acht aktiven/gekauften Stufen. Diagnose zusätzlich unter window.KartRaceDebug.current und beim Rennstart in der Konsole. DE/EN/FR, Desktop und Mobilansicht geprüft.
- Grasberührung entwertet vollständige Rundenzeiten auch für die Bestenliste nicht mehr. Geordnete Sektoren und die tatsächliche gerichtete Ziellinienüberquerung bleiben erforderlich; Positionssprünge und reines Pendeln zählen nicht. Die bestehende Trennung zwischen Serien-Bestenlisten und getunten Rennen bleibt erhalten.
- Richtungspfeile verwenden die tatsächliche Kamerarechtsrichtung. Entfernungen werden für alle aktiven Gegner vor und hinter dem Fahrer angezeigt, auch wenn der Fahrer vorne liegt.
- Mehrspieler-Lobbys starten standardmäßig mit genau einer Klasse: Kart oder GT3. Der Host kann beim Erstellen Gemischt wählen oder gemischte Klassen im Lobby-Menü umschalten. Beitritt, Fahrzeugwechsel und Rennstart werden sowohl durch den Webserver als auch den Host geprüft. Gäste dürfen keine Klassenregeln ändern. Nach Abschalten gemischter Klassen bleibt der Start gesperrt, bis jeder eine passende Klasse gewählt hat. Gesperrte Klassen sind in der Auswahl deaktiviert. Laufende Rennen behalten ihre gestarteten Regeln.
- Im gemischten Rennen benutzt jeder Fahrer seine eigene Fahrzeugklasse und deren Upgrades. Der Host ersetzt gefälschte Klassen-/Modellangaben in Rennpaketen durch die zugelassene Auswahl. Lobbyprotokoll 8 erfordert neu geladene Clients.
- Entfernte Autos übernehmen Höhe, Neigung und Rollwinkel aus dem synchronisierten Fahrzeugzustand. Die empfangene Höhe wird nicht mehr mit einer unabhängig berechneten Straßenprojektion überschrieben; das beseitigt die hier gefundene Ursache schwebender Autos an unterschiedlichen Streckenebenen.

## Ausgeführte lokale Prüfungen

- 96 Python-Modultests bestanden. Drei echte HTTP-Tests bestanden: private Bundles, Adminrouten sowie Klassenregeln einschließlich Beitritt, Klassenwechsel, Hostrechten und Startblockade. Tests ausschließlich mit isolierten Datenbanken.
- test-upgrades1210.cjs, test-classes1210.cjs, test-host-classes1210.cjs, test-fixes129b.cjs, test-racing.cjs, test-race-finish.cjs und test-lobby.cjs bestanden. Direkter Hosttest weist falsche Klassen und gefälschte Gastregeln zurück und bereinigt Rennpakete.
- test-tuning.cjs --report: 325 Längsdynamikmessungen, 676 Werkstattmodelle und 39 Streckenhüllenvergleiche bestanden. Berechneter maximaler Rundenvorteil ca. 22,16–22,53 %; dies ist eine Abschätzung und kein gefahrener Streckenvergleich.
- test-upgrades1210-browser.cjs: echte Käufe aller acht Kart-Upgrades bis Stufe 3, Login in neuem Browserkontext, Rennneustart, gespeicherte Schalter in beiden Modi, Livewerte und alle drei Sprachen bestanden. Kontrollierter Einsekundenlauf mit der produktiven update-Funktion: Serie 10,016 m / 18,081 m/s; Stufe 3 15,429 m / 27,539 m/s. Lenkvergleich bei gleichem Tempo: 0,380 gegenüber 0,536 rad. Dieser kontrollierte Test ist kein vollständig gefahrenes Rennen.
- test-grass1210-browser.cjs: vollständige Circuit-Runde mit gewöhnlichen Lenkeingaben, ohne Teleport oder Zeitbeschleunigung. 128 Grasframes; Rundenzeit 94,036 s gespeichert und als 94036 ms auf Rang 1 der isolierten Serien-Bestenliste abgerufen. Genau ein Ergebnis und eine Belohnung.
- test-multiplayer1210.cjs: zwei echte Browserclients mit Web-Lobby/WebRTC; Standardklasse, gemischter Beitritt, Gastrechte, Startblockade nach Abschalten gemischter Klassen, anschließender Klassenwechsel bestanden. Vier Rennen prüfen Kompetitiv/Lucky Blocks jeweils mit Upgrades an/aus. Zusätzlich gemischtes Kart-/GT3-Rennen mit eigenen Fahrzeugwerten, übereinstimmender Remote-Höhe und Neigung auf beiden Clients bestanden. Keine JavaScript-Ausnahmen. Der frühere test-tuning129b-online.cjs ruft jetzt diese aktuelle Regression auf.
- Screenshots für Telemetrie/Abstandsanzeige auf Desktop und Mobilgerät sowie beide Mehrspieleransichten und Gras-Zieleinlauf visuell geprüft. Lokale Testserver werden durch den Runner beendet.

## Grenzen und Veröffentlichung

- Ohne weitere Nutzeranweisung bleibt die vorhandene Regel bestehen: getunte Rennen liefern keine Serien-Bestenlistenrekorde; auch Online-Lobbys mit erlaubten Upgrades sind ausgeschlossen. Gras allein verhindert einen ansonsten gültigen Rekord nicht.
- Keine vollständige Balance-Testfahrt aller Fahrzeuge auf allen Strecken und keine Garantie für beliebige Internet-/VPN-Verbindungen. Klassenregeln werden durch Server/Host geprüft; dies ist keine neue serverautorisierte Physik oder vollständiger Anti-Cheat.
- Genau ein neues vollständiges Backup: ../Backups/Kart Racer 1.2.10-upgrades-racing. Das bereits vorhandene historische 1.2.10-Paket bleibt unverändert. Frühere Backups erhalten. Zugangsdaten, .work, Datenbanken und lokale Testartefakte gehören nicht in das Release.
- Der Server stand vor Veröffentlichung nachweislich auf 1.2.9B. Upload nur über getrenntes Staging, Prüfsummen, private SQLite-Sicherung, verlustfreie Initialisierungsprüfung und atomaren Releasewechsel. Live-Nachweise anschließend unter ../Rest/Organisation/*1210-result.json.

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

# 1.2.9B – Race Fixes, 15.11.2026

Status: lokal umgesetzt und geprüft; Serververöffentlichung ausdrücklich beauftragt, aber noch NICHT erfolgt. Der Ausführungskontext kann C:/Users/phils/.ssh nicht lesen (Zugriff verweigert). Der Alias kartracer-game wird deshalb hier nicht aus der eingerichteten Konfiguration geladen; der SSH-Versuch meldete Namensauflösungsfehler. Das beweist keinen defekten Server oder Schlüssel. Keine Serverdateien, Konten oder Dienste verändert; aktueller Live-Stand in diesem Auftrag nicht verifiziert. Keine GitHub-Veröffentlichung.

## Änderungen

- Rennfortschritt bleibt bei kontinuierlichen Gras-Abkürzungen erhalten, auch wenn die nächste Streckenposition mehrere Sektoren weiter liegt oder die zugeordnete Fahrbahnhöhe springt. Zuvor setzte diese Projektionsänderung die Runde zurück. Geordnete Sektoren bleiben erforderlich; echte Positionssprünge werden weiterhin abgewiesen.
- Zielüberquerungen verwenden die tatsächlichen Positionen beiderseits der Ziellinie und die Streckentangente. Die erste Startüberquerung zählt nicht. Rückwärtsüberquerung zieht eine gewertete Runde ab, mindestens null. Erneutes Vorwärtskreuzen stellt sie nicht wieder her; erst eine neue Umrundung zählt. Die strengere Rekordprüfung bleibt getrennt.
- Vor jedem Rennaufbau ausstehende Kontospeicherung abschließen und aktuellen Spielstand abrufen. Fehler oder Abbruch starten kein Rennen mit stillschweigend veralteten Upgrades. Fahrzeugwerte werden pro Rennen aus dem geladenen Besitz berechnet und als unveränderlicher Satz verwendet.
- Mehrspieler überschreibt freigegebene Upgrades nicht mehr pauschal mit roomStats. Die gemeinsame Raumklasse bleibt die physikalische Basis; gekaufte Effekte des tatsächlich verwendeten Fahrzeugs werden darauf angewendet. Beschleunigung, Topspeed, Grip und Lenkreaktion erreichen die Fahrsimulation. Kompetitiv bleibt Serie; online entscheidet die Host-Freigabe. Getunte Rennen bleiben von Rekorden ausgeschlossen.
- Lobbyprotokoll 7 verhindert die Mischung mit älteren Clients, deren Tuningphysik abweicht.
- GT3-Instrument tiefer und seitlich vor das Armaturenbrett versetzt, Blickpunkt leicht erhöht. HUD-Tacho im Cockpit rechts unten; Kameraknopf mit Abstand darüber, auch auf schmalen Ansichten. Speed zeigt den tatsächlichen vorzeichenbehafteten Wert in m/s; Max zeigt die Basis-Topspeed nach Upgrades (ohne temporäre Items, Windschatten oder Graslimit).
- Automatisches Updatefenster öffnet nicht während eines aktiven Rennladeversuchs.

## Ausgeführte Prüfungen

- 95 Python-Modultests und zwei gezielte echte HTTP-Tests (private Bundles und Adminrouten) bestanden.
- test-racing.cjs, test-race-finish.cjs, test-fixes129b.cjs, test-tuning.cjs und test-lobby.cjs bestanden. Enthalten sind Grasprojektion, gerichtete Zielüberquerung, Rückwärts-Abzug, Pendeln, fehlende Sektoren/Teleports, verschiedene Rundenzahlen, Fahrzeug-/Raumklassen und Tuning in der Geschwindigkeitssimulation.
- test-fixes129b-browser.cjs: echte HTTP-Käufe aller acht Upgradearten bis Stufe 3 für Kart/Porsche; tatsächliche Rennwerte, Speed während Fahrt, Szenenwechsel und Neuladen sowie kompetitive Serienwerte bestätigt. Cockpit bei 1100×700 und 390×700 geprüft; Bildschirmbilder visuell geprüft.
- test-race-browser.cjs: eine komplette Runde auf circuit nur mit normalen Lenken-/Gas-/Bremseingaben gefahren; genau ein Zieleinlauf, Ergebnis und Belohnung, keine zusätzliche Runde nötig.
- test-loading129.cjs: Abbruch, erneuter Start, späte Ergebnisse, Teilaufbau und Anfragefehler/Wiederherstellung bestanden.
- test-tuning129b-online.cjs: zwei echte Web-/WebRTC-Clients, GT3-Raum mit GT3- und Kart-Karosserie, gemeinsame Startfreigabe, gekaufte Beschleunigung/Topspeed/Grip bei erlaubten Upgrades, erneuter Szenenstart mit gesperrten Upgrades und Serienwerten bestanden. Der lokale Headless-Test deaktiviert Hintergrund-Drosselung und mDNS-Verdeckung lokaler WebRTC-Adressen; frühere Läufe ohne diese Testoptionen scheiterten am Hostbeitritt. Keine Produktions-Netzwerkänderung und keine Aussage über fremde Internet-/VPN-Verbindungen.
- Alle Browserläufe verwenden isolierte temporäre Konten/Datenbanken. Keine Produktionskonten als Testdaten.

## Grenzen und Veröffentlichung

- Kein vollständiger manuell gefahrener Test auf jeder Strecke und kein neuer Live-/HTTPS-Nachweis. Physik und Rundenbelege bleiben clientseitig; kein autoritativer Cheat-Schutz behauptet.
- Genau ein neues vollständiges Paket unter ../Backups/Kart Racer 1.2.9B, mit SHA-256-Manifest; ältere Backups unverändert erhalten. Uploadarchiv und Manifest liegen unter ../Rest/Organisation.
- Veröffentlichung nach Wiederherstellung des vorgesehenen SSH-Zugriffs fortsetzen: Uploadregeln erneut lesen, tatsächlichen Serverstand prüfen, Stagingtests, neue private SQLite-Sicherung, atomare Aktivierung und öffentliche HTTPS-Prüfung. Bestehende Serverfreigabe gilt; kein GitHub-Push beauftragt.

---

# Verifiziert veröffentlicht: 1.2.9 – UI & Race, 15.11.2026

- Der Nutzer hat den Server-Upload nach Abschluss der lokalen Umsetzung ausdrücklich beauftragt. 1.2.9 ist jetzt live bestätigt: `/var/www/kartracer/public` zeigt auf `releases/1.2.9`; `kartracer.service` ist aktiv. Kein GitHub-Push.
- Veröffentlicht wurde das bereits geprüfte vollständige Paket mit 193 Dateien, unverändert zum Backup `../Backups/Kart Racer 1.2.9-ui-race`. Alle SHA-256-Prüfsummen vor und nach Aktivierung bestätigt. Die folgenden lokalen Dokumentationsnachträge gehören zum Veröffentlichungsnachweis; das veröffentlichte Release und das bestehende Backup bleiben unverändert.
- Im Server-Staging: 95 Modultests und zwei echte HTTP-Tests bestanden. Neue private SQLite-Sicherung mit Integritätsprüfung; Initialisierung auf isolierter Kopie erhielt jede bestehende Tabellenzeile. Produktive Datenbankintegrität und bestehende Kontoidentitäten nach Veröffentlichung erneut bestätigt.
- Öffentlicher HTTPS-Browsertest: Versionsdateien, Anmeldeschutz, Login, private/no-store, Glass speichern und neu laden, Times/Einstellungen, Kart-/GT3-Rennstart, Pause/Menü und 390-px-Ansicht bestanden. Null JavaScript-Ausnahmen und null HTTP-Fehler in diesem Lauf. Kein neuer vollständig gefahrener Live-Rennlauf; die dokumentierte lokale Rennprüfung bleibt maßgeblich.
- Das ausschließlich für diesen Live-Test erzeugte QA-Konto samt abhängigen Daten wurde gezielt entfernt. Keine bestehenden Spielerkonten als Testdaten verwendet. Uploadarchiv entfernt, vorheriges Release 1.2.8P für Rollback erhalten. Keine alten Backups/BrokenVersions gelöscht oder überschrieben.
- Belege: `../Rest/Organisation/deployment-129-result.json` und `../Rest/Organisation/live-129-result.json`. Diese lokale Dokumentation ersetzt frühere Nur-lokal-/Uploadverbote als aktuellen Stand; die nachfolgenden Einträge bleiben historische Aufzeichnungen. Keine Behauptung, sporadische frühere 502-Fehler generell behoben zu haben.

---

# UI & Race - 1.2.9

Lokaler gemeinsamer Auftrag auf verifizierter Basis 1.2.8P (06e1f26). Keine Dateien aus dem alten zurueckgezogenen 1.2.9-Archiv uebernommen.

## DE

- Aktionsbuttons in Einstellungen und Verwaltung folgen dem Ambient-Theme; Accountaktionen sind bündig ausgerichtet.
- Einstellungstabs wechseln mit gleitender Auswahl, seitlicher Überblendung und gemessener Höhenanpassung. Reduzierte Bewegung wird berücksichtigt.
- Glass wird pro Konto gespeichert und steuert Buttonflächen, Ladefenster und Versionsauswahl. Native Schalter ersetzen Checkboxdarstellungen und binäre An/Aus-Paare.
- Freunde werden erst nach Bestätigung entfernt. Nichtkritische Fenster schließen bei einem echten Außenklick.
- Ladeabbrüche sind an den jeweiligen Startversuch gebunden; verspätete Ergebnisse starten kein abgebrochenes Rennen.
- Rennen enden nach der eingestellten Rundenzahl. Grasfahrten entwerten die Rennrunde nicht; Rückwärtsüberquerungen ziehen eine Runde ab, Pendeln an der Ziellinie bringt keinen Rundengewinn. Die bestehende Bestenlistenprüfung bleibt erhalten.

## EN

- Settings and administration actions follow the ambient theme; account actions share aligned edges.
- Settings tabs use a sliding selection, directional fade and measured height transition, respecting reduced motion.
- Glass is saved per account and controls button surfaces, the loading panel and version selector. Native switches replace checkbox styling and binary on/off pairs.
- Removing a friend requires confirmation. Noncritical windows close on a genuine outside click.
- Loading cancellation is scoped to each start attempt; late results cannot start a cancelled race.
- Races end at the selected lap count. Grass does not invalidate race laps; crossing backwards subtracts a lap, and oscillating at the line cannot gain laps. Existing leaderboard validation is retained.

## FR

- Les actions des paramètres et de l’administration suivent le thème ambiant ; les actions du compte sont alignées.
- Les onglets utilisent une sélection glissante, un fondu latéral et une hauteur mesurée, en respectant la réduction des animations.
- Glass est enregistré par compte et règle les surfaces des boutons, du chargement et du sélecteur de version. Des interrupteurs natifs remplacent l’apparence des cases à cocher et les paires marche/arrêt.
- Retirer un ami exige une confirmation. Les fenêtres non critiques se ferment après un véritable clic extérieur.
- L’annulation du chargement est liée à chaque tentative de départ ; une réponse tardive ne peut pas lancer une course annulée.
- La course se termine au nombre de tours choisi. L’herbe n’annule pas un tour ; franchir la ligne à l’envers retire un tour, sans gain possible par va-et-vient. La validation existante des classements est conservée.

## Diagnose und Umsetzung

- Die bisherige Rundenzählung verwendete dieselbe Validierung wie Rekordzeiten: Verlassen der Fahrbahn setzte die Runde ungültig. Zudem prüfte die alte Routine die Zielüberquerung vor einem im selben Schritt erreichten letzten Kontrollpunkt. Diese Codepfade erklären zusätzliche erforderliche Runden; damit ist nicht jede historisch gemeldete Situation rückwirkend reproduziert.
- Rennfortschritt und Rekordprüfung sind jetzt getrennt. Geordnete Sektoren, gerichtete Überquerungen und physisch plausible Bewegung verhindern Startlinien-Pendeln und Teleports. Gras beziehungsweise eine kürzere innere Fahrlinie entwertet die Rennrunde nicht. Rückwärtsüberquerung zieht eine Runde ab, mindestens null; erneutes Vorwärtskreuzen allein stellt diese nicht wieder her. Erst eine weitere Umrundung zählt wieder.
- Der Zieleinlauf ist nicht mehr durch einen laufenden Reparatur-/QTE-Zustand verzögert. Ergebnisse werden einmalig erzeugt. Bereits empfangene Zieleinläufe und beendete Bots werden durch verspätete laufende Zustände nicht reaktiviert; der nächste Rennstart setzt den Zustand zurück. Zuständigkeiten und Fahrwerte bleiben unverändert.
- Der bestehende Ladeabbruch hatte bereits einen Cancel-Handler. Der anschließende Streckenaufbau lief synchron; während solcher Arbeitsschritte konnte der UI-Thread keine Klicks verarbeiten. Er wird jetzt an gezielten Grenzen unterbrochen, prüft den jeweiligen Startversuch und räumt teilaufgebaute Szenen auf. Eigene Requests sind abbrechbar, gemeinsame Asset-Caches bleiben erhalten. Keine Behauptung einer gemessenen maximalen Blockierungsdauer auf allen Strecken.

## Tatsächlich ausgeführte Prüfungen

- `py server/run_unit_tests.py`: **95 Tests bestanden**, einschließlich Glass-Standardwert, explizitem false, Altprofilen/Altclients, strenger Boolean-Validierung, Adminberechtigungen, Revision und Audit.
- Zwei gezielte echte HTTP-Tests bestanden: `test_performance_http.PerformanceHTTP.test_bundles_remain_private` und `test_admin_http.AdminHTTP.test_admin_routes`. Neue UI-Dateien und Bundles bleiben authentifiziert, einschließlich 304; persönliche HTML bleibt private/no-store.
- `node test-race-finish.cjs`: 1/2/3 Runden, unterschiedliche Schritte/Geschwindigkeiten, erste Startüberquerung, Gras/innere Linie gegenüber Rekordvalidierung, Rückwärts-Abzug, Pendeln, fehlende Sektoren/Teleport, letzter Sektor und Ziel im selben Schritt, Neustart sowie verspätete Botzustände bestanden.
- `node test-racing.cjs`, `node test-tuning.cjs`, `node test-lobby.cjs` bestanden: vorhandene Prüfungen für zehn Strecken, Fahrwerte, 325 Längsdynamikmessungen, 676 Werkstattmodelle, 39 Streckenhüllenvergleiche sowie Bereitschaftsbarriere und Abstimmungen.
- `py test-ui129.py`: echte lokale Kontospeicherung nach Neuladen und erneutem Login, Altclient-HTTP-Speicherung und ungültiger Boolean; fünf Ambient-Themes × Glass; unveränderte Menü-/Profilfarbzuordnung; alle sechs Tabs in beide Richtungen, schnelle Wechsel, Schließen/Öffnen, DE/EN/FR, 1280 und 390 px, reduzierte Bewegung und bündige Accountaktionen bestanden. Native Adminschalter: Label und Leertaste jeweils ein Wechsel, keine vorzeitige Speicherung, gesperrte Freischaltungen, genau ein expliziter Save und sichtbarer Glass-Auditeintrag. Ladefläche und Versionsfeld in beiden Glass-Zuständen geprüft.
- `UI_TEST_SCRIPT=test-dialogs129.cjs py test-ui129.py` (Umgebungsvariable in PowerShell entsprechend setzen): zwei isolierte Testkonten; Abbrechen/Escape/Außenklick, verschachtelte Freunde-Fenster, Doppelklick, Sperre während Anfrage, Serverfehler und bereits entfernte Freundschaft bestanden. Reglerziehen nach außen schließt nicht, emulierter Touch-Außenklick schließt. Host-Ladeabbruch, Gastabbruch vor Grün, erhaltene Mitgliedschaft, neuer gemeinsamer Start, keine Belohnung und Schutz vor verspätetem Finish-Rückschritt bestanden.
- `UI_TEST_SCRIPT=test-loading129.cjs py test-ui129.py`: tatsächlich abgefangener verzögerter gemeinsamer Asset-Download, sofortiger Neustart und späte alte Antwort; Abbruch an früher/später Aufbaugrenze, bereinigte Szenen-Canvas, anschließender Neustart sowie HTTP-503-Ladefehler mit Wiederaufnahme bestanden. Keine Rennzählung, Münzen oder XP durch Abbruch. Testhaken existieren ausschließlich in den vom Test ersetzten Browserantworten.
- `UI_TEST_SCRIPT=test-race-browser.cjs py test-ui129.py`: **echter Browser-Rennlauf auf Circuit mit einer Runde**, über normale Gas-/Brems-/Lenktasten automatisiert gefahren, ohne Teleport, Zeitbeschleunigung oder Schreiben der Rundenzahl. Ergebnisse nach einer Runde; genau eine Rennzählung und Belohnung; nachlaufende Frames erzeugen kein zweites Ergebnis.
- `py test-performance.py`: begrenzte Wiederholung simulierter JS-/CSS-Fehler, Lazy Loading, deduplizierte Sozialabfragen, GT3-Rennaufbau, manuelle Startwiederholung und EN/FR-Fehleroberfläche bestanden. Keine neuen JavaScript-Ausnahmen in den Browserläufen.
- 73 JavaScript-Dateien mit `node --check` und die Python-Serverquellen per AST geprüft. Einstellungen auf Desktop und 390 px anhand erzeugter Browserbilder visuell geprüft.

## Offene Prüfgrenzen

- Browserprüfungen mit lokalem Microsoft Edge/Chromium auf Windows, Software-WebGL und emulierter Touch-Eingabe. Keine vollständige Firefox-/Safari-/iOS-/Android-Matrix und kein physisches Touchgerät getestet. Die geöffnete native Optionsliste bleibt in Farbe/Fokus vom Betriebssystem/Browser abhängig; kein eigenes Dropdown ersetzt sie.
- Der vollständig gefahrene Browserlauf deckt Circuit mit einer Runde ab. 2/3 Runden und Sonderfälle sind Logiktests, keine als gefahren ausgegebenen Rennen. Kein vollständiger Mehrspieler-Zieleinlauf über alle Strecken, Fahrzeugklassen, Bots und Zuschauer gefahren; Multiplayer-Abbruch, Bereitschaft, Rundenreset und verspätete Finish-Zustände wurden mit zwei echten lokalen Browserclients geprüft.
- Normales Konto und Founder/Main-Developer wurden in Browserabläufen verwendet; weitere Rollenberechtigungen sind durch Servertests abgedeckt, nicht jede Rollen-/Sprach-/Gerätekombination im Browser.
- Keine neue Untersuchung produktiver sporadischer 502-Fehler; diese werden nicht als behoben bezeichnet. Keine Produktivkonten, Freundschaften, Rennen oder Kontodaten verändert.

## Dateien und Paket

- UI: `ui-settings.js`, `ui-settings.css`, `game-shell.html`, `game.js`, `motion.js`, `account.js`, `account-store.js`, `admin.js`, `developer.js`, `friends.js`.
- Renn-/Netzablauf: `racing.js`, `network-runtime.js`, `bots.js`, `game.js`.
- Server: `server/profiles.py`, `server/admin.py`, `server/app.py`, `server/social.py`; Tests in `server/test_profiles.py`, `server/test_admin.py`, `server/test_performance_http.py`.
- Build/Version: `bundle-manifest.json`, `kart_racer.html`, `assets/bundles/{foundation,game,ui}.js`, `updates.js`, `release-notes.json`, `deployment-manifest.json`.
- Neue lokale Tests: `test-ui129.py`, `test-ui129.cjs`, `test-dialogs129.cjs`, `test-loading129.cjs`, `test-race-browser.cjs`, `test-race-finish.cjs`; bestehender `test-performance.cjs` liest den aktuellen Versionsmarker.
- Anleitung/Dokumentation: `AGENTS.md`, `CLAUDE.md`, `CHATGPT.md`, `changelog.md`. Vollständiges neues Paket: `../Backups/Kart Racer 1.2.9-ui-race`. Alte Backups/BrokenVersions unverändert. Paket enthält Laufzeitdateien, Assets, vorhandene Quellen/Lizenzen, Tests und Anweisungen; keine privaten Datenbanken, Zugangsdaten oder Testkonten.
- **Nur lokal. Kein Server-Upload, kein GitHub-Push und kein neuer Live-Nachweis.**

---

# Performance — 1.2.8P

Release auf Basis von 1.2.8. Veröffentlichung von Performance-Updates und Tutorial-Entfernung am 15.11.2026 ausdrücklich beauftragt; Live-Ergebnis im separaten Veröffentlichungsbeleg.

## Änderungen
- 46 direkt eingebundene lokale Skripte durch fünf zentrale Startdateien ersetzt (Bootstrap, Three.js, Foundation, Spiel, UI). Downloads parallel; Ausführung in geprüfter Abhängigkeitsreihenfolge.
- Spielcode aus personalisierter HTML-Seite in separat validierbare Pakete ausgelagert. HTML ohne Kontodaten: 271273 → 58925 Bytes; gzip: 93444 → 14990 Bytes. Dies ist keine Messung der gesamten Ladezeit oder sämtlicher übertragenen Assets.
- Admin/Developer-Oberflächen beim ersten Öffnen der Einstellungen, Rankings beim ersten Times-Aufruf bzw. Rekordereignis laden. Serverseitige Rechte bleiben unverändert; keine neuen Accountfelder.
- Downloadfehler bei Skripten und CSS maximal dreimal versuchen (15 Sekunden Timeout je Fetch, gestaffelte Pause); 401/403/404 nicht automatisch wiederholen. Start zeigt bei erschöpften Versuchen eine Wiederholen-Schaltfläche (DE/EN/FR). Bereits ausgeführte Pakete nicht erneut ausführen; nach Ausführungsfehler vollständig neu laden.
- Freunde: sechs Sekunden im geöffneten Dialog oder in einer Multiplayer-Lobby, 15 Sekunden im Hauptmenü, 30 Sekunden im Rennen; bei verborgenem Tab keine geplanten Polls. Unmittelbarer Abgleich beim Zurückkehren. Sozialdaten-Abfragen dedupliziert und maximal zwei Sekunden gemeinsam mit der Updateanzeige verwendet; Aktionen verwerfen den Cache.
- Fonts nach dem wesentlichen Start laden. Grafikeinstellungen, Auflösung, Schatten und Lobby-Renderloop unverändert gegenüber 1.2.8 (Punkt 6 ausdrücklich ausgeschlossen).
- Reproduzierbarer Build: node build-client.cjs; Quell-Reihenfolge in bundle-manifest.json; game-shell.html ist die HTML-Quelle. Erzeugte Pakete und fertige HTML-Datei gehören in jedes Release.

## Validierung
- Browser: simulierte 502/503 für JS und CSS, erfolgreiche begrenzte Wiederholungen, dauerhafter Ausfall und manuelle Wiederholung ohne doppelte UI, Bootstrap-Ausfalltexte EN/FR, nachgeladene Times-/Verwaltungsoberflächen, zusammengefasste Sozialabfrage, GT3-Rennstart; keine JavaScript-Fehler. Update-Gelesenwert im Browsertest gezielt gemockt, um unabhängige automatische Dialoge auszuschließen.
- 22 ausgewählte HTTP-/Sozial-/Admin-/Developer-Tests bestanden. Neue Pakettests prüfen echten Anmeldeschutz einschließlich 304, gzip und private/no-store für personalisierte HTML.
- test-racing.cjs, test-tuning.cjs, test-tutorial.cjs und test-lobby.cjs bestanden. Quelltextlesende Tests an game.js angepasst.
- Früherer Gesamtlauf des vererbten AdminHTTP-Testfalls scheiterte an einem zusätzlich angelegten Testkonto (3 statt erwarteten 2); isolierter Admin-Routentest bestanden. Direkter unittest-Aufruf hatte Windows-Dateisperren bei Testdaten-Aufräumung; vorhandener run_unit_tests.py mit gc.collect verwendbar.
- Kein Live-Upload, kein GitHub-Push, keine Live-Datenmigration. Keine vollständige Multiplayer-Rennfahrt oder garantierte Zeitersparnis behaupten.

## 502-Diagnose und Aufräumkandidaten
- 15.11.2026: 20 interne Abrufe und 20 öffentliche HTTPS-Abrufe von Login/öffentlichen Assets jeweils HTTP 200. Intern meist 2–5 ms (ein erster Abruf ~54 ms), öffentlich ~0,5–1,4 s. Dies ist kein authentifizierter vollständiger Spiel-Benchmark und kein Ausschluss sporadischer Fehler.
- Nginx-Fehlerlogs und Dienstjournal weder direkt noch über verfügbare sudo-Rechte lesbar. Keine belastbare 502-Ursache belegt; beim nächsten Fehler Antwort/Headers und korrespondierende Nginx-Upstream-Logs mit Zeitstempel erfassen. Netzwerk/VPN als Möglichkeit, nicht als bewiesene Ursache.
- Weitere Löschkandidaten: zehn Staging-Ordner ~413,7 MiB, elf Uploadarchive ~411,2 MiB. Zurückgezogene Releases 1.2.9/1.2.10 ~98,2 MiB vorerst für Diagnose behalten. Datenbank einschließlich WAL/SHM, Rollen-/Developer-Seeds und private Sicherungen erhalten. Hier keine weiteren Löschungen vorgenommen.

## Ordneraufteilung und Versionskorrektur
- Nutzerkorrektur: 1.2.8P (P = Performance), nicht 1.2.11. Kein neues Feature-Release, weiterhin auf Basis 1.2.8.
- Main ist die vollständige Entwicklungs-, Deployment- und Git-Wurzel. Backups und Rest liegen außerhalb des Repositories. Kein Commit, GitHub-Push oder Server-Upload.
- Unbenutzte Legacy-Texturen, PNG-Originale, komplette Quelldownloads und ältere Helmdateien liegen nicht in Main. Alle direkt referenzierten Laufzeitassets, 14 Fahrzeugvorschauen sowie sechs normale/saisonale Hintergründe vorhanden. Lizenzen/Quellennachweise erhalten.
- 94 Modultests, zwei gezielte HTTP-Tests und der Browser-Performance-Test nach Umordnung aus Main erfolgreich ausgeführt.
- Backups hält alle noch vorhandenen vollständigen Versionspakete; zuvor entfernte, nicht mehr lokal vorhandene Releases können nicht nachträglich rekonstruiert werden. Historische Pakete unverändert erhalten; Status im Backups-Katalog.

## Tutorial entfernt / Release 1.2.8P
- Tutorial-Einstieg, automatisches Angebot, Trainingsanzeige und Adminfelder vollständig entfernt. Acht reine Tutorial-Dateien einschließlich Skripten, CSS, Aufgaben und Servermodul/Tests gelöscht.
- Tutorial-Sonderfälle aus Rennstart, Pause/Neustart, Items, Bots, Tuning und Rennende entfernt. Bestehende Spielstände mit altem Tutorial-Feld werden ohne Änderung der übrigen Werte übernommen.
- 93 Server-Modultests bestanden, einschließlich Bestandsprofil-Rundlauf; zwei HTTP-Tests für authentifizierte Pakete, nicht mehr vorhandene Tutorialassets und Tuning-Käufe bestanden.
- Renn-/Tuning-/Lobbytests bestanden. Echter lokaler Browser: Start ohne Tutorial, Times und Einstellungen, GT3-Rennstart, 502/503-Wiederholungen und EN/FR-Fehleranzeige; keine JavaScript-Fehler. Keine vollständig gefahrene Rennrunde behaupten.
- Main auf benötigte Laufzeitdateien sowie Buildquellen, Tests, Lizenzen und Quellennachweise geprüft. Dynamisch geladene saisonale Hintergründe, Kartvorschauen und Winterassets bleiben erforderlich.
- Serverbereinigung und Entfernung der zurückgezogenen Versionspakete ausdrücklich beauftragt; tatsächliche gelöschte Dateien und verbleibende Einschränkungen im Veröffentlichungsbeleg. Keine GitHub-Veröffentlichung.
