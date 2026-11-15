/* Garage with the Customizer: once bought, the body colour of any vehicle can be chosen freely.
   Standalone module. Like kart-designs.js it uses the host page's globals (SAVE, PAINTS, KartGT3,
   KartModels, openSheet, ...) when called, so it can be loaded before the inline script.
   Integrated with server-authoritative purchases and account settings. */
window.KartGarage = (() => {
 'use strict';
 const TOOL = 'customizer', PRICE = 15000, SLOTS = 8, FALLBACK = '#e5b30e';

 const WORDS = {
  de: { title: 'Garage', karts: 'Karts', paint: 'Lackierung', wheel: 'Lenkrad', custom: 'Eigene Farbe', equip: 'Ausrüsten', equipped: 'Ausgerüstet',
   pad: 'Sättigung und Helligkeit', hue: 'Farbton', hex: 'Farbcode', save: 'Speichern', saved: 'Gespeicherte Farben', apply: 'Farbe anwenden', remove: 'Farbe entfernen',
   shop: 'Zum Shop', note: 'Weitere Lackierungen gibt es im Shop. Die Auswahl gilt auch online.', buy: 'Customizer freischalten',
   unlocked: 'Freigeschaltet', coins: 'Zu wenig Münzen', conflict: 'Bitte lade die Seite neu.', failed: 'Kauf fehlgeschlagen. Bitte erneut versuchen.' },
  en: { title: 'Garage', karts: 'Karts', paint: 'Paint', wheel: 'Steering wheel', custom: 'Custom colour', equip: 'Equip', equipped: 'Equipped',
   pad: 'Saturation and brightness', hue: 'Hue', hex: 'Colour code', save: 'Save', saved: 'Saved colours', apply: 'Apply colour', remove: 'Remove colour',
   shop: 'To the shop', note: 'More paints are available in the shop. Your choice also applies online.', buy: 'Unlock customizer',
   unlocked: 'Unlocked', coins: 'Not enough coins', conflict: 'Please reload the page.', failed: 'Purchase failed. Please try again.' },
  fr: { title: 'Garage', karts: 'Karts', paint: 'Peinture', wheel: 'Volant', custom: 'Couleur perso', equip: 'Équiper', equipped: 'Équipé',
   pad: 'Saturation et luminosité', hue: 'Teinte', hex: 'Code couleur', save: 'Enregistrer', saved: 'Couleurs enregistrées', apply: 'Appliquer la couleur', remove: 'Supprimer la couleur',
   shop: 'Vers la boutique', note: 'Plus de peintures sont disponibles dans la boutique. Ton choix vaut aussi en ligne.', buy: 'Débloquer le customizer',
   unlocked: 'Débloqué', coins: 'Pièces insuffisantes', conflict: 'Recharge la page.', failed: 'Achat échoué. Réessaie.' }
 };
 const t = k => (WORDS[document.documentElement.lang] || WORDS.de)[k];

 // ---- colour helpers -------------------------------------------------------------------------
 const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
 function parse(v) { v = String(v == null ? '' : v).trim().toLowerCase().replace(/^#/, ''); if (/^[0-9a-f]{3}$/.test(v)) v = v.replace(/./g, c => c + c); return /^[0-9a-f]{6}$/.test(v) ? '#' + v : null; }
 function hsv2hex(h, s, v) {
  const f = n => { const k = (n + h / 60) % 6, x = v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); return Math.round(x * 255).toString(16).padStart(2, '0'); };
  return '#' + f(5) + f(3) + f(1);
 }
 function hex2hsv(hex, keepHue = 0) {
  const n = parseInt(hex.slice(1), 16), r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255, max = Math.max(r, g, b), d = max - Math.min(r, g, b);
  let h = keepHue; if (d > .0001) h = (max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60;
  return { h, s: max ? d / max : 0, v: max };
 }
 const hexNum = hex => parseInt(hex.slice(1), 16);
 const numHex = n => '#' + (n >>> 0).toString(16).padStart(6, '0');

 // ---- save data --------------------------------------------------------------------------------
 const defaults = () => ({ ownedTools: [], paintMode: 'preset', customPaint: FALLBACK, savedPaints: [] }); // spread into DEF_SAVE
 function normalize(s) { // call at the end of loadSave(), like KartAmbient.normalize(s)
  s.ownedTools = [...new Set((Array.isArray(s.ownedTools) ? s.ownedTools : []).filter(v => v === TOOL))];
  s.customPaint = parse(s.customPaint) || FALLBACK;
  s.savedPaints = [...new Set((Array.isArray(s.savedPaints) ? s.savedPaints : []).map(parse).filter(Boolean))].slice(0, SLOTS);
  if (!['preset', 'custom'].includes(s.paintMode) || !s.ownedTools.includes(TOOL)) s.paintMode = 'preset'; // revoked tool falls back to the preset
  return s;
 }
 const owns = () => SAVE.ownedTools.includes(TOOL);
 const custom = () => owns() && SAVE.paintMode === 'custom';
 const paintColor = () => custom() ? hexNum(SAVE.customPaint) : PAINTS[SAVE.paint].c; // replaces the host paintColor()

 // Recolour the paint materials of the showroom car in place, so dragging does not rebuild the model.
 function tint(root, from, to) {
  if (!root) return; const f = hexNum(from), n = hexNum(to), seen = new Set();
  root.traverse(o => {
   if (!o.isMesh) return;
   for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
    if (!m || seen.has(m)) continue; seen.add(m);
    if (m.userData && m.userData.baseColor !== undefined) { m.userData.baseColor = n; if (KartSeason.skin(m.userData.livery) !== 'christmas') m.color.setHex(n).convertSRGBToLinear(); }
    else if (m.color && (m.isMeshPhysicalMaterial || m.isMeshStandardMaterial) && m.color.getHex() === f) m.color.setHex(n);
   }
  });
 }

 // ---- purchase ----------------------------------------------------------------------------------
 let pending = false;
 async function buy() {
  if (pending || owns()) return false; pending = true;
  const inert = $('menu').inert; $('menu').inert = true; $('sheetClose').disabled = true;
  try {
   if (window.KartAccount) await KartAccount.buyCosmetic('tool', TOOL); // server checks owner and coins atomically
   else { if (SAVE.coins < PRICE) throw { code: 'coins' }; SAVE.coins -= PRICE; SAVE.ownedTools.push(TOOL); }
   if (!owns()) throw { code: 'failed' };
   SAVE.paintMode = 'custom'; persist(); if(window.KartAccount)await KartAccount.flush(); showroomKart(); renderLobby(); flash(t('unlocked'), 'var(--lime)'); return true;
  } catch (e) { flash(e.code === 'coins' ? t('coins') : e.code === 'conflict' ? t('conflict') : t('failed'), 'var(--red)'); return false; }
  finally { pending = false; $('menu').inert = inert; $('sheetClose').disabled = false; }
 }

 // ---- styles ------------------------------------------------------------------------------------
 const css = `
.gc-garage #gW .seg{flex-wrap:wrap}
.gc-garage #gW .seg button{flex:1 1 80px}
.gc-editor{display:grid;grid-template-columns:minmax(0,1fr);min-width:0;width:100%;box-sizing:border-box;gap:12px;padding:12px;border:var(--bw) solid var(--navy);border-radius:var(--r);background:var(--navy-2)}
.gc-pad{position:relative;height:150px;border-radius:10px;border:3px solid var(--navy);cursor:crosshair;touch-action:none;
 background:linear-gradient(to top,#000,#0000),linear-gradient(to right,#fff,hsl(var(--hue,0),100%,50%))}
.gc-knob{position:absolute;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 0 2px var(--navy),0 2px 6px #0008;pointer-events:none}
.gc-pad:focus-visible,.gc-hue:focus-visible,.gc-hex:focus-visible{outline:4px solid var(--white);outline-offset:3px}
.gc-hue{-webkit-appearance:none;appearance:none;width:100%;height:22px;margin:0;border-radius:11px;border:3px solid var(--navy);cursor:pointer;
 background:linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)}
.gc-hue::-webkit-slider-thumb{-webkit-appearance:none;width:26px;height:26px;border-radius:50%;background:#fff;border:3px solid var(--navy);box-shadow:0 2px 0 var(--navy)}
.gc-hue::-moz-range-thumb{width:20px;height:20px;border-radius:50%;background:#fff;border:3px solid var(--navy)}
.gc-line{display:flex;flex-wrap:wrap;min-width:0;gap:10px;align-items:center}
.gc-line .gc-hex{flex:1 1 110px}
.gc-line .gc-save{flex:0 0 auto;max-width:100%;font-size:15px}
.gc-line .gc-save .bt b{font-size:17px}
.gc-hue{box-sizing:border-box;min-width:0}
.gc-now{flex:none;width:52px;height:46px;border-radius:10px;border:3px solid var(--navy);box-shadow:inset 0 -8px 0 rgba(0,0,0,.18),inset 0 5px 0 rgba(255,255,255,.25)}
.gc-hex{flex:1;min-width:0;min-height:46px;padding:10px 12px;background:var(--navy);color:var(--white);border:3px solid #4c4268;border-radius:10px;font:inherit;font-size:17px;letter-spacing:.06em;box-sizing:border-box}
.gc-saved{display:flex;flex-wrap:wrap;gap:8px}
.gc-slot{position:relative;display:inline-flex}
.gc-chip{width:44px;height:44px;border-radius:10px;border:3px solid var(--navy);cursor:pointer;padding:0;box-shadow:0 3px 0 var(--navy);transition:transform var(--t-fast) var(--ease)}
.gc-chip:hover:not(:disabled){transform:translateY(-2px)}.gc-chip:active:not(:disabled){transform:translateY(1px) scale(.96)}
.gc-chip.gc-empty{background:transparent;border-style:dashed;border-color:#4c4268;box-shadow:none;cursor:default}
.gc-del{position:absolute;top:-8px;right:-8px;width:22px;height:22px;padding:0;border-radius:50%;border:2px solid var(--navy);background:var(--yellow);color:var(--navy);font:900 14px/16px var(--font-u);cursor:pointer;opacity:0;transition:opacity var(--t-fast) var(--ease)}
.gc-slot:hover .gc-del,.gc-slot:focus-within .gc-del{opacity:1}
@media (hover:none){.gc-del{opacity:1}}
.gc-rainbow{display:flex;align-items:center;justify-content:center;background:conic-gradient(#f33,#fc0,#3d5,#2cf,#83f,#f3a,#f33)}
.gc-rainbow .ic{width:30px;height:30px}
@media (prefers-reduced-motion:reduce){.gc-chip,.gc-del{transition:none}.gc-chip:hover:not(:disabled),.gc-chip:active:not(:disabled){transform:none}}`;
 let styled = false;
 const addStyle = () => { if (styled) return; styled = true; const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s); };

 // ---- colour editor -----------------------------------------------------------------------------
 const editorHTML = () => `<div class="gc-editor" id="gcEditor">
  <div class="gc-pad" tabindex="0" role="application" aria-label="${t('pad')}"><i class="gc-knob"></i></div>
  <input class="gc-hue" type="range" min="0" max="360" step="1" aria-label="${t('hue')}">
  <div class="gc-line"><span class="gc-now"></span><input class="gc-hex" type="text" maxlength="7" spellcheck="false" autocomplete="off" aria-label="${t('hex')}">
   <button type="button" class="btn btn-small gc-save" style="--c:var(--lime);color:var(--navy)"><span class="bt"><b>${t('save')}</b></span></button></div>
  <div class="gc-saved" role="group" aria-label="${t('saved')}"></div></div>`;

 function mountEditor(box, swatchOf) {
  const pad = box.querySelector('.gc-pad'), knob = pad.firstElementChild, hue = box.querySelector('.gc-hue'), hexIn = box.querySelector('.gc-hex'),
   now = box.querySelector('.gc-now'), saved = box.querySelector('.gc-saved');
  let { h, s, v } = hex2hsv(SAVE.customPaint), applied = SAVE.customPaint, timer = 0;
  const ui = () => { const hex = hsv2hex(h, s, v); pad.style.setProperty('--hue', h); knob.style.left = s * 100 + '%'; knob.style.top = (1 - v) * 100 + '%'; hue.value = Math.round(h); now.style.background = hex; if (document.activeElement !== hexIn) hexIn.value = hex; const c = swatchOf(); if (c) c.style.background = hex; };
  const commit = () => { clearTimeout(timer); timer=0; persist(); showroomKart(); applied = SAVE.customPaint; };
  const apply = soon => { const hex = hsv2hex(h, s, v); if (hex !== SAVE.customPaint) { SAVE.customPaint = hex; tint(SR.kart, applied, hex); applied = hex; } ui(); persist(); clearTimeout(timer); timer = setTimeout(commit, 350); if (!soon) return; commit(); };
  const setHex = (hex, soon) => { const p = hex2hsv(hex, h); h = p.h; s = p.s; v = p.v; apply(soon); };
  // Saturation / brightness field: pointer drag and arrow keys.
  const move = e => { const r = pad.getBoundingClientRect(); s = clamp((e.clientX - r.left) / r.width, 0, 1); v = 1 - clamp((e.clientY - r.top) / r.height, 0, 1); apply(false); };
  pad.addEventListener('pointerdown', e => { pad.setPointerCapture(e.pointerId); pad.focus({ preventScroll: true }); move(e); });
  pad.addEventListener('pointermove', e => { if (pad.hasPointerCapture(e.pointerId)) move(e); });
  pad.addEventListener('pointerup', e => { if (pad.hasPointerCapture(e.pointerId)) { pad.releasePointerCapture(e.pointerId); commit(); } });
  pad.addEventListener('keydown', e => { const d = e.shiftKey ? .1 : .02; let used = true; if (e.key === 'ArrowLeft') s = clamp(s - d, 0, 1); else if (e.key === 'ArrowRight') s = clamp(s + d, 0, 1); else if (e.key === 'ArrowUp') v = clamp(v + d, 0, 1); else if (e.key === 'ArrowDown') v = clamp(v - d, 0, 1); else used = false; if (used) { e.preventDefault(); apply(false); } });
  hue.addEventListener('input', () => { h = +hue.value; apply(false); });
  hue.addEventListener('change', commit);
  hexIn.addEventListener('input', () => { const hex = parse(hexIn.value); if (hex && hexIn.value.replace('#', '').length >= 3) setHex(hex, false); });
  hexIn.addEventListener('change', () => { const hex = parse(hexIn.value); if (hex) setHex(hex, true); hexIn.value = SAVE.customPaint; });
  // Saved colours.
  const drawSaved = () => { saved.innerHTML = Array.from({ length: SLOTS }, (_, i) => { const c = SAVE.savedPaints[i]; return c ? `<span class="gc-slot"><button type="button" class="gc-chip" data-c="${c}" style="background:${c}" aria-label="${t('apply')} ${c}"></button><button type="button" class="gc-del" data-d="${i}" aria-label="${t('remove')} ${c}">×</button></span>` : `<span class="gc-slot"><span class="gc-chip gc-empty"></span></span>`; }).join(''); };
  saved.addEventListener('click', e => { const chip = e.target.closest('[data-c]'), del = e.target.closest('[data-d]'); if (chip) setHex(chip.dataset.c, true); else if (del) { SAVE.savedPaints.splice(+del.dataset.d, 1); persist(); drawSaved(); } });
  box.querySelector('.gc-save').onclick = () => { SAVE.savedPaints = [SAVE.customPaint, ...SAVE.savedPaints.filter(c => c !== SAVE.customPaint)].slice(0, SLOTS); persist(); drawSaved(); };
  drawSaved(); ui();
  return () => { if(timer)commit(); }; 
 }

 // ---- garage sheet ------------------------------------------------------------------------------
 const customCard = () => owns()
  ? `<button type="button" class="card-btn" data-custom aria-pressed="${custom()}"><span class="swatch" style="background:${SAVE.customPaint}"></span><b>${t('custom')}</b><small>${custom() ? t('equipped') : t('equip')}</small></button>`
  : `<button type="button" class="card-btn" data-buy-tool${SAVE.coins < PRICE ? ' disabled' : ''} aria-label="${t('buy')}"><span class="swatch gc-rainbow">${ic('lock')}</span><b>${t('custom')}</b><small><span class="coin-inline">${ic('coin')}${PRICE}</span></small></button>`;

 function open() {
  addStyle();
  const body = el('<div class="gc-garage" style="display:flex;flex-direction:column;gap:14px;min-width:0"></div>');
  let stopEditor = () => { };
  const draw = () => {
   stopEditor(); stopEditor = () => { };
   const grid = 'style="grid-template-columns:repeat(auto-fill,minmax(120px,1fr))"';
   body.innerHTML = `<p class="label">${t('karts')}</p><div class="vehicle-grid">${KartModels.models.filter(m=>!m.seasonal||KartSeason.active()).map(m => kartDesignCard(m, 'garage')).join('')}</div>`
    + `<p class="label">GT3</p><div class="vehicle-grid">${KartGT3.cars.map(c => vehicleCard(c[0], 'garage')).join('')}</div>`
    + `<p class="label" id="gcPaintLabel">${t('paint')}</p>`
    + `<div class="grid-cards" ${grid}>${PAINTS.map((_, i) => paintCard(i, 'garage')).join('')}${customCard()}</div>`
    + (custom() ? editorHTML() : '')
    + `<p class="label">${t('wheel')}</p><div id="gW">${seg(t('wheel'), WSTYLES.map((n, i) => [i, n]), WSTYLE, 'var(--lime)')}</div>`;
   KartTuning.entry(body);
   if (SAVE.category === 'kart' && KartSeason.active()) body.querySelector('#gcPaintLabel').insertAdjacentHTML('afterend', '<div id="kartSkin">' + seg('Kart-Design', [['original', 'Original'], ['christmas', 'Christmas']], KartSeason.skin(SAVE.kartSkin), 'var(--red)') + '</div>');
   if (body.querySelector('#kartSkin')) bindSeg(body, '#kartSkin', v => { if (v === 'christmas' && !KartSeason.active()) return; SAVE.kartSkin = v; SAVE.kartModel=v==='christmas'?'christmas':'original';persist(); showroomKart(); renderLobby(); draw(); });
   body.querySelectorAll('[data-kart]').forEach(b => b.onclick = () => { const id = b.dataset.kart; if (!SAVE.ownedKarts.includes(id)) return; if(id==='christmas'&&!KartSeason.active())return; SAVE.kartSkin=id==='christmas'?'christmas':'original';SAVE.kartModel = id; SAVE.category = 'kart'; persist(); showroomKart(); renderLobby(); draw(); });
   body.querySelectorAll('[data-car]').forEach(b => b.onclick = () => { const id = b.dataset.car; if (id !== 'kart' && !SAVE.ownedCars.includes(id)) return; SAVE.category = id === 'kart' ? 'kart' : 'gt3'; if (id !== 'kart') SAVE.car = id; persist(); showroomKart(); renderLobby(); draw(); body.querySelector('[data-car="' + id + '"]').focus(); });
   body.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { SAVE.paint = +b.dataset.p; SAVE.paintMode = 'preset'; persist(); showroomKart(); draw(); body.querySelector('[data-p="' + SAVE.paint + '"]').focus(); });
   const cc = body.querySelector('[data-custom]'); if (cc) cc.onclick = () => { SAVE.paintMode = 'custom'; persist(); showroomKart(); draw(); body.querySelector('[data-custom]').focus(); };
   const bt = body.querySelector('[data-buy-tool]'); if (bt) bt.onclick = async () => { if (await buy()) { draw(); body.querySelector('[data-custom]').focus(); } };
   bindSeg(body, '#gW', v => { WSTYLE = +v; try { KartStorage.setItem('kart-wheel', WSTYLE); } catch (e) { } showroomKart(); });
   const box = body.querySelector('#gcEditor'); if (box) stopEditor = mountEditor(box, () => body.querySelector('[data-custom] .swatch'));
  };
  draw();
  const foot = el('<button class="btn btn-small" type="button" style="--c:var(--red);width:100%"><span class="bt"><b>' + t('shop') + '</b></span>' + ic('bag') + '</button>');
  foot.onclick = () => { closeSheet(); openShop(); };
  SR.spin = true; openSheet({ title: t('title'), icon: 'wrench', color: 'var(--lime)', side: true, body, foot, onClose: () => { stopEditor(); SR.spin = false; } });
 }

 const shopCard=()=>owns()?`<button type="button" class="card-btn" disabled><span class="swatch gc-rainbow"></span><b>${t('custom')}</b><small>${t('unlocked')}</small></button>`:customCard();
 return { open, paintColor, defaults, normalize, owns, buy, shopCard:()=>{addStyle();return shopCard()}, price: PRICE, tool: TOOL };
})();
