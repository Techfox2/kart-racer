# Scenery assets

Downloaded 2026-11-07 from the official Kenney download service.

- [Kenney Racing Kit](https://kenney.nl/assets/racing-kit): tent, light posts, pylons. Archive license: Racing Kit 2.0, Creative Commons Zero (CC0).
- [Kenney Nature Kit](https://kenney.nl/assets/nature-kit): oak and deciduous trees, pine trees, bushes and rocks. Creative Commons Zero (CC0).

Original license texts: `LICENSE-racing.txt` and `LICENSE-nature.txt`.
Selected original OBJ/MTL files are preserved under `selected/`.

`build-scenery.cjs` converts the selected static OBJ models to triangulated,
height-normalized geometry with vertex colors in `models.js`. It remaps foliage
to fresh green, bark to brown and tent accents
to yellow to match the game's generated lobby backgrounds. Winter foliage is
tinted pale blue/white at runtime. No external model loader or network request
is required when playing. Models remain Kenney's original authored geometry.

1.1.8: Removed unused grandstands, pit garage and office from the runtime bundle
and selected sources. The game's repair bays use the geometry in pit-stops.js.

1.2.2: world-style.js supplies original rounded polygon tree crowns, firs, bushes, rocks, clouds and distant hills. Earlier Kenney sources remain bundled for rollback; tents and pylons still use the licensed Kenney geometry. grass-high.js is original instanced blade geometry, downloaded only for High quality. No roadside floodlight placements.
