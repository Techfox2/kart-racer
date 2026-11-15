# Strecken

Nürburgring GP und Shanghai: geografische Streckenverläufe aus
https://github.com/bacinger/f1-circuits (Tomislav Bacinger, MIT, siehe LICENSE.md).
Quelldateien: circuits/de-1927.geojson und circuits/cn-2004.geojson, abgerufen am 09.11.2026.

Für das Spiel in lokale Meterkoordinaten umgerechnet, auf 70 % verkleinert und
mit einer glatten Kurve verbunden. Höhen und Dekoration sind stilisierte
Spielgestaltung, keine Vermessung oder laserscannbasierte Simulation.

Die Fahrzeuggeometrie in gt3.js ist eine eigene, stilisierte prozedurale Umsetzung.
Marken- und Modellnamen dienen zur Bezeichnung der Vorbilder. Keine importierten
Fahrzeugmodelle, Herstellerlogos oder Herstellertexturen enthalten.

## Boxenbereiche (1.1.7)

Eigene Geometrie, keine kopierten Kartenbilder. Die seitliche Lage beim
Start-/Ziel-Komplex orientiert sich an den unten verlinkten offiziellen Plänen.
Das Spiel verwendet verkürzte Reparaturbuchten rechts in Fahrtrichtung,
keine exakten Nachbauten vollständiger Ein-/Ausfahrten. Insbesondere Monacos
echte Umfahrung bei Rascasse wird nicht maßstabsgetreu nachgebildet.
Rennstrecke, Schneeberge und Indoor sind frei gestaltete Spielstrecken.

- [Monaco, FIA 2025](https://www.fia.com/system/files/decision-document/2025_monaco_grand_prix_-_race_directors_event_notes_-_circuit_map_pit_lane_map_ers_battery_containment_area_red_zones.pdf)
- [Spa, FIA 2025](https://www.fia.com/system/files/decision-document/2025_belgian_grand_prix_-_event_notes_-_circuit_map_pit_lane_emergency_exits_quarantine_zone_and_red_zones.pdf)
- [Monza, FIA 2025](https://www.fia.com/system/files/decision-document/2025_italian_grand_prix_-_event_notes_-_circuit_map_pit_lane_emergency_exit_map_quarantine_zone_and_red_zones.pdf)
- [Nürburgring GP, FIA 2020](https://www.fia.com/sites/default/files/decision-document/2020%20Eifel%20Grand%20Prix%20-%20Circuit%20Map.pdf)
- [Shanghai, FIA 2025](https://www.fia.com/system/files/decision-document/2025_chinese_grand_prix_-_event_notes_-_circuit_map_pit_lane_and_quarantine_zone.pdf)

Quellen geprüft am 10.11.2026. Die fünf Sekunden Reparaturzeit sind eine Spielregel.

## Original Karting circuits — 1.2.4

Switchback Park (584 m) and Hairpin Heights (574 m) are original game layouts defined in kart-tracks.js, not copies of real circuits. Eight-metre road width, short straights, elevation changes and curvature-dependent banking capped at 0.24 / 0.31 radians. Banking fades out around start/finish and the repair bay. Repair bays occupy the final 72–12 metres before the line and are freely authored. Clearance was checked on sampled centre lines and six bots completed each course in simulation.


## 1.2.6 – terrain and lap validation
Terrain uses the actual game road heights with local spatial sampling, triangle interpolation and restricted shoulders at nearby nonadjacent sections. Monaco city terraces, harbour water and yachts are original simplified Poly geometry, not a geographic reconstruction. References: https://acm.mc/wp-content/uploads/2020/01/PLAN-PORT-DE-MONACO-GB.pdf and https://acm.mc/wp-content/uploads/2025/05/Hospitalites_ACM_F12026_F-3.pdf . Race minimum durations use the game-scaled curve lengths in race-rules.json, generous maximum speeds and a 0.9 margin; real circuit lengths are not substituted for game lengths. Client-reported results are not authoritative anti-cheat evidence.
