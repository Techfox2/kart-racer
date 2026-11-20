# Mobile UI and input layer: plan

Target: Grand Poly 1.2.10. Goal: proper phone/tablet controls and a usable mobile
HUD and menu layout, delivered as an add-on that leaves every existing game file
byte-identical so it can be merged into the main repository later.

## Findings that shape the design

From the code recon (measured in a real race at 844x390, 667x375, 390x844, 360x640):

- The game's only input state is `keys`, local to `boot()` in `game.js`. All actions are
  digital: `up`, `down`, `left`, `right`, `drift` (hold), `item` (edge-consumed).
- The game already listens for `pointerdown/up/cancel/leave` on `#touch button[data-k]`.
  Dispatching synthetic pointer events on those buttons drives the kart. This is the
  public surface the add-on uses; no game code is touched.
- Steering is low-pass filtered (`pl.steer += (tgt - pl.steer) * min(1, steering*dt)`,
  time constant about 0.1 s) and yaw is linear in `pl.steer`. Toggling left/right once per
  animation frame with a sigma-delta pattern therefore gives proportional steering.
- The stock touch row is broken on phones: in portrait the gas button is off-screen below
  about 475 px width; in landscape `#raceTelemetry` (z-index 8, pointer-events on) covers
  the steer buttons; `#camera` and `#sp` sit on top of or under the right cluster.
- No race lifecycle events exist. State must be derived from `body.lobby`,
  `window.kartActiveTrack`, `#panel.on`, `#results[hidden]`.
- `KartStorage` drops unknown keys and the server rejects unknown fields in
  `kart-settings`, so preferences go to plain `localStorage` (`kart-mobile`), per device.
- The localization table is closed. Add-on DOM uses `data-no-translate` and its own
  `{de,en,fr}` strings, as `account.js`/`privacy.js` do.
- Files under `assets/` are served by `server/app.py` without an allowlist change.

From the platform research (partly unverified, treated as starting values):

- iPhone Safari has no element fullscreen, no orientation lock and no `navigator.vibrate`.
  Fullscreen, orientation lock, haptics and wake lock are progressive enhancements only.
- Touch targets for game controls: 64 to 96 CSS px, at least 12 px apart, 20 px from the
  side edges (system back gestures), padded by `env(safe-area-inset-*)`.
- Casual default in comparable games: auto-accelerate plus steering, drift on hold.

## Architecture

All runtime code lives in `assets/mobile/`; tooling, tests and docs live in `mobile/`.

| File | Role |
|---|---|
| `assets/mobile/mobile-core.js` | `window.KartMobile`: activation (`html.km-on`), settings store, race state (`lobby/race/paused/results`), language helper, stylesheet loader |
| `assets/mobile/mobile-controls.js` + `.css` | In-race touch controls, virtual key driver, steering schemes, HUD rearrangement, settings rows, fullscreen/wake lock/haptics |
| `assets/mobile/mobile-orientation.js` + `.css` | "Turn your device" prompt in portrait: once per visit in the lobby; in a race it pauses through the game's pause button until the device is turned or the player continues in portrait |
| `assets/mobile/mobile-menus.js` + `.css` | Lobby, sheets, dialogs and settings panel fixes for phone viewports (CSS overrides scoped to `html.km-on`) |
| `mobile/modules.json` | Load order of the modules |
| `mobile/tools/integrate.cjs` | The one integration step: append the modules to the `ui` list in `bundle-manifest.json`, rebuild |
| `mobile/tools/sandbox.cjs` | Integrated throwaway copy of the game + server for testing; repo stays untouched |
| `mobile/tests/*.cjs` | Playwright checks against the sandbox |
| `mobile/MERGE.md` | Merge instructions for the main repository |

Rules for every module: one IIFE, no edits to existing files, no writes to game
globals, everything visual scoped under `html.km-on`, so desktop is unaffected.

## Input design

- Virtual key driver: desired state per action, flushed once per animation frame as
  synthetic pointer events on the game's own `#touch` buttons. Held keys are re-asserted
  after the game clears `keys` (pause, exit dialog, new race). `item` is sent as a pulse.
- Schemes (setting `scheme`):
  1. `buttons` (default): left and right steer buttons; a finger can slide between them.
  2. `slide`: floating steer zone, origin where the thumb lands, proportional output.
  3. `tilt`: device orientation, opt-in, permission requested from a tap, calibrate button.
- `autoGas` (default on): throttle is held automatically; brake overrides it. With it off a
  gas pedal is shown.
- Proportional steering uses the per-frame sigma-delta toggle. While drift is held the
  output is pushed past the game's 0.3 steer threshold so drifts start reliably.
- Options: mirrored (left-handed) layout, control size, opacity, haptics.
- Optional later upgrade, not applied here: a one-line analog hook in `game.js`
  (see MERGE.md) would replace the pulse emulation.

## Layout

- Landscape: steering bottom-left, drift/item/brake(/gas) arc bottom-right, pause, home and
  camera along the top, speed bottom-centre, telemetry collapsed and kept clear of controls.
- Portrait: same clusters, compacted; nothing may leave the viewport at 320 px width. A prompt
  asks the player to turn the device (dismissable).
- Control size follows the screen: a share of the short side (times the size setting), between
  a minimum that is still easy to hit (46 to 58 px) and a comfortable maximum (96 to 140 px),
  then capped so the clusters, the centre column (speedometer, rear-car list) and the minimap
  never overlap. Checked from 568x320 and 640x300 up to 1194x834, at sizes 0.7, 1 and 1.4.
- The stock `#touch` row stays in the DOM as the event target but is not rendered.
- QTE buttons (`#qk`) stay as they are, verified reachable.

## Phases and agent choice

| Phase | Job | Model | Why |
|---|---|---|---|
| 0 | Import snapshot, commit | main session | mechanical, needs no agent |
| 1a | Code recon of input/HUD/test surfaces | Sonnet | reading and measuring, no design judgement |
| 1b | Web research on mobile controls and platform limits | Sonnet | lookup and summarising |
| 2 | Architecture, core module, tooling | main session | already holds both reports; a fresh planner would re-read everything |
| 3a | In-race controls and input engine | Opus | multi-touch, frame-timed pulse steering, state resync: subtle logic |
| 3b | Menu/lobby phone layout pass | Sonnet | screenshot, find overflow, write scoped CSS: iterative but shallow |
| 4 | Integration review, full test run, merge guide | main session | needs the whole picture |

## Acceptance

- `git diff baseline-import --stat` lists additions only.
- Desktop (no touch): `KartMobile.active === false`, no visual change.
- Phone landscape and portrait: every control inside the viewport, no control covered by a
  HUD element, kart accelerates, steers both ways, drifts, uses items, pauses and resumes.
- No page errors in any test run.
