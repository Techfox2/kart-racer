// Shared by menus.cjs: how to reach every menu surface of the game through its own UI, the
// element that is the surface (root), the buttons that must stay reachable (actions) and the
// elements that may legitimately scroll sideways (hscroll).
const wait=(p,ms=500)=>p.waitForTimeout(ms);
const jsclick=(p,sel)=>p.evaluate(s=>document.querySelector(s).click(),sel);
const click=sel=>async p=>{await jsclick(p,sel);await wait(p,600)};
// Returns the page to the plain lobby (closes sheets, dialogs, panel, results, room lobby).
async function reset(page){
 const close=()=>page.evaluate(()=>{
  // the automatic "What's new" dialog is re-offered every 15s until it is dismissed with its own button
  const up=document.querySelector('#updatesDialog[open] header button');if(up)up.click();
  document.querySelectorAll('dialog[open]').forEach(d=>d.close());
  if(!document.getElementById('sheetWrap').hidden)document.getElementById('sheetClose').click();
  if(document.getElementById('panel').classList.contains('on'))document.getElementById('close').click();
  const r=document.getElementById('results');if(r)r.hidden=true;
  const pd=document.getElementById('paddock');if(pd&&!pd.hidden){document.getElementById('rleave').click();pd.hidden=true}
  const l=document.getElementById('lobby');if(l&&getComputedStyle(l).display!=='none')document.getElementById('lback').click();
 });
 for(let i=0;i<3;i++){await close();await wait(page,250)}
}
const NAV=n=>`.lb-nav .tile:nth-child(${n})`;
const SHEET_ACTIONS=['#sheetClose','#sheetFoot:not([hidden]) button'];
const SURFACES=[
 {name:'lobby',open:async()=>{},root:'#menu',actions:['#profileBtn','#setBtn','#coinInfo','#playBtn','#mpBtn','#customBtn','#garageBtn',NAV(1),NAV(2),NAV(3),NAV(4),NAV(5),'#eventBtn','#rewardBtn','#dailyBtn','#passBtn'],scroller:'#menu'},
 {name:'shop',open:click('[data-open=shop]'),root:'#sheetWrap .sheet',actions:SHEET_ACTIONS},
 {name:'missions',open:click('[data-open=missions]'),root:'#sheetWrap .sheet',actions:SHEET_ACTIONS},
 {name:'pass',open:click('[data-open=pass]'),root:'#sheetWrap .sheet',actions:SHEET_ACTIONS},
 {name:'coins',open:click('#coinInfo'),root:'#sheetWrap .sheet',actions:SHEET_ACTIONS},
 {name:'race-setup',open:click('#customBtn'),root:'#sheetWrap .sheet',actions:[...SHEET_ACTIONS,'.race-setup .tw-entry']},
 {name:'garage',open:click('#garageBtn'),root:'#sheetWrap .sheet',actions:SHEET_ACTIONS},
 {name:'tuning',open:async p=>{await jsclick(p,'#garageBtn');await wait(p,700);await jsclick(p,'.tw-entry');await wait(p,900)},root:'.tw-dialog[open]',actions:['.tw-dialog[open] button']},
 {name:'rankings',open:click('[data-open=times]'),root:'#rankingsDialog',actions:['#rankingsDialog [data-close]']},
 {name:'updates',open:click('[data-open=news]'),root:'#updatesDialog',actions:['#updatesDialog header button']},
 {name:'friends',open:async p=>{await jsclick(p,'[data-open=friends]');await wait(p,1000)},root:'#friendsDialog',actions:['#friendsDialog header button']},
 {name:'room-home',open:click('#mpBtn'),root:'#lobby .sheet',actions:['#lback','#lcreate','#ljoin']},
 {name:'room-create',open:async p=>{await jsclick(p,'#mpBtn');await wait(p,400);await jsclick(p,'#lcreate');await wait(p,500)},root:'#lobby .sheet',actions:['#lback','#mk'],controls:'#lobby select'},
 {name:'room-join',open:async p=>{await jsclick(p,'#mpBtn');await wait(p,400);await jsclick(p,'#ljoin');await wait(p,500)},root:'#lobby .sheet',actions:['#lback','#jn']},
 // Creating a room needs the online service, which the sandbox does not have ("Onlinedienst nicht erreichbar"), so the
 // paddock is un-hidden with host controls for layout purposes only (no peers, no 3D scene).
 {name:'room-paddock',open:async p=>{await p.evaluate(()=>{document.body.classList.add('lobby');document.getElementById('paddock').hidden=false;document.getElementById('rhost').hidden=false;
   document.getElementById('rcode').textContent='123456';const i=document.getElementById('rinfo');if(i){i.hidden=false;document.getElementById('rmap').textContent='Rennstrecke';document.getElementById('rmode').textContent='Luckyblock';document.getElementById('rlaps').textContent='3 Runden'}});await wait(p,500)},
  root:'#paddock',actions:['#rleave','#lcopy','#rstart','#rlucky','#rcomp'],forced:true},
 ...['controls','graphics','sound','language','account','privacy'].map(s=>({name:'settings-'+s,open:async p=>{
  if(!await p.evaluate(()=>document.getElementById('panel').classList.contains('on'))){await jsclick(p,'#setBtn');await wait(p,500)}
  await jsclick(p,'#settingsTabs [data-section='+s+']');await wait(p,400)},root:'#panel .sheet',actions:['#close','#reset','#settingsTabs button'],hscroll:['#settingsTabs']})),
 {name:'results',open:async p=>{await p.evaluate(()=>{const n=8;
   document.getElementById('resBody').innerHTML='<div class="res-place pop"><b>P3</b><span class="sticker b">von '+n+'</span></div><div class="res-stats"><div><small>Gesamtzeit</small><b>1:23.456</b></div><div><small>Beste Runde</small><b>0:41.234</b></div><div><small>Münzen</small><b>+120</b></div><div><small>XP</small><b>+80</b></div></div><p><span class="sticker y">Neue Bestzeit!</span></p><p class="note">3 Missions-Belohnung(en) im Menü bereit.</p><p class="label">Ergebnis</p><div class="res-board" id="resBoard">'+Array.from({length:n},(_,i)=>(i+1)+'. Spieler Nummer '+i+' – 1:2'+i+'.000').join('\n')+'</div>';
   document.getElementById('results').hidden=false});await wait(p,400)},root:'#results .sheet',actions:['#resMenu','#resAgain']},
 {name:'dialog-rename',open:async p=>{await jsclick(p,'#setBtn');await wait(p,500);await jsclick(p,'#settingsTabs [data-section=account]');await wait(p,300);await jsclick(p,'#openRename');await wait(p,700)},root:'#renameDialog',actions:['#renameClose','#renameSubmit']},
];
module.exports={SURFACES,reset,wait,jsclick};
