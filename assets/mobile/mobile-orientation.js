// Grand Poly mobile layer · "turn your device" prompt.
// Additive add-on (see mobile/PLAN.md): shown on touch devices held in portrait. In the lobby it
// appears once per visit; in a race it pauses the race through the game's own pause button and
// stays until the device is turned or the player chooses to continue in portrait.
(() => {
  'use strict';
  const KM = window.KartMobile;
  if (!KM || KM.orientation) return;
  KM.loadCSS('assets/mobile/mobile-orientation.css');

  const STR = {
    title: { de: 'Gerät drehen', en: 'Turn your device', fr: 'Tournez votre appareil' },
    body: { de: 'Im Querformat hast du die beste Sicht und Steuerung.', en: 'Landscape gives you the best view and controls.', fr: 'Le mode paysage offre la meilleure vue et les meilleures commandes.' },
    paused: { de: 'Das Rennen ist pausiert.', en: 'The race is paused.', fr: 'La course est en pause.' },
    stay: { de: 'Im Hochformat weiter', en: 'Continue in portrait', fr: 'Continuer en portrait' },
  };
  const t = key => KM.text(STR[key]);
  const portrait = matchMedia('(orientation: portrait)');

  let dismissedLobby = false; // lasts for this page visit
  let dismissedRace = false;  // lasts until the race ends
  let pausedByUs = false;
  let shown = false;

  const box = document.createElement('div');
  box.id = 'kmRotate';
  box.hidden = true;
  box.setAttribute('role', 'alertdialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-labelledby', 'kmRotateTitle');
  box.setAttribute('data-no-translate', '');
  box.innerHTML = `
    <svg class="km-rotate-icon" viewBox="0 0 96 96" aria-hidden="true">
      <g class="km-rotate-phone"><rect x="30" y="12" width="36" height="66" rx="7"/><circle cx="48" cy="70" r="3"/></g>
      <path class="km-rotate-arrow" d="M78 36a32 32 0 0 0-22-22l2-6m-2 6-6 2"/>
    </svg>
    <h2 id="kmRotateTitle"></h2>
    <p class="km-rotate-body"></p>
    <p class="km-rotate-paused"></p>
    <button type="button" class="km-rotate-stay"></button>`;
  const $ = s => box.querySelector(s);

  function renderText() {
    $('h2').textContent = t('title');
    $('.km-rotate-body').textContent = t('body');
    $('.km-rotate-paused').textContent = t('paused');
    $('.km-rotate-stay').textContent = t('stay');
  }

  const inRace = () => KM.state === 'race' || KM.state === 'paused';
  // Modal <dialog>s live in the browser's top layer, above any z-index: wait until they close.
  const modalOpen = () => !!document.querySelector('dialog[open]');

  function wanted() {
    if (!KM.active || !portrait.matches || modalOpen()) return false;
    if (inRace()) return !dismissedRace;
    if (KM.state === 'lobby') return !dismissedLobby;
    return false; // results screen
  }

  function pauseRace() {
    if (KM.state !== 'race' || pausedByUs) return;
    const gear = document.getElementById('gear');
    if (!gear) return;
    gear.click();
    pausedByUs = true;
  }

  function update() {
    const next = wanted();
    box.classList.toggle('km-rotate-race', inRace());
    box.classList.toggle('km-rotate-is-paused', pausedByUs && KM.state === 'paused');
    if (next && inRace()) pauseRace();
    if (next === shown) return;
    shown = next;
    box.hidden = !next;
    if (next) $('.km-rotate-stay').focus({ preventScroll: true });
  }

  function dismiss() {
    if (inRace()) {
      dismissedRace = true;
      // Undo only a pause this prompt caused, so the player goes straight back to driving.
      if (pausedByUs && KM.state === 'paused' && document.getElementById('panel')?.classList.contains('on')) document.getElementById('close')?.click();
    } else dismissedLobby = true;
    pausedByUs = false;
    update();
  }

  $('.km-rotate-stay').addEventListener('click', dismiss);
  // Touches on the prompt must not reach the race or the menus underneath.
  for (const type of ['pointerdown', 'touchstart']) box.addEventListener(type, e => e.stopPropagation(), { passive: true });

  KM.on('state', ({ state, previous }) => {
    const wasRace = previous === 'race' || previous === 'paused';
    const isRace = state === 'race' || state === 'paused';
    if (wasRace !== isRace) { dismissedRace = false; pausedByUs = false; }
    // The player closed the pause panel themselves while the prompt was up (or after turning).
    if (state === 'race') pausedByUs = false;
    update();
  });
  KM.on('active', update);
  KM.on('lang', renderText);
  portrait.addEventListener?.('change', update);
  // Dialogs opening and closing produce no event the add-on can listen to.
  setInterval(update, 300);

  KM.orientation = {
    get shown() { return shown; },
    get portrait() { return portrait.matches; },
    dismiss,
    refresh: update,
  };

  function mount() { renderText(); document.body.append(box); update(); }
  if (document.body) mount(); else addEventListener('DOMContentLoaded', mount, { once: true });
})();
