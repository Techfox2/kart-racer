// Grand Poly mobile layer · core.
// Additive add-on: owns activation, device-local settings, race-state signals and
// stylesheet loading for the other assets/mobile modules. It never edits game state
// and only reads public surfaces of the game (DOM ids/classes, window.kart* flags).
(()=>{'use strict';
 if(window.KartMobile)return;
 const root=document.documentElement,KEY='kart-mobile';
 const DEFAULTS={mode:'auto',scheme:'buttons',autoGas:true,mirror:false,size:1,opacity:.7,haptics:true,tiltRange:25,hudCompact:true,perf:'auto',fps30:false};
 const LIMITS={size:[.7,1.4],opacity:[.25,1],tiltRange:[12,45]};
 const CHOICES={mode:['auto','on','off'],scheme:['buttons','slide','tilt'],perf:['auto','quality','balanced','performance','off']};
 const settings={...DEFAULTS},listeners=new Map();
 function clean(key,value){
  if(!(key in DEFAULTS)||typeof value!==typeof DEFAULTS[key])return DEFAULTS[key];
  if(CHOICES[key])return CHOICES[key].includes(value)?value:DEFAULTS[key];
  if(LIMITS[key])return Number.isFinite(value)?Math.max(LIMITS[key][0],Math.min(LIMITS[key][1],value)):DEFAULTS[key];
  return value;
 }
 // Plain localStorage on purpose: KartStorage silently drops unknown keys and the
 // server rejects unknown fields in kart-settings, and these are per-device choices.
 try{const saved=JSON.parse(localStorage.getItem(KEY)||'{}');for(const k in DEFAULTS)if(k in saved)settings[k]=clean(k,saved[k])}catch{}
 const query=new URLSearchParams(location.search).get('mobile');
 const coarse=matchMedia('(hover:none),(pointer:coarse)');
 let touched=false,active=false,state='lobby';
 function emit(type,detail){for(const fn of listeners.get(type)||[])try{fn(detail)}catch(e){console.warn('KartMobile listener failed',e)}}
 function on(type,fn){if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(fn);return()=>listeners.get(type).delete(fn)}
 function wanted(){
  if(query==='1')return true;if(query==='0')return false;
  if(settings.mode!=='auto')return settings.mode==='on';
  return coarse.matches||touched;
 }
 function applyVars(){root.style.setProperty('--km-size',settings.size);root.style.setProperty('--km-opacity',settings.opacity);root.classList.toggle('km-mirror',settings.mirror);root.dataset.kmScheme=settings.scheme}
 function refresh(){const next=wanted();applyVars();if(next===active)return;active=next;root.classList.toggle('km-on',active);emit('active',active)}
 function set(key,value){
  if(!(key in DEFAULTS))return;const next=clean(key,value);if(next===settings[key])return;
  settings[key]=next;try{localStorage.setItem(KEY,JSON.stringify(settings))}catch{}
  refresh();emit('setting',{key,value:next});
 }
 function readState(){
  if(document.body.classList.contains('lobby')||!window.kartActiveTrack)return'lobby';
  const results=document.getElementById('results');if(results&&!results.hidden)return'results';
  // game.js shows a modal #raceLoading dialog while a track loads; kartActiveTrack is already
  // set by then, so that dialog means "not playable yet", not "paused".
  if(document.getElementById('raceLoading')?.open)return'lobby';
  if(document.getElementById('panel')?.classList.contains('on')||document.querySelector('dialog[open]:not(#raceLoading)'))return'paused';
  return'race';
 }
 function syncState(){const next=readState();if(next===state)return;const previous=state;state=next;root.dataset.kmState=state;emit('state',{state,previous})}
 const lang=()=>['de','en','fr'].includes(root.lang)?root.lang:'de';
 // text({de,en,fr}) → string for the current game language.
 const text=table=>table[lang()]??table.de;
 const sheets=new Map();
 function loadCSS(path){
  if(sheets.has(path))return sheets.get(path);
  const style=document.createElement('style');style.dataset.km=path;document.head.append(style);
  const pending=(window.KartAssets?KartAssets.text(path):fetch(path,{credentials:'same-origin'}).then(r=>{if(!r.ok)throw new Error('HTTP '+r.status);return r.text()}))
   .then(css=>{style.textContent=css}).catch(e=>{console.warn('KartMobile stylesheet failed',path,e.message)});
  sheets.set(path,pending);return pending;
 }
 window.KartMobile={version:'1.0.0',DEFAULTS,CHOICES,LIMITS,settings,get:k=>settings[k],set,on,text,lang,loadCSS,
  get active(){return active},get state(){return state},refresh};
 coarse.addEventListener?.('change',refresh);
 addEventListener('pointerdown',e=>{if(e.pointerType==='touch'&&e.isTrusted&&!touched){touched=true;refresh()}},{capture:true,passive:true});
 new MutationObserver(()=>emit('lang',lang())).observe(root,{attributes:true,attributeFilter:['lang']});
 // The game exposes no race-lifecycle events, so state is derived from the DOM it already maintains.
 const watch=new MutationObserver(syncState);
 function observe(){
  watch.observe(document.body,{attributes:true,attributeFilter:['class']});
  for(const id of['panel','results'])if(document.getElementById(id))watch.observe(document.getElementById(id),{attributes:true,attributeFilter:['class','hidden']});
  setInterval(syncState,250);root.dataset.kmState=state;syncState();
 }
 refresh();observe();
})();
