// In-race touch controls: input driver, steering schemes and HUD layout.
//   node mobile/tests/controls.cjs           (exit code = number of failures)
//   KM_PARTS=desktop,driving,tiltFallback,layout to run a subset
//   KM_SHOTS=<dir> to choose where layout screenshots go (default: os tmpdir/km-shots)
// Game internals are read only through a test-only hook that rewrites the served game.js
// (same trick as test-race-browser.cjs); the game files themselves are untouched.
const fs = require('fs'), os = require('os'), path = require('path');
const L = require('./lib.cjs');

const SHOTS = process.env.KM_SHOTS || path.join(os.tmpdir(), 'km-shots');
const LAYOUT_VIEWPORTS = [
  { width: 844, height: 390 }, { width: 667, height: 375 }, { width: 932, height: 430 },
  { width: 390, height: 844 }, { width: 360, height: 640 }, { width: 1024, height: 768 },
];
const HUD = ['#raceTelemetry', '#camera', '#gear', '#home', '#minimap', '#sp', '#rearIndicator', '#fx'];

// Records pl/keys every game update; also counts writes of keys.item=1 (the game consumes it
// in the same frame, so sampling alone could miss it).
async function hook(page) {
  await page.route('**/assets/bundles/game.js*', async route => {
    const response = await route.fetch();
    const body = (await response.text()).replace('function update(dt){', 'function update(dt){window.__drive?.({pl,keys,state});');
    await route.fulfill({ response, body });
  });
  await page.addInitScript(() => {
    window.__samples = [];
    window.__itemSets = 0;
    window.__drive = ({ pl, keys, state }) => {
      if (!keys.__kmItem) {
        let item = keys.item || 0;
        Object.defineProperty(keys, 'item', { configurable: true, enumerable: true, get: () => item, set: v => { if (v && !item) window.__itemSets++; item = v; } });
        Object.defineProperty(keys, '__kmItem', { value: true });
      }
      window.__samples.push({ steer: pl.steer, drift: pl.drift, speed: pl.vF, up: keys.up, down: keys.down, left: keys.left, right: keys.right, spin: pl.spin > 0 || pl.fin ? 1 : 0, state, t: performance.now() });
      if (window.__samples.length > 4000) window.__samples.splice(0, 2000);
    };
  });
}

const resetSamples = page => page.evaluate(() => { window.__samples = []; });
const stats = page => page.evaluate(() => {
  const s = window.__samples, n = s.length || 1;
  const mean = k => s.reduce((a, x) => a + (+x[k] || 0), 0) / n;
  return { n: s.length, minSpeed: Math.min(...s.map(x => x.speed)), steer: mean('steer'), left: mean('left'), right: mean('right'), spin: mean('spin'), up: mean('up'), down: mean('down'), drift: s.some(x => x.drift), maxSpeed: Math.max(0, ...s.map(x => x.speed)), lastSpeed: s.length ? s[s.length - 1].speed : 0 };
});
const centre = async (page, selector) => {
  const r = await L.rect(page, selector);
  if (!r || !r.visible) throw new Error('not visible: ' + selector);
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
};

// Real multi-touch through CDP; `active` maps touch id → {x,y}.
function touchPad(cdp) {
  const active = new Map();
  const points = () => [...active].map(([id, p]) => ({ x: p.x, y: p.y, id }));
  return {
    async down(id, p) { active.set(id, p); await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points() }); },
    async move(id, p) { active.set(id, p); await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points() }); },
    // CDP's touchEnd lists the points being lifted (not the ones that remain).
    async up(id) { const p = active.get(id); if (!p) return; active.delete(id); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [{ x: p.x, y: p.y, id }] }); },
    async upAll() { for (const id of [...active.keys()]) await this.up(id); },
  };
}
// Waits game time rather than wall time: software rendering runs the game slowly.
async function waitSamples(page, count, timeout = 30000) {
  await page.waitForFunction(n => window.__samples.length >= n, count, { timeout }).catch(() => {});
}
async function waitSpeed(page, min, timeout = 60000) {
  await page.waitForFunction(v => (window.KartRaceDebug?.current?.speed ?? 0) > v, min, { timeout }).catch(() => {});
  return L.speed(page);
}

