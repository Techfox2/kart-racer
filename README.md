# Kart Racer 3D

A 3D kart racer in a single HTML file (three.js r128). Open `index.html` in a browser.

## Controls
- **W / ↑** gas, **S / ↓** brake / reverse, **A D / ← →** steer
- **Space (hold) + steer** = drift. Release for a mini-turbo (3 tiers: blue → orange → purple)
- **E** item, **C** camera, **Esc / ⚙** key bindings, **M / ⌂** menu, **1–4** engine-failure quick-time event
- Touch: on-screen buttons, including a **DRIFT** button

## Tracks
- **Spa-Francorchamps, Monaco, Monza**: real F1 layouts from GPS data
  ([bacinger/f1-circuits](https://github.com/bacinger/f1-circuits), MIT), scaled down
  (Spa 1:2.6, Monaco 1:1.3, Monza 1:2.6), with real elevation profiles at the same scale
  (Spa ≈ 100 m real → Eau Rouge/Raidillon, Kemmel climbing to Les Combes, descent to Stavelot;
  Monaco: climb from Sainte Dévote to Casino, down to the tunnel). The HUD shows the corner name and height.
- Rennstrecke, Schneeberge, Indoor-Kartbahn (original tracks)

## Changes in this version

### Driving physics (rewritten)
- **Drifting didn't work.** Drift *lowered* the grip limit and the kart had no real slip.
  It now uses a world-velocity model: no hop, the rear slides out sideways (≈ 25–40° slip angle),
  drift direction from steering, steering widens or tightens the line, a charge depending on steering, and a mini-turbo on release.
- **Too much understeer.** The grip limit was 22 m/s² and steering was capped heavily. It's now 30 m/s² (× track grip)
  with direct, speed-dependent steering and trail-braking.
- Random "spin from slipping" removed. The kart only spins on hard crashes, oil, or rockets.
- Physics substeps at high speed, so there's no tunnelling.
- Slopes act with real gravity (9.8 · gradient).
- **Karts sank into the ground on slopes** (up to 0.57 m on Spa): their height trailed the road and only used the nearest sample.
  Height and pitch now come from all four wheel contact points, so no wheel goes below the road, even in steep hairpins.

### Tire effects
- Skid marks on the road while drifting, braking and sliding
- Tire smoke, plus sparks while drifting in the turbo-stage color
- Rear wheels lock when braking (karts only brake at the rear) and spin faster while drifting
- Tire-squeal sound

### Ground around elevation changes
- Terrain height used to come from the single nearest track point, which made steps and cliffs where two track sections at
  different heights are close. It's now a smooth weighted average of nearby track points, on a finer grid.
- Next to the road there's a grass shoulder that follows the road height exactly (flat to behind the barrier, then an embankment),
  so the terrain can't poke through the road or kerbs.

### Barriers (hitboxes + physics)
- The hitbox was a lateral distance to the nearest centerline point, ~1 m in front of the visible barrier.
  Now it's exact: two circles (front/rear of the kart) against the visible barrier line.
- Barriers broke at light touches (vn > 4) and then let the kart drive off into nothing (invisible wall 30 m away).
  Now they only break on hard hits, purely visually. The wall stays solid and the pieces come back after 3.5 s.
- Impact response: little bounce, friction along the wall, and on glancing hits the kart turns parallel instead of sticking.
- In tight hairpins, road edges, kerbs, barriers and walls folded over each other. They're now limited on the inside by the curve radius.

### Other bugs fixed
- Minimap sat top-left over the lap/time display (`canvas{inset:0}`), and the player arrow pointed the wrong way (mirrored).
- Bots drove through the barriers on narrow tracks (Monaco/indoor). Their lateral offset is now limited by the barriers, and bots no longer drive into each other.
- Bot speed profile was computed from too coarse a curvature (too fast in hairpins).
- Trees were placed off-centre from the track, and the placement loop could hang forever.
- C/M shortcuts overrode custom key bindings.
- The pit-stop zone sat right in La Source on Spa. It's now just before the finish line on the straight. Its "missed" logic is now independent of track length.
- Index-based constants (grid, lookahead, pit lane) were converted to metres, because the F1 tracks are sampled more finely.
- No drift button on touch devices.
