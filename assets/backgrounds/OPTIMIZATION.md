# Lobby background delivery

The current v2 PNGs and prompt records are the source artwork.
Runtime pages use WebP copies of the same images at their original resolution,
encoded at quality 0.90 on 2026-11-11. No motif or crop changed.

- Multiplayer: 1,601,560 bytes PNG → 101,456 bytes WebP.
- Single player: 1,687,518 bytes PNG → 120,946 bytes WebP.

Only the single-player image is preloaded on the game page. Multiplayer loads
when that lobby opens. Login uses the multiplayer image. No obsolete v1 images
or procedural scenery are used as loading fallbacks. Failed image loads can retry.
