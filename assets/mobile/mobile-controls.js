// Grand Poly mobile layer · in-race touch controls.
// Builds on window.KartMobile (mobile-core.js). The game's only input surface reachable from
// outside is the stock #touch row: game.js listens for pointerdown/pointerup on
// `#touch button[data-k]` and sets its private `keys` flags. This module keeps a desired
// state per action and flushes it to those buttons as synthetic pointer events once per
// animation frame. Proportional steering (slide/tilt) is emulated by toggling left/right per
// frame with a sigma-delta pattern; the game's steering low-pass turns that into an analog value.
// Nothing here writes game globals; all visuals are scoped under html.km-on.
(() => {
  'use strict';
  const KM = window.KartMobile;
  if (!KM || KM.controls) return;

  const root = document.documentElement;
  const ACTIONS = ['up', 'down', 'left', 'right', 'drift', 'item'];
  const REASSERT_MS = 300;    // held keys are re-sent this often (the game zeroes keys on pause etc.)
  const SLIDE_DEAD = 8;       // px around the slide origin that count as centre
  const SLIDE_FULL = 70;      // px (× size) for full lock
  const TILT_DEAD = 3;        // degrees
  const DRIFT_INTENT = 0.12;  // |steer| above this while drift is held counts as "clearly steering"
  const DRIFT_FLOOR = 0.55;   // ...and is raised to at least this, so the game's 0.3 drift threshold is cleared
  const ITEM_PULSE_FRAMES = 2;

  // ---------------------------------------------------------------- strings
  const STR = {
    group: { de: 'Touch-Steuerung', en: 'Touch controls', fr: 'Commandes tactiles' },
    left: { de: 'Links lenken', en: 'Steer left', fr: 'Tourner à gauche' },
    right: { de: 'Rechts lenken', en: 'Steer right', fr: 'Tourner à droite' },
    zone: { de: 'Lenkfläche: Daumen nach links oder rechts ziehen', en: 'Steering area: drag your thumb left or right', fr: 'Zone de direction : glisse le pouce à gauche ou à droite' },
    drift: { de: 'Drift (halten)', en: 'Drift (hold)', fr: 'Drift (maintenir)' },
    driftShort: { de: 'Drift', en: 'Drift', fr: 'Drift' },
    item: { de: 'Item benutzen', en: 'Use item', fr: 'Utiliser l’objet' },
    brake: { de: 'Bremse / Rückwärts', en: 'Brake / reverse', fr: 'Frein / marche arrière' },
    brakeShort: { de: 'Bremse', en: 'Brake', fr: 'Frein' },
    gas: { de: 'Gas', en: 'Accelerate', fr: 'Accélérer' },
    gasShort: { de: 'Gas', en: 'Gas', fr: 'Gaz' },
    fullscreen: { de: 'Vollbild umschalten', en: 'Toggle fullscreen', fr: 'Basculer en plein écran' },
    tiltTap: { de: 'Tippen für Neigungssteuerung', en: 'Tap to enable tilt steering', fr: 'Touche pour activer l’inclinaison' },
    tiltMeter: { de: 'Neigung', en: 'Tilt', fr: 'Inclinaison' },
    tiltFailed: { de: 'Neigungssteuerung nicht verfügbar – Tasten aktiv', en: 'Tilt steering unavailable – using buttons', fr: 'Inclinaison indisponible – boutons activés' },
    tiltDenied: { de: 'Bewegungssensor nicht erlaubt – Tasten aktiv', en: 'Motion access denied – using buttons', fr: 'Capteur de mouvement refusé – boutons activés' },
    calibrated: { de: 'Neutralstellung gespeichert', en: 'Centre position saved', fr: 'Position neutre enregistrée' },
    // settings
    sTitle: { de: 'Touch-Steuerung', en: 'Touch controls', fr: 'Commandes tactiles' },
    sMode: { de: 'Touch-Steuerung anzeigen', en: 'Show touch controls', fr: 'Afficher les commandes tactiles' },
    sModeAuto: { de: 'Automatisch', en: 'Automatic', fr: 'Automatique' },
    sModeOn: { de: 'Immer', en: 'Always', fr: 'Toujours' },
    sModeOff: { de: 'Nie', en: 'Never', fr: 'Jamais' },
    sScheme: { de: 'Lenkung', en: 'Steering', fr: 'Direction' },
    sButtons: { de: 'Tasten ◀ ▶', en: 'Buttons ◀ ▶', fr: 'Boutons ◀ ▶' },
    sSlide: { de: 'Wischen (stufenlos)', en: 'Slide (analog)', fr: 'Glisser (analogique)' },
    sTilt: { de: 'Neigen', en: 'Tilt', fr: 'Inclinaison' },
    sAutoGas: { de: 'Automatisch Gas geben', en: 'Auto-accelerate', fr: 'Accélération automatique' },
    sMirror: { de: 'Linkshänder (Seiten tauschen)', en: 'Left-handed (swap sides)', fr: 'Gaucher (inverser les côtés)' },
    sSize: { de: 'Tastengröße', en: 'Control size', fr: 'Taille des commandes' },
    sOpacity: { de: 'Deckkraft im Ruhezustand', en: 'Idle opacity', fr: 'Opacité au repos' },
    sHaptics: { de: 'Vibration bei Berührung', en: 'Vibrate on touch', fr: 'Vibration au toucher' },
    sTiltRange: { de: 'Neigung für vollen Einschlag', en: 'Tilt for full lock', fr: 'Inclinaison pour braquage max.' },
    sCalibrate: { de: 'Neutralstellung', en: 'Centre position', fr: 'Position neutre' },
    sCalibrateBtn: { de: 'Kalibrieren', en: 'Calibrate', fr: 'Calibrer' },
    sCompact: { de: 'Kompaktes Renn-HUD', en: 'Compact race HUD', fr: 'HUD de course compact' },
  };
  const t = key => KM.text(STR[key]);

  // Small inline icons (no emoji: they render differently on every platform).
  const ICON = {
    left: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.5 4.5 7 12l8.5 7.5z" fill="currentColor"/></svg>',
    right: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 4.5 17 12l-8.5 7.5z" fill="currentColor"/></svg>',
    item: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2.8 2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z" fill="currentColor"/></svg>',
    full: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    tilt: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="3" width="10" height="18" rx="2.5" fill="none" stroke="currentColor" stroke-width="2.2" transform="rotate(-18 12 12)"/></svg>',
  };

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const stockButton = k => document.querySelector(`#touch button[data-k="${k}"]`);
  const racing = () => KM.active && KM.state === 'race';

  // ---------------------------------------------------------------- input sources
  const pointers = new Map(); // pointerId → {kind, el, action?, dir?, ox?, oy?, value?}
  const apiHeld = new Set();  // actions held through KartMobile.controls.press()
  let apiSteer = null;        // analog override in -1..1 (tests / future hook), null = off
  let itemFrames = 0;         // >0 while an item pulse is being sent
  let steerValue = 0;         // last analog steering output, -1 (left) .. +1 (right)
  let sigma = 0;              // sigma-delta accumulator

  const heldByPointer = action => {
    for (const p of pointers.values()) if (p.action === action) return true;
    return false;
  };
  const held = action => apiHeld.has(action) || heldByPointer(action);

  // Steering request before the drift adjustment, -1..1 (positive = right).
  function steerRequest() {
    if (apiSteer !== null) return apiSteer;
    if (apiHeld.has('left') || apiHeld.has('right')) return (apiHeld.has('right') ? 1 : 0) - (apiHeld.has('left') ? 1 : 0);
    // Most recent finger on the steering controls wins (Map keeps insertion order).
    let value = null;
    for (const p of pointers.values()) {
      if (p.kind === 'steer') value = p.dir;
      else if (p.kind === 'zone') value = p.value;
    }
    if (value !== null) return value;
    if (KM.get('scheme') === 'tilt' && tilt.status === 'on') return tilt.value;
    return 0;
  }

  // Desired key state. With advance=true (once per animation frame) the sigma-delta modulator
  // steps; otherwise (immediate flush from an input event) the current left/right output is kept.
  function computeKeys(advance) {
    const keys = { up: 0, down: 0, left: 0, right: 0, drift: 0, item: 0 };
    keys.down = held('down') ? 1 : 0;
    keys.drift = held('drift') ? 1 : 0;
    keys.up = (KM.get('autoGas') ? !keys.down : held('up')) ? 1 : 0;
    keys.item = itemFrames > 0 ? 1 : 0;
    let s = clamp(steerRequest(), -1, 1);
    if (keys.drift && Math.abs(s) > DRIFT_INTENT) s = Math.sign(s) * Math.max(Math.abs(s), DRIFT_FLOOR);
    steerValue = s;
    let out;
    if (Math.abs(s) >= 0.999 || s === 0) { out = Math.sign(s); sigma = 0; }
    else if (advance) {
      sigma = clamp(sigma + s, -1.5, 1.5);
      out = sigma >= 0.5 ? 1 : sigma <= -0.5 ? -1 : 0;
      sigma -= out;
    } else out = lastKeys.right - lastKeys.left;
    keys.left = out < 0 ? 1 : 0;
    keys.right = out > 0 ? 1 : 0;
    return keys;
  }

  // ---------------------------------------------------------------- virtual key driver
  const sent = Object.fromEntries(ACTIONS.map(a => [a, 0]));
  let lastKeys = { up: 0, down: 0, left: 0, right: 0, drift: 0, item: 0 };
  let lastAssert = 0;

  // Non-bubbling on purpose: the game's listeners sit on the buttons themselves, and
  // this keeps the synthetic events away from any document-level handlers.
  function send(action, down) {
    const button = stockButton(action);
    sent[action] = down ? 1 : 0;
    if (!button) return;
    button.dispatchEvent(new PointerEvent(down ? 'pointerdown' : 'pointerup', { bubbles: false, cancelable: true, pointerType: 'touch', pointerId: 9000 + ACTIONS.indexOf(action) }));
  }
  function releaseAll() {
    for (const a of ACTIONS) if (sent[a]) send(a, false);
  }

  // One driver step. `advance` is false for the immediate flush inside a pointer handler,
  // so the sigma-delta pattern still advances exactly once per frame.
  function step(advance, now = performance.now()) {
    if (!racing()) { releaseAll(); return; }
    const keys = computeKeys(advance);
    lastKeys = keys;
    for (const a of ACTIONS) if (keys[a] !== sent[a]) send(a, !!keys[a]);
    if (now - lastAssert > REASSERT_MS) {
      lastAssert = now;
      // Idempotent on the game side (keys[k]=1); heals pause/resume, exit dialog and new races.
      for (const a of ACTIONS) if (keys[a] && a !== 'item') send(a, true);
    }
    if (advance && itemFrames > 0) itemFrames--;
  }

  let rafId = 0;
  function frame(now) {
    rafId = 0;
    step(true, now);
    renderFeedback();
    housekeeping();
    if (KM.active && (KM.state === 'race' || KM.state === 'paused')) rafId = requestAnimationFrame(frame);
  }
  function startLoop() {
    if (!rafId && KM.active && (KM.state === 'race' || KM.state === 'paused')) rafId = requestAnimationFrame(frame);
  }

  function pulseItem() { itemFrames = ITEM_PULSE_FRAMES; }

  // ---------------------------------------------------------------- tilt
  const tilt = {
    status: 'off',       // off | needs-permission | waiting | on
    value: 0, roll: null, filtered: null, neutral: null, recalibrate: true,
    lastTime: 0, timer: 0, listening: false,
  };
  const D2R = Math.PI / 180;
  function screenAngle() {
    const a = screen.orientation?.angle ?? window.orientation ?? 0;
    return Number(a) || 0;
  }
  // Roll of the screen in degrees: how far the screen's right edge points up (positive)
  // or down, for any device orientation. Earth "up" in device coordinates is
  // (-cosβ·sinγ, sinβ, cosβ·cosγ); projecting it on the screen's x axis (which depends on
  // the screen rotation) handles landscape, reversed landscape and portrait alike.
  function rollFrom(e) {
    const b = e.beta * D2R, g = e.gamma * D2R, a = screenAngle() * D2R;
    const ux = -Math.cos(b) * Math.sin(g), uy = Math.sin(b);
    const sx = ux * Math.cos(a) - uy * Math.sin(a);
    return Math.asin(clamp(sx, -1, 1)) / D2R;
  }
  function onOrientation(e) {
    if (e.beta == null || e.gamma == null) return;
    const roll = rollFrom(e), now = performance.now();
    const dt = tilt.lastTime ? Math.min(0.2, (now - tilt.lastTime) / 1000) : 1;
    tilt.lastTime = now;
    tilt.filtered = tilt.filtered === null ? roll : tilt.filtered + (roll - tilt.filtered) * Math.min(1, dt / 0.08);
    tilt.roll = tilt.filtered;
    if (tilt.recalibrate || tilt.neutral === null) { tilt.neutral = tilt.roll; tilt.recalibrate = false; }
    const d = tilt.roll - tilt.neutral, range = KM.get('tiltRange');
    const magnitude = clamp((Math.abs(d) - TILT_DEAD) / Math.max(1, range - TILT_DEAD), 0, 1);
    // Right edge up = wheel turned left.
    tilt.value = -Math.sign(d) * magnitude;
    if (tilt.status !== 'on') { tilt.status = 'on'; clearTimeout(tilt.timer); renderScheme(); }
  }
  function startTiltListening() {
    if (!tilt.listening) { addEventListener('deviceorientation', onOrientation); tilt.listening = true; }
    tilt.status = 'waiting'; tilt.recalibrate = true; tilt.filtered = null;
    clearTimeout(tilt.timer);
    tilt.timer = setTimeout(() => { if (tilt.status === 'waiting') tiltFailed('tiltFailed'); }, 2500);
    renderScheme();
  }
  function stopTilt() {
    if (tilt.listening) removeEventListener('deviceorientation', onOrientation);
    tilt.listening = false; tilt.status = 'off'; tilt.value = 0; clearTimeout(tilt.timer);
  }
  function tiltFailed(messageKey) {
    stopTilt();
    KM.set('scheme', 'buttons');
    notify(t(messageKey));
  }
  const needsPermission = () => typeof window.DeviceOrientationEvent?.requestPermission === 'function';
  let tiltGranted = false;
  // Called when the tilt scheme becomes active (not necessarily from a gesture).
  function activateTilt() {
    if (!('DeviceOrientationEvent' in window)) { tiltFailed('tiltFailed'); return; }
    if (needsPermission() && !tiltGranted) { tilt.status = 'needs-permission'; renderScheme(); return; }
    startTiltListening();
  }
  // Must run inside a user gesture (click) where requestPermission exists (iOS Safari).
  function requestTilt() {
    if (!needsPermission() || tiltGranted) { activateTilt(); return; }
    DeviceOrientationEvent.requestPermission().then(result => {
      if (result === 'granted') { tiltGranted = true; startTiltListening(); } else tiltFailed('tiltDenied');
    }, () => tiltFailed('tiltDenied'));
  }
  function calibrate() {
    tilt.recalibrate = true;
    if (tilt.roll !== null) { tilt.neutral = tilt.roll; tilt.recalibrate = false; }
    notify(t('calibrated'));
  }

  // ---------------------------------------------------------------- extras
  function haptic(ms = 10) {
    if (KM.get('haptics') && typeof navigator.vibrate === 'function') try { navigator.vibrate(ms); } catch {}
  }

  let wakeLock = null, wakePending = false;
  async function updateWakeLock() {
    const want = KM.active && (KM.state === 'race' || KM.state === 'paused') && document.visibilityState === 'visible';
    if (!('wakeLock' in navigator)) return;
    if (want && !wakeLock && !wakePending) {
      wakePending = true;
      try {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => { wakeLock = null; });
      } catch { wakeLock = null; } finally { wakePending = false; }
    } else if (!want && wakeLock) {
      const lock = wakeLock; wakeLock = null;
      lock.release().catch(() => {});
    }
  }

  const fsEnabled = () => !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
  const fsElement = () => document.fullscreenElement || document.webkitFullscreenElement;
  function toggleFullscreen() {
    try {
      if (fsElement()) { (document.exitFullscreen || document.webkitExitFullscreen).call(document)?.catch?.(() => {}); return; }
      const request = root.requestFullscreen || root.webkitRequestFullscreen;
      Promise.resolve(request.call(root, { navigationUI: 'hide' }))
        .then(() => screen.orientation?.lock?.('landscape'))
        .catch(() => {});
    } catch {}
  }

  // ---------------------------------------------------------------- overlay DOM
  const overlay = document.createElement('div');
  overlay.id = 'kmControls';
  overlay.dataset.noTranslate = '';
  overlay.setAttribute('role', 'group');
  overlay.innerHTML = `
    <div class="km-steer">
      <button type="button" class="km-btn km-left" data-km="steer" data-dir="-1">${ICON.left}</button>
      <button type="button" class="km-btn km-right" data-km="steer" data-dir="1">${ICON.right}</button>
    </div>
    <div class="km-zone" data-km="zone" role="slider" aria-valuemin="-100" aria-valuemax="100" aria-valuenow="0">
      <div class="km-zone-hint" aria-hidden="true">${ICON.left}<i></i>${ICON.right}</div>
      <div class="km-stick" aria-hidden="true"><i class="km-knob"></i></div>
    </div>
    <div class="km-tilt">
      <button type="button" class="km-btn km-tilt-enable">${ICON.tilt}<span></span></button>
      <div class="km-tilt-meter" role="meter" aria-valuemin="-100" aria-valuemax="100" aria-valuenow="0"><i></i></div>
    </div>
    <div class="km-actions">
      <button type="button" class="km-btn km-item" data-km="item" data-action="item">${ICON.item}</button>
      <button type="button" class="km-btn km-brake" data-km="btn" data-action="down"><span></span></button>
      <button type="button" class="km-btn km-drift" data-km="btn" data-action="drift"><span></span></button>
      <button type="button" class="km-btn km-gas" data-km="btn" data-action="up"><span></span></button>
    </div>
    <button type="button" class="icon-btn km-full">${ICON.full}</button>
    <p class="km-note" role="status" aria-live="polite"></p>`;
  const $ = selector => overlay.querySelector(selector);
  const el = {
    left: $('.km-left'), right: $('.km-right'), zone: $('.km-zone'), stick: $('.km-stick'), knob: $('.km-knob'),
    tiltEnable: $('.km-tilt-enable'), tiltMeter: $('.km-tilt-meter'), item: $('.km-item'), brake: $('.km-brake'),
    drift: $('.km-drift'), gas: $('.km-gas'), full: $('.km-full'), note: $('.km-note'),
  };

  function renderText() {
    overlay.setAttribute('aria-label', t('group'));
    el.left.setAttribute('aria-label', t('left'));
    el.right.setAttribute('aria-label', t('right'));
    el.zone.setAttribute('aria-label', t('zone'));
    el.drift.setAttribute('aria-label', t('drift'));
    el.drift.firstElementChild.textContent = t('driftShort');
    el.item.setAttribute('aria-label', t('item'));
    el.brake.setAttribute('aria-label', t('brake'));
    el.brake.firstElementChild.textContent = t('brakeShort');
    el.gas.setAttribute('aria-label', t('gas'));
    el.gas.firstElementChild.textContent = t('gasShort');
    el.full.setAttribute('aria-label', t('fullscreen'));
    el.full.title = t('fullscreen');
    el.tiltEnable.setAttribute('aria-label', t('tiltTap'));
    el.tiltEnable.lastElementChild.textContent = t('tiltTap');
    el.tiltMeter.setAttribute('aria-label', t('tiltMeter'));
  }

  // Overlay-local state that CSS keys off (scheme comes from html[data-km-scheme] via core).
  function renderScheme() {
    overlay.dataset.gas = root.dataset.kmGas = KM.get('autoGas') ? 'auto' : 'pedal';
    overlay.dataset.tilt = KM.get('scheme') === 'tilt' ? tilt.status : 'off';
    el.full.hidden = !fsEnabled();
  }

  let noteTimer = 0;
  function notify(message) {
    el.note.textContent = message;
    el.note.classList.add('on');
    clearTimeout(noteTimer);
    noteTimer = setTimeout(() => el.note.classList.remove('on'), 3200);
    if (settingsUI) settingsUI.message(message);
  }

  // Pressed state and analog indicators, refreshed every frame.
  function renderFeedback() {
    const keys = lastKeys;
    const steerDir = Math.sign(steerValue);
    let fingerSteer = false;
    for (const p of pointers.values()) if (p.kind === 'steer') fingerSteer = true;
    const pressedSteer = fingerSteer || apiHeld.has('left') || apiHeld.has('right');
    el.left.classList.toggle('is-down', pressedSteer && steerDir < 0);
    el.right.classList.toggle('is-down', pressedSteer && steerDir > 0);
    el.drift.classList.toggle('is-down', !!keys.drift);
    el.brake.classList.toggle('is-down', !!keys.down);
    el.gas.classList.toggle('is-down', !!keys.up && !KM.get('autoGas'));
    el.item.classList.toggle('is-down', itemFrames > 0 || [...pointers.values()].some(p => p.kind === 'item'));
    el.zone.setAttribute('aria-valuenow', String(Math.round(steerValue * 100)));
    if (KM.get('scheme') === 'tilt') {
      el.tiltMeter.style.setProperty('--km-tilt', tilt.value.toFixed(3));
      el.tiltMeter.setAttribute('aria-valuenow', String(Math.round(tilt.value * 100)));
    }
  }

  // ---------------------------------------------------------------- pointer handling
  let steerSplit = 0; // clientX between the two steer buttons, measured on touch-down

  function slideValue(p, x) {
    const full = SLIDE_FULL * KM.get('size');
    let dx = x - p.ox;
    // Drag the origin along when the thumb overshoots, so reversing direction is immediate.
    if (Math.abs(dx) > full) { p.ox = x - Math.sign(dx) * full; dx = x - p.ox; }
    p.dx = dx;
    return Math.sign(dx) * clamp((Math.abs(dx) - SLIDE_DEAD) / (full - SLIDE_DEAD), 0, 1);
  }
  function placeStick(p) {
    const box = overlay.getBoundingClientRect();
    el.stick.style.transform = `translate(${p.ox - box.left}px, ${p.oy - box.top}px)`;
    el.knob.style.transform = `translateX(${p.dx || 0}px)`;
  }

  function onPointerDown(e) {
    const target = e.target.closest('[data-km]');
    if (!target || !overlay.contains(target)) return;
    e.preventDefault();
    try { target.setPointerCapture(e.pointerId); } catch {}
    const kind = target.dataset.km;
    let p;
    if (kind === 'steer') {
      const a = el.left.getBoundingClientRect(), b = el.right.getBoundingClientRect();
      steerSplit = (a.right + b.left) / 2;
      p = { kind, el: target, dir: e.clientX < steerSplit ? -1 : 1 };
    } else if (kind === 'zone') {
      p = { kind, el: target, ox: e.clientX, oy: e.clientY, dx: 0, value: 0 };
      el.zone.classList.add('is-active');
      placeStick(p);
    } else if (kind === 'item') {
      pulseItem();
      p = { kind, el: target, action: null };
    } else {
      p = { kind, el: target, action: target.dataset.action };
    }
    pointers.delete(e.pointerId); // re-insert so this finger becomes the most recent one
    pointers.set(e.pointerId, p);
    haptic();
    step(false);   // respond within this event instead of waiting for the next frame
    renderFeedback();
  }
  function onPointerMove(e) {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    if (p.kind === 'steer') {
      const dir = e.clientX < steerSplit ? -1 : 1;
      if (dir !== p.dir) { p.dir = dir; haptic(6); step(false); }
    } else if (p.kind === 'zone') {
      p.value = slideValue(p, e.clientX);
      placeStick(p);
    }
  }
  function onPointerEnd(e) {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    pointers.delete(e.pointerId);
    if (p.kind === 'zone' && ![...pointers.values()].some(q => q.kind === 'zone')) el.zone.classList.remove('is-active');
    step(false);
    renderFeedback();
  }
  function dropAllPointers() {
    pointers.clear();
    el.zone.classList.remove('is-active');
    step(false); // recomputes the desired state and releases what no finger holds any more
    renderFeedback();
  }

  overlay.addEventListener('pointerdown', onPointerDown);
  overlay.addEventListener('pointermove', onPointerMove);
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) overlay.addEventListener(type, onPointerEnd);
  // Suppress long-press menus, pinch and double-tap zoom on the controls only.
  overlay.addEventListener('contextmenu', e => e.preventDefault());
  overlay.addEventListener('gesturestart', e => e.preventDefault());
  overlay.addEventListener('dblclick', e => e.preventDefault());
  overlay.addEventListener('touchstart', e => { if (e.target.closest('[data-km]')) e.preventDefault(); }, { passive: false });
  // These two need a real click: Safari only grants permission/fullscreen from click/touchend.
  el.tiltEnable.addEventListener('click', requestTilt);
  el.full.addEventListener('click', toggleFullscreen);

  // ---------------------------------------------------------------- HUD housekeeping
  // hudCompact: collapse the telemetry panel once per race (it is recreated every race);
  // the player can still open it again.
  let collapsedTelemetry = null;
  function housekeeping() {
    if (!KM.get('hudCompact') || KM.state !== 'race') return;
    const telemetry = document.getElementById('raceTelemetry');
    if (telemetry && telemetry !== collapsedTelemetry) {
      collapsedTelemetry = telemetry;
      telemetry.open = false;
    }
  }

  // ---------------------------------------------------------------- settings block
  let settingsUI = null;
  function buildSettings() {
    const host = document.getElementById('settings-controls');
    if (!host) return null;
    const box = document.createElement('div');
    box.id = 'kmSettings';
    box.dataset.noTranslate = '';
    const opt = (value, key) => `<option value="${value}" data-t="${key}"></option>`;
    box.innerHTML = `
      <p class="label" data-t="sTitle"></p>
      <label class="pref-row" data-row="mode"><span data-t="sMode"></span><select data-set="mode">${opt('auto', 'sModeAuto')}${opt('on', 'sModeOn')}${opt('off', 'sModeOff')}</select></label>
      <label class="pref-row" data-row="scheme"><span data-t="sScheme"></span><select data-set="scheme">${opt('buttons', 'sButtons')}${opt('slide', 'sSlide')}${opt('tilt', 'sTilt')}</select></label>
      <label class="pref-row" data-row="tiltRange"><span data-t="sTiltRange"></span><output></output><input type="range" data-set="tiltRange" min="12" max="45" step="1"></label>
      <div class="pref-row" data-row="calibrate"><span data-t="sCalibrate"></span><button type="button" class="kb" data-t="sCalibrateBtn"></button></div>
      <label class="pref-row" data-row="autoGas"><span data-t="sAutoGas"></span><input type="checkbox" data-set="autoGas"></label>
      <label class="pref-row" data-row="mirror"><span data-t="sMirror"></span><input type="checkbox" data-set="mirror"></label>
      <label class="pref-row" data-row="size"><span data-t="sSize"></span><output></output><input type="range" data-set="size" min="0.7" max="1.4" step="0.05"></label>
      <label class="pref-row" data-row="opacity"><span data-t="sOpacity"></span><output></output><input type="range" data-set="opacity" min="0.25" max="1" step="0.05"></label>
      <label class="pref-row" data-row="haptics"><span data-t="sHaptics"></span><input type="checkbox" data-set="haptics"></label>
      <label class="pref-row" data-row="hudCompact"><span data-t="sCompact"></span><input type="checkbox" data-set="hudCompact"></label>
      <p class="km-settings-msg" role="status" aria-live="polite"></p>`;
    const binds = host.querySelector('.note') || null;
    host.insertBefore(box, binds);

    const format = { size: v => Math.round(v * 100) + ' %', opacity: v => Math.round(v * 100) + ' %', tiltRange: v => Math.round(v) + '°' };
    box.addEventListener('input', e => {
      const input = e.target.closest('input[type=range][data-set]');
      if (input) KM.set(input.dataset.set, Number(input.value));
    });
    box.addEventListener('change', e => {
      const control = e.target.closest('[data-set]');
      if (!control) return;
      const key = control.dataset.set;
      if (control.type === 'checkbox') KM.set(key, control.checked);
      else if (control.type === 'range') KM.set(key, Number(control.value));
      else {
        KM.set(key, control.value);
        // Selecting tilt is a user gesture: ask for sensor permission right here where needed.
        if (key === 'scheme' && control.value === 'tilt') requestTilt();
      }
    });
    box.querySelector('[data-row=calibrate] button').addEventListener('click', calibrate);

    const coarse = matchMedia('(hover:none),(pointer:coarse)');
    let msgTimer = 0;
    return {
      box,
      text() { for (const node of box.querySelectorAll('[data-t]')) node.textContent = t(node.dataset.t); },
      sync() {
        for (const control of box.querySelectorAll('[data-set]')) {
          const value = KM.get(control.dataset.set);
          if (control.type === 'checkbox') control.checked = value;
          else control.value = String(value);
          const out = control.parentElement.querySelector('output');
          if (out) out.textContent = format[control.dataset.set](value);
        }
        // The block is only useful on touch devices, or once someone forced the mode.
        const relevant = KM.active || coarse.matches || KM.get('mode') !== 'auto';
        box.hidden = !relevant;
        const show = (row, visible) => { box.querySelector(`[data-row=${row}]`).hidden = !visible; };
        for (const row of ['scheme', 'autoGas', 'mirror', 'size', 'opacity', 'hudCompact']) show(row, KM.active);
        show('haptics', KM.active && typeof navigator.vibrate === 'function');
        show('tiltRange', KM.active && KM.get('scheme') === 'tilt');
        show('calibrate', KM.active && KM.get('scheme') === 'tilt');
      },
      message(message) {
        const p = box.querySelector('.km-settings-msg');
        p.textContent = message;
        clearTimeout(msgTimer);
        msgTimer = setTimeout(() => { p.textContent = ''; }, 5000);
      },
    };
  }
  // The settings panel is static markup, but re-check in case something rebuilds it.
  function ensureSettings() {
    if (settingsUI && settingsUI.box.isConnected) return;
    settingsUI = buildSettings();
    if (settingsUI) { settingsUI.text(); settingsUI.sync(); }
  }

  // ---------------------------------------------------------------- wiring
  function applyScheme() {
    if (KM.get('scheme') === 'tilt') { if (tilt.status === 'off') activateTilt(); }
    else if (tilt.status !== 'off') stopTilt();
    renderScheme();
  }

  function onState({ state }) {
    if (state !== 'race') { releaseAll(); itemFrames = 0; }
    if (state === 'lobby') collapsedTelemetry = null;
    ensureSettings();
    startLoop();
    updateWakeLock();
  }

  KM.on('state', onState);
  KM.on('active', active => {
    if (!active) { dropAllPointers(); stopTilt(); }
    else applyScheme();
    settingsUI?.sync();
    startLoop();
    updateWakeLock();
  });
  KM.on('setting', ({ key }) => {
    if (key === 'scheme') { dropAllPointers(); applyScheme(); }
    if (key === 'autoGas' || key === 'tiltRange') renderScheme();
    settingsUI?.sync();
  });
  KM.on('lang', () => { renderText(); settingsUI?.text(); });

  // Fingers that the page stops seeing must not leave keys stuck.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') dropAllPointers();
    updateWakeLock();
  });
  addEventListener('blur', dropAllPointers);
  addEventListener('pagehide', dropAllPointers);
  document.addEventListener('fullscreenchange', () => overlay.classList.toggle('is-fullscreen', !!fsElement()));
  screen.orientation?.addEventListener?.('change', () => { tilt.recalibrate = true; });

  function mount() {
    document.body.append(overlay);
    renderText();
    renderScheme();
    ensureSettings();
    if (KM.active) applyScheme();
    startLoop();
    updateWakeLock();
  }
  KM.loadCSS('assets/mobile/mobile-controls.css');
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount, { once: true });

  // ---------------------------------------------------------------- public API
  // steer: current analog steering output, -1 = full left … +1 = full right
  //        (the game's own convention is the opposite sign: keys.left - keys.right).
  KM.controls = {
    get steer() { return steerValue; },
    get keys() { return { ...lastKeys }; },        // desired state of the last frame
    get sent() { return { ...sent }; },            // what the stock buttons were last told
    get scheme() { return KM.get('scheme'); },
    get tilt() { return { status: tilt.status, value: tilt.value, roll: tilt.roll, neutral: tilt.neutral }; },
    press(action) { if (action === 'item') pulseItem(); else if (ACTIONS.includes(action)) apiHeld.add(action); step(false); },
    release(action) { apiHeld.delete(action); step(false); },
    // Analog override for tests and a future analog hook; pass null to hand back to touch input.
    setSteer(value) { apiSteer = value === null || value === undefined ? null : clamp(Number(value) || 0, -1, 1); },
    releaseAll() { apiHeld.clear(); apiSteer = null; dropAllPointers(); },
    calibrate,
    requestTilt,
  };
})();