async function desktop(env, r) {
  console.log('desktop (no touch, 1280x720)');
  const { page, context, errors } = await L.open(env, { viewport: { width: 1280, height: 720 }, touch: false });
  r.ok(await page.evaluate(() => KartMobile.active === false), 'KartMobile.active is false');
  r.ok(await page.evaluate(() => !document.documentElement.classList.contains('km-on')), 'html has no km-on');
  await L.startRace(page);
  const display = await page.evaluate(() => { const e = document.getElementById('kmControls'); return e ? getComputedStyle(e).display : 'missing'; });
  r.ok(display === 'none', '#kmControls not rendered in a desktop race', display);
  const sent = await page.evaluate(() => KartMobile.controls.sent);
  r.ok(!sent.up, 'auto-gas does not touch the keys on desktop', JSON.stringify(sent));
  r.ok(errors.length === 0, 'no page errors (desktop)', errors.join(' | '));
  await context.close();
}

async function driving(env, r) {
  console.log('driving (844x390, touch)');
  const { page, context, errors } = await L.open(env, { viewport: L.VIEWPORTS.landscape, setup: hook });
  const cdp = await context.newCDPSession(page);
  const pad = touchPad(cdp);
  r.ok(await page.evaluate(() => KartMobile.active && KartMobile.controls && KartMobile.get('scheme') === 'buttons' && KartMobile.get('autoGas')), 'active with defaults (buttons, auto-gas)');
  await L.startRace(page);
  r.ok(await page.evaluate(() => KartMobile.state) === 'race', "KartMobile.state is 'race' after the countdown");
  const stockHidden = await page.evaluate(() => { const c = getComputedStyle(document.getElementById('touch')); return c.visibility === 'hidden' && c.pointerEvents === 'none'; });
  r.ok(stockHidden, 'stock #touch row is hidden and not hittable');

  // Auto-gas: accelerate without touching anything.
  const v0 = await L.speed(page);
  const v1 = await waitSpeed(page, 12);
  r.ok(v1 > 12 && v1 > v0, 'auto-gas accelerates without a gas button', `${v0?.toFixed(1)} → ${v1?.toFixed(1)} m/s`);
  r.ok(await page.evaluate(() => getComputedStyle(document.querySelector('#kmControls .km-gas')).display === 'none'), 'no gas pedal while auto-gas is on');

  // Buttons scheme: real touch holds.
  const left = await centre(page, '#kmControls .km-left'), right = await centre(page, '#kmControls .km-right');
  await pad.down(1, left); await resetSamples(page); await waitSamples(page, 25);
  const sl = await stats(page);
  r.ok(sl.steer > 0.5, 'holding ◀ steers left (game steer > 0.5)', sl.steer.toFixed(2));
  r.ok(await page.evaluate(() => document.querySelector('#kmControls .km-left').classList.contains('is-down')), '◀ shows pressed state');
  // Slide to ▶ without lifting.
  await pad.move(1, { x: (left.x + right.x) / 2 + 4, y: left.y }); await pad.move(1, right);
  await resetSamples(page); await waitSamples(page, 25);
  const sr = await stats(page);
  r.ok(sr.steer < -0.5, 'sliding the finger onto ▶ steers right', sr.steer.toFixed(2));
  await pad.up(1);
  await resetSamples(page); await waitSamples(page, 15);
  const s0 = await stats(page);
  r.ok(Math.abs(s0.steer) < 0.25, 'lifting the finger centres the steering', s0.steer.toFixed(2));

  // Drift: steer + hold drift with a second finger. The kart may hit a barrier (the game needs
  // >8 m/s at the moment drift is pressed), so press drift up to 4 times, each time at speed.
  const drift = await centre(page, '#kmControls .km-drift');
  const tryDrift = async (fingerId) => {
    let last = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      await waitSpeed(page, 10);
      await resetSamples(page);
      await pad.down(fingerId, drift);
      await waitSamples(page, 12);
      last = await stats(page);
      await pad.up(fingerId);
      if (last.drift) return { ok: true, attempt, ...last };
      await waitSamples(page, 4);
    }
    return { ok: false, ...last };
  };
  await pad.down(1, right);
  const sd = await tryDrift(2);
  r.ok(sd.ok, 'steer + hold DRIFT (multi-touch) starts a drift', `steer ${sd.steer.toFixed(2)} speed ${sd.minSpeed.toFixed(1)}..${sd.maxSpeed.toFixed(1)}`);
  await pad.upAll();

  // Item pulse.
  const before = await page.evaluate(() => window.__itemSets);
  await page.touchscreen.tap(...Object.values(await centre(page, '#kmControls .km-item')));
  await waitSamples(page, 5);
  await page.waitForTimeout(500);
  const after = await page.evaluate(() => window.__itemSets);
  r.ok(after > before, 'tapping ★ pulses keys.item', `${before} → ${after}`);
  await page.waitForFunction(() => KartMobile.controls.sent.item === 0, null, { timeout: 10000 }).catch(() => {});
  const itemSent = await page.evaluate(() => KartMobile.controls.sent.item);
  r.ok(itemSent === 0, 'item key is released again after the pulse');

  // Brake: speed drops while brake is held, and auto-gas yields.
  const vb0 = await waitSpeed(page, 12);
  const brake = await centre(page, '#kmControls .km-brake');
  await pad.down(3, brake); await resetSamples(page); await waitSamples(page, 30);
  const sb = await stats(page);
  const vb1 = await L.speed(page);
  r.ok(vb1 < vb0 - 3, 'holding BRAKE slows the kart', `${vb0.toFixed(1)} → ${vb1.toFixed(1)} m/s`);
  r.ok(sb.up < 0.2 && sb.down > 0.8, 'brake overrides auto-gas', `up ${sb.up.toFixed(2)} down ${sb.down.toFixed(2)}`);
  await pad.up(3);

  // Pause and resume with a finger still on ◀: input must resume after closing the panel.
  await pad.down(1, left);
  await page.click('#gear'); await page.waitForTimeout(600);
  r.ok(await page.evaluate(() => KartMobile.state) === 'paused', "settings panel → state 'paused'");
  const sentPaused = await page.evaluate(() => KartMobile.controls.sent);
  r.ok(!Object.values(sentPaused).some(Boolean), 'all keys released while paused', JSON.stringify(sentPaused));
  r.ok(await page.evaluate(() => !!document.querySelector('#settings-controls #kmSettings:not([hidden])')), 'touch settings block is shown in the controls tab');
  await page.click('#close'); await page.waitForTimeout(600);
  await resetSamples(page); await waitSamples(page, 25);
  const sp = await stats(page);
  r.ok(sp.steer > 0.5 && sp.up > 0.8, 'held steering and auto-gas resume after the panel closes', `steer ${sp.steer.toFixed(2)} up ${sp.up.toFixed(2)}`);
  await pad.up(1);

  // Slide scheme: ~40 % deflection gives proportional steering.
  await page.evaluate(() => KartMobile.set('scheme', 'slide'));
  await page.waitForTimeout(300);
  const zone = await L.rect(page, '#kmControls .km-zone');
  r.ok(zone && zone.visible, 'slide zone visible in slide scheme');
  r.ok(await page.evaluate(() => getComputedStyle(document.querySelector('#kmControls .km-steer')).display === 'none'), 'steer buttons hidden in slide scheme');
  const size = await page.evaluate(() => KartMobile.get('size'));
  const origin = { x: zone.x + zone.w * 0.45, y: zone.y + zone.h * 0.6 };
  const dx = 8 + 0.4 * (70 * size - 8);
  await pad.down(4, origin);
  await pad.move(4, { x: origin.x - dx / 2, y: origin.y });
  await pad.move(4, { x: origin.x - dx, y: origin.y });
  await page.waitForTimeout(200);
  const analog = await page.evaluate(() => KartMobile.controls.steer);
  r.ok(Math.abs(analog + 0.4) < 0.05, 'slide: controls.steer ≈ -0.4 at 40 % left deflection', analog.toFixed(3));
  r.ok(await page.evaluate(() => getComputedStyle(document.querySelector('#kmControls .km-stick')).display !== 'none'), 'slide: knob shown while touching');
  await resetSamples(page); await waitSamples(page, 60);
  const ss = await stats(page);
  // The key duty is what the add-on controls; the game's steer value is only comparable on
  // frames where the kart is controllable (after a wall hit the game forces steering to 0).
  const sc = await page.evaluate(() => { const c = window.__samples.filter(x => !x.spin); return { n: c.length, steer: c.reduce((a, x) => a + x.steer, 0) / (c.length || 1) }; });
  const slideDetail = `steer ${sc.steer.toFixed(3)} over ${sc.n}/${ss.n} controllable frames, left duty ${ss.left.toFixed(2)}, right duty ${ss.right.toFixed(2)}`;
  r.ok(ss.left > 0.3 && ss.left < 0.5 && ss.right === 0, 'slide: left key duty ≈ 40 % at 40 % deflection', slideDetail);
  r.ok(sc.n < 10 || (sc.steer > 0.2 && sc.steer < 0.7), 'slide: mean game steer is proportional (0.2..0.7)', slideDetail);
  // Drift held at this small deflection: output is pushed past the 0.3 threshold.
  await pad.down(5, drift);
  await page.waitForTimeout(100);
  const boosted = await page.evaluate(() => KartMobile.controls.steer);
  r.ok(boosted <= -0.55 + 1e-6, 'slide + drift: steering raised past the drift threshold', boosted.toFixed(2));
  await pad.up(5);
  const sdd = await tryDrift(5);
  r.ok(sdd.ok, 'slide + drift at 40 % deflection starts a drift', `mean steer ${sdd.steer.toFixed(2)} speed ${sdd.minSpeed.toFixed(1)}..${sdd.maxSpeed.toFixed(1)}`);
  await pad.upAll();
  await page.waitForTimeout(200);
  r.ok(await page.evaluate(() => KartMobile.controls.steer === 0), 'slide: releasing returns steer to 0');

  // Auto-gas off: gas pedal appears and drives.
  await page.evaluate(() => { KartMobile.set('scheme', 'buttons'); KartMobile.set('autoGas', false); });
  await page.waitForTimeout(300);
  const gasRect = await L.rect(page, '#kmControls .km-gas');
  r.ok(gasRect && gasRect.visible, 'gas pedal shown with auto-gas off');
  await resetSamples(page); await waitSamples(page, 15);
  r.ok((await stats(page)).up < 0.1, 'no throttle without the pedal when auto-gas is off');
  await pad.down(6, await centre(page, '#kmControls .km-gas'));
  await resetSamples(page); await waitSamples(page, 15);
  r.ok((await stats(page)).up > 0.9, 'gas pedal holds throttle');
  await pad.upAll();
  await page.evaluate(() => KartMobile.set('autoGas', true));

  // Second race: listeners are rebound by the game; the driver must keep working.
  await page.evaluate(() => leaveSingleRace());
  await page.waitForFunction(() => KartMobile.state === 'lobby', null, { timeout: 30000 }).catch(() => {});
  r.ok(await page.evaluate(() => KartMobile.state) === 'lobby', "leaveSingleRace → state 'lobby'");
  r.ok(await page.evaluate(() => !Object.values(KartMobile.controls.sent).some(Boolean)), 'all keys released in the lobby');
  await L.startRace(page);
  r.ok(await page.evaluate(() => KartMobile.state) === 'race', "second race: state 'race'");
  const w1 = await waitSpeed(page, 8);
  r.ok(w1 > 8, 'second race: auto-gas accelerates', w1?.toFixed(1));
  await pad.down(1, await centre(page, '#kmControls .km-right'));
  await resetSamples(page); await waitSamples(page, 25);
  const s2 = await stats(page);
  r.ok(s2.steer < -0.5, 'second race: ▶ steers right', s2.steer.toFixed(2));
  await pad.upAll();

  // Telemetry collapsed once per race with hudCompact.
  r.ok(await page.evaluate(() => document.getElementById('raceTelemetry')?.open === false), 'compact HUD collapses #raceTelemetry');

  // Language switch re-renders own strings.
  await page.evaluate(() => { document.documentElement.lang = 'en'; });
  await page.waitForTimeout(100);
  r.ok(await page.evaluate(() => document.querySelector('#kmControls .km-brake').getAttribute('aria-label') === 'Brake / reverse'), 'labels follow the game language');
  await page.evaluate(() => { document.documentElement.lang = 'de'; });

  // Background/blur releases everything.
  await pad.down(1, await centre(page, '#kmControls .km-left'));
  await page.evaluate(() => dispatchEvent(new Event('blur')));
  await page.waitForTimeout(100);
  r.ok(await page.evaluate(() => !KartMobile.controls.keys.left && !KartMobile.controls.sent.left), 'window blur releases held touch keys');
  await pad.upAll();

  r.ok(errors.length === 0, 'no page errors (driving)', errors.join(' | '));
  await context.close();
}

