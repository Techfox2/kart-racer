# Mobile performance layer: plan

Target: Grand Poly 1.2.10 races on phones. Same rule as the controls work: an add-on
under `assets/mobile/`, no edits to existing game files. Everything is inactive on
desktop (`KartMobile.active === false`) and can be switched off per device.

## Measured starting point

Headless Chromium, 844x390 at device pixel ratio 3, 7 cars, quality "high". GPU time
cannot be measured here (software GL); workload and JavaScript cost can.

| Track | Draw calls (shadow pass) | Triangles per frame (shadow pass) |
|---|---|---|
| circuit | 377 (282) | 535k (329k) |
| nurburgring | 442 (325) | 921k (400k) |
| monaco | 472 (351) | 1.71M (841k) |

- Quality presets hardly change this: low vs high differs by 1 to 5 % in triangles.
  Presets only change resolution, shadow map size and filtering, anisotropy, env map.
- Default quality for every account is "high": 2110x975 px (2.06 MP) with 4x MSAA, a
  4096 px PCF-soft shadow map re-rendered every frame, env map on every material.
- Instanced meshes (barriers, trees, Monaco buildings, grass, clouds) all have
  `frustumCulled=false` and `castShadow=true`: every instance is drawn in both passes.
  Barriers alone are 400 to 2532 instances of a 192-triangle rounded box: 77k triangles
  on circuit, 486k on monaco, per pass.
- Terrain ("Road terrain") is one mesh of 25k to 194k triangles, never culled, no LOD:
  up to 42 % of main-pass triangles (nurburgring).
- Seven cars are about 197k triangles in 252 meshes, MeshPhysical with clearcoat.
- Hitches: about 2.9 s shader compile on the first race frame (countdown already
  running) and a further 1 to 3.5 s stall mid-race when a new shader program is first
  needed (first particle sprite, a physical-material variant). Software-GL timings; the
  cause is real, the duration on a phone is unknown.
- Per-frame JavaScript at 4x CPU throttle: 16 to 19 ms, about 65 % render submission,
  11 to 13 % HUD of which the minimap redraw is 6 to 9 %, update logic 6 to 8 %,
  bot AI about 1 %.
- `PREF.quality` is server-validated account state and is re-applied from the server at
  each race start. The add-on must not write to `PREF` or `QUALITY_PRESETS`.

## Hooks available without editing files

Classic scripts share one global scope, so top-level functions are `window` properties:

- `window.qualityRender(r, scene, camera)`: called once per frame; gives renderer and camera.
- `window.applyQuality(r)`: sets pixel ratio, shadow map size/type, anisotropy, env map.
- `graphicsRenderers` (Set) and `r._kartScene === window.kartRaceScene` identify the race renderer.
- `THREE.WebGLRenderer` is a plain assignable property (constructor options such as `antialias`).
- `window.kartRaceScene`: the scene, once built; meshes can be re-organised after the build.
- `KartAssets.script`: mutable, used for lazy loads (`grass-high.js`).

## What the module does

File: `assets/mobile/mobile-perf.js`, API `KartMobile.perf`, setting `perf`
(`auto | quality | balanced | performance | off`) and `fps30`.

### 1. Render profile (per tier, applied after the game's own `applyQuality`)

| | quality | balanced (default) | performance |
|---|---|---|---|
| Pixel budget (cap on drawing buffer) | 1.6 MP | 1.1 MP | 0.75 MP |
| MSAA | off | off | off |
| Shadow map | 2048, PCF | 1024, PCF | 512, basic |
| Shadow casters | cars, trees, props | cars, large props | player car + nearby cars |
| Env map | game setting | off | off |
| Anisotropy cap | 8 | 4 | 2 |
| 3D grass | game setting | off | off |

The game's own quality setting still applies underneath; the tier only caps it, so a
player on "low" is never raised.

Adaptive resolution: frame-time average steers the pixel ratio between 60 % and 100 % of
the tier budget, with hysteresis and at most one change every 2 s (a change reallocates
the drawing buffer). In `auto`, sustained low frame rate at minimum resolution steps the
tier down and remembers it on the device.

### 2. Geometry (the terrain and instancing work)

- Terrain: split the single terrain mesh into a grid of tiles that share the original
  vertex buffers and each carry their own index range and bounding sphere, so three.js
  frustum culling removes the tiles behind and beside the camera. Distant tiles may use
  a coarser index only if seams are handled and verified by screenshot; otherwise
  culling only.
- Barriers: replace the 192-triangle rounded box with a low-poly box of the same outer
  size and split the instances into consecutive chunks with their own bounds so they are
  culled. Crash animation (`flyBars`) writes to the original instance matrices; the
  chunks mirror those matrices whenever the original changes.
- Trees, props, Monaco buildings: split instanced meshes into spatial chunks with bounds.
- Static objects: `matrixAutoUpdate=false` after one `updateMatrix()`.
- Cars: far opponents stop casting shadows; on `performance` their driver detail is
  hidden beyond a distance.

### 3. Hitches

- Shader warm-up: compile all programs before the first visible frame, including the
  ones only needed later (pooled particle sprites, oil, snow, material variants), by
  rendering one warm-up frame with pooled objects temporarily visible into a tiny target.
- Minimap: redraw at about 20 Hz instead of every frame.
- Skip redundant `setSize` calls on resize; debounce URL-bar resizes.
- Optional 30 fps cap (`fps30`) for battery and heat.

### 4. Diagnostics

`KartMobile.perf.stats()` returns fps, frame-time percentiles, pixel ratio, draw calls,
triangles, active tier. `?kmperf=1` shows a small overlay.

## Not fixable from an add-on (documented as recommendations in MERGE.md)

- Terrain build time during loading (`terrH` per vertex, synchronous).
- Per-frame allocations in `update()` (`trackAt`, `botTraffic`, camera vectors).
- Variable timestep clamped at 0.05 s (hitches slow the game instead of catching up).
- Device-aware default quality on the account.
- The hidden lobby WebGL context kept alive during races.

## Agent choice

| Job | Model | Why |
|---|---|---|
| Static pipeline analysis | Sonnet | reading and cataloguing |
| Workload measurement harness | Sonnet | mechanical data collection |
| Plan | main session | holds both reports |
| Perf module build and verification | Opus | three.js internals, index-buffer surgery, wrapping live render functions without breaking the game |

## Acceptance

- Desktop: module inactive, draw calls and triangles identical to baseline.
- Phone profile, balanced tier: draw calls and triangles per frame cut by at least half on
  circuit, nurburgring and monaco; drawing buffer within the pixel budget.
- No new shader program appears after the warm-up during a 60 s race with a crash.
- Screenshots before/after show no missing terrain, seams, barriers or props.
- Barrier crash animation still works. Controls and menu tests still pass. No page errors.
- `git diff --stat baseline-import` lists additions only.