async function layout(env, r) {
  console.log('layout');
  fs.mkdirSync(SHOTS, { recursive: true });
  const { page, context, errors } = await L.open(env, { viewport: LAYOUT_VIEWPORTS[0] });
  await L.startRace(page, { bots: 5 });
  await page.waitForTimeout(1500);
  const variants = [
    { name: 'default', settings: {} },
    { name: 'pedal', settings: { autoGas: false } },
    { name: 'mirror', settings: { mirror: true, autoGas: false } },
    { name: 'telemetry-open', settings: {}, telemetryOpen: true },
    // The classes game.js sets for the cockpit camera (moves #sp/#camera in the stock CSS).
    { name: 'cockpit', settings: {}, cockpit: true },
  ];
  for (const vp of LAYOUT_VIEWPORTS) {
    await page.setViewportSize(vp);
    for (const variant of variants) {
      await page.evaluate(s => { for (const k of ['autoGas', 'mirror']) KartMobile.set(k, KartMobile.DEFAULTS[k]); for (const k in s) KartMobile.set(k, s[k]); }, variant.settings);
      await page.evaluate(open => { const t = document.getElementById('raceTelemetry'); if (t) t.open = open; }, !!variant.telemetryOpen);
      await page.evaluate(on => { document.getElementById('sp').classList.toggle('cockpit-speed', on); document.getElementById('camera').classList.toggle('cockpit-camera', on); }, !!variant.cockpit);
      await page.waitForTimeout(350);
      const tag = `${vp.width}x${vp.height} ${variant.name}`;
      const data = await page.evaluate(hud => {
        const box = e => { const r = e.getBoundingClientRect(), c = getComputedStyle(e); return { x: r.x, y: r.y, w: r.width, h: r.height, visible: c.display !== 'none' && c.visibility !== 'hidden' && r.width > 0 && r.height > 0 }; };
        const controls = [...document.querySelectorAll('#kmControls .km-btn, #kmControls .km-full')].map(e => ({ name: e.className.split(' ').find(c => c.startsWith('km-') && c !== 'km-btn'), ...box(e) })).filter(b => b.visible);
        const huds = hud.map(s => { const e = document.querySelector(s); return e ? { name: s, ...box(e) } : null; }).filter(b => b && b.visible);
        return { controls, huds, vw: innerWidth, vh: innerHeight };
      }, HUD);
      const problems = [];
      for (const c of data.controls) {
        if (c.x < 0 || c.y < 0 || c.x + c.w > data.vw + 0.5 || c.y + c.h > data.vh + 0.5) problems.push(`${c.name} outside viewport`);
        if (c.name !== 'km-full' && (c.x < 19.5 || c.x + c.w > data.vw - 19.5)) problems.push(`${c.name} closer than 20px to a side edge`);
      }
      for (let i = 0; i < data.controls.length; i++) for (let j = i + 1; j < data.controls.length; j++)
        if (L.overlap(data.controls[i], data.controls[j])) problems.push(`${data.controls[i].name} overlaps ${data.controls[j].name}`);
      for (const c of data.controls) for (const h of data.huds) if (L.overlap(c, h)) problems.push(`${h.name} overlaps ${c.name}`);
      const names = data.controls.map(c => c.name);
      const expected = ['km-left', 'km-right', 'km-item', 'km-brake', 'km-drift', ...(variant.settings.autoGas === false ? ['km-gas'] : [])];
      const missing = expected.filter(n => !names.includes(n));
      if (missing.length) problems.push('missing ' + missing.join(','));
      if (variant.settings.mirror) {
        const drift = data.controls.find(c => c.name === 'km-drift'), leftBtn = data.controls.find(c => c.name === 'km-left');
        if (!(drift && leftBtn && drift.x < leftBtn.x)) problems.push('mirror did not swap the clusters');
      }
      r.ok(problems.length === 0, `layout ${tag}`, problems.join('; '));
      if (variant.name === 'default' || variant.name === 'pedal') await page.screenshot({ path: path.join(SHOTS, `${vp.width}x${vp.height}-${variant.name}.png`) });
    }
  }
  // Slide and the "tap to enable" tilt prompt are visual only; just check they stay inside.
  await page.evaluate(() => { KartMobile.set('mirror', false); KartMobile.set('autoGas', true); KartMobile.set('scheme', 'slide'); });
  await page.setViewportSize(LAYOUT_VIEWPORTS[1]);
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(SHOTS, '667x375-slide.png') });
  await page.evaluate(() => KartMobile.set('scheme', 'buttons'));
  r.ok(errors.length === 0, 'no page errors (layout)', errors.join(' | '));
  await context.close();
}

async function tiltFallback(env, r) {
  console.log('tilt fallback (headless has no orientation sensor)');
  // Granting the sensor permissions makes Chromium's requestPermission() resolve 'granted'
  // (without it, it resolves 'prompt', which the module treats as denied).
  const grant = (page, context) => context.grantPermissions(['accelerometer', 'gyroscope', 'magnetometer']);
  const { page, context, errors } = await L.open(env, { viewport: L.VIEWPORTS.landscape, setup: grant });
  await L.startRace(page);
  // Chromium exposes DeviceOrientationEvent.requestPermission, so tilt first asks for a tap.
  const enable = async () => {
    await page.waitForTimeout(200);
    const status = await page.evaluate(() => KartMobile.controls.tilt.status);
    if (status === 'needs-permission') {
      const button = await L.rect(page, '#kmControls .km-tilt-enable');
      r.ok(button && button.visible, '"tap to enable tilt" prompt shown while permission is needed');
      await page.touchscreen.tap(button.x + button.w / 2, button.y + button.h / 2);
    }
  };
  await page.evaluate(() => KartMobile.set('scheme', 'tilt'));
  await enable();
  await page.waitForFunction(() => KartMobile.get('scheme') === 'buttons', null, { timeout: 15000 }).catch(() => {});
  r.ok(await page.evaluate(() => KartMobile.get('scheme')) === 'buttons', 'tilt without sensor data falls back to buttons');
  r.ok(await page.evaluate(() => document.querySelector('#kmControls .km-note').classList.contains('on') && !!document.querySelector('#kmControls .km-note').textContent), 'fallback shows an inline notice');
  // Synthetic orientation events: roll to the left (right edge up) steers left.
  await page.evaluate(() => KartMobile.set('scheme', 'tilt'));
  await enable();
  await page.evaluate(() => {
    const fire = (beta, gamma) => dispatchEvent(Object.assign(new Event('deviceorientation'), { beta, gamma, alpha: 0 }));
    window.__fireTilt = fire;
    fire(0, 0);
  });
  await page.waitForTimeout(200);
  // Landscape (angle 90): screen-right is device -y, so positive beta raises the left edge.
  const angle = await page.evaluate(() => screen.orientation?.angle ?? 0);
  await page.evaluate(async a => { for (let i = 0; i < 20; i++) { window.__fireTilt(a === 90 ? -20 : 0, a === 90 ? 0 : -20); await new Promise(f => setTimeout(f, 30)); } }, angle);
  await page.waitForTimeout(150);
  const tilt = await page.evaluate(() => KartMobile.controls.tilt);
  r.ok(tilt.status === 'on' && tilt.value < -0.5, 'synthetic tilt (right edge up) steers left', JSON.stringify(tilt));
  r.ok(await page.evaluate(() => getComputedStyle(document.querySelector('#kmControls .km-steer')).display === 'none'), 'tilt scheme frees the left side');
  await page.evaluate(() => KartMobile.set('scheme', 'buttons'));
  r.ok(errors.length === 0, 'no page errors (tilt)', errors.join(' | '));
  await context.close();
}

(async () => {
  const r = L.reporter('controls');
  const env = await L.environment();
  try {
    const only = (process.env.KM_PARTS || '').split(',').filter(Boolean); // e.g. KM_PARTS=layout,tiltFallback
    for (const part of [desktop, driving, tiltFallback, layout].filter(p => !only.length || only.includes(p.name))) {
      try { await part(env, r); } catch (e) { r.ok(false, part.name + ' crashed', e.stack || e.message); }
    }
  } finally { await env.close(); }
  console.log('screenshots: ' + SHOTS);
  process.exit(r.done());
})();
