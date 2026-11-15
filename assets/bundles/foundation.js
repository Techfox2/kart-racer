
;/* lobby-classes.js */
(function(root){'use strict';
 const valid=c=>c==='kart'||c==='gt3',accepts=(policy,category)=>valid(category)&&(policy.mixedClasses===true||category===policy.category);
 const allReady=(policy,players)=>players.every(p=>accepts(policy,p.presence.driverClass));
 const words={de:{mixed:'Gemischt',allow:'Gemischte Klassen erlauben',car:'Deine Fahrzeugklasse',policy:'Fahrzeugklasse',kart:'Diese Lobby erlaubt nur Karts.',gt3:'Diese Lobby erlaubt nur GT3.',blocked:'Klasse wechseln: Rennen wartet auf passende Fahrzeuge.'},en:{mixed:'Mixed',allow:'Allow mixed classes',car:'Your vehicle class',policy:'Vehicle class',kart:'This lobby only allows karts.',gt3:'This lobby only allows GT3.',blocked:'Change class: the race is waiting for matching vehicles.'},fr:{mixed:'Mixte',allow:'Autoriser les classes mixtes',car:'Ta classe de véhicule',policy:'Classe de véhicule',kart:'Ce salon accepte uniquement les karts.',gt3:'Ce salon accepte uniquement les GT3.',blocked:'Change de classe : la course attend des véhicules autorisés.'}};
 const text=()=>words[typeof document==='undefined'?'en':document.documentElement.lang]||words.en;
 const message=category=>text()[category]||text().blocked;
 function render(session){
  const players=session.room.peers(),policy=players.find(p=>p.presence.host===1)?.presence,me=players.find(p=>p.isMe)?.presence;if(!policy||!me)return;
  const t=text(),select=document.getElementById('rClass'),mixed=document.getElementById('rMixed'),driver=document.getElementById('rDriverClass');
  document.querySelector('[for=rClass]').textContent=t.policy;document.querySelector('[for=rDriverClass]').textContent=t.car;document.querySelector('#rMixedLabel span').textContent=t.allow;
  select.value=policy.category;select.disabled=!session.host||!!policy.go;mixed.checked=policy.mixedClasses===true;mixed.disabled=!session.host||!!policy.go;
  driver.value=me.driverClass;driver.disabled=!!policy.go;for(const option of driver.options)option.disabled=!accepts(policy,option.value);
  const notice=document.getElementById('rClassNotice');notice.hidden=allReady(policy,players);notice.textContent=accepts(policy,me.driverClass)?t.blocked:message(policy.category);
  const changePolicy=async()=>{try{await session.room.presence({category:select.value,mixedClasses:mixed.checked})}catch(error){notice.hidden=false;notice.textContent=error.message}finally{render(session)}};
  select.onchange=mixed.onchange=changePolicy;
  driver.onchange=async()=>{const category=driver.value;try{await session.room.setVehicleClass(category);SAVE.category=category;persist();await window.KartAccount?.flush();showroomKart()}catch(error){notice.hidden=false;notice.textContent=error.message}finally{render(session)}};
 }
 const api={valid,accepts,allReady,message,render};if(typeof module!=='undefined')module.exports=api;else root.KartLobbyClasses=api;
})(typeof window!=='undefined'?window:globalThis);


;/* ui-settings.js */
/* UI-only transitions and dismissals. No rendering loop or network requests. */
(()=>{'use strict';
 const $=id=>document.getElementById(id),panel=$('panel'),sheet=panel.querySelector('.sheet'),tabs=$('settingsTabs'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const buttons=[...tabs.querySelectorAll('button')],sections=buttons.map(b=>$('settings-'+b.dataset.section));
 const marker=document.createElement('span');marker.className='settings-marker';marker.ariaHidden='true';tabs.prepend(marker);
 let active='controls',sequence=0,animations=[],frame=0,revealPending=false;
 function cancel(){sequence++;for(const a of animations)a.cancel();animations=[];sheet.style.height='';for(const s of sections){s.inert=s.hidden;s.style.position='';s.style.width=''} }
 function revealTab(button,animate=true){const left=button.offsetLeft,right=left+button.offsetWidth,view=tabs.scrollLeft,width=tabs.clientWidth;let next=view;if(left<view+8)next=left-8;else if(right>view+width-8)next=right-width+8;if(next!==view)tabs.scrollTo({left:Math.max(0,next),behavior:animate&&!reduced.matches?'smooth':'instant'})}
 function place(animate=false){const b=buttons.find(b=>b.dataset.section===active);if(!b)return;if(marker.style.width===b.offsetWidth+'px'&&marker.style.height===b.offsetHeight+'px'&&marker.style.top===b.offsetTop+'px'&&marker.style.transform===`translateX(${b.offsetLeft}px)`)return;marker.style.transition=animate&&!reduced.matches?'transform 220ms ease-out,width 220ms ease-out':'none';marker.style.width=b.offsetWidth+'px';marker.style.height=b.offsetHeight+'px';marker.style.top=b.offsetTop+'px';marker.style.transform=`translateX(${b.offsetLeft}px)`}
 function schedule(reveal=false){revealPending=revealPending||reveal===true;cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{frame=0;place();if(revealPending)revealTab(buttons.find(b=>b.dataset.section===active),false);revealPending=false})}
 function settings(name,apply){const next=buttons.findIndex(b=>b.dataset.section===name);if(next<0)return;if(active===name){apply();sections.forEach(s=>s.inert=s.hidden);place();return}
  const previous=buttons.findIndex(b=>b.dataset.section===active),old=sections[previous],target=sections[next],before=sheet.getBoundingClientRect().height,visible=panel.classList.contains('on');
  cancel();const token=sequence,direction=next>previous?1:-1;active=name;apply();sections.forEach(s=>s.inert=s.hidden);const after=sheet.getBoundingClientRect().height;place(visible);revealTab(buttons[next],visible);
  if(!visible||reduced.matches)return;
  // Retain the real outgoing nodes briefly, inert and out of layout. No cloned controls/IDs.
  old.hidden=false;old.inert=true;old.style.position='absolute';old.style.width=target.getBoundingClientRect().width+'px';
  const out=old.animate([{transform:'translateX(0)',opacity:1},{transform:`translateX(${-20*direction}px)`,opacity:0}],{duration:190,easing:'ease-out'});
  const enter=target.animate([{transform:`translateX(${20*direction}px)`,opacity:0},{transform:'translateX(0)',opacity:1}],{duration:210,easing:'ease-out'});animations.push(out,enter);
  out.onfinish=()=>{if(sequence!==token)return;old.hidden=true;old.style.position='';old.style.width='';out.cancel()};
  if(Math.abs(after-before)>.5){const size=sheet.animate([{height:before+'px'},{height:after+'px'}],{duration:240,easing:'ease-out'});animations.push(size);size.onfinish=()=>{if(sequence===token)size.cancel()}}
 }
 // Closing and fast changes synchronously restore a single live section.
 function settle(){cancelAnimationFrame(frame);frame=0;revealPending=false;marker.style.transition='none';tabs.scrollTo({left:tabs.scrollLeft,behavior:'instant'});cancel();sections.forEach((s,i)=>{s.hidden=buttons[i].dataset.section!==active;s.inert=s.hidden});place()}
 new MutationObserver(()=>{settle();if(panel.classList.contains('on'))revealTab(buttons.find(b=>b.dataset.section===active),false)}).observe(panel,{attributes:true,attributeFilter:['class']});
 new ResizeObserver(schedule).observe(tabs);new ResizeObserver(schedule).observe(panel.querySelector('.sheet-body'));
 new MutationObserver(schedule).observe(tabs,{subtree:true,childList:true,characterData:true});new MutationObserver(()=>schedule(true)).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});document.fonts?.ready.then(()=>schedule(true));addEventListener('resize',()=>schedule(true));reduced.addEventListener('change',settle);
 window.KartUI={settings,revealTab,settle};place();
 // Convert only known binary pairs. Original buttons/handlers remain the single action path.
 function switches(){for(const selector of ['#guestInvitePolicy .seg','#quickDaily .seg','#botItems .seg']){
  const group=document.querySelector(selector);if(!group)continue;const pair=[...group.children].filter(e=>e.tagName==='BUTTON');if(pair.length!==2)continue;
  let input=group.querySelector('input');if(!input){input=document.createElement('input');input.type='checkbox';input.className='binary-switch';group.append(input);pair.forEach(b=>b.hidden=true);input.onchange=()=>pair[input.checked?1:0].click()}
  input.checked=pair[1].getAttribute('aria-pressed')==='true';const disabled=pair.every(b=>b.disabled)||pair[input.checked?0:1].disabled;if(input.disabled!==disabled)input.disabled=disabled;input.ariaLabel=group.getAttribute('aria-label')||$('guestInviteLabel')?.textContent||'';
 }}
 new MutationObserver(switches).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['aria-pressed','disabled']});switches();
 // Only opt-in, noncritical surfaces. Their existing close actions enforce all locks.
 const closers={friendsDialog:'[data-close]',friendRemoveDialog:'[data-cancel]',updatesDialog:'header button',renameDialog:'#renameClose',adminDialog:'[data-close]',adminInventory:'header button',developerDialog:'[data-close]',roomBotsDialog:'header button',rankingsDialog:'[data-close]'};
 let order=[],gesture=null,suppress=0;
 new MutationObserver(records=>{for(const r of records){if(r.target.tagName==='DIALOG'){order=order.filter(d=>d!==r.target);if(r.target.open)order.push(r.target)}}}).observe(document.body,{subtree:true,attributes:true,attributeFilter:['open']});
 function surface(){const modal=order.filter(d=>d.open&&d.matches(':modal')).at(-1)||[...document.querySelectorAll('dialog[open]')].filter(d=>d.matches(':modal')).at(-1);if(modal){const selector=closers[modal.id];return selector?{outer:modal,inner:modal,close:()=>modal.querySelector(selector)?.click()}:null}
  if(panel.classList.contains('on'))return {outer:panel,inner:sheet,close:()=>$('close').click()};
  if(!$('sheetWrap').hidden)return {outer:$('sheetWrap'),inner:$('sheetWrap').querySelector('.sheet'),close:()=>$('sheetClose').click()};return null;
 }
 const outside=(s,e)=>{const r=s.inner.getBoundingClientRect();return e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom};
 document.addEventListener('pointerdown',e=>{gesture=null;if(e.button!==0||!e.isPrimary)return;const s=surface();if(s&&outside(s,e)){gesture={s,id:e.pointerId,x:e.clientX,y:e.clientY,moved:false};e.preventDefault();e.stopImmediatePropagation()}},true);
 document.addEventListener('pointermove',e=>{if(gesture&&gesture.id===e.pointerId&&Math.hypot(e.clientX-gesture.x,e.clientY-gesture.y)>8)gesture.moved=true},true);
 document.addEventListener('pointercancel',()=>gesture=null,true);document.addEventListener('wheel',()=>{if(gesture)gesture.moved=true},{capture:true,passive:true});
 document.addEventListener('pointerup',e=>{const g=gesture;gesture=null;if(!g||g.id!==e.pointerId)return;e.preventDefault();e.stopImmediatePropagation();suppress=performance.now()+500;if(!g.moved&&surface()?.outer===g.s.outer&&outside(g.s,e))g.s.close()},true);
 document.addEventListener('click',e=>{if(e.isTrusted&&performance.now()<suppress){suppress=0;e.preventDefault();e.stopImmediatePropagation()}},true);
})();


;/* season.js */
// UTC calendar shared by login, lobby images and the seasonal kart livery.
window.KartSeason=(()=>{
 const calendar=(date=new Date())=>date.getUTCMonth()===11;
 const active=(date=new Date())=>calendar(date)||!!(window.KART_ACCOUNT?.developer?.role&&window.KART_ACCOUNT.developer.christmasPreview);
 const background=(kind,date=new Date())=>'assets/backgrounds/'+(kind==='multiplayer'?(active(date)?'multiplayer-grid-christmas-v2':'multiplayer-grid-v2'):kind==='login'?(active(date)?'multiplayer-christmas-v1':'multiplayer-garage-v2'):(active(date)?'singleplayer-christmas-v1':'singleplayer-pitlane-v2'))+'.webp';
 let previous=active();
 function sync(force=false){const now=active();document.documentElement.style.setProperty('--login-background','url("'+background('login')+'")');if(now!==previous||force===true){previous=now;dispatchEvent(new Event('kart-season-change'))}}
 sync();setInterval(sync,30000);addEventListener('visibilitychange',sync);
 return {active,calendar,sync,background,skin:id=>id==='christmas'&&active()?'christmas':'original'};
})();


;/* account-store.js */
/* Account storage: server is canonical; standalone file copies keep local mode. */
(()=>{'use strict';
if(!window.KART_ACCOUNT){window.KartStorage=localStorage;return}
const keys=['kart-save','kart-settings','kart-binds','kart-wheel','kart-language'];
let retryWrite=null;const raceRecords=[];const appliedRewards=new Set();
let account=KART_ACCOUNT,cache={...(account.state||{})},revision=account.revision,dirty=false,timer,flight=null,blocked=false,migrating=account.state===null;
if(migrating)for(const k of keys)try{const v=localStorage.getItem(k);if(v!==null)cache[k]=v}catch{}
const announce=(error='')=>dispatchEvent(new CustomEvent('account-storage',{detail:{error,dirty}}));
function schedule(){dirty=true;clearTimeout(timer);timer=setTimeout(()=>flush().catch(()=>{}),350)}
window.KartStorage={getItem:k=>k==='kart-name'?account.username:cache[k]??null,setItem:(k,v)=>{if(keys.includes(k)&&cache[k]!==String(v)){cache[k]=String(v);schedule()}},removeItem:k=>{if(keys.includes(k)){delete cache[k];schedule()}}};
function snapshot(){return {'kart-save':cache['kart-save']??JSON.stringify(SAVE),'kart-settings':cache['kart-settings']??JSON.stringify(PREF),'kart-binds':cache['kart-binds']??JSON.stringify(binds),'kart-wheel':cache['kart-wheel']??String(WSTYLE),'kart-language':cache['kart-language']??document.documentElement.lang}}
async function request(path,data,options={}){const r=await fetch(path,{method:data===undefined?'GET':'POST',cache:'no-store',headers:{'Content-Type':'application/json','X-Kart-Request':'1'},body:data===undefined?undefined:JSON.stringify(data),keepalive:data!==undefined,signal:options.signal?AbortSignal.any([options.signal,AbortSignal.timeout(15000)]):AbortSignal.timeout(15000)});const result=await r.json();if(!r.ok)throw Object.assign(Error(result.error||'network'),{code:result.error||'network'});return result}
async function flush(){clearTimeout(timer);if(flight){await flight;if(dirty)return flush();return}if(blocked)throw Object.assign(Error('conflict'),{code:'conflict'});if(!dirty)return;
 const fresh=snapshot(),write=retryWrite||{requestId:crypto.randomUUID().replaceAll('-',''),revision,state:fresh,raceRecords:raceRecords.slice(0,20)};dirty=!!retryWrite&&(keys.some(k=>write.state[k]!==fresh[k])||raceRecords.some(r=>!(write.raceRecords||[]).includes(r)));retryWrite=null;
 flight=(async()=>{try{let result;try{result=await request('/api/account/state',write)}catch(e){if(e.code!=='conflict')throw e;const latest=await request('/api/me');if(!keys.every(k=>latest.state?.[k]===write.state[k]))throw e;result=latest}
  for(const entry of write.raceRecords||[]){const i=raceRecords.indexOf(entry);if(i>=0)raceRecords.splice(i,1)}
  revision=result.revision;account=result;window.KART_ACCOUNT=result;const reward=Number(result.recordReward)||0;
  if(reward>0&&!appliedRewards.has(write.requestId)){appliedRewards.add(write.requestId);if(appliedRewards.size>32)appliedRewards.delete(appliedRewards.values().next().value);SAVE.coins+=reward;if(dirty){const pending=JSON.parse(cache['kart-save']);pending.coins+=reward;cache['kart-save']=JSON.stringify(pending)}dispatchEvent(new CustomEvent('kart-record-reward',{detail:{coins:reward}}));if(typeof renderLobby==='function')renderLobby()}
  if(!dirty)cache={...result.state};if(migrating){migrating=false;for(const k of [...keys,'kart-name','kart-save-backup'])try{localStorage.removeItem(k)}catch{}}announce()
 }catch(e){dirty=true;if(e.code==='conflict')blocked=true;else retryWrite=write;announce(e.code||'network');if(!blocked)timer=setTimeout(()=>flush().catch(()=>{}),5000);throw e}finally{flight=null}})();await flight;if(dirty)return flush()
}
function apply(result){const pending=Object.fromEntries(keys.filter(k=>cache[k]!==account.state?.[k]&&k!=='kart-save').map(k=>[k,cache[k]]));account=result;window.KART_ACCOUNT=result;revision=result.revision;cache={...result.state,...pending};SAVE=JSON.parse(cache['kart-save']);if(cache['kart-settings']){Object.assign(PREF,JSON.parse(cache['kart-settings']));document.documentElement.dataset.glass=String(PREF.glass!==false);drawPreferences()}myName=result.username;renderLobby();if(Object.keys(pending).length)schedule();announce()}
async function refreshForRace(signal){await flush();const result=await request('/api/me',undefined,{signal});if(signal?.aborted)throw new DOMException('Cancelled','AbortError');apply(result)}
window.KartAccount={refreshForRace,async buyUpgrade(car,part,level){await flush();const result=await request('/api/account/buy-upgrade',{car,part,level,revision});apply(result);return result},queueLap(key,seconds,season){if(Number.isInteger(season)&&seconds>0){raceRecords.push({key,seconds,season});schedule()}},async buyCosmetic(kind,item){await flush();const result=await request('/api/account/buy-cosmetic',{kind,item,revision});apply(result);return result},async buyCar(car){await flush();const result=await request('/api/account/buy-car',{car,revision});apply(result);return result},get account(){return account},flush,request,apply,get dirty(){return dirty},start(){if(migrating){cache=snapshot();schedule()}if(account.music){musicURL='/api/account/music';musicPlayer.src=musicURL;applyMusic()}},async uploadMusic(file){if(!file||!file.size||file.size>25*1024*1024)throw Object.assign(Error('music'),{code:'music'});const token=crypto.randomUUID().replaceAll('-',''),mime=file.type||(/\.mp3$/i.test(file.name)?'audio/mpeg':'');for(let offset=0;offset<file.size;offset+=262144){const r=await fetch('/api/account/music',{method:'POST',headers:{'Content-Type':mime,'X-Kart-Request':'1','X-Kart-Upload':token,'X-Kart-Offset':String(offset),'X-Kart-Total':String(file.size)},body:file.slice(offset,offset+262144)});if(!r.ok)throw Object.assign(Error('music'),{code:'music'})}account.music=true;musicURL='/api/account/music?v='+Date.now();musicPlayer.src=musicURL;applyMusic()}};
addEventListener('pagehide',()=>{if(dirty&&!flight)flush().catch(()=>{})});addEventListener('online',()=>flush().catch(()=>{}));addEventListener('beforeunload',e=>{if(dirty||flight){e.preventDefault();e.returnValue=''}});
})();


;/* clipboard.js */
/* Shared, transient clipboard feedback for every copy control. */
(()=>{'use strict';
 const words={de:{copied:'Kopiert.',failed:'Kopieren fehlgeschlagen.'},en:{copied:'Copied.',failed:'Could not copy.'},fr:{copied:'Copié.',failed:'Copie impossible.'}};
 let toast,timer,closeTimer,frame;
 function notify(ok){
  if(!toast){toast=document.createElement('div');toast.id='copyToast';toast.className='kr-copy-toast';toast.dataset.noTranslate='';toast.setAttribute('role','status');toast.setAttribute('aria-live','polite');toast.setAttribute('aria-atomic','true');toast.setAttribute('popover','manual');document.body.append(toast)}
  clearTimeout(timer);clearTimeout(closeTimer);cancelAnimationFrame(frame);
  const text=words[document.documentElement.lang]||words.de;
  toast.textContent=text[ok?'copied':'failed'];
  if(typeof toast.showPopover==='function'&&!toast.matches(':popover-open'))toast.showPopover();
  frame=requestAnimationFrame(()=>toast.classList.add('is-visible'));
  timer=setTimeout(()=>{toast.classList.remove('is-visible');closeTimer=setTimeout(()=>{if(typeof toast.hidePopover==='function'&&toast.matches(':popover-open'))toast.hidePopover();toast.textContent=''},200)},1800);
 }
 window.KartClipboard={async copy(value){try{await navigator.clipboard.writeText(String(value));notify(true);return true}catch{notify(false);return false}}};
})();


;/* tuning-data.js */
/* Shared authored tuning table; server prices live in server/tuning-prices.json. */
(function(r){const data={"version":2,"parts":{"engine":{"name":{"de":"Motor","en":"Engine","fr":"Moteur"}},"induction":{"name":{"de":"Ansaugung / Turbo","en":"Intake / turbo","fr":"Admission / turbo"}},"gearbox":{"name":{"de":"Getriebe","en":"Gearbox","fr":"Boîte"}},"tyres":{"name":{"de":"Reifen","en":"Tyres","fr":"Pneus"}},"suspension":{"name":{"de":"Fahrwerk","en":"Suspension","fr":"Suspension"}},"brakes":{"name":{"de":"Bremsen","en":"Brakes","fr":"Freins"}},"aero":{"name":{"de":"Aerodynamik","en":"Aerodynamics","fr":"Aérodynamique"}},"weight":{"name":{"de":"Leichtbau","en":"Weight reduction","fr":"Allègement"}}},"cars":{"kart":{"category":"kart","engine":"single","layout":"rear","parts":{"engine":[{"level":1,"price":140,"effects":{"acceleration":0.1}},{"level":2,"price":290,"effects":{"acceleration":0.2}},{"level":3,"price":480,"effects":{"acceleration":0.3}}],"induction":[{"level":1,"price":150,"effects":{"topSpeed":0.1,"response":0.04}},{"level":2,"price":300,"effects":{"topSpeed":0.2,"response":0.08}},{"level":3,"price":500,"effects":{"topSpeed":0.3,"response":0.12}}],"gearbox":[{"level":1,"price":150,"effects":{"highAcceleration":0.1}},{"level":2,"price":300,"effects":{"highAcceleration":0.2}},{"level":3,"price":500,"effects":{"highAcceleration":0.3}}],"tyres":[{"level":1,"price":150,"effects":{"grip":0.1,"terrainGrip":0.1}},{"level":2,"price":300,"effects":{"grip":0.2,"terrainGrip":0.2}},{"level":3,"price":500,"effects":{"grip":0.3,"terrainGrip":0.3}}],"suspension":[{"level":1,"price":150,"effects":{"steering":0.1,"yaw":0.08,"stability":0.06}},{"level":2,"price":300,"effects":{"steering":0.2,"yaw":0.16,"stability":0.12}},{"level":3,"price":500,"effects":{"steering":0.3,"yaw":0.24,"stability":0.18}}],"brakes":[{"level":1,"price":150,"effects":{"braking":0.1}},{"level":2,"price":300,"effects":{"braking":0.2}},{"level":3,"price":500,"effects":{"braking":0.3}}],"aero":[{"level":1,"price":150,"effects":{"downforce":0.1,"drag":0.006}},{"level":2,"price":300,"effects":{"downforce":0.2,"drag":0.012}},{"level":3,"price":500,"effects":{"downforce":0.3,"drag":0.018}}],"weight":[{"level":1,"price":160,"effects":{"weight":-0.03,"acceleration":0.03,"steering":0.03,"damage":0.045}},{"level":2,"price":310,"effects":{"weight":-0.06,"acceleration":0.06,"steering":0.06,"damage":0.09}},{"level":3,"price":520,"effects":{"weight":-0.09,"acceleration":0.09,"steering":0.09,"damage":0.135}}]}},"kart-apex":{"category":"kart","engine":"single","layout":"rear","parts":{"engine":[{"level":1,"price":150,"effects":{"acceleration":0.1}},{"level":2,"price":300,"effects":{"acceleration":0.2}},{"level":3,"price":500,"effects":{"acceleration":0.3}}],"induction":[{"level":1,"price":150,"effects":{"topSpeed":0.1,"response":0.04}},{"level":2,"price":300,"effects":{"topSpeed":0.2,"response":0.08}},{"level":3,"price":500,"effects":{"topSpeed":0.3,"response":0.12}}],"gearbox":[{"level":1,"price":160,"effects":{"highAcceleration":0.1}},{"level":2,"price":320,"effects":{"highAcceleration":0.2}},{"level":3,"price":530,"effects":{"highAcceleration":0.3}}],"tyres":[{"level":1,"price":150,"effects":{"grip":0.1,"terrainGrip":0.1}},{"level":2,"price":300,"effects":{"grip":0.2,"terrainGrip":0.2}},{"level":3,"price":500,"effects":{"grip":0.3,"terrainGrip":0.3}}],"suspension":[{"level":1,"price":160,"effects":{"steering":0.1,"yaw":0.08,"stability":0.06}},{"level":2,"price":310,"effects":{"steering":0.2,"yaw":0.16,"stability":0.12}},{"level":3,"price":520,"effects":{"steering":0.3,"yaw":0.24,"stability":0.18}}],"brakes":[{"level":1,"price":150,"effects":{"braking":0.1}},{"level":2,"price":300,"effects":{"braking":0.2}},{"level":3,"price":500,"effects":{"braking":0.3}}],"aero":[{"level":1,"price":150,"effects":{"downforce":0.1,"drag":0.006}},{"level":2,"price":300,"effects":{"downforce":0.2,"drag":0.012}},{"level":3,"price":500,"effects":{"downforce":0.3,"drag":0.018}}],"weight":[{"level":1,"price":150,"effects":{"weight":-0.03,"acceleration":0.03,"steering":0.03,"damage":0.045}},{"level":2,"price":300,"effects":{"weight":-0.06,"acceleration":0.06,"steering":0.06,"damage":0.09}},{"level":3,"price":500,"effects":{"weight":-0.09,"acceleration":0.09,"steering":0.09,"damage":0.135}}]}},"kart-rally":{"category":"kart","engine":"single","layout":"rear","parts":{"engine":[{"level":1,"price":150,"effects":{"acceleration":0.1}},{"level":2,"price":300,"effects":{"acceleration":0.2}},{"level":3,"price":500,"effects":{"acceleration":0.3}}],"induction":[{"level":1,"price":150,"effects":{"topSpeed":0.1,"response":0.04}},{"level":2,"price":300,"effects":{"topSpeed":0.2,"response":0.08}},{"level":3,"price":500,"effects":{"topSpeed":0.3,"response":0.12}}],"gearbox":[{"level":1,"price":150,"effects":{"highAcceleration":0.1}},{"level":2,"price":300,"effects":{"highAcceleration":0.2}},{"level":3,"price":500,"effects":{"highAcceleration":0.3}}],"tyres":[{"level":1,"price":170,"effects":{"grip":0.1,"terrainGrip":0.1}},{"level":2,"price":330,"effects":{"grip":0.2,"terrainGrip":0.2}},{"level":3,"price":550,"effects":{"grip":0.3,"terrainGrip":0.3}}],"suspension":[{"level":1,"price":150,"effects":{"steering":0.1,"yaw":0.08,"stability":0.06}},{"level":2,"price":300,"effects":{"steering":0.2,"yaw":0.16,"stability":0.12}},{"level":3,"price":500,"effects":{"steering":0.3,"yaw":0.24,"stability":0.18}}],"brakes":[{"level":1,"price":150,"effects":{"braking":0.1}},{"level":2,"price":310,"effects":{"braking":0.2}},{"level":3,"price":520,"effects":{"braking":0.3}}],"aero":[{"level":1,"price":150,"effects":{"downforce":0.1,"drag":0.006}},{"level":2,"price":300,"effects":{"downforce":0.2,"drag":0.012}},{"level":3,"price":500,"effects":{"downforce":0.3,"drag":0.018}}],"weight":[{"level":1,"price":150,"effects":{"weight":-0.03,"acceleration":0.03,"steering":0.03,"damage":0.045}},{"level":2,"price":300,"effects":{"weight":-0.06,"acceleration":0.06,"steering":0.06,"damage":0.09}},{"level":3,"price":500,"effects":{"weight":-0.09,"acceleration":0.09,"steering":0.09,"damage":0.135}}]}},"kart-vector":{"category":"kart","engine":"twin","layout":"rear","parts":{"engine":[{"level":1,"price":150,"effects":{"acceleration":0.1}},{"level":2,"price":300,"effects":{"acceleration":0.2}},{"level":3,"price":500,"effects":{"acceleration":0.3}}],"induction":[{"level":1,"price":160,"effects":{"topSpeed":0.1,"response":0.04}},{"level":2,"price":320,"effects":{"topSpeed":0.2,"response":0.08}},{"level":3,"price":540,"effects":{"topSpeed":0.3,"response":0.12}}],"gearbox":[{"level":1,"price":150,"effects":{"highAcceleration":0.1}},{"level":2,"price":300,"effects":{"highAcceleration":0.2}},{"level":3,"price":500,"effects":{"highAcceleration":0.3}}],"tyres":[{"level":1,"price":150,"effects":{"grip":0.1,"terrainGrip":0.1}},{"level":2,"price":300,"effects":{"grip":0.2,"terrainGrip":0.2}},{"level":3,"price":500,"effects":{"grip":0.3,"terrainGrip":0.3}}],"suspension":[{"level":1,"price":150,"effects":{"steering":0.1,"yaw":0.08,"stability":0.06}},{"level":2,"price":300,"effects":{"steering":0.2,"yaw":0.16,"stability":0.12}},{"level":3,"price":500,"effects":{"steering":0.3,"yaw":0.24,"stability":0.18}}],"brakes":[{"level":1,"price":150,"effects":{"braking":0.1}},{"level":2,"price":300,"effects":{"braking":0.2}},{"level":3,"price":500,"effects":{"braking":0.3}}],"aero":[{"level":1,"price":160,"effects":{"downforce":0.1,"drag":0.006}},{"level":2,"price":310,"effects":{"downforce":0.2,"drag":0.012}},{"level":3,"price":520,"effects":{"downforce":0.3,"drag":0.018}}],"weight":[{"level":1,"price":150,"effects":{"weight":-0.03,"acceleration":0.03,"steering":0.03,"damage":0.045}},{"level":2,"price":300,"effects":{"weight":-0.06,"acceleration":0.06,"steering":0.06,"damage":0.09}},{"level":3,"price":500,"effects":{"weight":-0.09,"acceleration":0.09,"steering":0.09,"damage":0.135}}]}},"kart-christmas":{"category":"kart","engine":"twin","layout":"rear","parts":{"engine":[{"level":1,"price":150,"effects":{"acceleration":0.1}},{"level":2,"price":300,"effects":{"acceleration":0.2}},{"level":3,"price":500,"effects":{"acceleration":0.3}}],"induction":[{"level":1,"price":150,"effects":{"topSpeed":0.1,"response":0.04}},{"level":2,"price":300,"effects":{"topSpeed":0.2,"response":0.08}},{"level":3,"price":500,"effects":{"topSpeed":0.3,"response":0.12}}],"gearbox":[{"level":1,"price":150,"effects":{"highAcceleration":0.1}},{"level":2,"price":300,"effects":{"highAcceleration":0.2}},{"level":3,"price":500,"effects":{"highAcceleration":0.3}}],"tyres":[{"level":1,"price":160,"effects":{"grip":0.1,"terrainGrip":0.1}},{"level":2,"price":320,"effects":{"grip":0.2,"terrainGrip":0.2}},{"level":3,"price":530,"effects":{"grip":0.3,"terrainGrip":0.3}}],"suspension":[{"level":1,"price":150,"effects":{"steering":0.1,"yaw":0.08,"stability":0.06}},{"level":2,"price":300,"effects":{"steering":0.2,"yaw":0.16,"stability":0.12}},{"level":3,"price":500,"effects":{"steering":0.3,"yaw":0.24,"stability":0.18}}],"brakes":[{"level":1,"price":150,"effects":{"braking":0.1}},{"level":2,"price":300,"effects":{"braking":0.2}},{"level":3,"price":500,"effects":{"braking":0.3}}],"aero":[{"level":1,"price":150,"effects":{"downforce":0.1,"drag":0.006}},{"level":2,"price":300,"effects":{"downforce":0.2,"drag":0.012}},{"level":3,"price":500,"effects":{"downforce":0.3,"drag":0.018}}],"weight":[{"level":1,"price":150,"effects":{"weight":-0.03,"acceleration":0.03,"steering":0.03,"damage":0.045}},{"level":2,"price":310,"effects":{"weight":-0.06,"acceleration":0.06,"steering":0.06,"damage":0.09}},{"level":3,"price":520,"effects":{"weight":-0.09,"acceleration":0.09,"steering":0.09,"damage":0.135}}]}},"porsche":{"category":"gt3","engine":"boxer","layout":"rear","parts":{"engine":[{"level":1,"price":290,"effects":{"acceleration":0.1}},{"level":2,"price":530,"effects":{"acceleration":0.2}},{"level":3,"price":820,"effects":{"acceleration":0.3}}],"induction":[{"level":1,"price":300,"effects":{"topSpeed":0.1,"response":0.04}},{"level":2,"price":550,"effects":{"topSpeed":0.2,"response":0.08}},{"level":3,"price":850,"effects":{"topSpeed":0.3,"response":0.12}}],"gearbox":[{"level":1,"price":300,"effects":{"highAcceleration":0.1}},{"level":2,"price":550,"effects":{"highAcceleration":0.2}},{"level":3,"price":850,"effects":{"highAcceleration":0.3}}],"tyres":[{"level":1,"price":330,"effects":{"grip":0.1,"terrainGrip":0.1}},{"level":2,"price":600,"effects":{"grip":0.2,"terrainGrip":0.2}},{"level":3,"price":930,"effects":{"grip":0.3,"terrainGrip":0.3}}],"suspension":[{"level":1,"price":300,"effects":{"steering":0.1,"yaw":0.08,"stability":0.06}},{"level":2,"price":550,"effects":{"steering":0.2,"yaw":0.16,"stability":0.12}},{"level":3,"price":850,"effects":{"steering":0.3,"yaw":0.24,"stability":0.18}}],"brakes":[{"level":1,"price":300,"effects":{"braking":0.1}},{"level":2,"price":550,"effects":{"braking":0.2}},{"level":3,"price":850,"effects":{"braking":0.3}}],"aero":[{"level":1,"price":300,"effects":{"downforce":0.1,"drag":0.006}},{"level":2,"price":550,"effects":{"downforce":0.2,"drag":0.012}},{"level":3,"price":850,"effects":{"downforce":0.3,"drag":0.018}}],"weight":[{"level":1,"price":320,"effects":{"weight":-0.03,"acceleration":0.03,"steering":0.03,"damage":0.045}},{"level":2,"price":580,"effects":{"weight":-0.06,"acceleration":0.06,"steering":0.06,"damage":0.09}},{"level":3,"price":900,"effects":{"weight":-0.09,"acceleration":0.09,"steering":0.09,"damage":0.135}}]}},"amg":{"category":"gt3","engine":"v8","layout":"front","parts":{"engine":[{"level":1,"price":320,"effects":{"acceleration":0.1}},{"level":2,"price":590,"effects":{"acceleration":0.2}},{"level":3,"price":910,"effects":{"acceleration":0.3}}],"induction":[{"level":1,"price":300,"effects":{"topSpeed":0.1,"response":0.04}},{"level":2,"price":550,"effects":{"topSpeed":0.2,"response":0.08}},{"level":3,"price":850,"effects":{"topSpeed":0.3,"response":0.12}}],"gearbox":[{"level":1,"price":320,"effects":{"highAcceleration":0.1}},{"level":2,"price":580,"effects":{"highAcceleration":0.2}},{"level":3,"price":900,"effects":{"highAcceleration":0.3}}],"tyres":[{"level":1,"price":300,"effects":{"grip":0.1,"terrainGrip":0.1}},{"level":2,"price":550,"effects":{"grip":0.2,"terrainGrip":0.2}},{"level":3,"price":850,"effects":{"grip":0.3,"terrainGrip":0.3}}],"suspension":[{"level":1,"price":300,"effects":{"steering":0.1,"yaw":0.08,"stability":0.06}},{"level":2,"price":550,"effects":{"steering":0.2,"yaw":0.16,"stability":0.12}},{"level":3,"price":850,"effects":{"steering":0.3,"yaw":0.24,"stability":0.18}}],"brakes":[{"level":1,"price":300,"effects":{"braking":0.1}},{"level":2,"price":550,"effects":{"braking":0.2}},{"level":3,"price":850,"effects":{"braking":0.3}}],"aero":[{"level":1,"price":300,"effects":{"downforce":0.1,"drag":0.006}},{"level":2,"price":550,"effects":{"downforce":0.2,"drag":0.012}},{"level":3,"price":850,"effects":{"downforce":0.3,"drag":0.018}}],"weight":[{"level":1,"price":290,"effects":{"weight":-0.03,"acceleration":0.03,"steering":0.03,"damage":0.045}},{"level":2,"price":530,"effects":{"weight":-0.06,"acceleration":0.06,"steering":0.06,"damage":0.09}},{"level":3,"price":820,"effects":{"weight":-0.09,"acceleration":0.09,"steering":0.09,"damage":0.135}}]}},"ferrari":{"category":"gt3","engine":"v6","layout":"middle","parts":{"engine":[{"level":1,"price":290,"effects":{"acceleration":0.1}},{"level":2,"price":530,"effects":{"acceleration":0.2}},{"level":3,"price":820,"effects":{"acceleration":0.3}}],"induction":[{"level":1,"price":330,"effects":{"topSpeed":0.1,"response":0.04}},{"level":2,"price":600,"effects":{"topSpeed":0.2,"response":0.08}},{"level":3,"price":930,"effects":{"topSpeed":0.3,"response":0.12}}],"gearbox":[{"level":1,"price":300,"effects":{"highAcceleration":0.1}},{"level":2,"price":550,"effects":{"highAcceleration":0.2}},{"level":3,"price":850,"effects":{"highAcceleration":0.3}}],"tyres":[{"level":1,"price":300,"effects":{"grip":0.1,"terrainGrip":0.1}},{"level":2,"price":550,"effects":{"grip":0.2,"terrainGrip":0.2}},{"level":3,"price":850,"effects":{"grip":0.3,"terrainGrip":0.3}}],"suspension":[{"level":1,"price":300,"effects":{"steering":0.1,"yaw":0.08,"stability":0.06}},{"level":2,"price":550,"effects":{"steering":0.2,"yaw":0.16,"stability":0.12}},{"level":3,"price":850,"effects":{"steering":0.3,"yaw":0.24,"stability":0.18}}],"brakes":[{"level":1,"price":300,"effects":{"braking":0.1}},{"level":2,"price":550,"effects":{"braking":0.2}},{"level":3,"price":850,"effects":{"braking":0.3}}],"aero":[{"level":1,"price":320,"effects":{"downforce":0.1,"drag":0.006}},{"level":2,"price":590,"effects":{"downforce":0.2,"drag":0.012}},{"level":3,"price":910,"effects":{"downforce":0.3,"drag":0.018}}],"weight":[{"level":1,"price":300,"effects":{"weight":-0.03,"acceleration":0.03,"steering":0.03,"damage":0.045}},{"level":2,"price":550,"effects":{"weight":-0.06,"acceleration":0.06,"steering":0.06,"damage":0.09}},{"level":3,"price":850,"effects":{"weight":-0.09,"acceleration":0.09,"steering":0.09,"damage":0.135}}]}},"bmw":{"category":"gt3","engine":"inline6","layout":"front","parts":{"engine":[{"level":1,"price":300,"effects":{"acceleration":0.1}},{"level":2,"price":550,"effects":{"acceleration":0.2}},{"level":3,"price":850,"effects":{"acceleration":0.3}}],"induction":[{"level":1,"price":300,"effects":{"topSpeed":0.1,"response":0.04}},{"level":2,"price":550,"effects":{"topSpeed":0.2,"response":0.08}},{"level":3,"price":850,"effects":{"topSpeed":0.3,"response":0.12}}],"gearbox":[{"level":1,"price":320,"effects":{"highAcceleration":0.1}},{"level":2,"price":590,"effects":{"highAcceleration":0.2}},{"level":3,"price":910,"effects":{"highAcceleration":0.3}}],"tyres":[{"level":1,"price":300,"effects":{"grip":0.1,"terrainGrip":0.1}},{"level":2,"price":550,"effects":{"grip":0.2,"terrainGrip":0.2}},{"level":3,"price":850,"effects":{"grip":0.3,"terrainGrip":0.3}}],"suspension":[{"level":1,"price":300,"effects":{"steering":0.1,"yaw":0.08,"stability":0.06}},{"level":2,"price":550,"effects":{"steering":0.2,"yaw":0.16,"stability":0.12}},{"level":3,"price":850,"effects":{"steering":0.3,"yaw":0.24,"stability":0.18}}],"brakes":[{"level":1,"price":310,"effects":{"braking":0.1}},{"level":2,"price":570,"effects":{"braking":0.2}},{"level":3,"price":890,"effects":{"braking":0.3}}],"aero":[{"level":1,"price":300,"effects":{"downforce":0.1,"drag":0.006}},{"level":2,"price":550,"effects":{"downforce":0.2,"drag":0.012}},{"level":3,"price":850,"effects":{"downforce":0.3,"drag":0.018}}],"weight":[{"level":1,"price":300,"effects":{"weight":-0.03,"acceleration":0.03,"steering":0.03,"damage":0.045}},{"level":2,"price":550,"effects":{"weight":-0.06,"acceleration":0.06,"steering":0.06,"damage":0.09}},{"level":3,"price":850,"effects":{"weight":-0.09,"acceleration":0.09,"steering":0.09,"damage":0.135}}]}},"aston":{"category":"gt3","engine":"v8","layout":"front","parts":{"engine":[{"level":1,"price":310,"effects":{"acceleration":0.1}},{"level":2,"price":570,"effects":{"acceleration":0.2}},{"level":3,"price":890,"effects":{"acceleration":0.3}}],"induction":[{"level":1,"price":300,"effects":{"topSpeed":0.1,"response":0.04}},{"level":2,"price":550,"effects":{"topSpeed":0.2,"response":0.08}},{"level":3,"price":850,"effects":{"topSpeed":0.3,"response":0.12}}],"gearbox":[{"level":1,"price":300,"effects":{"highAcceleration":0.1}},{"level":2,"price":550,"effects":{"highAcceleration":0.2}},{"level":3,"price":850,"effects":{"highAcceleration":0.3}}],"tyres":[{"level":1,"price":300,"effects":{"grip":0.1,"terrainGrip":0.1}},{"level":2,"price":550,"effects":{"grip":0.2,"terrainGrip":0.2}},{"level":3,"price":850,"effects":{"grip":0.3,"terrainGrip":0.3}}],"suspension":[{"level":1,"price":320,"effects":{"steering":0.1,"yaw":0.08,"stability":0.06}},{"level":2,"price":590,"effects":{"steering":0.2,"yaw":0.16,"stability":0.12}},{"level":3,"price":910,"effects":{"steering":0.3,"yaw":0.24,"stability":0.18}}],"brakes":[{"level":1,"price":300,"effects":{"braking":0.1}},{"level":2,"price":550,"effects":{"braking":0.2}},{"level":3,"price":850,"effects":{"braking":0.3}}],"aero":[{"level":1,"price":300,"effects":{"downforce":0.1,"drag":0.006}},{"level":2,"price":550,"effects":{"downforce":0.2,"drag":0.012}},{"level":3,"price":850,"effects":{"downforce":0.3,"drag":0.018}}],"weight":[{"level":1,"price":300,"effects":{"weight":-0.03,"acceleration":0.03,"steering":0.03,"damage":0.045}},{"level":2,"price":550,"effects":{"weight":-0.06,"acceleration":0.06,"steering":0.06,"damage":0.09}},{"level":3,"price":850,"effects":{"weight":-0.09,"acceleration":0.09,"steering":0.09,"damage":0.135}}]}},"audi":{"category":"gt3","engine":"v10","layout":"middle","parts":{"engine":[{"level":1,"price":300,"effects":{"acceleration":0.1}},{"level":2,"price":550,"effects":{"acceleration":0.2}},{"level":3,"price":850,"effects":{"acceleration":0.3}}],"induction":[{"level":1,"price":300,"effects":{"topSpeed":0.1,"response":0.04}},{"level":2,"price":550,"effects":{"topSpeed":0.2,"response":0.08}},{"level":3,"price":850,"effects":{"topSpeed":0.3,"response":0.12}}],"gearbox":[{"level":1,"price":310,"effects":{"highAcceleration":0.1}},{"level":2,"price":570,"effects":{"highAcceleration":0.2}},{"level":3,"price":890,"effects":{"highAcceleration":0.3}}],"tyres":[{"level":1,"price":320,"effects":{"grip":0.1,"terrainGrip":0.1}},{"level":2,"price":580,"effects":{"grip":0.2,"terrainGrip":0.2}},{"level":3,"price":900,"effects":{"grip":0.3,"terrainGrip":0.3}}],"suspension":[{"level":1,"price":300,"effects":{"steering":0.1,"yaw":0.08,"stability":0.06}},{"level":2,"price":550,"effects":{"steering":0.2,"yaw":0.16,"stability":0.12}},{"level":3,"price":850,"effects":{"steering":0.3,"yaw":0.24,"stability":0.18}}],"brakes":[{"level":1,"price":300,"effects":{"braking":0.1}},{"level":2,"price":550,"effects":{"braking":0.2}},{"level":3,"price":850,"effects":{"braking":0.3}}],"aero":[{"level":1,"price":300,"effects":{"downforce":0.1,"drag":0.006}},{"level":2,"price":550,"effects":{"downforce":0.2,"drag":0.012}},{"level":3,"price":850,"effects":{"downforce":0.3,"drag":0.018}}],"weight":[{"level":1,"price":300,"effects":{"weight":-0.03,"acceleration":0.03,"steering":0.03,"damage":0.045}},{"level":2,"price":550,"effects":{"weight":-0.06,"acceleration":0.06,"steering":0.06,"damage":0.09}},{"level":3,"price":850,"effects":{"weight":-0.09,"acceleration":0.09,"steering":0.09,"damage":0.135}}]}},"lambo":{"category":"gt3","engine":"v10","layout":"middle","parts":{"engine":[{"level":1,"price":300,"effects":{"acceleration":0.1}},{"level":2,"price":550,"effects":{"acceleration":0.2}},{"level":3,"price":850,"effects":{"acceleration":0.3}}],"induction":[{"level":1,"price":310,"effects":{"topSpeed":0.1,"response":0.04}},{"level":2,"price":570,"effects":{"topSpeed":0.2,"response":0.08}},{"level":3,"price":890,"effects":{"topSpeed":0.3,"response":0.12}}],"gearbox":[{"level":1,"price":300,"effects":{"highAcceleration":0.1}},{"level":2,"price":550,"effects":{"highAcceleration":0.2}},{"level":3,"price":850,"effects":{"highAcceleration":0.3}}],"tyres":[{"level":1,"price":300,"effects":{"grip":0.1,"terrainGrip":0.1}},{"level":2,"price":550,"effects":{"grip":0.2,"terrainGrip":0.2}},{"level":3,"price":850,"effects":{"grip":0.3,"terrainGrip":0.3}}],"suspension":[{"level":1,"price":300,"effects":{"steering":0.1,"yaw":0.08,"stability":0.06}},{"level":2,"price":550,"effects":{"steering":0.2,"yaw":0.16,"stability":0.12}},{"level":3,"price":850,"effects":{"steering":0.3,"yaw":0.24,"stability":0.18}}],"brakes":[{"level":1,"price":300,"effects":{"braking":0.1}},{"level":2,"price":550,"effects":{"braking":0.2}},{"level":3,"price":850,"effects":{"braking":0.3}}],"aero":[{"level":1,"price":320,"effects":{"downforce":0.1,"drag":0.006}},{"level":2,"price":580,"effects":{"downforce":0.2,"drag":0.012}},{"level":3,"price":900,"effects":{"downforce":0.3,"drag":0.018}}],"weight":[{"level":1,"price":300,"effects":{"weight":-0.03,"acceleration":0.03,"steering":0.03,"damage":0.045}},{"level":2,"price":550,"effects":{"weight":-0.06,"acceleration":0.06,"steering":0.06,"damage":0.09}},{"level":3,"price":850,"effects":{"weight":-0.09,"acceleration":0.09,"steering":0.09,"damage":0.135}}]}},"mclaren":{"category":"gt3","engine":"v8","layout":"middle","parts":{"engine":[{"level":1,"price":300,"effects":{"acceleration":0.1}},{"level":2,"price":550,"effects":{"acceleration":0.2}},{"level":3,"price":850,"effects":{"acceleration":0.3}}],"induction":[{"level":1,"price":300,"effects":{"topSpeed":0.1,"response":0.04}},{"level":2,"price":550,"effects":{"topSpeed":0.2,"response":0.08}},{"level":3,"price":850,"effects":{"topSpeed":0.3,"response":0.12}}],"gearbox":[{"level":1,"price":300,"effects":{"highAcceleration":0.1}},{"level":2,"price":550,"effects":{"highAcceleration":0.2}},{"level":3,"price":850,"effects":{"highAcceleration":0.3}}],"tyres":[{"level":1,"price":300,"effects":{"grip":0.1,"terrainGrip":0.1}},{"level":2,"price":550,"effects":{"grip":0.2,"terrainGrip":0.2}},{"level":3,"price":850,"effects":{"grip":0.3,"terrainGrip":0.3}}],"suspension":[{"level":1,"price":300,"effects":{"steering":0.1,"yaw":0.08,"stability":0.06}},{"level":2,"price":550,"effects":{"steering":0.2,"yaw":0.16,"stability":0.12}},{"level":3,"price":850,"effects":{"steering":0.3,"yaw":0.24,"stability":0.18}}],"brakes":[{"level":1,"price":300,"effects":{"braking":0.1}},{"level":2,"price":550,"effects":{"braking":0.2}},{"level":3,"price":850,"effects":{"braking":0.3}}],"aero":[{"level":1,"price":320,"effects":{"downforce":0.1,"drag":0.006}},{"level":2,"price":590,"effects":{"downforce":0.2,"drag":0.012}},{"level":3,"price":910,"effects":{"downforce":0.3,"drag":0.018}}],"weight":[{"level":1,"price":320,"effects":{"weight":-0.03,"acceleration":0.03,"steering":0.03,"damage":0.045}},{"level":2,"price":580,"effects":{"weight":-0.06,"acceleration":0.06,"steering":0.06,"damage":0.09}},{"level":3,"price":900,"effects":{"weight":-0.09,"acceleration":0.09,"steering":0.09,"damage":0.135}}]}}}};if(typeof module!=="undefined")module.exports=data;else r.KartTuningData=data})(typeof window!=="undefined"?window:globalThis);


;/* tuning-stats.js */
/* Pure vehicle stats: no save, clock, mode or DOM dependencies. Units: m/s, m/s², kg. */
(function(root){'use strict';
 const data=typeof module!=='undefined'?require('./tuning-data.js'):root.KartTuningData;
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 function definition(id){return data.cars[id]||(id.startsWith('kart-')?data.cars.kart:{...data.cars.porsche,engine:'inline6',layout:'front'})}
 function clean(value,ids=Object.keys(data.cars)){const result={};if(!value||typeof value!=='object'||Array.isArray(value))return result;for(const id of ids){const entry=value[id];if(!entry||typeof entry!=='object'||Array.isArray(entry))continue;const p={};for(const part of Object.keys(data.parts))if(Number.isInteger(entry[part])&&entry[part]>=1&&entry[part]<=3)p[part]=entry[part];if(Object.keys(p).length)result[id]=p}return result}
 function carStats(id,upgrades={}){const def=definition(id),gt3=def.category==='gt3',u=clean({[id]:upgrades},[id])[id]||{},e={};for(const [part,level]of Object.entries(u)){for(const [key,n]of Object.entries(def.parts[part][level-1].effects))e[key]=(e[key]||0)+n}
  const stock={acceleration:gt3?34:24,topSpeed:gt3?68:40,offSpeed:gt3?21:16,grip:gt3?40:30,braking:gt3?52:40,weight:gt3?1300:160,downforce:0,drag:0,steering:10,yaw:2.3,stability:1,terrainGrip:1,response:1,highAcceleration:1,damage:1};
  const s={...stock,acceleration:stock.acceleration*(1+clamp(e.acceleration||0,0,.5)),topSpeed:stock.topSpeed*(1+clamp((e.topSpeed||0)-(e.drag||0),-.04,.35)),grip:stock.grip*(1+clamp(e.grip||0,0,.4)),braking:stock.braking*(1+clamp(e.braking||0,0,.4)),weight:stock.weight*(1+clamp(e.weight||0,-.12,0)),downforce:clamp(e.downforce||0,0,.35),drag:clamp(e.drag||0,0,.04),steering:stock.steering*(1+clamp(e.steering||0,0,.5)),yaw:stock.yaw*(1+clamp(e.yaw||0,0,.3)),stability:1+clamp(e.stability||0,0,.3),terrainGrip:1+clamp(e.terrainGrip||0,0,.35),response:1+clamp(e.response||0,0,.2),highAcceleration:1+clamp(e.highAcceleration||0,0,.35),damage:1+clamp(e.damage||0,0,.20)};
  s.pi=Math.round((gt3?600:300)*(1+.26*(s.acceleration/stock.acceleration-1)+.3*(s.topSpeed/stock.topSpeed-1)+.14*(s.grip/stock.grip-1)+.08*(s.braking/stock.braking-1)+.08*(s.highAcceleration-1)+.07*s.downforce+.07*(s.steering/stock.steering-1)));return Object.freeze(s)
 }
 function roomStats(category){return carStats(category==='gt3'?'porsche':'kart',{})}
 function raceStats(id,upgrades,category){
  const tuned=carStats(id,upgrades);if(!category)return tuned;
  // Room class defines base physics even when a player uses a different body.
  // Apply that vehicle's purchased effects to the room base instead of dropping them.
  const stock=carStats(id,{}),base=roomStats(category),result={...tuned};
  for(const key of ['acceleration','topSpeed','offSpeed','grip','braking','weight','steering','yaw'])result[key]=base[key]*tuned[key]/stock[key];
  result.pi=Math.round(base.pi*tuned.pi/stock.pi);
  return Object.freeze(result);
 }
 function active(mode){return mode.online?mode.allowed===true:mode.allowed!==false}
 function prepareRace(id,progress,mode={},category){
  const owned=id==='kart'||(id.startsWith('kart-')?(progress.ownedKarts||[]).includes(id.slice(5)):(progress.ownedCars||[]).includes(id));
  const stored=Object.freeze(owned?{...(clean(progress.upgrades,[id])[id]||{})}:{});
  const reason=!active(mode)?mode.online?'host':'disabled':Object.keys(stored).length?'active':'stock';
  const upgrades=Object.freeze(active(mode)?{...stored}:{});
  return Object.freeze({id,stored,upgrades,reason,stats:raceStats(id,upgrades,category)});
 }
 function acceleration(stats,speed){const ratio=clamp(Math.abs(speed)/stats.topSpeed,0,1);return stats.acceleration*(1+(stats.highAcceleration-1)*ratio)*(1+(stats.response-1)*(1-ratio))}
 const api={roomStats,raceStats,prepareRace,data,definition,clean,carStats,active,acceleration};if(typeof module!=='undefined')module.exports=api;else{root.KartTuningStats=api;root.carStats=carStats}
})(typeof window!=='undefined'?window:globalThis);


;/* tuning-visuals.js */
/* Hand-built primitive engines and bolt-on parts. No imported geometry or logos. */
window.KartTuningVisuals=(()=>{'use strict';
 function isolateMaterials(root,shared){const copies=new Map(),set=new Set(shared);root.traverse(o=>{if(!o.material)return;const own=m=>{if(!set.has(m))return m;if(!copies.has(m))copies.set(m,m.clone());return copies.get(m)};o.material=Array.isArray(o.material)?o.material.map(own):own(o.material)})}
 function dispose(root){const geos=new Set(),mats=new Set();root.traverse(o=>{if(o.geometry)geos.add(o.geometry);for(const m of (Array.isArray(o.material)?o.material:[o.material]))if(m)mats.add(m)});geos.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());if(root.parent)root.parent.remove(root)}
 function make(id,levels={},workshop=false,low=false){const def=KartTuningStats.definition(id),gt=def.category==='gt3',root=new THREE.Group(),groups={},segments=low?8:18,z=def.layout==='front'?1.14:def.layout==='rear'?-1.28:-.70,ey=gt?.93:.52;
  root.name='Tuning '+id;
  for(const part of Object.keys(KartTuningStats.data.parts)){groups[part]=new THREE.Group();groups[part].userData.part=part;root.add(groups[part])}
  const material=(level=0,color=0x596779)=>new THREE.MeshStandardMaterial({color:level?[0x82909f,0x27bbc5,0xffbe49][level-1]:color,roughness:level?.35:.7,metalness:.45,emissive:level===3&&!low?0x463006:0,emissiveIntensity:.25});
  const mats=Object.fromEntries(Object.keys(groups).map(k=>[k,material(levels[k]||0)]));
  function mesh(part,geo,x,y,z,rx=0,rz=0,mat=mats[part]){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.rotation.set(rx,0,rz);m.userData.part=part;groups[part].add(m);return m}
  const box=(p,w,h,d,x,y,z)=>mesh(p,new THREE.BoxGeometry(w,h,d),x,y,z);
  const cyl=(p,r,h,x,y,z,rx=0,rz=0)=>mesh(p,new THREE.CylinderGeometry(r,r,h,segments),x,y,z,rx,rz);
  if(workshop){
   const signature=[...id].reduce((n,c)=>n+c.charCodeAt(0),0)%7;groups.engine.scale.z=1+signature*.025;
   box('engine',gt?.65:.34,.24,gt?.78:.38,0,ey,z);
   const trim=material(0,[0xb74935,0x2d99a5,0xe8b84c,0x99a8b8,0x5d79b0,0x85a45c,0x9d719e][signature]);mesh('engine',new THREE.BoxGeometry(gt?.38:.20,.04,.10),0,ey+.39,z,0,0,trim);
   const kind=def.engine,count={single:1,twin:2,inline6:6,v6:6,v8:8,v10:10,boxer:6}[kind]||6;
   for(let i=0;i<count;i++){const bank=kind==='single'||kind==='twin'||kind==='inline6'?0:i%2?1:-1,row=bank?Math.floor(i/2):i,n=bank?count/2:count,zz=z+(row-(n-1)/2)*(gt?.19:.14),xx=bank*(kind==='boxer'?.38:.22),angle=kind==='boxer'?bank*Math.PI/2:bank*.55;
    cyl('engine',gt?.12:.10,kind==='boxer'?.35:.28,xx,ey+.16,zz,0,angle);
    box('engine',.16,.06,.13,xx,ey+.31,zz);
   }
   const boost=levels.induction||0;
   if(kind==='single'||kind==='twin'){cyl('induction',.09+boost*.015,.22,.23,ey+.18,z,Math.PI/2)}
   else for(const side of [-1,1]){mesh('induction',new THREE.TorusGeometry(.12+boost*.025,.055,low?5:8,segments),side*.51,ey+.12,z+.25,Math.PI/2);box('induction',.10,.10,.65,side*.35,ey+.34,z)}
   box('gearbox',.32,.22,.42,0,ey-.05,z+(def.layout==='front'?-.6:.6));
   for(const side of [-1,1])cyl('suspension',.04,.62,side*.6,.6,gt?1.15:.6,0,side*.3);
  }
  for(const side of [-1,1]){
   if(workshop||levels.induction)cyl('induction',.06+(levels.induction||0)*.014,.32,side*(gt?.58:.35),.36,gt?-2.12:-1.05,Math.PI/2);
   for(const zz of gt?[-1.27,1.25]:[-.68,.65]){
    const x=side*(gt?1.02:.83),rad=gt?.34:.26;
    if(workshop||levels.brakes){cyl('brakes',rad*.62,.035,x,.36,zz,0,Math.PI/2);box('brakes',.07,.18,.12,x+side*.03,.38,zz+.12)}
    if(workshop||levels.tyres){const m=mesh('tyres',new THREE.TorusGeometry(rad-.04,.025+(levels.tyres||0)*.004,low?4:6,segments),x+side*.04,.36,zz);m.rotation.y=Math.PI/2;for(let n=0;n<5;n++){const angle=n*Math.PI*2/5;const spoke=box('tyres',.035,.025,rad*1.6,x+side*.045,.36,zz);spoke.rotation.x=angle}}
   }
  }
  if(workshop||levels.aero){const l=levels.aero||0,span=gt?1.9:1.4,back=gt?-1.88:-1.04;box('aero',span,.055,.25+l*.06,0,gt?1.4:.94,back);for(const side of [-1,1])box('aero',.06,.34,.08,side*span*.33,gt?1.22:.77,back)}
  if(workshop||levels.weight){for(const side of [-1,1])box('weight',.045,.13,gt?1.65:.80,side*(gt?.98:.65),.28,0)}
  // Batch fixed details by part and material; hotspots and installation groups stay separate.
  for(const [part,group]of Object.entries(groups)){const batches=new Map();for(const m of [...group.children]){m.updateMatrix();const geo=m.geometry.index?m.geometry.toNonIndexed():m.geometry.clone();geo.applyMatrix4(m.matrix);const list=batches.get(m.material)||[];list.push(geo);batches.set(m.material,list);group.remove(m);m.geometry.dispose()}for(const [mat,geos]of batches){const geo=new THREE.BufferGeometry();for(const [key,size]of [['position',3],['normal',3],['uv',2]]){const values=new Float32Array(geos.reduce((n,g)=>n+g.attributes[key].array.length,0));let at=0;for(const g of geos){values.set(g.attributes[key].array,at);at+=g.attributes[key].array.length}geo.setAttribute(key,new THREE.BufferAttribute(values,size))}geos.forEach(g=>g.dispose());const m=new THREE.Mesh(geo,mat);m.userData.part=part;group.add(m)}}
  const used=new Set();root.traverse(o=>{if(o.material)used.add(o.material)});for(const m of Object.values(mats))if(!used.has(m))m.dispose();
  root.userData.groups=groups;root.userData.engine={type:def.engine,layout:def.layout,position:new THREE.Vector3(0,ey,z)};return root;
 }
 function attach(vehicle,id,levels){if(!Object.values(levels||{}).some(Boolean))return;const old=vehicle.getObjectByName('Tuning '+id);if(old)dispose(old);vehicle.add(make(id,levels,false,typeof PREF!=='undefined'&&PREF.quality==='low'))}
 return {make,attach,dispose,isolateMaterials};
})();


;/* tuning.js */
window.KartTuning=(()=>{'use strict';
 const S=KartTuningStats,D=S.data,lang=()=>['de','en','fr'].includes(document.documentElement.lang)?document.documentElement.lang:'de';
 const WORDS={de:{title:'Werkstatt',close:'Schließen',buy:'Einbauen',max:'Maximal',locked:'Fahrzeug gesperrt',coins:'Zu wenig Münzen',failed:'Kauf fehlgeschlagen',conflict:'Bitte neu laden',balance:'Münzen',available:'Neues Teil verfügbar',cut:'Schnittmodell',whole:'Karosserie',reset:'Ansicht',rotate:'Drehen',zoom:'Zoom',view:'3D-Werkstatt: Pfeiltasten drehen, + / − zoomen',acceleration:'Beschleunigung',topSpeed:'Topspeed',grip:'Grip',braking:'Bremskraft',weight:'Gewicht',pi:'PI',highAcceleration:'Obere Gänge',steering:'Lenkreaktion',terrainGrip:'Gelände-Grip',downforce:'Abtrieb',drag:'Luftwiderstand',damage:'Schadensfaktor',installed:'Teil eingebaut',allowed:'Upgrades erlaubt',stage:'Stufe'},en:{title:'Workshop',close:'Close',buy:'Install',max:'Maximum',locked:'Vehicle locked',coins:'Not enough coins',failed:'Purchase failed',conflict:'Please reload',balance:'Coins',available:'New part available',cut:'Cutaway',whole:'Bodywork',reset:'View',rotate:'Rotate',zoom:'Zoom',view:'3D workshop: arrow keys rotate, + / − zoom',acceleration:'Acceleration',topSpeed:'Top speed',grip:'Grip',braking:'Braking',weight:'Weight',pi:'PI',highAcceleration:'Upper gears',steering:'Steering response',terrainGrip:'Terrain grip',downforce:'Downforce',drag:'Drag',damage:'Damage factor',installed:'Part installed',allowed:'Upgrades allowed',stage:'Stage'},fr:{title:'Atelier',close:'Fermer',buy:'Installer',max:'Maximum',locked:'Véhicule verrouillé',coins:'Pièces insuffisantes',failed:'Achat échoué',conflict:'Recharge la page',balance:'Pièces',available:'Nouvelle pièce disponible',cut:'Vue en coupe',whole:'Carrosserie',reset:'Vue',rotate:'Tourner',zoom:'Zoom',view:'Atelier 3D : flèches pour tourner, + / − pour zoomer',acceleration:'Accélération',topSpeed:'Vitesse max.',grip:'Adhérence',braking:'Freinage',weight:'Poids',pi:'IP',highAcceleration:'Rapports longs',steering:'Direction',terrainGrip:'Adhérence terrain',downforce:'Appui',drag:'Traînée',damage:'Dégâts',installed:'Pièce installée',allowed:'Améliorations autorisées',stage:'Niveau'}};
 const t=k=>WORDS[lang()][k]||k,partName=k=>D.parts[k].name[lang()];
 const id=(category=SAVE.category,car=SAVE.car,model=SAVE.kartModel)=>category==='gt3'?car:KartModels.effective(model)==='original'?'kart':'kart-'+KartModels.effective(model);
 const all=()=>[...KartModels.models.map(m=>({id:m.id==='original'?'kart':'kart-'+m.id,name:'Kart · '+m.name,seasonal:m.seasonal})),...KartGT3.cars.map(([id,name])=>({id,name}))];
 const owned=car=>car==='kart'||car.startsWith('kart-')&&SAVE.ownedKarts.includes(car.slice(5))||SAVE.ownedCars.includes(car);
 const levels=car=>owned(car)?S.clean(SAVE.upgrades||{},all().map(c=>c.id))[car]||{}:{};
 const pi=car=>S.carStats(car,levels(car)).pi;
 function card(car){return '<small class="tw-pi">'+t('pi')+' '+pi(car)+'</small>'}
 function available(car=id()){const u=levels(car);return owned(car)&&Object.entries(S.definition(car).parts).some(([p,list])=>(u[p]||0)<3&&list[u[p]||0].price<=SAVE.coins)}
 function entry(parent){const b=document.createElement('button');b.type='button';b.className='tw-entry';b.textContent=t('title');b.onclick=()=>{closeSheet();open()};parent.prepend(b);if(available()){const n=document.createElement('small');n.className='tw-available';n.textContent=t('available');b.after(n)}}
 let dialog=null;
 function open(initial=id()){
  if(dialog||stopRace||cur)return;
  const d=document.createElement('dialog');dialog=d;d.className='tw-dialog';d.ariaLabel=t('title');
  d.innerHTML='<header><h2>'+t('title')+'</h2><select aria-label="'+t('title')+'"></select><button type="button" data-close>'+t('close')+'</button></header><div class="tw-layout"><div class="tw-view"><canvas tabindex="0" aria-label="'+t('view')+'"></canvas><span class="tw-engine"></span><div class="tw-view-tools"><button data-cut>'+t('whole')+'</button><button data-reset>'+t('reset')+'</button><button data-zoom="-1" aria-label="'+t('zoom')+' +">+</button><button data-zoom="1" aria-label="'+t('zoom')+' −">−</button></div></div><section class="tw-panel"><div class="tw-parts"></div><div class="tw-buy"><strong></strong><button data-buy></button></div><div class="tw-stats"></div><p class="tw-status" role="status" aria-live="polite"></p></section></div>';
  const focusBefore=document.activeElement;document.body.append(d);d.showModal();const low=PREF.quality==='low',rm=matchMedia('(prefers-reduced-motion:reduce)'),cv=d.querySelector('canvas'),view=d.querySelector('.tw-view'),select=d.querySelector('select'),status=d.querySelector('.tw-status');
  for(const c of all().filter(c=>!c.seasonal||KartSeason.active())){const o=document.createElement('option');o.value=c.id;o.textContent=c.name;select.append(o)}select.value=initial;if(!select.value)select.value='kart';
  let car=select.value,part='engine',busy=false,closed=false,raf=0,vehicle=null,rig=null,cut=true,install=null,last=0,idle=0,angle=.7,elevation=.48,distance=6.5,pitchTarget=new THREE.Vector3(0,.7,0),target=pitchTarget.clone(),points=new Map(),clickStart=null;
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x142e40);const camera=new THREE.PerspectiveCamera(40,1,.1,80);let renderer;
  try{renderer=new THREE.WebGLRenderer({canvas:cv,antialias:!low});renderer.setPixelRatio(Math.min(devicePixelRatio,low?1:1.75));renderer.outputEncoding=THREE.sRGBEncoding;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.localClippingEnabled=true}catch(e){status.textContent=t('failed');d.querySelector('[data-close]').onclick=()=>d.close();d.addEventListener('close',()=>{d.remove();dialog=null;focusBefore?.focus()},{once:true});return}
  scene.add(new THREE.HemisphereLight(0xd9efff,0x506269,1.6));const key=new THREE.DirectionalLight(0xffe9c0,1.8);key.position.set(3,7,4);scene.add(key);const fill=new THREE.DirectionalLight(0x66c5ff,.9);fill.position.set(-5,3,-3);scene.add(fill);
  const floor=new THREE.Mesh(new THREE.CylinderGeometry(3.1,3.35,.15,low?12:48),new THREE.MeshStandardMaterial({color:0x314f60,roughness:.8}));floor.position.y=-.1;scene.add(floor);const grid=new THREE.GridHelper(16,16,0x426c7d,0x294a5a);grid.position.y=-.19;scene.add(grid);
  function draw(){if(closed)return;const rect=view.getBoundingClientRect();renderer.setSize(Math.max(1,rect.width),Math.max(1,rect.height),false);camera.aspect=rect.width/Math.max(1,rect.height);camera.updateProjectionMatrix();camera.position.set(target.x+Math.sin(angle)*Math.cos(elevation)*distance,target.y+Math.sin(elevation)*distance,target.z+Math.cos(angle)*Math.cos(elevation)*distance);camera.lookAt(target);renderer.render(scene,camera)}
  function applyCut(){vehicle.userData.fpHide?.forEach(o=>o.visible=!cut);vehicle.userData.body?.traverse(o=>{if(!o.isMesh)return;for(const m of Array.isArray(o.material)?o.material:[o.material]){m.transparent=cut&&!low;m.opacity=cut&&!low?.18:1;m.depthWrite=!cut||low;m.clippingPlanes=cut&&low?[new THREE.Plane(new THREE.Vector3(0,-1,0),.62)]:[];m.needsUpdate=true}});rig.visible=true;for(const [p,g] of Object.entries(rig.userData.groups))g.visible=cut||!!levels(car)[p];d.querySelector('[data-cut]').textContent=t(cut?'whole':'cut');draw()}
  function rebuild(){if(vehicle)KartTuningVisuals.dispose(vehicle);if(rig)KartTuningVisuals.dispose(rig);const def=S.definition(car),model=car==='kart'?'original':car.slice(5);vehicle=makeKart(paintColor(),WSTYLE,scene,def.category,car,'original',model);KartTuningVisuals.isolateMaterials(vehicle,[wRub,wChr,wAcc,wWood,wMark]);rig=KartTuningVisuals.make(car,levels(car),true,low);scene.add(rig);d.querySelector('.tw-engine').textContent=def.engine.toUpperCase().replace('INLINE','I')+' · '+({de:{front:'Vorn',rear:'Hinten',middle:'Mitte'},en:{front:'Front',rear:'Rear',middle:'Mid'},fr:{front:'Avant',rear:'Arrière',middle:'Central'}}[lang()][def.layout]);applyCut()}
  function focusPart(p){part=p;idle=performance.now()+5000;const pos={engine:rig.userData.engine.position,induction:rig.userData.engine.position,gearbox:rig.userData.engine.position,tyres:new THREE.Vector3(.7,.4,1),brakes:new THREE.Vector3(.8,.4,1),suspension:new THREE.Vector3(.5,.6,1),aero:new THREE.Vector3(0,1,-1.4),weight:new THREE.Vector3(.6,.4,0)}[part];pitchTarget.copy(pos);if(rm.matches)target.copy(pitchTarget);distance=4.8;paint();draw()}
  function paint(){const u=levels(car),n=u[part]||0,list=S.definition(car).parts[part],next=n<3?list[n]:null,current=S.carStats(car,u),preview=S.carStats(car,next?{...u,[part]:n+1}:u);const parts=d.querySelector('.tw-parts');parts.replaceChildren();for(const p of Object.keys(D.parts)){const b=document.createElement('button');b.type='button';b.setAttribute('aria-pressed',String(p===part));b.ariaLabel=partName(p)+' · '+t('stage')+' '+(u[p]||0)+'/3';b.innerHTML=partName(p)+'<span class="tw-dots" aria-hidden="true">'+[1,2,3].map(i=>'<i class="'+((u[p]||0)>=i?'on':'')+'"></i>').join('')+'</span>';b.onclick=()=>focusPart(p);parts.append(b)}
   d.querySelector('.tw-buy strong').textContent=SAVE.coins+' '+t('balance');const b=d.querySelector('[data-buy]');b.disabled=busy||!owned(car)||!next||SAVE.coins<next.price;b.textContent=!owned(car)?t('locked'):!next?t('max'):SAVE.coins<next.price?t('coins')+' · '+next.price:t('buy')+' · '+next.price;
   const stats=d.querySelector('.tw-stats');stats.replaceChildren();for(const k of ['acceleration','topSpeed','grip','braking','weight','pi','highAcceleration','steering','terrainGrip','downforce','drag','damage']){const mul=k==='topSpeed'?3.6:1,a=current[k]*mul,b=preview[k]*mul,diff=b-a,negative=['weight','drag','damage'].includes(k),color=Math.abs(diff)<.0001?'':(negative?diff<0:diff>0)?'good':'bad',unit=k==='topSpeed'?' km/h':k==='weight'?' kg':'',digits=k==='pi'||k==='weight'?0:2;const row=document.createElement('div');row.className='tw-stat';row.innerHTML='<label><span>'+t(k)+'</span><span>'+a.toFixed(digits)+' → '+b.toFixed(digits)+unit+' <b class="'+color+'">'+(Math.abs(diff)<.0001?'':(diff>0?'+':'')+diff.toFixed(digits))+'</b></span></label><meter min="0" max="'+Math.max(S.carStats(car,{})[k]*mul*1.4,a,b,1)+'" value="'+b+'"></meter>';stats.append(row)}
  }
  async function buy(){if(busy)return;const selectedCar=car,selectedPart=part,u=levels(car),level=(u[part]||0)+1,next=S.definition(car).parts[part][level-1];if(!owned(car)||!next)return;busy=true;paint();select.disabled=true;status.textContent='';try{if(window.KartAccount)await KartAccount.buyUpgrade(car,part,level);else{if(SAVE.coins<next.price)throw{code:'coins'};SAVE.coins-=next.price;SAVE.upgrades??={};(SAVE.upgrades[car]??={})[part]=level;persist()}showroomKart();renderLobby();if(closed)return;rebuild();if(!rm.matches){const g=rig.userData.groups[selectedPart];install={group:g,time:0,y:g.position.y};g.position.y+=.7;g.scale.setScalar(.3)}status.textContent=partName(selectedPart)+' · '+t('installed')}catch(e){if(!closed)status.textContent=t(e.code==='coins'?'coins':e.code==='conflict'?'conflict':'failed')}finally{busy=false;if(!closed){select.disabled=false;paint();draw();d.querySelector('[data-buy]').focus()}}}
  d.querySelector('[data-buy]').onclick=buy;select.onchange=()=>{car=select.value;install=null;rebuild();focusPart(part)};
  d.querySelector('[data-cut]').onclick=()=>{cut=!cut;applyCut()};d.querySelector('[data-reset]').onclick=()=>{angle=.7;elevation=.48;distance=6.5;pitchTarget.set(0,.7,0);if(rm.matches)target.copy(pitchTarget);draw()};d.querySelectorAll('[data-zoom]').forEach(b=>b.onclick=()=>{distance=Math.max(2.6,Math.min(10,distance+Number(b.dataset.zoom)*.6));draw()});
  function release(e){points.delete(e.pointerId);if(clickStart&&Math.hypot(e.clientX-clickStart.x,e.clientY-clickStart.y)<6){const r=cv.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2),camera);const hit=ray.intersectObject(rig,true).find(x=>x.object.visible&&x.object.userData.part);if(hit)focusPart(hit.object.userData.part)}clickStart=null}
  cv.onpointerdown=e=>{cv.setPointerCapture(e.pointerId);points.set(e.pointerId,{x:e.clientX,y:e.clientY});clickStart={x:e.clientX,y:e.clientY};idle=performance.now()+5000};cv.onpointerup=release;cv.onpointercancel=e=>{points.delete(e.pointerId);clickStart=null};cv.onpointermove=e=>{if(!points.has(e.pointerId))return;const old=points.get(e.pointerId),other=[...points.entries()].find(([i])=>i!==e.pointerId)?.[1];if(other){const before=Math.hypot(old.x-other.x,old.y-other.y),after=Math.hypot(e.clientX-other.x,e.clientY-other.y);distance=Math.max(2.6,Math.min(10,distance+(before-after)*.015));clickStart=null}else{angle-=(e.clientX-old.x)*.008;elevation=Math.max(.12,Math.min(1.3,elevation+(e.clientY-old.y)*.006))}points.set(e.pointerId,{x:e.clientX,y:e.clientY});idle=performance.now()+5000;draw()};cv.onwheel=e=>{e.preventDefault();distance=Math.max(2.6,Math.min(10,distance+e.deltaY*.007));idle=performance.now()+5000;draw()};cv.onkeydown=e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','='].includes(e.key)){e.preventDefault();e.stopPropagation();if(e.key==='ArrowLeft')angle-=.12;if(e.key==='ArrowRight')angle+=.12;if(e.key==='ArrowUp')elevation=Math.min(1.3,elevation+.1);if(e.key==='ArrowDown')elevation=Math.max(.12,elevation-.1);if(e.key==='+'||e.key==='=')distance=Math.max(2.6,distance-.4);if(e.key==='-')distance=Math.min(10,distance+.4);idle=performance.now()+5000;draw()}};
  function loop(now){if(closed)return;const dt=Math.max(0,Math.min(.05,(now-last)/1000));last=now;if(!rm.matches){if(now>idle&&!points.size)angle+=dt*.16;target.lerp(pitchTarget,1-Math.exp(-dt*7));if(install){install.time+=dt;const x=Math.min(1,install.time/.7),ease=1-Math.pow(1-x,3);install.group.position.y=install.y+.7*(1-ease);install.group.scale.setScalar(.3+.7*ease);if(x===1)install=null}draw();raf=requestAnimationFrame(loop)}}
  const resize=new ResizeObserver(draw);resize.observe(view);const motion=()=>{cancelAnimationFrame(raf);if(rm.matches){if(install){install.group.position.y=install.y;install.group.scale.setScalar(1);install=null}target.copy(pitchTarget);draw()}else raf=requestAnimationFrame(loop)};rm.addEventListener('change',motion);
  function close(){if(closed)return;closed=true;cancelAnimationFrame(raf);resize.disconnect();rm.removeEventListener('change',motion);KartTuningVisuals.dispose(scene);renderer.dispose();renderer.forceContextLoss();d.remove();dialog=null;(focusBefore?.isConnected?focusBefore:document.getElementById('garageBtn'))?.focus()}
  d.querySelector('[data-close]').onclick=()=>d.close();d.addEventListener('close',close);d.addEventListener('keydown',e=>e.stopPropagation());rebuild();paint();draw();if(!rm.matches)raf=requestAnimationFrame(loop);
 }
 function adminEditor(holder,inventory){const section=document.createElement('details'),summary=document.createElement('summary');summary.textContent=t('title');section.append(summary);for(const c of all()){const row=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent=c.name;row.append(legend);for(const p of Object.keys(D.parts)){const label=document.createElement('label');label.textContent=partName(p);const input=document.createElement('select');input.dataset.upgradeCar=c.id;input.dataset.upgradePart=p;for(let n=0;n<=3;n++){const o=document.createElement('option');o.value=n;o.textContent=t('stage')+' '+n;input.append(o)}input.value=inventory.upgrades?.[c.id]?.[p]||0;label.append(input);row.append(label)}section.append(row)}const reset=document.createElement('button');reset.type='button';reset.textContent={de:'Alle Teile zurücksetzen',en:'Reset all parts',fr:'Réinitialiser les pièces'}[lang()];reset.onclick=()=>section.querySelectorAll('select').forEach(s=>s.value=0);section.prepend(reset);holder.append(section)}
 function adminValue(holder){const value={};holder.querySelectorAll('[data-upgrade-car]').forEach(s=>{const n=Number(s.value);if(n)(value[s.dataset.upgradeCar]??={})[s.dataset.upgradePart]=n});return value}
 function network(){const ids=[id('kart'),id('gt3')];return Object.fromEntries(ids.map(c=>[c,levels(c)]))}
 function room(hp){const b=document.getElementById('rUpgrades');if(!b)return;b.checked=hp.upgradesAllowed===true;b.disabled=!cur?.host||!!hp.go;const summary=document.getElementById('rTuningSummary');summary.textContent=t('allowed')+' · '+({de:['Aus','An'],en:['Off','On'],fr:['Non','Oui']}[lang()][b.checked?1:0])}
 function install(){for(const [target,key]of [['lsetup','sUpgrades'],['rhost','rUpgrades']]){const label=document.createElement('label');label.className='field';const input=document.createElement('input');input.type='checkbox';input.id=key;const span=document.createElement('span');span.dataset.tuningLabel='';label.append(input,span);document.getElementById(target).append(label);if(key==='rUpgrades')input.onchange=()=>{const hp=cur&&hostPlayer(cur.room.peers())?.presence;if(cur?.host&&!hp.go)cur.room.presence({upgradesAllowed:input.checked}).catch(()=>{})}}
  const summary=document.createElement('small');summary.id='rTuningSummary';document.getElementById('rmode').after(summary);const render=()=>{document.querySelectorAll('[data-tuning-label]').forEach(s=>s.textContent=t('allowed'));document.getElementById('sUpgrades').disabled=false};document.getElementById('smode').addEventListener('change',render);new MutationObserver(render).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});render();
 }
 return {open,entry,id,levels,owned,all,pi,card,available,text:t,adminEditor,adminValue,network,room,install};
})();


;/* stylized.js */
// Shared generated surface atlas. Only requested tiles become GPU textures.
window.KartStyle=(()=>{
 const cache=new Map();let source,trackSource,winterSource;
 const loadWinter=()=>winterSource||(winterSource=new Promise((resolve,reject)=>{const i=new Image(),timer=setTimeout(()=>{i.onload=i.onerror=null;winterSource=null;reject(Error('Winter atlas timeout'))},20000);i.onload=()=>{clearTimeout(timer);resolve(i)};i.onerror=()=>{clearTimeout(timer);winterSource=null;reject(Error('Winter atlas unavailable'))};i.src='assets/materials/stylized/winter-surfaces-v1.webp'}));
 const loadTrack=()=>trackSource||(trackSource=new Promise((resolve,reject)=>{const i=new Image(),timer=setTimeout(()=>{i.onload=i.onerror=null;trackSource=null;reject(Error('Track atlas timeout'))},20000);i.onload=()=>{clearTimeout(timer);resolve(i)};i.onerror=()=>{clearTimeout(timer);trackSource=null;reject(Error('Track atlas unavailable'))};i.src='assets/materials/stylized/track-surfaces-v2.webp'}));
 const load=()=>source||(source=new Promise((resolve,reject)=>{const i=new Image(),timer=setTimeout(()=>{i.onload=i.onerror=null;source=null;reject(Error('Surface atlas timeout'))},20000);i.onload=()=>{clearTimeout(timer);resolve(i)};i.onerror=()=>{clearTimeout(timer);source=null;reject(Error('Surface atlas unavailable'))};i.src='assets/materials/stylized/surfaces-v1.webp'}));
 function texture(tile,repeat=[1,1],neutral=false,facade=false){const key=[tile,...repeat,neutral,facade].join(':');if(cache.has(key))return cache.get(key);
  const winter=tile>=20,track=tile>=16,localTile=winter?tile-20:track?tile-16:tile,grid=track?2:4;
  const task=(winter?loadWinter():track?loadTrack():load()).then(i=>{const c=document.createElement('canvas');c.width=c.height=512;const g=c.getContext('2d'),w=i.width/grid,h=i.height/grid;
   // Mirrored quadrants make edges continuous, including generated tile seams.
   for(let y=0;y<2;y++)for(let x=0;x<2;x++){g.save();g.translate(x?512:0,y?512:0);g.scale(x?-1:1,y?-1:1);g.drawImage(i,(localTile%grid)*w+2,Math.floor(localTile/grid)*h+2,w-4,h-4,0,0,256,256);g.restore()}
   if(neutral&&!track){const p=g.getImageData(0,0,512,512);for(let j=0;j<p.data.length;j+=4){const v=225+(p.data[j]+p.data[j+1]+p.data[j+2])/765*30;p.data[j]=p.data[j+1]=p.data[j+2]=v}g.putImageData(p,0,0)}
   if(tile===17){g.fillStyle='rgba(38,43,47,.16)';g.fillRect(0,0,4,512);g.fillRect(508,0,4,512);g.fillStyle='rgba(255,255,255,.25)';g.fillRect(4,0,4,512);g.fillRect(504,0,4,512)}
   if(facade){g.fillStyle='#eee9da';g.fillRect(0,0,512,16);g.fillRect(0,496,512,16);for(let y=42;y<480;y+=108)for(let x=28;x<490;x+=98){g.fillStyle='#d8d6ca';g.fillRect(x-5,y-5,64,74);g.fillStyle='#71a6c3';g.fillRect(x,y,54,62);g.fillStyle='#304e68';g.fillRect(x,y+4,54,4);g.fillStyle='#e5e9dd';g.fillRect(x+25,y,4,62);g.fillRect(x-7,y+63,68,6)}}
   const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(...repeat);t.anisotropy=QUALITY_PRESETS[PREF.quality].anisotropy;t.userData={sharedSurface:true,stylized:true,tile};return t;
  }).catch(e=>{cache.delete(key);throw e});cache.set(key,task);return task;
 }
 function apply(m,tile=5,repeat=[1,1],neutral=true,facade=false){if(m.userData.stylized)return m;m.userData.stylized=true;let disposed=false;m.addEventListener('dispose',()=>disposed=true);texture(tile,repeat,neutral,facade).then(t=>{if(disposed)return;m.map=t;m.normalMap=m.roughnessMap=m.bumpMap=null;m.needsUpdate=true}).catch(()=>{m.userData.stylized=false});return m}
 function environment(root){root.traverse(o=>{if(!o.isMesh||o.userData.legacyScenery)return;for(const m of [].concat(o.material)){if(!m.isMeshStandardMaterial||m.userData.surface||m.map||m.userData.art||m.userData.authoredScenery||m.transparent)continue;apply(m)}})}
 function uv(geometry){if(geometry.attributes.uv)return;const p=geometry.attributes.position,n=geometry.attributes.normal,a=[];for(let i=0;i<p.count;i++){const x=Math.abs(n.getX(i)),y=Math.abs(n.getY(i)),z=Math.abs(n.getZ(i));a.push((x>y&&x>z?p.getZ(i):p.getX(i))*1.5,(y>x&&y>z?p.getZ(i):p.getY(i))*1.5)}geometry.setAttribute('uv',new THREE.Float32BufferAttribute(a,2))}
 return {texture,apply,environment,uv,prepare:(winter=false)=>Promise.all([load(),loadTrack(),...(winter?[loadWinter()]:[])])};
})();


;/* quality.js */
// Quality presets and locally bundled CC0 ambientCG materials.
const QUALITY_PRESETS={low:{scale:.65,shadow:512,anisotropy:1},medium:{scale:1,shadow:1024,anisotropy:4},high:{scale:1.6,shadow:4096,anisotropy:16}};
const surfaceMaterials=new Set(),surfaceTextures=new Map();
function materialTexture(id,tier,role,repeat,road=false,neutral=false){
 const tile={WinterRoad:20,WinterSnow:21,WinterFir:22,WinterTrail:23,Asphalt012:16,PaintedCurb:18,Grass001:19,Concrete034:2,Snow001:11,Metal012:5}[id]??5;
 return KartStyle.texture(tile,repeat,neutral||id==='Metal012');
}
function pbr(material,id,repeat=[1,1],options={}){
  material.userData.surface={id,repeat,options,original:{map:material.map,normalMap:material.normalMap,roughnessMap:material.roughnessMap,bumpMap:material.bumpMap,color:material.color.clone(),roughness:material.roughness},revision:0};
  surfaceMaterials.add(material);
  material.addEventListener('dispose',()=>{surfaceMaterials.delete(material);material.userData.surface.disposed=true});
  updateSurface(material);return material;
}
function updateSurface(material){
  const s=material.userData.surface,tier=PREF.quality,revision=++s.revision;
  const roles=['Color'];
  Promise.all(roles.map(role=>materialTexture(s.id,tier,role,s.options.road&&role!=='Color'?[4,8]:s.repeat,s.options.road,material.vertexColors))).then(maps=>{
    if(s.disposed||revision!==s.revision)return;
    material.map=s.options.keepColor?s.original.map:maps[0];
    material.normalMap=maps[1]||null;material.roughnessMap=maps[2]||null;material.bumpMap=null;
    material.normalScale.setScalar(s.options.normal??.3);
    material.color.set(s.options.tint??(s.id==='Asphalt012'?0x626d82:s.id==='Grass001'?0x849577:s.id==='Metal012'||s.options.keepColor?s.original.color:0xffffff));
    material.roughness=s.options.roughness??s.original.roughness;material.needsUpdate=true;
  }).catch(error=>console.warn('Material fallback:',s.id,error));
}
function applyQuality(r){
  const preset=QUALITY_PRESETS[PREF.quality];
  // Supersampling differs even on a display with devicePixelRatio = 1.
  const size=r.getSize(new THREE.Vector2()),w=size.x||innerWidth,h=size.y||innerHeight;
  const ratio=Math.min(Math.max(1,devicePixelRatio)*preset.scale,2.5,Math.sqrt(12000000/(w*h)));
  if(r.getPixelRatio()!==ratio)r.setPixelRatio(ratio);
  r.shadowMap.enabled=PREF.shadows;r.shadowMap.type=PREF.quality==='low'?THREE.BasicShadowMap:THREE.PCFSoftShadowMap;
  r.shadowMap.needsUpdate=true;r.toneMappingExposure=PREF.brightness;
  if(r._kartScene)r._kartScene.traverse(o=>{
    if(o.isLight&&o.shadow){const n=Math.min(preset.shadow,r.capabilities.maxTextureSize);if(o.shadow.mapSize.x!==n){o.shadow.map?.dispose();o.shadow.map=null;o.shadow.mapSize.set(n,n)}o.shadow.normalBias=.025}
    if(o.material)for(const m of [].concat(o.material)){
      for(const key of ['map','normalMap','roughnessMap','bumpMap'])if(m[key]){const a=Math.min(preset.anisotropy,r.capabilities.getMaxAnisotropy());if(m[key].anisotropy!==a){m[key].anisotropy=a;m[key].needsUpdate=true}}
      if(m.isMeshStandardMaterial){m.envMap=PREF.quality==='high'?r._studioEnv?.texture||null:null;m.envMapIntensity=.35;m.needsUpdate=true}
    }
  });
}
function qualityRender(r,scene,camera){
  r._kartScene=scene;
  const key=[PREF.quality,PREF.shadows,PREF.brightness].join(':');
  if(r._qualityKey!==key){
    if(PREF.quality==='high'&&!r._studioEnv){
      const room=new THREE.Scene();room.background=new THREE.Color(0x9badc0);
      const shapes=[];
      for(const [x,y,z,w,h,d,color] of [[0,12,0,30,.2,30,0xe8f1ff],[-12,5,0,.2,6,18,0xffffff],[12,3,0,.2,4,18,0x6d8ba6],[0,-3,0,30,.2,30,0x25313a]]){
        const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshBasicMaterial({color}));mesh.position.set(x,y,z);room.add(mesh);shapes.push(mesh);
      }
      const pmrem=new THREE.PMREMGenerator(r);r._studioEnv=pmrem.fromScene(room,.04);pmrem.dispose();for(const m of shapes){m.geometry.dispose();m.material.dispose()}
    }
    if(typeof SR!=='undefined'&&scene===SR.scene){if(SR.kart)upgradeArt(SR.kart);if(podiumStage)for(const kart of podiumStage.karts.values())upgradeArt(kart)}
    else {upgradeArt(scene);updateTrackScenery(scene)}
    applyQuality(r);r._qualityKey=key;
  }
  if(typeof SR!=='undefined'&&scene===SR.scene&&drawLobbyArt(r,scene,camera))return;
  if(PREF.quality==='high'&&PREF.experimentalShaders&&scene===window.kartRaceScene){
    if(window.KartExperimental){KartExperimental.render(r,scene,camera);return}
    if(!r._experimentalLoading){r._experimentalLoading=true;KartAssets.script('experimental-shaders.js').then(()=>r._experimentalLoading=false).catch(()=>{r._experimentalLoading=false})}
  }else if(r._kartExperimental)KartExperimental.dispose(r);
  r.render(scene,camera);
}
function disposeQuality(r){window.KartExperimental?.dispose(r);r._studioEnv?.dispose();r._studioEnv=null;r._kartScene=null}
function releaseSurfaceMaterials(root){
  const shared=new Set([wRub,wChr,wAcc,wWood,wMark]);
  root.traverse(o=>{if(o.material)for(const m of [].concat(o.material))if(!shared.has(m)&&(m.userData.art||(m.userData.surface&&!m.userData.surface.disposed)))m.dispose()});
}

function disposeRaceScene(scene){
 if(window.kartRaceScene===scene)window.kartRaceScene=null;
 const protectedMaterials=new Set([wRub,wChr,wAcc,wWood,wMark]),protectedTextures=new Set([radT,tireSide,tireCap]);
 const geometries=new Set(),materials=new Set(),textures=new Set();
 scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)for(const m of [].concat(o.material))if(!protectedMaterials.has(m))materials.add(m);if(o.isLight&&o.shadow)o.shadow.dispose()});
 if(scene.background?.isTexture)textures.add(scene.background);
 for(const m of materials){if(m.userData.art?.original&&!m.userData.art.original.userData?.sharedSurface)textures.add(m.userData.art.original);for(const k of ['map','normalMap','roughnessMap','bumpMap'])if(m[k]&&!m[k].userData?.sharedSurface)textures.add(m[k]);m.dispose()}
 for(const g of geometries)g.dispose();for(const t of textures)if(!protectedTextures.has(t))t.dispose();scene.clear();pruneArtTextures();
}


;/* assets/backgrounds/backgrounds.js */
// Calendar selection; images load only when their lobby is visible.
window.KART_BACKGROUNDS={get multiplayer(){return KartSeason.background('multiplayer')},get singleplayer(){return KartSeason.background('singleplayer')}};


;/* art.js */
// Stylized materials shared by all graphics levels. Original sources remain available.
const artMaterials=new Set(),artTextureCache=new Map();
function restyleKartPaint(m,color){
  const c=m.userData.art.modern.image,ctx=c.getContext('2d');
  ctx.fillStyle='#'+new THREE.Color(color).getHexString();ctx.fillRect(0,0,1024,1024);
  ctx.fillStyle='#f4eed8';ctx.beginPath();ctx.moveTo(160,0);ctx.lineTo(330,0);ctx.lineTo(840,1024);ctx.lineTo(670,1024);ctx.fill();
  ctx.fillStyle='#142c42';ctx.beginPath();ctx.moveTo(355,0);ctx.lineTo(400,0);ctx.lineTo(910,1024);ctx.lineTo(865,1024);ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,.16)';ctx.lineWidth=2;for(let x=0;x<1024;x+=12){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,1024);ctx.stroke()}
  m.userData.art.newRoughness=.35;m.userData.art.modern.needsUpdate=true;refreshArt(m);
}
function upgradeArt(root){
  root.traverse(o=>{
    if(o.userData.driverVariants){o.userData.driverVariants[0].visible=false;o.userData.driverVariants[1].visible=true}
    if(!o.isMesh||!o.material)return;
    for(const m of [].concat(o.material)){
      if(!m.isMeshStandardMaterial&&!m.isMeshBasicMaterial)return;
      const kind=m.metalness>.35?'metal':m.roughness>.85?'matte':'paint';
      detailMaterial(m,kind);if(m.userData.art)refreshArt(m);
    }
  });
}
function refreshArt(m){
  const a=m.userData.art;if(!a)return;
  m.map=a.modern;
  m.roughness=a.newRoughness;
  if(KartSeason.skin(m.userData.livery)==='christmas')christmasPaint().then(t=>{if(artMaterials.has(m)&&KartSeason.skin(m.userData.livery)==='christmas'){m.map=t;m.roughness=.36;m.needsUpdate=true}}).catch(()=>{});
  m.needsUpdate=true;
}
let christmasTexture;
function christmasPaint(){return christmasTexture||(christmasTexture=new Promise((resolve,reject)=>new THREE.TextureLoader().load('assets/vehicles/liveries/christmas-sleigh-v2.webp',t=>{t.encoding=THREE.sRGBEncoding;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.userData={sharedSurface:true,christmas:true};resolve(t)},undefined,e=>{christmasTexture=null;reject(e)})))}
function detailMaterial(m,kind='paint'){
  if(m.userData.stylized||m.userData.authoredScenery||m.userData.art||m.userData.surface||!m.color)return;
  const key=(m.map?.uuid||'plain')+':'+kind,cached=artTextureCache.get(key);
  if(cached){attachArt(m,cached,kind);return}
  const original=m.map,c=document.createElement('canvas');c.width=c.height=1024;const ctx=c.getContext('2d');
  ctx.fillStyle='#ffffff';ctx.fillRect(0,0,1024,1024);
  if(original?.image){try{ctx.drawImage(original.image,0,0,1024,1024)}catch(e){}}
  else {const gr=ctx.createLinearGradient(0,0,1024,1024);gr.addColorStop(0,'#ffffff');gr.addColorStop(.45,'#e5e8ed');gr.addColorStop(1,'#fafbff');ctx.fillStyle=gr;ctx.fillRect(0,0,1024,1024)}
  let seed=17;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return(seed>>>0)/4294967296};
  for(let i=0;i<14000;i++){ctx.fillStyle=rnd()>.5?'rgba(255,255,255,.045)':'rgba(0,0,0,.035)';ctx.fillRect(rnd()*1024,rnd()*1024,kind==='metal'?12:2,1)}
  if(kind==='fabric'){ctx.strokeStyle='rgba(15,25,40,.12)';ctx.lineWidth=1;for(let i=0;i<1024;i+=6){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,1024);ctx.moveTo(0,i);ctx.lineTo(1024,i);ctx.stroke()}}
  if(kind==='rubber'){ctx.strokeStyle='rgba(0,0,0,.2)';ctx.lineWidth=5;for(let i=-1024;i<2048;i+=40){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i+512,1024);ctx.stroke()}}
  const modern=new THREE.CanvasTexture(c);modern.encoding=THREE.sRGBEncoding;modern.wrapS=modern.wrapT=THREE.RepeatWrapping;modern.userData={sharedSurface:true};
  if(original){modern.repeat.copy(original.repeat);modern.offset.copy(original.offset);modern.rotation=original.rotation}
  artTextureCache.set(key,modern);attachArt(m,modern,kind);
}
function attachArt(m,modern,kind){m.userData.art={original:m.map,modern,roughness:m.roughness,newRoughness:kind==='metal'?.4:kind==='fabric'?.88:kind==='rubber'?.94:.65};artMaterials.add(m);m.addEventListener('dispose',()=>{artMaterials.delete(m)});refreshArt(m)}
function modernDriver(color){if(window.KartModels)return KartModels.driver(color);
  const group=new THREE.Group();group.name='Modern racer';
  const suit=new THREE.MeshStandardMaterial({color,roughness:.8}),ivory=new THREE.MeshStandardMaterial({color:0xf5f1dc,roughness:.65}),dark=new THREE.MeshStandardMaterial({color:0x18283a,roughness:.8}),visor=new THREE.MeshStandardMaterial({color:0x193c54,metalness:.45,roughness:.22}),gold=new THREE.MeshStandardMaterial({color:0xffcb32,roughness:.5});
  detailMaterial(suit,'fabric');detailMaterial(dark,'fabric');detailMaterial(ivory);detailMaterial(gold,'metal');
  function ell(x,y,z,sx,sy,sz,m){const mesh=new THREE.Mesh(new THREE.SphereGeometry(1,24,16),m);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);mesh.castShadow=true;group.add(mesh);return mesh}
  function limb(a,b,r,m){const A=new THREE.Vector3(...a),B=new THREE.Vector3(...b),mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r*1.05,A.distanceTo(B),12),m);mesh.position.copy(A).add(B).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),B.sub(A).normalize());mesh.castShadow=true;group.add(mesh)}
  ell(0,.86,-.37,.29,.34,.22,suit);ell(0,.92,-.17,.22,.23,.045,ivory);
  limb([0,.72,-.12],[0,1.11,-.12],.018,dark);
  for(const side of [-1,1]){
    ell(side*.26,1.03,-.32,.14,.16,.15,suit);
    limb([side*.26,1.04,-.28],[side*.36,.86,-.01],.085,suit);
    limb([side*.36,.86,-.01],[side*.19,1,.16],.077,ivory);
    ell(side*.19,1,.16,.09,.075,.095,dark);
    limb([side*.13,.67,-.36],[side*.18,.48,.15],.105,suit);
    ell(side*.18,.4,.35,.12,.095,.22,dark);
    limb([side*.21,.97,-.108],[side*.21,.78,-.108],.025,gold);
  }
  ell(0,1.22,-.34,.12,.09,.12,dark);
  ell(0,1.49,-.32,.33,.35,.32,ivory);
  ell(0,1.51,-.04,.285,.16,.085,dark);
  ell(0,1.525,.015,.25,.115,.03,visor);
  ell(0,1.30,-.045,.26,.075,.085,ivory);
  ell(0,1.79,-.32,.055,.045,.21,gold);
  for(const side of [-1,1])ell(side*.325,1.48,-.29,.025,.06,.06,gold);
  return group;
}
const lobbyArt={textures:{},pending:{},retryAfter:{},placeholder:new THREE.Color(0x243342)};
function drawLobbyArt(r,scene,camera){
  const multi=!!podiumStage,kind=multi?'multiplayer':'singleplayer',path=KartSeason.background(kind),id=kind+(KartSeason.active()?'-christmas':'');
  if(!lobbyArt.textures[id]&&!lobbyArt.pending[id]&&Date.now()>=(lobbyArt.retryAfter[id]||0)){
    lobbyArt.pending[id]=true;
    new THREE.TextureLoader().load(path,t=>{t.encoding=THREE.sRGBEncoding;lobbyArt.textures[id]=t;delete lobbyArt.pending[id]},undefined,()=>{delete lobbyArt.pending[id];lobbyArt.retryAfter[id]=Date.now()+5000});
  }
  const texture=lobbyArt.textures[id];
  if(texture?.image){const aspect=texture.image.width/texture.image.height,view=camera.aspect;
    texture.repeat.set(view<aspect?view/aspect:1,view>aspect?aspect/view:1);texture.offset.set((1-texture.repeat.x)/2,(1-texture.repeat.y)/2);
  }
  if(!scene.userData.artStage){
    const stage=new THREE.Group();stage.add(new THREE.HemisphereLight(0xe6f3ff,0x535365,1.1));
    const key=new THREE.DirectionalLight(0xfff1db,1.2);key.position.set(-8,14,8);key.castShadow=true;key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-25,right:25,top:30,bottom:-25});stage.add(key);
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(90,90),new THREE.ShadowMaterial({opacity:.2}));floor.rotation.x=-Math.PI/2;floor.position.y=.49;floor.receiveShadow=true;stage.add(floor);stage.visible=false;scene.add(stage);scene.userData.artStage=stage;
  }
  const old=scene.children.map(o=>[o,o.visible]),bg=scene.background,fog=scene.fog;
  for(const [o] of old)o.visible=o===SR.kart||o===scene.userData.artStage||(multi&&[...podiumStage.karts.values()].includes(o));
  scene.background=texture||lobbyArt.placeholder;scene.fog=null;
  try{r.render(scene,camera)}finally{for(const [o,v] of old)o.visible=v;scene.background=bg;scene.fog=fog}
  return true;
}

function pruneArtTextures(){
 const used=new Set([...artMaterials].map(m=>m.userData.art?.modern));
 for(const [key,texture] of artTextureCache)if(!used.has(texture)){artTextureCache.delete(key);texture.dispose()}
}


;/* kart-models.js */
/* Original stylized meshes; image-generated material atlas, see assets/vehicles/SOURCES.md. */
window.KartModels=(()=>{
 const models=[{id:'original',name:'Original',price:0},{id:'apex',name:'Apex',price:1500},{id:'rally',name:'Rally',price:2800},{id:'vector',name:'Vector',price:4500},{id:'christmas',name:'Christmas',price:0,seasonal:true}],valid=id=>models.some(m=>m.id===id)?id:'original',effective=id=>id==='christmas'&&!KartSeason.active()?'original':valid(id),record=id=>valid(id)==='original'?'kart':'kart-'+valid(id);
 let atlas;const maps=new Map();
 function texture(tile){if(maps.has(tile))return maps.get(tile);atlas=atlas||new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>{atlas=null;reject(Error('Kart materials unavailable'))};i.src='assets/vehicles/liveries/kart-materials-v2.webp'});const task=atlas.then(i=>{const c=document.createElement('canvas');c.width=c.height=512;const w=i.width/4,h=i.height/2;c.getContext('2d').drawImage(i,tile%4*w+2,Math.floor(tile/4)*h+2,w-4,h-4,0,0,512,512);const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=QUALITY_PRESETS[PREF.quality].anisotropy;t.userData={sharedSurface:true,kartAtlas:true};return t}).catch(e=>{maps.delete(tile);throw e});maps.set(tile,task);return task}
 function material(tile,options={}){const m=new THREE.MeshPhysicalMaterial({roughness:.55,...options});m.userData.authoredScenery=true;let disposed=false;m.addEventListener('dispose',()=>disposed=true);texture(tile).then(t=>{if(disposed)return;m.map=t;m.needsUpdate=true}).catch(()=>{});return m}
 function paint(color,livery,tile=0){const m=new THREE.MeshPhysicalMaterial({color,roughness:.42,metalness:.03,clearcoat:.55,clearcoatRoughness:.35});m.userData.authoredScenery=true;m.userData.livery=livery;m.userData.baseColor=color;m.userData.paintTile=tile;skin(m);return m}
 function skin(m){const christmas=KartSeason.skin(m.userData.livery)==='christmas';const token=m.userData.skinToken=(m.userData.skinToken||0)+1;m.color.set(christmas?0xffffff:m.userData.baseColor).convertSRGBToLinear();(christmas?christmasPaint():texture(m.userData.paintTile)).then(t=>{if(m.userData.disposed||token!==m.userData.skinToken)return;m.map=t;m.needsUpdate=true}).catch(()=>{})}
 function rounded(w,h,d,r=.13){r=Math.min(r,w*.28,h*.28,d*.28);const g=new THREE.BoxGeometry(w,h,d,4,4,4),p=g.attributes.position,n=g.attributes.normal,inner=new THREE.Vector3(w/2-r,h/2-r,d/2-r),q=new THREE.Vector3(),c=new THREE.Vector3(),normal=new THREE.Vector3();for(let i=0;i<p.count;i++){q.fromBufferAttribute(p,i);c.set(Math.max(-inner.x,Math.min(inner.x,q.x)),Math.max(-inner.y,Math.min(inner.y,q.y)),Math.max(-inner.z,Math.min(inner.z,q.z)));normal.copy(q).sub(c).normalize();q.copy(c).addScaledVector(normal,r);p.setXYZ(i,q.x,q.y,q.z);n.setXYZ(i,normal.x,normal.y,normal.z)}return g}
 function merge(group){const batches=new Map();for(const m of [...group.children]){if(!m.isMesh||Array.isArray(m.material))continue;m.updateMatrix();const geo=m.geometry.index?m.geometry.toNonIndexed():m.geometry.clone();geo.applyMatrix4(m.matrix);if(!geo.attributes.uv)KartStyle.uv(geo);const list=batches.get(m.material)||[];list.push(geo);batches.set(m.material,list);group.remove(m);m.geometry.dispose()}for(const [mat,geos] of batches){const geo=new THREE.BufferGeometry();for(const [key,size] of [['position',3],['normal',3],['uv',2]]){const n=geos.reduce((s,g)=>s+g.attributes[key].array.length,0),a=new Float32Array(n);let offset=0;for(const g of geos){a.set(g.attributes[key].array,offset);offset+=g.attributes[key].array.length}geo.setAttribute(key,new THREE.BufferAttribute(a,size))}for(const g of geos)g.dispose();const mesh=new THREE.Mesh(geo,mat);mesh.castShadow=mesh.receiveShadow=true;group.add(mesh)}}
 function driver(color){const g=new THREE.Group();g.name='November racer';const suit=material(6,{color:0xffffff,roughness:.83}),ivory=material(7,{roughness:.75}),helmet=material(1,{color:0xfff9e8,roughness:.28,clearcoat:1}),glass=material(5,{roughness:.13,metalness:.35,clearcoat:1}),dark=material(2,{roughness:.8}),trim=new THREE.MeshStandardMaterial({color,roughness:.4}),gold=new THREE.MeshStandardMaterial({color:0xffcc49,metalness:.4,roughness:.35});
  const ell=(x,y,z,sx,sy,sz,m)=>{const o=new THREE.Mesh(new THREE.SphereGeometry(1,24,16),m);o.position.set(x,y,z);o.scale.set(sx,sy,sz);o.castShadow=true;g.add(o);return o};
  const limb=(a,b,r,m)=>{const A=new THREE.Vector3(...a),B=new THREE.Vector3(...b),o=new THREE.Mesh(new THREE.CylinderGeometry(r*.88,r,A.distanceTo(B),12),m);o.position.copy(A).add(B).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),B.sub(A).normalize());o.castShadow=true;g.add(o)};
  ell(0,.89,-.37,.28,.35,.22,suit);ell(0,.93,-.166,.22,.255,.043,ivory);
  for(const side of [-1,1]){ell(side*.25,1.04,-.32,.145,.15,.15,trim);limb([side*.26,1.02,-.29],[side*.34,.88,-.015],.087,suit);limb([side*.34,.88,-.015],[side*.20,1.025,.16],.077,ivory);ell(side*.20,1.025,.16,.086,.075,.09,dark);limb([side*.13,.66,-.38],[side*.18,.48,.2],.105,suit);ell(side*.18,.41,.39,.115,.095,.2,dark);limb([side*.12,1.12,-.13],[side*.16,.73,-.13],.024,dark);ell(side*.16,.75,-.108,.045,.035,.012,gold)}
  ell(0,1.19,-.34,.13,.10,.13,dark);ell(0,1.48,-.32,.315,.335,.31,helmet);
  // Curved full-face visor, rim and sculpted chin guard.
  ell(0,1.51,-.055,.285,.155,.105,dark);ell(0,1.525,.008,.259,.116,.045,glass);ell(0,1.295,-.044,.252,.088,.095,helmet);
  for(const side of [-1,1]){ell(side*.305,1.49,-.28,.025,.065,.065,trim);ell(side*.322,1.49,-.28,.013,.032,.032,gold);ell(side*.11,1.295,.04,.055,.014,.012,dark)}
  const stripe=ell(0,1.48,-.32,.045,.343,.318,trim);stripe.name='Helmet stripe';merge(g);return g;
 }
 function make(color,wstyle,scene,id='original',livery='original'){
  id=effective(id);if(KartSeason.skin(livery)==='christmas')id='christmas';const christmas=id==='christmas';if(christmas)livery='christmas';const apex=id==='apex',rally=id==='rally',vector=id==='vector',g=new THREE.Group(),body=new THREE.Group();g.name='Kart '+id;g.add(body);
  const primary=paint(color,livery),sidePaint=paint(color,livery,1),accent=material(1,{color:0xfff1d8,roughness:.48}),carbon=material(2,{roughness:.6}),rubber=material(3,{roughness:.93}),metal=material(4,{metalness:.35,roughness:.4}),rim=new THREE.MeshStandardMaterial({color:rally||christmas?0xe8b535:0xdce6ed,metalness:.35,roughness:.4}),seat=material(6,{roughness:.9}),lamp=new THREE.MeshStandardMaterial({color:0xc8f8ff,emissive:0x76c9de,emissiveIntensity:.45}),tl=new THREE.MeshStandardMaterial({color:0xb51d35,emissive:0,roughness:.4});
  const add=(geo,m,x=0,y=0,z=0,parent=body)=>{const o=new THREE.Mesh(geo,m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;parent.add(o);return o};
  const box=(w,h,d,m,x,y,z,parent)=>add(rounded(w,h,d),m,x,y,z,parent);
  const fairing=(w,h,d,m,x,y,z,taper=.22)=>{const geo=rounded(w,h,d,.18),p=geo.attributes.position;for(let i=0;i<p.count;i++){const t=(p.getZ(i)+d/2)/d;p.setX(i,p.getX(i)*(1-taper*t))}geo.computeVertexNormals();return add(geo,m,x,y,z)};
  const beam=(a,b,r,m,parent=body)=>{const A=new THREE.Vector3(...a),B=new THREE.Vector3(...b),o=add(new THREE.CylinderGeometry(r,r,A.distanceTo(B),10),m,...A.clone().add(B).multiplyScalar(.5).toArray(),parent);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),B.sub(A).normalize());return o};
  box(1.18,.13,2.42,carbon,0,.29,-.02);box(.62,.14,.65,seat,0,.48,-.34);box(.66,.65,.18,seat,0,.78,-.63).rotation.x=-.15;
  // Distinct body silhouettes, all with the same gameplay footprint.
  if(christmas){
   fairing(1.44,.38,2.30,primary,0,.48,-.02,.08);box(.68,.75,.22,primary,0,.92,-.67);box(.70,.13,.24,accent,0,1.31,-.67);
   for(const side of [-1,1]){const shape=new THREE.Shape();shape.moveTo(-1.18,.38);shape.lineTo(1.25,.38);shape.quadraticCurveTo(1.6,.82,1.1,.99);shape.quadraticCurveTo(.80,.91,.62,.67);shape.lineTo(-.5,.73);shape.quadraticCurveTo(-.90,1.15,-1.19,1.16);shape.closePath();const geo=new THREE.ExtrudeGeometry(shape,{depth:.12,bevelEnabled:true,bevelSize:.045,bevelThickness:.035,bevelSegments:2,steps:1,curveSegments:12});geo.rotateY(Math.PI/2);add(geo,sidePaint,side*.76,0,0);
    const curl=new THREE.CatmullRomCurve3([new THREE.Vector3(side*.88,.35,-1.25),new THREE.Vector3(side*.98,.28,-.4),new THREE.Vector3(side*.98,.30,.95),new THREE.Vector3(side*.93,.62,1.40),new THREE.Vector3(side*.85,.84,1.25),new THREE.Vector3(side*.85,.68,1.12)]);add(new THREE.TubeGeometry(curl,32,.065,8,false),rim);
   }
   const green=new THREE.MeshStandardMaterial({color:0x226b48,roughness:.65});box(.42,.40,.38,green,.27,.98,-1.05);box(.44,.055,.40,rim,.27,1.10,-1.05);box(.055,.42,.40,rim,.27,.98,-1.05);box(.38,.29,.36,primary,-.23,.87,-1.09);box(.40,.04,.38,accent,-.23,.94,-1.09);
  }else if(vector){fairing(1.82,.34,.92,primary,0,.51,1.0,.14);fairing(.82,.34,.85,sidePaint,0,.73,.65,.3).rotation.x=-.16;for(const s of [-1,1])box(.4,.38,1.66,sidePaint,s*.81,.59,-.12);box(1.76,.2,.38,primary,0,.53,-1.17);box(1.68,.045,.06,lamp,0,.57,1.52)}
  else{box(1.86,.33,apex?.52:.48,primary,0,.44,1.21);const nose=fairing(apex?.74:.68,.31,apex?1.08:.9,primary,0,.67,apex?.73:.77,apex?.38:.16);nose.rotation.x=-.18;for(const s of [-1,1]){const pod=fairing(apex?.52:.48,rally?.42:.36,apex?1.5:1.30,sidePaint,s*.77,rally?.62:.54,-.03,.13);pod.rotation.y=s*(apex?.1:.035)}box(1.66,.2,.3,primary,0,.45,-1.21)}
  // Physical trim follows the body contours instead of stretched texture decals.
  for(const side of [-1,1])box(.045,.09,vector?1.1:.92,accent,side*(vector?.999:1.005),vector?.62:.56,-.04);
  box(vector?.82:.68,.075,.035,accent,0,vector?.57:.47,vector?1.47:1.46);
  if(apex){box(1.98,.06,.5,carbon,0,.28,1.26);for(const s of [-1,1]){box(.07,.27,.5,primary,s*.96,.38,1.26);beam([s*.48,.53,-1.05],[s*.48,1.08,-1.15],.035,metal)}box(1.7,.1,.39,primary,0,1.12,-1.15);for(const s of [-1,1])box(.07,.25,.46,carbon,s*.85,1.12,-1.15)}
  if(rally){for(const s of [-1,1]){beam([s*.45,.55,-.63],[s*.45,1.59,-.68],.045,metal);beam([s*.45,1.59,-.68],[s*.75,.52,-1.12],.045,metal);for(const z of [-.89,.88])box(.45,.10,.7,carbon,s*.94,.81,z)}beam([-.45,1.59,-.68],[.45,1.59,-.68],.045,metal);for(const s of [-1,1]){const l=add(new THREE.CylinderGeometry(.12,.12,.1,16),lamp,s*.37,.84,1.2);l.rotation.x=Math.PI/2}}
  // Visible frame, steering linkages, rear engine and cooling fins.
  for(const s of [-1,1])beam([s*.48,.32,1.1],[s*.48,.32,-1.1],.035,metal);beam([-.98,.33,-.9],[.98,.33,-.9],.045,metal);beam([-.9,.35,.9],[.9,.35,.9],.03,metal);
  box(.43,.34,.48,carbon,-.27,.6,-.93);for(let i=0;i<5;i++)box(.4,.025,.43,metal,-.27,.47+i*.062,-.93);const exhaust=beam([.38,.4,-.65],[.38,.45,-1.27],.075,metal);box(.09,.47,.48,carbon,.52,.75,-.74);for(let i=0;i<6;i++)box(.11,.018,.46,metal,.52,.55+i*.067,-.74);
  beam([0,.56,.48],[0,1.06,.13],.025,metal);const mount=new THREE.Group();mount.position.set(0,1.06,.14);mount.rotation.x=.7;body.add(mount);const steerG=new THREE.Group();mount.add(steerG);steerG.add(makeWheel(wstyle||0));
  box(.46,.09,.06,tl,0,.46,-1.39);const racer=driver(christmas?0xbb172a:color);body.add(racer);if(christmas){const cap=new THREE.Mesh(new THREE.ConeGeometry(.245,.38,20),new THREE.MeshStandardMaterial({color:0xba1930,roughness:.85}));cap.position.set(.04,1.87,-.32);cap.rotation.z=-.24;racer.add(cap);const band=new THREE.Mesh(new THREE.TorusGeometry(.24,.055,8,24),accent);band.rotation.x=Math.PI/2;band.position.set(0,1.72,-.32);racer.add(band);const pom=new THREE.Mesh(new THREE.SphereGeometry(.075,12,8),accent);pom.position.set(.09,2.06,-.32);racer.add(pom)}
  const wheels=[],pivots=[];for(const [x,z,front] of [[-.92,.9,true],[.92,.9,true],[-.97,-.9,false],[.97,-.9,false]]){const R=rally?.37:front?.32:.35,width=front?.27:.39,pivot=new THREE.Group(),wheel=new THREE.Group();pivot.position.set(x,R,z);pivot.add(wheel);g.add(pivot);const tireGeo=new THREE.CylinderGeometry(R-.018,R-.018,width,24);tireGeo.rotateZ(Math.PI/2);add(tireGeo,rubber,0,0,0,wheel);for(const sign of [-1,1]){const tor=new THREE.TorusGeometry(R-.055,.055,8,24);tor.rotateY(Math.PI/2);add(tor,rubber,sign*(width/2-.035),0,0,wheel);const hubGeo=new THREE.CylinderGeometry(R*.53,R*.53,.027,20);hubGeo.rotateZ(Math.PI/2);add(hubGeo,carbon,sign*(width/2+.004),0,0,wheel);for(let j=0;j<6;j++){const a=j*Math.PI/3;beam([sign*(width/2+.025),Math.cos(a)*.035,Math.sin(a)*.035],[sign*(width/2+.025),Math.cos(a)*R*.52,Math.sin(a)*R*.52],.021,rim,wheel)}const cap=new THREE.CylinderGeometry(.05,.05,.035,10);cap.rotateZ(Math.PI/2);add(cap,metal,sign*(width/2+.026),0,0,wheel)}wheels.push(wheel);if(front)pivots.push(pivot)}
  const sleigh=new THREE.Group();sleigh.name='Santa sleigh trim';sleigh.visible=KartSeason.skin(livery)==='christmas';body.add(sleigh);const gold=new THREE.MeshStandardMaterial({color:0xeac05b,metalness:.35,roughness:.4}),cream=new THREE.MeshStandardMaterial({color:0xfff1db,roughness:.85});for(const m of [gold,cream])m.userData.authoredScenery=true;
  for(const side of [-1,1]){const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(side*.78,.24,-1.22),new THREE.Vector3(side*.94,.25,-.45),new THREE.Vector3(side*.96,.30,.75),new THREE.Vector3(side*.89,.48,1.23),new THREE.Vector3(side*.75,.61,1.20)]);add(new THREE.TubeGeometry(curve,24,.045,8,false),gold,0,0,0,sleigh);box(.055,.055,1.03,gold,side*1.02,.69,-.03,sleigh)}box(.68,.12,.21,cream,0,1.08,-.64,sleigh);box(.78,.05,.04,gold,0,.64,1.45,sleigh);merge(sleigh);
  merge(body);for(const wheel of wheels)merge(wheel);g.rotation.order='YXZ';g.userData={sleigh,body,wheels,pivots,tl,steerG,fpHide:[racer],paint:primary,paints:[primary,sidePaint],skin:livery,kartModel:id,recordCar:record(id),modelRevision:4};for(const p of g.userData.paints)p.addEventListener('dispose',()=>p.userData.disposed=true);scene.add(g);return g;
 }
 function setSkin(g,id){if(!g.userData.paints)return;g.userData.skin=id;if(g.userData.sleigh)g.userData.sleigh.visible=KartSeason.skin(id)==='christmas';for(const m of g.userData.paints){m.userData.livery=id;skin(m)}}
 return {models,valid,effective,record,texture,material,driver,make,setSkin,rounded};
})();


;/* ambient.js */
window.KartAmbient=(()=>{
 const themes=[
  {id:'default',level:1,price:0,n:['Original','Original','Original'],colors:['#171329','#241d40','#332a5c','#c9c2e8','#0e0b1f','#8c42f5']},
  {id:'ocean',level:5,price:3000,n:['Ozean','Ocean','Océan'],colors:['#0b1b35','#123350','#1b5074','#c3e4f7','#071323','#1685ce']},
  {id:'forest',level:10,price:6000,n:['Wald','Forest','Forêt'],colors:['#10251f','#1b3a2e','#2d5941','#d2edce','#091811','#3b9764']},
  {id:'sunset',level:20,price:12000,n:['Sonnenuntergang','Sunset','Coucher de soleil'],colors:['#301923','#4a2931','#75403b','#f6ddca','#1d111a','#b94e4c']},
  {id:'midnight',level:30,price:20000,n:['Mitternacht','Midnight','Minuit'],colors:['#121a22','#222f3a','#364651','#d6e5eb','#090f15','#347c8f']}
 ];
 const idx=()=>({de:0,en:1,fr:2}[document.documentElement.lang]??0),words={equip:['Ausrüsten','Equip','Équiper'],equipped:['Ausgerüstet','Equipped','Équipé'],level:['Ab Level','From level','Dès le niveau'],coins:['Zu wenig Münzen','Not enough coins','Pas assez de pièces'],locked:['Level noch nicht erreicht','Level not reached','Niveau insuffisant'],failed:['Kauf fehlgeschlagen. Bitte erneut versuchen.','Purchase failed. Please try again.','Achat échoué. Réessaie.'],conflict:['Bitte lade die Seite neu.','Please reload the page.','Recharge la page.']};const word=k=>words[k][idx()];
 function normalize(s){s.ownedAmbient=[...new Set(['default',...(Array.isArray(s.ownedAmbient)?s.ownedAmbient:[]).filter(id=>themes.some(t=>t.id===id))])];if(!s.ownedAmbient.includes(s.ambient))s.ambient='default';return s}
 function apply(s){normalize(s);const t=themes.find(t=>t.id===s.ambient)||themes[0];['--navy','--navy-2','--navy-3','--ink-soft','--bg','--ambient-accent'].forEach((k,i)=>document.documentElement.style.setProperty(k,t.colors[i]));document.documentElement.dataset.ambient=t.id}
 function cards(s){const lv=Math.floor(s.xp/250)+1;return '<div class="vehicle-grid ambient-grid" data-no-translate>'+themes.map(t=>{const own=s.ownedAmbient.includes(t.id),selected=s.ambient===t.id,locked=lv<t.level;return '<button type="button" class="card-btn ambient-card" data-ambient="'+t.id+'" aria-pressed="'+selected+'"'+(!own&&(locked||s.coins<t.price)?' disabled':'')+'><span class="ambient-sample" style="background:'+t.colors[1]+';border-color:'+t.colors[0]+'"><i style="background:'+t.colors[2]+'"></i><i style="background:'+t.colors[5]+'"></i><i style="background:'+t.colors[2]+'"></i></span><b>'+t.n[idx()]+'</b><small>'+(selected?word('equipped'):own?word('equip'):word('level')+' '+t.level+' · '+t.price.toLocaleString(document.documentElement.lang)+' 🪙')+'</small></button>'}).join('')+'</div>'}
 async function choose(id){const t=themes.find(t=>t.id===id);if(!t||vehiclePurchasePending)return;vehiclePurchasePending=true;const inert=document.getElementById('menu').inert;document.getElementById('menu').inert=true;document.getElementById('sheetClose').disabled=true;
  try{if(!SAVE.ownedAmbient.includes(id)){if(window.KartAccount)await KartAccount.buyCosmetic('ambient',id);else{if(Math.floor(SAVE.xp/250)+1<t.level)throw {code:'level'};if(SAVE.coins<t.price)throw {code:'coins'};SAVE.coins-=t.price;SAVE.ownedAmbient.push(id)}}SAVE.ambient=id;persist();apply(SAVE);renderLobby();if(window.KartAccount)await KartAccount.flush()}
  catch(e){flash(word(e.code==='coins'?'coins':e.code==='level'?'locked':e.code==='conflict'?'conflict':'failed'),'var(--red)')}
  finally{vehiclePurchasePending=false;document.getElementById('menu').inert=inert;document.getElementById('sheetClose').disabled=false}
 }
 return {themes,normalize,apply,cards,choose};
})();


;/* kart-designs.js */
function kartDesignCard(model,mode){const own=SAVE.ownedKarts.includes(model.id),selected=SAVE.category==='kart'&&SAVE.kartModel===model.id;return '<button type="button" class="card-btn vehicle-card" '+(mode==='garage'?'data-kart="'+model.id+'" aria-pressed="'+selected+'"'+(own?'':' disabled'):'data-buy-kart="'+model.id+'"'+(own||SAVE.coins<model.price?' disabled':''))+'>'+KartTuning.card(model.id==='original'?'kart':'kart-'+model.id)+'<img class="vehicle-preview" src="assets/vehicles/previews/kart-'+model.id+'.webp" alt="" width="320" height="180" loading="eager" decoding="async"><b>Kart · '+model.name+'</b><small>'+(mode==='garage'?(own?(selected?'Ausgerüstet':'Ausrüsten'):'Im Shop freischalten'):(own?'Freigeschaltet':'<span class="coin-inline">'+ic('coin')+model.price+'</span>'))+'</small></button>'}
async function buyKartDesign(id){const model=KartModels.models.find(m=>m.id===id);if(!model||vehiclePurchasePending||SAVE.ownedKarts.includes(id))return;vehiclePurchasePending=true;const inert=$('menu').inert;$('menu').inert=true;$('sheetClose').disabled=true;try{if(window.KartAccount)await KartAccount.buyCosmetic('kart',id);else{if(SAVE.coins<model.price)throw {code:'coins'};SAVE.coins-=model.price;SAVE.ownedKarts.push(id);persist()}renderLobby();flash('Freigeschaltet','var(--lime)')}catch(e){flash(e.code==='coins'?'Zu wenig Münzen':e.code==='conflict'?'Bitte lade die Seite neu.':'Kauf fehlgeschlagen. Bitte erneut versuchen.','var(--red)')}finally{vehiclePurchasePending=false;$('menu').inert=inert;$('sheetClose').disabled=false}}


;/* scenery.js */
// Kenney CC0 models, loaded on demand for races at every quality level.
function createTrackScenery(scene,points,settings){
 scene.userData.sceneryRequest={points,settings,loading:false,ready:false};ensureTrackScenery(scene);
}
function ensureTrackScenery(scene){
 const request=scene.userData.sceneryRequest;
 if(!request||request.disposed||request.loading||request.ready)return;
 request.loading=true;
 KartAssets.script('assets/scenery/models.js').then(()=>{request.loading=false;if(request.disposed)return;KartWorld.models();buildTrackScenery(scene,request.points,request.settings);KartWorld.decorate(scene,request.points,request.settings);request.ready=true;updateTrackScenery(scene)}).catch(()=>{request.loading=false});
}
function buildTrackScenery(scene,points,settings){
  const root=new THREE.Group();root.name='Kenney track scenery';root.userData.modernScenery=true;
  const batches=new Map(),placed=[];let state=settings.seed>>>0;
  const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296};
  function trackDistance(x,z){
    let best=Infinity;
    for(let i=0;i<points.length;i++){
      const a=points[i],b=points[(i+1)%points.length],dx=b.x-a.x,dz=b.z-a.z;
      const t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz||1)));
      best=Math.min(best,Math.hypot(x-a.x-t*dx,z-a.z-t*dz));
    }
    return best;
  }
  function place(id,index,side,height,extra=0){
    const source=window.KART_SCENERY_MODELS[id];if(!source)return;
    const radius=source.radius*height,a=points[index%points.length],b=points[(index+2)%points.length];
    const dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz)||1,nx=side*dz/length,nz=-side*dx/length;
    const distance=(settings.indoor?settings.width/2+.15:settings.border+9)+radius+extra;
    const x=a.x+nx*distance,z=a.z+nz*distance;
    const clearance=settings.indoor?settings.width/2+.1:settings.border+5;
    if(trackDistance(x,z)<clearance+radius)return;
    if(placed.some(o=>Math.hypot(x-o.x,z-o.z)<radius+o.radius+2))return;
    const y=settings.indoor?a.y:settings.height(x,z),heights=[[radius,0],[-radius,0],[0,radius],[0,-radius]].map(([ox,oz])=>settings.indoor?a.y:settings.height(x+ox,z+oz));
    if(Math.max(...heights,y)-Math.min(...heights,y)>Math.max(.8,height*.16))return;
    const transform=new THREE.Object3D();transform.position.set(x,Math.min(y,...heights)-.06,z);transform.rotation.y=Math.atan2(nx,nz);transform.scale.setScalar(height);transform.updateMatrix();
    if(!batches.has(id))batches.set(id,[]);batches.get(id).push(transform.matrix.clone());placed.push({id,x,z,radius,clearance});
  }
  const n=points.length,spacing=Math.max(1,Math.floor(n/80));
  if(!settings.indoor){
    for(const f of [.22,.46,.7,.9])place('tent',Math.floor(n*f),-1,3.5,1);
    for(const f of [.015,.035,.065])place('pylon',Math.floor(n*f),-1,1.1,0);
    const trees=settings.snow?['tree_pineRoundA','tree_pineTallA']:settings.city?['tree_default','plant_bushDetailed']:['tree_oak','tree_default','tree_pineRoundA'];
    for(let i=0;i<80;i++)for(const side of [-1,1]){
      const index=(i*spacing+Math.floor(random()*spacing))%n;
      const tree=trees[Math.floor(random()*trees.length)];place(tree,index,side,tree.startsWith('plant')?2:5+random()*4,10+random()*28);
      if(i%2===0)place(i%4===0?(i%8===0?'rock_largeA':'rock_largeC'):'plant_bushDetailed',(index+Math.floor(spacing*.45))%n,side,1.2+random()*1.8,3+random()*6);
    }

  }
  // Roadside floodlights removed; authored sources remain available for rollback.
  for(const [id,transforms] of batches){
    const source=window.KART_SCENERY_MODELS[id],geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(source.p,3));
    const colors=[];
    for(let i=0;i<source.c.length;i+=3){const c=new THREE.Color().setRGB(source.c[i],source.c[i+1],source.c[i+2]);if(settings.snow&&id.startsWith('tree')&&c.g>c.r*1.2)c.setRGB(.77,.87,.89);c.convertSRGBToLinear();colors.push(c.r,c.g,c.b)}
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.computeVertexNormals();geometry.computeBoundingSphere();
    const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.9,flatShading:true});material.userData.authoredScenery=true;KartStyle.uv(geometry);
    const mesh=new THREE.InstancedMesh(geometry,material,transforms.length);transforms.forEach((m,i)=>{mesh.setMatrixAt(i,m);const tint=new THREE.Color().setScalar(.88+(i%5)*.03);mesh.setColorAt(i,tint)});mesh.castShadow=mesh.receiveShadow=true;mesh.frustumCulled=false;mesh.name=id;root.add(mesh);
  }
  if(settings.winter)KartWinter.trees(root,batches);
  root.userData.placements=placed;root.visible=true;scene.add(root);return root;
}
function updateTrackScenery(scene){ensureTrackScenery(scene);updateHighGrass(scene);scene.traverse(o=>{
  if(o.userData.modernScenery)o.visible=true;
  if(o.userData.legacyScenery)o.visible=false;
})}
function disposeTrackScenery(scene){if(scene.userData.sceneryRequest)scene.userData.sceneryRequest.disposed=true}

function updateHighGrass(scene){const request=scene.userData.sceneryRequest;if(!request||request.disposed)return;const enabled=PREF.quality==='high'&&!request.settings.snow&&!request.settings.indoor;if(request.grass){request.grass.visible=enabled;return}if(!enabled||request.grassLoading)return;request.grassLoading=true;KartAssets.script('assets/scenery/grass-high.js').then(()=>{request.grassLoading=false;if(request.disposed||PREF.quality!=='high')return;request.grass=KartHighGrass.build(scene,request.points,request.settings)}).catch(()=>{request.grassLoading=false})}


;/* vehicle-geometry.js */
/* Closed loft with outward, hard-edged end caps; body normals stay smooth. */
(function(root){'use strict';
 function loft(T,rings){const p=[],ix=[],n=rings[0].length;for(const ring of rings)for(const v of ring)p.push(...v);
  for(let j=0;j<rings.length-1;j++)for(let k=0;k<n;k++){const a=j*n+k,b=j*n+(k+1)%n,c=(j+1)*n+k,d=(j+1)*n+(k+1)%n;ix.push(a,c,b,b,c,d)}
  for(const j of [0,rings.length-1]){const offset=p.length/3;for(const v of rings[j])p.push(...v);for(let k=1;k<n-1;k++)ix.push(offset,offset+k+(j===0?0:1),offset+k+(j===0?1:0))}
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(p,3));geometry.setIndex(ix);geometry.computeVertexNormals();return geometry;
 }
 const api={loft};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.KartVehicleGeometry=api;
})(typeof window!=='undefined'?window:globalThis);


;/* racing.js */
/* Shared race math. Server and client use assets/tracks/race-rules.json. */
(function(root){'use strict';
 const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),mod=(x,n)=>(x%n+n)%n;
 let rules,pending;
 const api={
  prepare(){return pending||(pending=fetch('assets/tracks/race-rules.json',{credentials:'same-origin'}).then(r=>{if(!r.ok)throw Error('Race rules');return r.json()}).then(r=>rules=r).catch(e=>{pending=null;throw e}))},
  setRules(r){rules=r},
  remotePose(previous,packet,dt){
   if(!['x','y','z','h'].every(key=>Number.isFinite(packet[key])))return null;
   const snap=!previous||Math.hypot(packet.x-previous.x,packet.y-previous.y,packet.z-previous.z)>60,k=snap?1:1-Math.exp(-14*Math.max(0,dt)),pose={};
   for(const key of ['x','y','z','pitch','roll']){const target=Number.isFinite(packet[key])?packet[key]:0;pose[key]=snap?target:(previous[key]||0)+(target-(previous[key]||0))*k;}
   const before=previous?.h||0,delta=mod(packet.h-before+Math.PI,2*Math.PI)-Math.PI;pose.h=snap?packet.h:before+delta*k;
   return pose;
  },
  minLap(track,category,mode){return rules?.tracks[track]?rules.tracks[track].length*rules.distanceMargin/rules.maxSpeed[mode][category]:Infinity},
  speed(v,dt,o){
   if(o.throttle)v+=o.acceleration*Math.max(.1,1-Math.max(0,v)/o.vmax)*dt;
   else v*=Math.exp(-.28*(1-(o.draft||0)*.7)*dt);
   if(o.boost&&v>0)v+=o.boost*dt;
   if(o.brake)v-=(v>.5?o.braking:12)*dt;
   v-=9.8*(o.slope||0)*dt;
   return clamp(v,-9,o.vmax);
  },
  nearest(P,x,y,z,previous,window){let best=mod(Math.round(previous),P.length),distance=Infinity;
   for(let d=-Math.min(window,P.length);d<=Math.min(window,P.length);d++){const i=mod(Math.round(previous)+d,P.length),p=P[i],q=(x-p.x)**2+(z-p.z)**2+(Number.isFinite(y)?(y-p.y)**2*4:0);if(q<distance){distance=q;best=i}}return best;
  },
  progress(N,seg,start,finish=null){const guard=api.raceProgress(N,seg,start,finish);let startTime=0,timed=false,valid=false;
   return {
    step(s,position,dt,now,onCourse,maxSpeed=110){
     // Surface does not invalidate a lap; ordered sectors and the actual finish do.
     const mark=guard.step(s,position,dt,maxSpeed);let completed=0;
     if(mark.crossedForward){if(mark.completed&&timed)completed=now-startTime;startTime=now;timed=true}
     if(!mark.armed)timed=false;valid=mark.armed;
     return {completed,laps:mark.laps,total:mark.total,lapTime:timed?now-startTime:0,valid};
    },
    invalidate(){guard.invalidate();timed=false;valid=false},get laps(){return guard.laps},get sectors(){return guard.sectors},get nextGate(){return guard.nextGate},get invalid(){return !valid}
   };
  },
  // Race distance is independent of record validity: grass does not cancel a lap.
  // Forward gates establish a whole circuit. Reversing over the line consumes
  // the last credit and requires a new full circuit, so line oscillation cannot farm laps.
  raceProgress(N,seg,start,finish=null){let cursor=start,last=null,armed=false,next=1,epoch=0,laps=0;
   const sectors=Math.max(8,Math.min(32,Math.ceil(N*seg/120))),spacing=N/sectors;
   return {step(s,position,dt,maxSpeed=110){
    let d=mod(s,N)-mod(cursor,N);if(d>N/2)d-=N;if(d<-N/2)d+=N;
    const moved=last?Math.hypot(position.x-last.x,position.z-last.z):0;
    // Projection can jump multiple sectors on a continuous grass shortcut.
    // Only actual horizontal movement can invalidate race distance; projected
    // road height is not the car's physical displacement off the road.
    const plausible=Number.isFinite(d)&&Number.isFinite(moved)&&dt>=0&&(!last||moved<=maxSpeed*dt+1.2);
    const side=p=>finish?(p.x-finish.x)*finish.tx+(p.z-finish.z)*finish.tz:0;
    const previousSide=last?side(last):null,currentSide=side(position);
    const before=cursor;cursor+=d;last={...position};let completed=false;
    const nearFinish=mod(cursor,N)<spacing||mod(cursor,N)>N-spacing||mod(before,N)<spacing||mod(before,N)>N-spacing;
    const forward=finish?nearFinish&&previousSide!==null&&previousSide<0&&currentSide>=0:d>0&&Math.floor(before/N)<Math.floor(cursor/N);
    const backward=finish?nearFinish&&previousSide!==null&&previousSide>=0&&currentSide<0:d<0&&Math.floor(before/N)>Math.floor(cursor/N);
    if(!plausible){armed=false;next=1}
    else if(backward){if(laps>0)laps--;armed=false;next=1}
    else{
     if(armed&&d>0){while(next<sectors&&before<epoch+next*spacing&&cursor>=epoch+next*spacing)next++}
     if(forward){if(armed&&next===sectors){laps++;completed=true}armed=true;epoch=Math.round(cursor/N)*N;next=1}
    }
    return {laps,completed,armed,crossedForward:plausible&&forward&&!backward,total:armed?laps*N+mod(cursor,N):Math.min(laps*N-.001,laps*N+mod(cursor,N)-N)};
   },invalidate(){armed=false;next=1},get sectors(){return sectors},get laps(){return laps},get nextGate(){return armed?mod(epoch+next*spacing,N):0}};
  },
  relativeDrivers(player,drivers){const fx=Math.sin(player.h),fz=Math.cos(player.h),targets=[];
   for(const [index,other] of drivers.entries()){
    if(other===player||other.fin||other.ft||!Number.isFinite(other.x)||!Number.isFinite(other.z))continue;
    const dx=other.x-player.x,dz=other.z-player.z,dy=(other.y||0)-(player.y||0),distance=Math.hypot(dx,dy,dz),forward=dx*fx+dz*fz;
    if(distance<.01)continue;
    // Three.js camera looks along +forward: screen-right is (-cos(h), sin(h)).
    const right=dz*fx-dx*fz;
    targets.push({other,index,distance,ahead:forward>=0,angle:Math.atan2(right,forward)});
   }
   return targets.sort((a,b)=>a.distance-b.distance);
  },
  behind(player,drivers){return api.relativeDrivers(player,drivers).find(t=>!t.ahead&&Math.abs((t.other.y||0)-(player.y||0))<=8)||null}
 };
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.KartRace=api;
})(typeof window!=='undefined'?window:globalThis);


;/* race-hud.js */
window.KartRearIndicator={
 create(){
  const e=document.createElement('div');e.id='rearIndicator';e.dataset.noTranslate='';document.body.append(e);
  const rows=new Map();let last=0,wasVisible=false;
  return {update(player,drivers,visible){
   const now=performance.now();if(visible===wasVisible&&visible&&now-last<100)return;last=now;wasVisible=visible;
   const targets=visible?KartRace.relativeDrivers(player,drivers):[],current=new Set(targets.map(t=>t.other));e.hidden=!targets.length;
   for(const [driver,row] of rows)if(!current.has(driver)){row.remove();rows.delete(driver)}
   const words=({de:['Vorn','Hinten','Fahrer'],en:['Ahead','Behind','Driver'],fr:['Devant','Derrière','Pilote']})[document.documentElement.lang]||['Ahead','Behind','Driver'];
   for(const target of targets){
    let row=rows.get(target.other);
    if(!row){row=document.createElement('div');row.className='driver-distance';row.innerHTML='<svg width="25" height="25" viewBox="0 0 40 40" aria-hidden="true"><path d="M20 4 34 31 20 25 6 31Z" fill="currentColor" stroke="#17263b" stroke-width="3" stroke-linejoin="round"/></svg><span></span>';rows.set(target.other,row)}
    const name=target.other.nm||words[2]+' '+(target.index+1),distance=(target.distance<100?target.distance.toFixed(1):Math.round(target.distance))+' m';
    row.dataset.direction=target.ahead?'ahead':'behind';row.querySelector('svg').style.transform='rotate('+target.angle+'rad)';
    row.querySelector('span').textContent=words[target.ahead?0:1]+' '+(target.index+1)+' · '+distance;
    row.setAttribute('aria-label',name+' · '+words[target.ahead?0:1]+' · '+distance);e.append(row);
   }
  },dispose(){rows.clear();e.remove()}};
 }
};

window.KartRaceTelemetry={
 create(config){
  const e=document.createElement('details');e.id='raceTelemetry';e.open=true;e.dataset.noTranslate='';e.innerHTML='<summary></summary><div class="telemetry-values"></div><div class="telemetry-levels"></div>';e.addEventListener('keydown',event=>event.stopPropagation());document.body.append(e);
  const words={de:['Fahrwerte','Aktiv','Serie: Kompetitiv','Serie: Host sperrt Upgrades','Serie: keine Upgrades','Tempo','Max','Limit aktuell','Beschl.','Handling','Lenkreaktion','Stufen aktiv / gekauft'],en:['Race stats','Active','Stock: competitive','Stock: host disabled upgrades','Stock: no upgrades','Speed','Max','Current limit','Accel.','Handling','Steer response','Stages active / owned'],fr:['Valeurs course','Actives','Série : compétition','Série : hôte sans améliorations','Série : aucune amélioration','Vitesse','Max','Limite actuelle','Accél.','Tenue de route','Réactivité','Niveaux actifs / achetés']};
  let last=0;
  return {update(value,visible){
   e.hidden=!visible;if(!visible||performance.now()-last<100)return;last=performance.now();
   const lang=document.documentElement.lang,t=words[lang]||words.en,s=config.stats;
   e.querySelector('summary').textContent=t[0]+' · '+config.id;
   const reason=config.reason==='disabled'?({de:'Upgrades ausgeschaltet',en:'Upgrades switched off',fr:'Améliorations désactivées'}[lang]||'Upgrades switched off'):t[{active:1,host:3,stock:4}[config.reason]];
   e.querySelector('.telemetry-values').textContent=[reason,t[5]+': '+(value.speed*3.6).toFixed(1)+' km/h',t[6]+': '+(s.topSpeed*3.6).toFixed(1)+' km/h',t[7]+': '+(value.maxSpeed*3.6).toFixed(1)+' km/h',t[8]+': '+value.acceleration.toFixed(2)+' m/s²',t[9]+': '+value.handling.toFixed(2)+' m/s²',t[10]+': '+s.steering.toFixed(2)+' /s · '+s.yaw.toFixed(2)+' rad/s'].join('\n');
   e.querySelector('.telemetry-levels').textContent=t[11]+'\n'+Object.keys(KartTuningStats.data.parts).map(part=>(KartTuningStats.data.parts[part].name[lang]||KartTuningStats.data.parts[part].name.en)+': '+(config.upgrades[part]||0)+' / '+(config.stored[part]||0)).join('\n');
  },dispose(){e.remove()}};
 }
};


;/* track-terrain.js */
/* Road-conforming terrain: local segment height, not an average of nearby decks. */
(function(root){'use strict';
 function create(P,T,seg,border,noise=5){const N=P.length,cell=32,buckets=new Map();
  const key=(x,z)=>x+','+z;P.forEach((p,i)=>{const k=key(Math.floor(p.x/cell),Math.floor(p.z/cell));if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(i)});
  function candidates(x,z){const cx=Math.floor(x/cell),cz=Math.floor(z/cell),list=[];for(let a=-2;a<=2;a++)for(let b=-2;b<=2;b++){const q=buckets.get(key(cx+a,cz+b));if(q)list.push(...q)}if(!list.length)for(let i=0;i<N;i+=8)list.push(i);return list}
  function height(x,z){let best=Infinity,y=0,ceiling=Infinity;for(const i of candidates(x,z)){const p=P[i],q=P[(i+1)%N],dx=q.x-p.x,dz=q.z-p.z,u=Math.max(0,Math.min(1,((x-p.x)*dx+(z-p.z)*dz)/(dx*dx+dz*dz||1))),d=Math.hypot(x-p.x-u*dx,z-p.z-u*dz),h=p.y+(q.y-p.y)*u;
    if(d<best){best=d;y=h}if(d<border+20)ceiling=Math.min(ceiling,h-.3+Math.max(0,d-border-4)*.55)}
   const blend=Math.max(0,Math.min(1,(best-border-12)/140)),n=(Math.sin(x*.012)+Math.cos(z*.01)+Math.sin((x+z)*.02))*noise;
   return Math.min(ceiling,(y-1.2)*(1-blend)+n*blend);
  }
  function width(i,side,max){const p=P[i],t=T[i];let result=max;for(const j of candidates(p.x,p.z)){const arc=Math.min(Math.abs(j-i),N-Math.abs(j-i))*seg;if(arc<60)continue;const q=P[j],dx=q.x-p.x,dz=q.z-p.z,along=Math.abs(dx*t.x+dz*t.z),lateral=(dx*t.z-dz*t.x)*side;if(lateral>0&&along<max)result=Math.min(result,Math.max(border+.8,Math.hypot(dx,dz)*.46))}return result}
  return {height,width};
 }
 const api={create};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.KartTerrain=api;
})(typeof window!=='undefined'?window:globalThis);


;/* bot-driving.js */
/* Deterministic racing decisions; no distance-to-player speed bonuses. */
(function(root){'use strict';
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),mod=(v,n)=>(v%n+n)%n;
 const levels={easy:{pace:.8,grip:.62,brake:17,look:9,error:.85,mistake:.009,pass:false,draft:false},normal:{pace:.94,grip:.82,brake:25,look:24,error:.20,mistake:.0015,pass:true,draft:false},hard:{pace:1,grip:.96,brake:34,look:48,error:.06,mistake:0,pass:true,draft:true}};
 function profiles(curvature,seg,gt3,grip){const out={},N=curvature.length;for(const [name,l]of Object.entries(levels)){const v=curvature.map(k=>Math.min((gt3?68:40)*l.pace,Math.sqrt((gt3?40:30)*grip*l.grip/Math.max(.0001,Math.abs(k)))));for(let pass=0;pass<3;pass++)for(let i=N-1;i>=0;i--)v[i]=Math.min(v[i],Math.sqrt(v[(i+1)%N]**2+2*l.brake*seg));out[name]=v}return out}
 function plan(a,env){const {N,seg,width,K,profiles,traffic,time,gt3,bay}=env,l=levels[a.level]||levels.normal,i=mod(Math.floor(a.s),N),far=mod(i+Math.round(l.look/seg),N),near=mod(i+Math.round(8/seg),N),edge=Math.max(.4,width/2-1.45),k=K[i],future=K[far];
  let want=a.level==='hard'?(Math.abs(k)>.006?clamp(k*100,-edge*.7,edge*.7):-clamp(future*90,-edge*.65,edge*.65)):clamp(K[near]*45,-edge*.4,edge*.4);
  want+=Math.sin(time*(a.level==='easy'?.65:.42)+a.phase)*l.error;
  let speed=profiles[a.level][i],front=null,behind=null;
  for(const b of traffic){if(b.source===a||b.finished)continue;const gap=(b.s-a.s)*seg;if(gap>0&&gap<45&&(!front||gap<front.gap))front={...b,gap};if(gap<0&&gap>-14&&(!behind||gap>behind.gap))behind={...b,gap}}
  const safeLane=lane=>traffic.every(b=>b.source===a||b.finished||Math.abs((b.s-a.s)*seg)>Math.max(6,a.v*.32)||Math.abs(lane-b.o)>2.8);
  if(front&&Math.abs(front.o-a.o)<3){
   if(l.draft&&front.gap>13&&front.gap<35&&Math.abs(future)<.012)want=front.o;
   if(front.gap<Math.max(12,a.v*.65)){
    const choices=[front.o-3.15,front.o+3.15].filter(o=>Math.abs(o)<=edge&&safeLane(o));
    if((l.pass||front.v<2)&&choices.length){want=choices.sort((x,y)=>Math.abs(x-a.o)-Math.abs(y-a.o))[0];a.passing=true}
    else{speed=Math.min(speed,Math.max(0,front.v+(front.gap-7)*.65));a.passing=false}
   }
  }else{a.passing=false;if(a.level==='hard'&&behind&&behind.gap<-5&&Math.abs(future)<.009){const lane=clamp(behind.o,-edge*.55,edge*.55);if(safeLane(lane))want=lane}}
  if(a.pit||a.pitExit){const d=bay.distance(i);if(d>=bay.from-35&&d<=bay.to+3){const blend=bay.blend(i);want=-(width/2+3.5)*blend;speed=Math.min(speed,12);if(a.pit){const remaining=bay.centre-d;if(remaining>=-.8&&remaining<55){speed=Math.min(speed,Math.sqrt(2*12*Math.max(0,remaining-.2)));if(remaining<.5)speed=0}}}if(a.pitExit&&d>bay.to+1)a.pitExit=false}
  const max=(gt3?68:40)+(l.draft?a.draft*5:0)+(a.fxT>0&&a.fxK?8:0);
  if(a.fxT>0)speed*=a.fxK?(Math.abs(future)<.012?1.13:1):.75;
  if(l.draft&&Math.abs(future)<.012)speed+=a.draft*5;
  if(a.pit)speed*=.65;
  return {speed:clamp(speed,0,max),offset:clamp(want,a.pit||a.pitExit?-width/2-4:-(width/2-.7),width/2-.7),brake:l.brake,acceleration:(gt3?34:24)*(a.level==='easy'?.78:a.level==='normal'?.92:1),lateral:a.level==='easy'?1.7:a.level==='hard'?3.5:2.8,mistake:l.mistake};
 }
 function useful(a,item,traffic,seg,curvature){if(a.level!=='hard')return true;if(item==='boost')return Math.abs(curvature)<.009&&!a.pit&&!a.pitExit;if(item==='rocket')return traffic.some(b=>b.source!==a&&!b.finished&&(b.s-a.s)*seg>3&&(b.s-a.s)*seg<65&&Math.abs((b.y||0)-(a.y||0))<3);return traffic.some(b=>b.source!==a&&!b.finished&&(b.s-a.s)*seg<0&&(b.s-a.s)*seg>-20&&Math.abs(b.o-a.o)<3)}
 const api={profiles,plan,useful,levels};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.KartDriving=api;
})(typeof window!=='undefined'?window:globalThis);


;/* gt3.js */
/* Hand-authored stylized GT3 meshes. No downloaded third-party vehicle geometry. */
window.KartGT3={
 cars:[['porsche','Porsche 911 GT3 RS'],['amg','Mercedes-AMG GT3'],['ferrari','Ferrari 296 GT3']],prices:{porsche:0,amg:1500,ferrari:2200},valid:id=>['porsche','amg','ferrari'].includes(id)?id:'porsche',
 make(color,wstyle,scene,id){
 id=this.valid(id);const porsche=id==='porsche',amg=id==='amg',g=new THREE.Group(),body=new THREE.Group();g.add(body);
 const low=typeof PREF!=='undefined'&&PREF.quality==='low',segments=low?16:28;
 const paint=new THREE.MeshPhysicalMaterial({color,metalness:.38,roughness:.25,clearcoat:low?0:1,clearcoatRoughness:.18}),carbon=new THREE.MeshStandardMaterial({color:0x141b23,roughness:.62,metalness:.15}),glass=new THREE.MeshPhysicalMaterial({color:0x153449,metalness:.35,roughness:.12,clearcoat:1}),rubber=new THREE.MeshStandardMaterial({color:0x111419,roughness:.96}),rim=new THREE.MeshStandardMaterial({color:0xb7c1cd,metalness:.8,roughness:.24}),rimDark=new THREE.MeshStandardMaterial({color:0x37424e,metalness:.7,roughness:.3}),lights=new THREE.MeshStandardMaterial({color:0xe6f8ff,emissive:0x9cdfff,emissiveIntensity:.7}),tl=new THREE.MeshStandardMaterial({color:0xd52132,emissive:0}),caliper=new THREE.MeshStandardMaterial({color:porsche?0xefe037:0xe83e31,roughness:.4});
 for(const m of [paint,carbon,glass,rubber,rim,rimDark,lights,tl,caliper]){m.color.convertSRGBToLinear();m.userData.authoredScenery=true}paint.userData.baseColor=color;paint.userData.livery='original';
  const parts=[];
 const add=(geo,mat,x=0,y=0,z=0,parent=body)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=false;parent.add(m);if(parent===body)parts.push(m);return m};
 const box=(w,h,d,mat,x,y,z,parent)=>add(new THREE.BoxGeometry(w,h,d),mat,x,y,z,parent);
 const oval=(x,y,z,sx,sy,sz,mat)=>{const m=add(new THREE.SphereGeometry(1,segments,10),mat,x,y,z);m.scale.set(sx,sy,sz);return m};
 const patch=(points,mat,parent=body)=>{const positions=[],indices=[];points.forEach(p=>positions.push(...p));for(let i=1;i<points.length-1;i++)indices.push(0,i,i+1);const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setIndex(indices);geo.computeVertexNormals();const m=add(geo,mat,0,0,0,parent);m.material.side=THREE.DoubleSide;return m};
 const beam=(from,to,r,mat,parent=body)=>{const a=new THREE.Vector3(...from),b=new THREE.Vector3(...to),m=add(new THREE.CylinderGeometry(r,r,a.distanceTo(b),6),mat,...a.clone().add(b).multiplyScalar(.5).toArray(),parent);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.sub(a).normalize());return m};
 function loft(rings,mat){return add(KartVehicleGeometry.loft(THREE,rings),mat)}
 // Sculpted shoulder line, tapered nose and open wheel-arch lower edges.
 const rings=[],cabinZ=amg?-.48:porsche?-.20:.04;
 for(let i=0;i<=64;i++){const z=-2.08+i*4.16/64,ends=Math.pow(Math.abs(z)/2.1,7),arch=Math.min(Math.abs(z-1.25),Math.abs(z+1.27)),fender=Math.exp(-Math.pow(arch/.45,2));const width=(amg?.96:porsche?.965:.98)-ends*.17+fender*.055,top=(porsche?.83:amg?.84:.77)+fender*.12-ends*.14+(z<-.9&&porsche?.05:0),bottom=arch<.46?.37+Math.sqrt(.46*.46-arch*arch):.34;
 const safeTop=Math.max(top,bottom+.06),cockpitFloor=z>cabinZ-.85&&z<cabinZ+.58?.46:safeTop+.035;
 rings.push([[-width,bottom,z],[-width,Math.max(bottom+.025,safeTop-.1),z],[-width*.86,safeTop,z],[-width*.4,cockpitFloor,z],[width*.4,cockpitFloor,z],[width*.86,safeTop,z],[width,Math.max(bottom+.025,safeTop-.1),z],[width,bottom,z]])}loft(rings,paint);
 box(1.52,.12,3.65,carbon,0,.32,0);box(2.04,.055,.36,carbon,0,.29,1.98);box(1.95,.06,.31,carbon,0,.3,-1.98);
 const rz=cabinZ-.60,fz=cabinZ+.35,back=cabinZ-1.05,front=cabinZ+.92,roof=porsche?1.4:amg?1.35:1.29;
 const cabin=loft([[[-.79,.89,back],[-.62,.98,back],[.62,.98,back],[.79,.89,back]],[[-.76,.89,rz],[-.60,roof-.025,rz],[.60,roof-.025,rz],[.76,.89,rz]],[[-.75,.89,fz],[-.60,roof,fz],[.60,roof,fz],[.75,.89,fz]],[[-.78,.87,front],[-.73,.92,front],[.73,.92,front],[.78,.87,front]]],glass);
 const roofMesh=loft([[[-.61,roof-.035,rz-.09],[-.46,roof+.025,rz-.09],[.46,roof+.025,rz-.09],[.61,roof-.035,rz-.09]],[[-.61,roof-.005,fz+.035],[-.46,roof+.05,fz+.035],[.46,roof+.05,fz+.035],[.61,roof-.005,fz+.035]]],paint);
 // Roof pillars, window frames, mirrors and door shut lines.
 for(const side of [-1,1]){beam([side*.78,.9,front],[side*.61,roof,fz],.035,paint);beam([side*.78,.9,back],[side*.61,roof-.025,rz],.045,paint);beam([side*.76,.91,cabinZ-.30],[side*.61,roof,cabinZ-.30],.022,carbon);beam([side*.77,.89,back],[side*.78,.89,front],.02,carbon);
 beam([side*.83,.91,cabinZ+.65],[side*1.06,1.04,cabinZ+.59],.025,carbon);oval(side*1.10,1.045,cabinZ+.58,.13,.065,.19,paint);
 box(.075,.13,1.54,carbon,side*1.005,.34,0);box(.012,.022,.24,rimDark,side*.981,.79,cabinZ-.43);
 beam([side*.985,.41,-.71],[side*.99,.79,-.71],.009,carbon);beam([side*.99,.79,-.71],[side*.99,.79,.65],.009,carbon);
 for(const z of [1.25,-1.27]){const curve=new THREE.CatmullRomCurve3(Array.from({length:19},(_,i)=>{const angle=i*Math.PI/18;return new THREE.Vector3(side*1.022,.38+Math.sin(angle)*.447,z+Math.cos(angle)*.447)}));add(new THREE.TubeGeometry(curve,18,.018,5,false),carbon)}
 // Front lamp housings and distinctive light signatures.
 if(porsche){const housing=oval(side*.70,.878,1.72,.21,.055,.29,carbon);housing.rotation.x=.35;const lamp=oval(side*.70,.903,1.72,.175,.025,.245,glass);lamp.rotation.x=.35;for(const x of [-.065,.065])for(const z of [-.10,.10])oval(side*.70+x,.93,1.72+z,.035,.015,.046,lights);}
 else {const z=1.91,x=side*.69;patch([[x-side*.27,.77,z-.03],[x+side*.24,.82,z-.07],[x+side*.22,.72,z+.035],[x-side*.24,.70,z+.06]],carbon);beam([x-side*.23,.785,z+.01],[x+side*.19,.79,z-.035],.021,lights);if(!amg)beam([x-side*.23,.785,z+.01],[x-side*.23,.735,z+.025],.018,lights)}
 box(.35,.16,.075,carbon,side*.76,.49,2.025);for(let j=0;j<3;j++)box(.30,.013,.025,rimDark,side*.76,.44+j*.045,2.071);
 // Brake lights and side air intakes.
 if(porsche){box(.83,.035,.04,tl,side*.45,.78,-2.065);for(let n=0;n<6;n++)box(.10,.012,.025,carbon,side*(.12+n*.085),.88,-1.65);}else if(amg){const m=box(.55,.055,.045,tl,side*.65,.77,-2.07);m.rotation.z=-side*.12}else{const lamp=box(.31,.065,.045,tl,side*.65,.75,-2.085);box(.21,.026,.05,carbon,side*.65,.75,-2.09)}
 if(!porsche){patch([[side*1.024,.43,-.73],[side*1.04,.78,-.78],[side*1.014,.71,-.18],[side*1.014,.51,-.28]],carbon);beam([side*1.03,.43,-.73],[side*1.015,.71,-.18],.024,paint)}
 // Swan-neck / pedestal rear wing supports and thin endplates.
 if(porsche){beam([side*.65,.83,-1.4],[side*.65,1.49,-1.58],.035,carbon);beam([side*.65,1.49,-1.58],[side*.65,1.49,-1.87],.035,carbon)}else beam([side*.66,.84,-1.50],[side*.66,1.37,-1.78],.04,carbon);
 box(.035,.23,.58,carbon,side*1.095,porsche?1.38:1.28,-1.81);
 }
 const wing=box(2.20,.065,.55,carbon,0,porsche?1.40:1.30,-1.81);wing.rotation.x=-.10;
 box(amg?1.30:.92,amg?.29:.22,.06,carbon,0,.52,2.09);if(amg){for(let x=-.50;x<.51;x+=.10)box(.018,.18,.028,rim,x,.52,2.13)}else for(let x=-.4;x<.41;x+=.10)box(.014,.13,.02,rimDark,x,.50,2.13);
 for(const side of [-1,1])for(let i=0;i<(porsche?4:3);i++){const vent=box(.24,.012,.035,carbon,side*.67,.96,1.30-i*.09);if(!porsche)vent.position.set(side*.30,.87,1.22-i*.09)}
 for(let x=-.7;x<=.7;x+=.23)box(.025,.14,.36,carbon,x,.31,-2.02);
 for(const side of [-1,1]){const pipe=add(new THREE.CylinderGeometry(.07,.07,.16,14),rim,side*(porsche?.20:.60),.42,-2.10);pipe.rotation.x=Math.PI/2;const hole=add(new THREE.CylinderGeometry(.048,.048,.17,12),carbon,side*(porsche?.20:.60),.42,-2.11);hole.rotation.x=Math.PI/2;}
 // Merge static details by material to keep seven-car grids inexpensive.
 const hide=[cabin,roofMesh],batches=new Map();for(const m of parts){if(hide.includes(m))continue;m.updateMatrix();const geo=m.geometry.index?m.geometry.toNonIndexed():m.geometry.clone();geo.applyMatrix4(m.matrix);const list=batches.get(m.material)||[];list.push(geo);batches.set(m.material,list);body.remove(m);m.geometry.dispose()}
 for(const [mat,geos] of batches){const p=[],n=[];for(const geo of geos){p.push(...geo.attributes.position.array);n.push(...geo.attributes.normal.array);geo.dispose()}const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geo.setAttribute('normal',new THREE.Float32BufferAttribute(n,3));const m=new THREE.Mesh(geo,mat);m.castShadow=true;m.receiveShadow=false;body.add(m)}
 const wheels=[],pivots=[];
 for(const [x,z,frontWheel] of [[-1.015,1.25,1],[1.015,1.25,1],[-1.025,-1.27,0],[1.025,-1.27,0]]){const pivot=new THREE.Group();pivot.position.set(x,.38,z);g.add(pivot);const wheel=new THREE.Group();pivot.add(wheel);wheels.push(wheel);if(frontWheel)pivots.push(pivot);const sign=Math.sign(x);
 const tire=add(new THREE.CylinderGeometry(.375,.375,.27,segments),rubber,0,0,0,wheel);tire.rotation.z=Math.PI/2;
 const disc=add(new THREE.CylinderGeometry(.248,.248,.026,segments),rimDark,sign*.145,0,0,wheel);disc.rotation.z=Math.PI/2;
 const lip=add(new THREE.TorusGeometry(.262,.018,6,segments),rim,sign*.161,0,0,wheel);lip.rotation.y=Math.PI/2;
 const spokeGeo=new THREE.BufferGeometry(),positions=[],normals=[];for(let i=0;i<10;i++){const a=i*Math.PI/5,geo=new THREE.BoxGeometry(.027,.026,.23);geo.rotateX(a);geo.translate(sign*.166,-Math.sin(a)*.145,Math.cos(a)*.145);const flat=geo.toNonIndexed();positions.push(...flat.attributes.position.array);normals.push(...flat.attributes.normal.array);geo.dispose();flat.dispose()}spokeGeo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));spokeGeo.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));add(spokeGeo,rim,0,0,0,wheel);
 const cap=add(new THREE.CylinderGeometry(.067,.067,.035,12),carbon,sign*.18,0,0,wheel);cap.rotation.z=Math.PI/2;box(.035,.13,.06,caliper,sign*.135,.06,-.15,pivot);
 }
 const steerG=new THREE.Group();steerG.position.set(-.34,1.0,.25);steerG.add(makeWheel(wstyle));steerG.scale.setScalar(.65);body.add(steerG);const driver=KartModels.driver(color);driver.scale.setScalar(.60);driver.position.set(-.34,.08,-.25);body.add(driver);
 g.rotation.order='YXZ';g.userData={vehicle:'gt3',car:id,body,wheels,pivots,tl,steerG,fpHide:[driver,...hide],modelRevision:3};scene.add(g);return g;
 }
};


;/* gt3-extra.js */
/* Additional hand-authored GT3 meshes. Loads after gt3.js and extends window.KartGT3
   (cars, prices, valid, make) without editing gt3.js. No downloaded geometry, no brand logos;
   the shapes are stylised approximations, not official manufacturer assets. */
(() => {
 'use strict';
 const base = window.KartGT3;
 if (!base || base.extraLoaded) return;

 // Per-car parameters. Wheel positions, body length and driver position match gt3.js so physics,
 // cameras and first-person view behave the same for every GT3.
 const SPECS = {
  bmw: {
   name: 'BMW M4 GT3', price: 1800, caliper: 0x2f7fe8,
   w: .97, flare: .06, top: .81, fh: .14, hood: .05, rear: .02, roof: 1.37, cabinZ: -.20,
   nose: 'kidney', lights: 'split', tail: 'wrap', wing: { type: 'ped', y: 1.36, z: -1.81, chord: .56 },
   side: 'fender', hoodDetail: 'louver'
  },
  aston: {
   name: 'Aston Martin Vantage GT3', price: 2400, caliper: 0xe8c23a,
   w: .98, flare: .06, top: .80, fh: .15, hood: .12, rear: .00, roof: 1.33, cabinZ: -.42,
   nose: 'gape', lights: 'slit', tail: 'bar', wing: { type: 'ped', y: 1.31, z: -1.83, chord: .62 },
   side: 'strake', hoodDetail: 'vent'
  },
  audi: {
   name: 'Audi R8 LMS GT3', price: 2800, caliper: 0xe83e31,
   w: .975, flare: .055, top: .78, fh: .17, hood: .12, rear: .05, roof: 1.30, cabinZ: .02,
   nose: 'frame', lights: 'led', tail: 'bar', wing: { type: 'ped', y: 1.34, z: -1.80, chord: .56 },
   side: 'blade', hoodDetail: 'none'
  },
  lambo: {
   name: 'Lamborghini Hurac\u00e1n GT3 Evo2', price: 3400, caliper: 0xefe037,
   w: 1.0, flare: .06, top: .75, fh: .20, hood: .13, rear: .08, roof: 1.25, cabinZ: .14,
   nose: 'wedge', lights: 'wye', tail: 'hex', wing: { type: 'swan', y: 1.44, z: -1.84, chord: .60 },
   side: 'scoop', hoodDetail: 'vent'
  },
  mclaren: {
   name: 'McLaren 720S GT3', price: 3800, caliper: 0xff7a1a,
   w: .99, flare: .065, top: .76, fh: .19, hood: .15, rear: .07, roof: 1.27, cabinZ: .10,
   nose: 'dihedral', lights: 'eye', tail: 'strip', wing: { type: 'swan', y: 1.46, z: -1.86, chord: .62 },
   side: 'scoop', hoodDetail: 'scoop', roofScoop: true
  }
 };
 const IDS = Object.keys(SPECS);

 const smooth = (x, a, b) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

 function build(color, wstyle, scene, id) {
  const s = SPECS[id], g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const low = typeof PREF !== 'undefined' && PREF.quality === 'low', segments = low ? 16 : 28;
  const paint = new THREE.MeshPhysicalMaterial({ color, metalness: .38, roughness: .25, clearcoat: low ? 0 : 1, clearcoatRoughness: .18 }),
   carbon = new THREE.MeshStandardMaterial({ color: 0x141b23, roughness: .62, metalness: .15 }),
   glass = new THREE.MeshPhysicalMaterial({ color: 0x153449, metalness: .35, roughness: .12, clearcoat: 1 }),
   rubber = new THREE.MeshStandardMaterial({ color: 0x111419, roughness: .96 }),
   rim = new THREE.MeshStandardMaterial({ color: 0xb7c1cd, metalness: .8, roughness: .24 }),
   rimDark = new THREE.MeshStandardMaterial({ color: 0x37424e, metalness: .7, roughness: .3 }),
   lights = new THREE.MeshStandardMaterial({ color: 0xe6f8ff, emissive: 0x9cdfff, emissiveIntensity: .7 }),
   tl = new THREE.MeshStandardMaterial({ color: 0xd52132, emissive: 0 }),
   caliper = new THREE.MeshStandardMaterial({ color: s.caliper, roughness: .4 });
  for(const m of [paint,carbon,glass,rubber,rim,rimDark,lights,tl,caliper]){m.color.convertSRGBToLinear();m.userData.authoredScenery=true}paint.userData.baseColor=color;paint.userData.livery='original';
  const parts = [];
  const add = (geo, mat, x = 0, y = 0, z = 0, parent = body) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = false; parent.add(m); if (parent === body) parts.push(m); return m; };
  const box = (w, h, d, mat, x, y, z, parent) => add(new THREE.BoxGeometry(w, h, d), mat, x, y, z, parent);
  const oval = (x, y, z, sx, sy, sz, mat) => { const m = add(new THREE.SphereGeometry(1, segments, 10), mat, x, y, z); m.scale.set(sx, sy, sz); return m; };
  const patch = (points, mat, parent = body) => { const positions = [], indices = []; points.forEach(p => positions.push(...p)); for (let i = 1; i < points.length - 1; i++) indices.push(0, i, i + 1); const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geo.setIndex(indices); geo.computeVertexNormals(); const m = add(geo, mat, 0, 0, 0, parent); m.material.side = THREE.DoubleSide; return m; };
  const beam = (from, to, r, mat, parent = body) => { const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to), m = add(new THREE.CylinderGeometry(r, r, a.distanceTo(b), 6), mat, ...a.clone().add(b).multiplyScalar(.5).toArray(), parent); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize()); return m; };
  function loft(rings,mat){return add(KartVehicleGeometry.loft(THREE,rings),mat)}

  // Sculpted shoulder line. The wheel arches need body above them, so `top + fh` stays above the arch crown.
  const rings = [];
  for (let i = 0; i <= 64; i++) {
   const z = -2.08 + i * 4.16 / 64, ends = Math.pow(Math.abs(z) / 2.1, 7), arch = Math.min(Math.abs(z - 1.25), Math.abs(z + 1.27)), fender = Math.exp(-Math.pow(arch / .45, 2));
   const bottom = arch < .46 ? .37 + Math.sqrt(.46 * .46 - arch * arch) : .34;
   const width = s.w - ends * .17 + fender * s.flare;
   const top = Math.max(bottom + .06, s.top + fender * s.fh - ends * .14 + s.rear * smooth(-z, 0, 1.3) - s.hood * smooth(z, 1.3, 2.0));
   const cockpitFloor=z>s.cabinZ-.85&&z<s.cabinZ+.58?.46:top+.035;
   rings.push([[-width, bottom, z], [-width, Math.max(bottom + .025, top - .1), z], [-width * .86, top, z], [-width * .4, cockpitFloor, z], [width * .4, cockpitFloor, z], [width * .86, top, z], [width, Math.max(bottom + .025, top - .1), z], [width, bottom, z]]);
  }
  loft(rings, paint);
  box(1.52, .12, 3.65, carbon, 0, .32, 0); box(2.04, .055, .36, carbon, 0, .29, 1.98); box(1.95, .06, .31, carbon, 0, .3, -1.98);

  // Glasshouse and roof.
  const belt = s.top + .08, roof = s.roof, c0 = s.cabinZ;
  const back = c0 - 1.02, rz = c0 - .58, fz = c0 + .34, front = c0 + .90;
  const cabin = loft([
   [[-.79, belt, back], [-.62, belt + .09, back], [.62, belt + .09, back], [.79, belt, back]],
   [[-.76, belt, rz], [-.60, roof - .025, rz], [.60, roof - .025, rz], [.76, belt, rz]],
   [[-.75, belt, fz], [-.60, roof, fz], [.60, roof, fz], [.75, belt, fz]],
   [[-.78, belt - .02, front], [-.73, belt + .03, front], [.73, belt + .03, front], [.78, belt - .02, front]]], glass);
  const roofMesh = loft([
   [[-.61, roof - .035, rz - .09], [-.46, roof + .025, rz - .09], [.46, roof + .025, rz - .09], [.61, roof - .035, rz - .09]],
   [[-.61, roof - .005, fz + .035], [-.46, roof + .05, fz + .035], [.46, roof + .05, fz + .035], [.61, roof - .005, fz + .035]]], paint);
  if (s.roofScoop) { box(.34, .08, .62, carbon, 0, roof + .1, rz - .22); box(.26, .05, .3, rimDark, 0, roof + .145, rz - .08); }

  const mid = s.cabinZ > -.1, wg = s.wing; // cab-forward, mid-engine proportions
  for (const side of [-1, 1]) {
   // Pillars, window frames, mirrors and door shut lines.
   beam([side * .78, belt + .01, front], [side * .61, roof, fz], .035, paint); beam([side * .78, belt + .01, back], [side * .61, roof - .025, rz], .045, paint);
   beam([side * .76, belt + .02, c0 - .30], [side * .61, roof, c0 - .30], .022, carbon); beam([side * .77, belt, back], [side * .78, belt, front], .02, carbon);
   beam([side * .83, belt + .02, c0 + .65], [side * 1.06, belt + .15, c0 + .59], .025, carbon); oval(side * 1.10, belt + .155, c0 + .58, .13, .065, .19, paint);
   box(.075, .13, 1.54, carbon, side * 1.005, .34, 0); box(.012, .022, .24, rimDark, side * .981, s.top, c0 - .43);
   beam([side * .985, .41, c0 - .55], [side * .99, s.top, c0 - .55], .009, carbon); beam([side * .99, s.top, c0 - .55], [side * .99, s.top, c0 + .55], .009, carbon);
   for (const z of [1.25, -1.27]) { const curve = new THREE.CatmullRomCurve3(Array.from({ length: 19 }, (_, i) => { const angle = i * Math.PI / 18; return new THREE.Vector3(side * 1.022, .38 + Math.sin(angle) * .447, z + Math.cos(angle) * .447); })); add(new THREE.TubeGeometry(curve, 18, .018, 5, false), carbon); }

   // Front lamp signature (side-specific).
   const lz = 1.90, lx = side * .63, ly = s.top - Math.pow(lz / 2.1,7)*.14 - s.hood*smooth(lz,1.3,2.0) + .005;
   if (s.lights === 'split') { for (const dx of [.46, .78]) { oval(side * dx, ly + .02, lz + .02, .12, .03, .10, carbon); beam([side * (dx - .09), ly + .03, lz + .075], [side * (dx + .09), ly + .03, lz + .075], .017, lights); } }
   else if (s.lights === 'slit') { patch([[lx - side * .30, ly + .02, lz - .02], [lx + side * .26, ly + .04, lz - .08], [lx + side * .26, ly - .03, lz - .04], [lx - side * .28, ly - .06, lz + .02]], carbon); beam([lx - side * .26, ly, lz + .01], [lx + side * .22, ly + .015, lz - .05], .015, lights); }
   else if (s.lights === 'led') { patch([[lx - side * .26, ly + .02, lz - .03], [lx + side * .26, ly + .05, lz - .09], [lx + side * .22, ly - .05, lz - .02], [lx - side * .24, ly - .06, lz + .04]], carbon); for (let k = 0; k < 4; k++) beam([lx - side * (.22 - k * .12), ly + .02 - k * .003, lz + .02 - k * .02], [lx - side * (.10 - k * .12), ly + .025 - k * .003, lz - .01 - k * .02], .014, lights); }
   else if (s.lights === 'wye') { const y0 = ly + .015; patch([[lx - side * .30, y0 + .03, lz - .06], [lx + side * .30, y0 + .02, lz - .1], [lx + side * .26, y0 - .06, lz - .02], [lx - side * .26, y0 - .07, lz + .04]], carbon); beam([lx - side * .26, y0, lz + .01], [lx, y0 + .01, lz - .03], .02, lights); beam([lx, y0 + .01, lz - .03], [lx + side * .22, y0 + .035, lz - .07], .02, lights); beam([lx, y0 + .01, lz - .03], [lx + side * .1, y0 - .045, lz + .0], .02, lights); }
   else if (s.lights === 'eye') { oval(lx, ly + .01, lz - .02, .24, .045, .13, carbon).rotation.z = -side * .22; beam([lx - side * .2, ly - .02, lz + .06], [lx + side * .2, ly + .045, lz - .02], .02, lights); oval(lx - side * .1, ly - .005, lz + .03, .045, .028, .045, lights); }
   // Front corner intake.
   box(.35, .16, .075, carbon, side * .62, .49, 2.015); for (let j = 0; j < 3; j++) box(.30, .013, .025, rimDark, side * .62, .44 + j * .045, 2.058);

   // Brake lights.
   if (s.tail === 'bar') box(.78, .05, .04, tl, side * .46, s.top + .02, -2.065);
   else if (s.tail === 'wrap') { box(.62, .05, .04, tl, side * .56, s.top + .02, -2.07); box(.04, .06, .22, tl, side * .93, s.top + .02, -1.97); }
   else if (s.tail === 'hex') { for (const x of [.48, .76]) { const m = add(new THREE.CylinderGeometry(.075, .075, .04, 6), tl, side * x, s.top, -2.08); m.rotation.x = Math.PI / 2; } }
   else { box(.62, .028, .04, tl, side * .52, s.top + .03, -2.07); box(.50, .028, .04, tl, side * .56, s.top - .03, -2.07); }

   // Side details and air intakes.
   if (s.side === 'scoop') { patch([[side * 1.024, .43, c0 - .95], [side * 1.05, .78, c0 - 1.0], [side * 1.02, .72, c0 - .35], [side * 1.02, .47, c0 - .45]], carbon); beam([side * 1.03, .43, c0 - .95], [side * 1.02, .72, c0 - .35], .024, paint); }
   else if (s.side === 'blade') { box(.04, .30, .98, carbon, side * 1.045, .58, c0 - .62); box(.03, .05, .98, paint, side * 1.065, .72, c0 - .62); }
   else if (s.side === 'strake') { for (let k = 0; k < 3; k++) box(.03, .012, .30, carbon, side * 1.03, .52 + k * .05, 1.0 - k * .04); }
   else if (s.side === 'fender') { for (let k = 0; k < 4; k++) box(.03, .012, .20, carbon, side * 1.032, .62 + k * .045, 1.50 - k * .05); }

   // Rear wing supports and endplates.
   if (wg.type === 'swan') { beam([side * .65, s.top + .02, wg.z + .36], [side * .65, wg.y + .08, wg.z + .22], .035, carbon); beam([side * .65, wg.y + .08, wg.z + .22], [side * .65, wg.y + .08, wg.z - .06], .035, carbon); }
   else beam([side * .66, s.top + .03, wg.z + .32], [side * .66, wg.y + .07, wg.z - .0], .04, carbon);
   box(.035, .23, wg.chord + .04, carbon, side * 1.095, wg.y - .02, wg.z);
  }
  const wing = box(2.20, .065, wg.chord, carbon, 0, wg.y, wg.z); wing.rotation.x = -.10;

  // Nose, grille and splitter.
  if (s.nose === 'kidney') { for (const side of [-1, 1]) { box(.24, .27, .05, carbon, side * .16, s.top - .22, 2.07); for (let k = 0; k < 4; k++) box(.015, .24, .02, rimDark, side * (.08 + k * .055), s.top - .22, 2.10); } box(.04, .30, .06, carbon, 0, s.top - .22, 2.075); }
  else if (s.nose === 'gape') { box(1.05, .24, .06, carbon, 0, .52, 2.07); for (let x = -.46; x <= .47; x += .08) box(.012, .21, .02, rimDark, x, .52, 2.11); }
  else if (s.nose === 'frame') { patch([[-.34, .66, 2.05], [.34, .66, 2.05], [.27, .38, 2.07], [-.27, .38, 2.07]], carbon); for (let k = 0; k < 4; k++) box(.52 - k * .03, .012, .02, rimDark, 0, .44 + k * .05, 2.10); box(.64, .045, .03, rimDark, 0, .68, 2.08); }
  else if (s.nose === 'wedge') { patch([[-.5, .50, 2.06], [.5, .50, 2.06], [.30, .33, 2.09], [-.30, .33, 2.09]], carbon); for (let k = 0; k < 3; k++) box(.62 - k * .08, .012, .02, rimDark, 0, .39 + k * .045, 2.11); }
  else { box(.84, .20, .06, carbon, 0, .50, 2.075); box(.30, .04, .03, rimDark, -.28, .50, 2.12); box(.30, .04, .03, rimDark, .28, .50, 2.12); box(.04, .20, .03, rimDark, 0, .50, 2.12); }
  for (let x = -.7; x <= .7; x += .23) box(.025, .14, .36, carbon, x, .31, -2.02);

  // Bonnet detail and rear deck louvres.
  if (s.hoodDetail === 'louver') for (let k = 0; k < 4; k++) box(.42, .012, .035, carbon, 0, s.top + .02 - s.hood * smooth(1.3 + k * .15, 1.3, 2.0) + .0, 1.05 + k * .13);
  else if (s.hoodDetail === 'vent') for (const side of [-1, 1]) for (let k = 0; k < 3; k++) box(.20, .012, .03, carbon, side * .38, s.top - .01, 1.15 + k * .1);
  else if (s.hoodDetail === 'scoop') { box(.30, .05, .38, carbon, 0, s.top - .03, 1.15); box(.20, .02, .22, rimDark, 0, s.top - .005, 1.15); }
  if (mid) for (let k = 0; k < 5; k++) box(.78, .012, .04, carbon, 0, s.top + s.rear * smooth(1.2 + k * .11, 0, 1.3) + .045, -1.0 - k * .14);
  for (const side of [-1, 1]) { const x = side * (s.nose === 'kidney' ? .60 : .62); const pipe = add(new THREE.CylinderGeometry(.07, .07, .16, 14), rim, x, .42, -2.10); pipe.rotation.x = Math.PI / 2; const hole = add(new THREE.CylinderGeometry(.048, .048, .17, 12), carbon, x, .42, -2.11); hole.rotation.x = Math.PI / 2; }

  // Merge static details by material to keep seven-car grids inexpensive.
  const hide = [cabin, roofMesh], batches = new Map();
  for (const m of parts) { if (hide.includes(m)) continue; m.updateMatrix(); const geo = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone(); geo.applyMatrix4(m.matrix); const list = batches.get(m.material) || []; list.push(geo); batches.set(m.material, list); body.remove(m); m.geometry.dispose(); }
  for (const [mat, geos] of batches) { const p = [], n = []; for (const geo of geos) { p.push(...geo.attributes.position.array); n.push(...geo.attributes.normal.array); geo.dispose(); } const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3)); const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = false; body.add(m); }

  // Wheels: identical placement and construction to gt3.js.
  const wheels = [], pivots = [];
  for (const [x, z, frontWheel] of [[-1.015, 1.25, 1], [1.015, 1.25, 1], [-1.025, -1.27, 0], [1.025, -1.27, 0]]) {
   const pivot = new THREE.Group(); pivot.position.set(x, .38, z); g.add(pivot); const wheel = new THREE.Group(); pivot.add(wheel); wheels.push(wheel); if (frontWheel) pivots.push(pivot); const sign = Math.sign(x);
   const tire = add(new THREE.CylinderGeometry(.375, .375, .27, segments), rubber, 0, 0, 0, wheel); tire.rotation.z = Math.PI / 2;
   const disc = add(new THREE.CylinderGeometry(.248, .248, .026, segments), rimDark, sign * .145, 0, 0, wheel); disc.rotation.z = Math.PI / 2;
   const lip = add(new THREE.TorusGeometry(.262, .018, 6, segments), rim, sign * .161, 0, 0, wheel); lip.rotation.y = Math.PI / 2;
   const spokeGeo = new THREE.BufferGeometry(), positions = [], normals = [];
   for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5, geo = new THREE.BoxGeometry(.027, .026, .23); geo.rotateX(a); geo.translate(sign * .166, -Math.sin(a) * .145, Math.cos(a) * .145); const flat = geo.toNonIndexed(); positions.push(...flat.attributes.position.array); normals.push(...flat.attributes.normal.array); geo.dispose(); flat.dispose(); }
   spokeGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); spokeGeo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3)); add(spokeGeo, rim, 0, 0, 0, wheel);
   const cap = add(new THREE.CylinderGeometry(.067, .067, .035, 12), carbon, sign * .18, 0, 0, wheel); cap.rotation.z = Math.PI / 2; box(.035, .13, .06, caliper, sign * .135, .06, -.15, pivot);
  }
  const steerG = new THREE.Group(); steerG.position.set(-.34, 1.0, .25); steerG.add(makeWheel(wstyle)); steerG.scale.setScalar(.65); body.add(steerG);
  const driver = KartModels.driver(color); driver.scale.setScalar(.60); driver.position.set(-.34, .08, -.25); body.add(driver);
  g.rotation.order = 'YXZ'; g.userData = { vehicle: 'gt3', car: id, body, wheels, pivots, tl, steerG, fpHide: [driver, ...hide], modelRevision: 3 };
  scene.add(g); return g;
 }

 // Register: names, prices, validation and construction.
 const originalValid = base.valid.bind(base), originalMake = base.make;
 for (const id of IDS) { if (!base.cars.some(c => c[0] === id)) base.cars.push([id, SPECS[id].name]); base.prices[id] = SPECS[id].price; }
 base.extraIds = IDS.slice();
 base.valid = id => IDS.includes(id) ? id : originalValid(id);
 base.make = function (color, wstyle, scene, id) { return IDS.includes(id) ? build(color, wstyle, scene, id) : originalMake.call(this, color, wstyle, scene, id); };
 base.extraLoaded = true;
})();


;/* garage.js */
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


;/* kart-tracks.js */
/* Original compact kart circuits. Coordinates in metres; banking is gameplay authored. */
window.KartTracks={ids:['switchback','hairpin'],install(maps){
 const shared={...maps.circuit,S:1,W:8,bw:2.6,terrain:true,tn:1.5,curveType:'centripetal',karting:true,banking:.24,fogN:100,fogF:650};
 maps.switchback={...shared,ctrl:[[0,-70,0],[35,-70,0],[60,-55,1],[62,-35,2],[45,-22,2],[5,-22,1],[-8,-10,0],[0,4,0],[45,4,1],[60,18,2],[55,35,3],[30,46,4],[-5,44,3],[-25,60,2],[-55,54,1],[-68,30,0],[-52,5,0],[-42,-20,1],[-60,-38,1],[-60,-58,0],[-35,-70,0]],corners:[]};
 maps.hairpin={...shared,banking:.31,ctrl:[[-25,-60,0],[20,-60,0],[50,-45,1],[50,-20,3],[25,-10,4],[-25,-10,5],[-40,5,5],[-30,22,4],[15,22,3],[32,35,2],[18,55,1],[-22,65,0],[-58,55,1],[-75,32,2],[-65,8,3],[-80,-18,2],[-82,-42,0],[-60,-60,0]],corners:[]};
}};


;/* track-physics.js */
/* Collision normal from the actual visible barrier segment, not the centre-line tangent. */
window.KartTrackPhysics={
 segmentHit(cx,cz,r,A,B,inside,out){
  const ex=B.x-A.x,ez=B.z-A.z,len=Math.hypot(ex,ez);if(len<.0001)return 0;
  const raw=((cx-A.x)*ex+(cz-A.z)*ez)/(len*len),u=Math.max(0,Math.min(1,raw)),qx=A.x+ex*u,qz=A.z+ez*u,dx=cx-qx,dz=cz-qz,distance=Math.hypot(dx,dz);
  if(distance>r+3)return 0;
  let nx=-ez/len,nz=ex/len;if((inside.x-qx)*nx+(inside.z-qz)*nz<0){nx=-nx;nz=-nz}
  let signed=dx*nx+dz*nz;
  if(raw<0||raw>1){if(distance>=r)return 0;if(distance>.0001&&signed>=0){nx=dx/distance;nz=dz/distance;signed=distance}}
  const penetration=r-signed;if(penetration<=0)return 0;
  out.nx=nx;out.nz=nz;return penetration;
 }
};


;/* pit-stops.js */
/* Stylised service bays near the real circuits' start/finish pit complexes.
   Positions are gameplay approximations; references: assets/tracks/SOURCES.md. */
window.KartPits=(()=>{
 const layouts={circuit:[-95,-10],snow:[-80,-8],indoor:[-90,-16],spa:[-110,-15],monaco:[-115,-12],monza:[-210,-15],nurburgring:[-155,-12],shanghai:[-200,-15],switchback:[-72,-12],hairpin:[-72,-12]};
 const words={de:{pit:'BOXENSTOPP',damage:'MOTORSCHADEN · BOXENSTOPP',fixed:'REPARIERT',stop:'ANHALTEN'},en:{pit:'PIT STOP',damage:'ENGINE DAMAGE · PIT STOP',fixed:'REPAIRED',stop:'STOP'},fr:{pit:'ARRÊT AUX STANDS',damage:'PANNE MOTEUR · STANDS',fixed:'RÉPARÉ',stop:'ARRÊTE-TOI'}};
 const label=k=>(words[document.documentElement.lang]||words.de)[k];
 function create(id,P,T,seg,W,BW,co){
  const N=P.length,length=N*seg,[from,to]=layouts[id],ramp=Math.min(24,(to-from)*.23),centre=(from+to)/2;
  const distance=k=>{const d=((k*seg%length)+length)%length;return d>length/2?d-length:d};
  const blend=k=>{const d=distance(k),u=Math.max(0,Math.min(1,(d-from)/ramp,(to-d)/ramp));return u*u*(3-2*u)};
  const boundary=(k,o)=>co(k,o+(o<0?-Math.max(0,W/2+9-BW)*blend(k):0));
  const contains=(k,lat,repair=false)=>{const d=distance(k),margin=repair?ramp:0,near=W/2+(repair?1.5:-.6),far=Math.abs(co(k,-W/2-7))-(repair?1.2:0);return d>=from+margin&&d<=to-margin&&-lat>=near&&-lat<=far};
  const bay={from,to,centre,ramp,N,seg,W,BW,distance,blend,boundary,contains,side:-1,indoor:id==='indoor'};
  return bay;
 }
 function step(pl,bay,dt,active){
  if(!pl.pit)return false;
  if(!active||!bay.contains(pl.idx,pl.lat||0,true)||Math.hypot(pl.vx||0,pl.vz||0)>=.6){pl.pitT=0;return false}
  pl.pitT=Math.min(5,(pl.pitT||0)+Math.max(0,dt));
  if(pl.pitT>=5-1e-8){pl.pit=false;pl.pitT=0;return true}return false;
 }
 function build(scene,bay,P,T,co){
  const root=new THREE.Group();root.name='Pit service area';const {N,seg,W,from,to,ramp}=bay;
  const index=d=>(Math.round(d/seg)%N+N)%N;
  function ribbon(start,end,inner,outer,y,mat,name){
   const pos=[],uv=[],ix=[],a=Math.floor(start/seg),b=Math.ceil(end/seg);
   for(let j=a;j<=b;j++){const k=(j%N+N)%N,p=P[k],t=T[k],s=bay.blend(k),u=co(k,inner),v=co(k,typeof outer==='function'?outer(s):outer);pos.push(p.x+t.z*u,p.y+y,p.z-t.x*u,p.x+t.z*v,p.y+y,p.z-t.x*v);uv.push(0,j*seg/8,1,j*seg/8);if(j<b){const q=(j-a)*2;ix.push(q,q+1,q+2,q+1,q+3,q+2)}}
   const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();const m=new THREE.Mesh(g,mat);m.name=name;m.receiveShadow=true;root.add(m);return m;
  }
  const asphalt=pbr(new THREE.MeshStandardMaterial({roughness:.86,side:THREE.DoubleSide}),bay.winter?'WinterRoad':'Asphalt012',[1,1]);
  ribbon(from,to,-W/2+.6,s=>-W/2-7*s,.12,asphalt,'Pit lane');
  const mat=new THREE.MeshBasicMaterial({color:0xffd24a,transparent:true,opacity:.28,side:THREE.DoubleSide,depthWrite:false});
  ribbon(from+ramp,to-ramp,-W/2-1.5,-W/2-5.8,.14,mat,'Repair zone');
  const white=new THREE.MeshBasicMaterial({color:0xffd24a,side:THREE.DoubleSide});
  ribbon(from+ramp,to-ramp,-W/2-1.4,-W/2-1.6,.15,white,'Pit marking');
  ribbon(from+ramp,to-ramp,-W/2-5.7,-W/2-5.9,.15,white,'Pit marking');
  function box(w,h,d,material,x,y,z,parent){const m=new THREE.Mesh(KartModels.rounded(w,h,d,.12),material);m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;parent.add(m);return m}
  const steel=new THREE.MeshStandardMaterial({color:0xe8dfc9,roughness:.85,metalness:0}),cyan=new THREE.MeshStandardMaterial({color:0xf5c944,roughness:.65}),door=new THREE.MeshStandardMaterial({color:0x427f9c,roughness:.65,metalness:.08});
  const k=index(bay.centre),p=P[k],t=T[k],garage=new THREE.Group(),offset=bay.boundary(k,-bay.BW)-3.3;
  garage.position.set(p.x+t.z*offset,p.y,p.z-t.x*offset);garage.rotation.y=Math.atan2(t.x,t.z);
  box(5.4,4.3,18,steel,0,2.15,0,garage);box(6,.25,19,cyan,0,4.4,0,garage);
  for(const z of [-6,0,6]){box(.12,3.2,4.8,door,2.74,1.7,z,garage);for(let h=.5;h<3.1;h+=.5)box(.15,.045,4.6,cyan,2.82,h,z,garage)}
  // A compact sign faces drivers approaching the service lane.
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;const ctx=canvas.getContext('2d');ctx.fillStyle='#17283b';ctx.fillRect(0,0,512,128);ctx.fillStyle='#ffd24a';ctx.font='bold 66px sans-serif';ctx.textAlign='center';ctx.fillText('PIT  5s',256,87);const texture=new THREE.CanvasTexture(canvas);texture.encoding=THREE.sRGBEncoding;
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(5.4,1.35),new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide}));sign.position.set(0,4.1,-9.2);garage.add(sign);
  const entry=index(from+ramp),ep=P[entry],et=T[entry],eo=co(entry,-W/2-3.6),marker=sign.clone();marker.position.set(ep.x+et.z*eo,ep.y+3.4,ep.z-et.x*eo);marker.rotation.y=Math.atan2(et.x,et.z);root.add(marker);
  garage.visible=!bay.indoor;root.add(garage);KartStyle.apply(asphalt,16,[1,1],false);KartStyle.environment(root);scene.add(root);return mat;
 }
 return {create,step,build,label,layouts};
})();


;/* web-rooms.js */
/* The server only exchanges SDP/ICE. Race packets travel through RTCDataChannel. */
window.KartWebPeer=(()=>{'use strict';
const errors={class_kart:'Diese Lobby erlaubt nur Karts.',class_gt3:'Diese Lobby erlaubt nur GT3.',class_mismatch:'Alle Fahrer müssen die Lobby-Klasse erfüllen.',invalid_class:'Ungültige Fahrzeugklasse.',unauthorized:'Bitte melde dich erneut an.',room_missing:'Spiel nicht gefunden. Prüfe den Code und ob der Host noch wartet.',room_full:'Das Spiel ist voll.',race_started:'Das Rennen läuft bereits.',room_limit:'Bitte verlasse zuerst deine andere Web-Lobby.',rate:'Zu viele Anfragen. Bitte versuche es gleich erneut.',network:'Der Webdienst ist nicht erreichbar. Versuche es erneut.',unsupported:'Web-Mehrspieler benötigt einen aktuellen Browser und die Spielwebseite.',connection:'Keine direkte Verbindung möglich. Prüft eure Netzwerke.'};
class Events{constructor(){this.events=new Map()}on(type,fn){if(!this.events.has(type))this.events.set(type,new Set());this.events.get(type).add(fn);return this}off(type,fn){this.events.get(type)?.delete(fn)}emit(type,value){for(const fn of this.events.get(type)||[])fn(value)}}
async function api(action,data,keepalive=false){let response;try{response=await fetch('/api/rooms/'+action,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-Kart-Request':'1'},body:JSON.stringify(data),keepalive,signal:AbortSignal.timeout(10000)})}catch{throw Object.assign(new Error(errors.network),{code:'network'})}const result=await response.json();if(!response.ok)throw Object.assign(new Error(errors[result.error]||errors.network),{code:result.error});return result}
let iceCache=null,iceRequest=null;
async function iceConfiguration(){
 if(iceCache&&iceCache.expires>Date.now()/1000+300)return iceCache;
 if(!iceRequest)iceRequest=fetch('/api/ice',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(10000)}).then(async r=>{if(!r.ok)throw Object.assign(new Error(errors[r.status===401?'unauthorized':'network']),{code:r.status===401?'unauthorized':'network'});const c=await r.json();if(!Array.isArray(c.iceServers))throw new Error(errors.network);iceCache=c;return c}).finally(()=>iceRequest=null);
 return iceRequest;
}
class Link extends Events{
 constructor(owner,id,initiator){super();this.owner=owner;this.peer=id;this.open=false;this.closed=false;this.ice=[];this.pc=new RTCPeerConnection({iceServers:owner.ice.iceServers});this.pc.onicecandidate=e=>{if(e.candidate)owner.signal(id,{type:'ice',candidate:e.candidate.toJSON()})};this.pc.ondatachannel=e=>this.attach(e.channel);this.pc.onconnectionstatechange=()=>{clearTimeout(this.disconnectTimer);if(this.pc.connectionState==='failed')this.fail();else if(this.pc.connectionState==='disconnected')this.disconnectTimer=setTimeout(()=>this.fail(),12000)};this.timeout=setTimeout(()=>{if(!this.open)this.fail()},40000);if(initiator)this.attach(this.pc.createDataChannel('kart-race',{ordered:true}));}
 attach(channel){if(this.channel){channel.close();return}this.channel=channel;channel.onopen=()=>{clearTimeout(this.timeout);this.open=true;this.emit('open')};channel.onmessage=e=>{if(typeof e.data!=='string'||e.data.length>65536)return;try{this.emit('data',JSON.parse(e.data))}catch{}};channel.onclose=()=>this.close();channel.onerror=()=>this.fail();}
 async offer(){try{await this.pc.setLocalDescription(await this.pc.createOffer());this.owner.signal(this.peer,{type:'offer',sdp:this.pc.localDescription.sdp})}catch{this.fail()}}
 async receive(message){if(this.closed)return;try{if(message.type==='ice'){if(this.pc.remoteDescription)await this.pc.addIceCandidate(message.candidate);else this.ice.push(message.candidate);return}if(message.type==='offer'||message.type==='answer'){await this.pc.setRemoteDescription({type:message.type,sdp:message.sdp});for(const ice of this.ice)await this.pc.addIceCandidate(ice);this.ice=[];if(message.type==='offer'){await this.pc.setLocalDescription(await this.pc.createAnswer());this.owner.signal(this.peer,{type:'answer',sdp:this.pc.localDescription.sdp})}}}catch{this.fail()}}
 send(value){if(!this.open||this.channel.bufferedAmount>262144)return;const json=JSON.stringify(value);if(json.length>65536)return;try{this.channel.send(json)}catch{this.fail()}}
 fail(){if(this.closed)return;this.emit('error',new Error(errors.connection));this.close()}
 close(){if(this.closed)return;this.closed=true;this.open=false;clearTimeout(this.timeout);clearTimeout(this.disconnectTimer);this.channel?.close();this.pc.close();this.owner.links.delete(this.peer);this.emit('close')}
}
class Peer extends Events{
 constructor(result,ice){super();this.observers=new Set();this.observer=!!result.observer;this.ice=ice;this.id=result.peer;this.code=result.code;this.hostId=result.host;this.links=new Map();this.early=new Map();this.destroyed=false;this.after=0;this.failures=0;this.sendChain=Promise.resolve();this.unload=()=>this.destroy();addEventListener('pagehide',this.unload);this.timer=setTimeout(()=>this.poll(),0)}
 async setClassPolicy(category,mixedClasses){await api('class-policy',this.payload({category,mixedClasses}))}
 async setVehicleClass(category){await api('vehicle-class',this.payload({category}))}
 async setGuestInvites(allowed){await api('invite-policy',this.payload({allowed}))}
 payload(extra={}){return {code:this.code,peer:this.id,...extra}}
 signal(to,message){this.sendChain=this.sendChain.then(()=>{if(!this.destroyed)return api('signal',this.payload({to,message}))}).catch(error=>{if(!this.destroyed)this.emit('error',error)})}
 connect(){const link=new Link(this,this.hostId,true);this.links.set(this.hostId,link);queueMicrotask(()=>link.offer());return link}
 async poll(){if(this.destroyed)return;try{this.ice=await iceConfiguration();const result=await api('poll',this.payload({after:this.after}));if(this.destroyed)return;this.failures=0;this.observers=new Set(result.observers||[]);for(const event of result.messages){if(event.seq<=this.after)continue;let link=this.links.get(event.from);if(!link&&event.message.type==='offer'&&this.id===this.hostId){link=new Link(this,event.from,false);this.links.set(event.from,link);this.emit('connection',link);for(const ice of this.early.get(event.from)||[])await link.receive(ice);this.early.delete(event.from)}if(link)await link.receive(event.message);else if(event.message.type==='ice'){const pending=this.early.get(event.from)||[];if(pending.length<64)pending.push(event.message);this.early.set(event.from,pending)}this.after=event.seq}for(const [id,link] of this.links)if(!result.peers.includes(id))link.close();}catch(error){if(this.destroyed)return;if(['room_missing','unauthorized','forbidden'].includes(error.code)||++this.failures>=4){this.emit('error',error);this.destroy();return}}if(!this.destroyed)this.timer=setTimeout(()=>this.poll(),1000)}
 setLocked(locked){return api('lock',this.payload({locked}))}
 destroy(){if(this.destroyed)return;this.destroyed=true;clearTimeout(this.timer);removeEventListener('pagehide',this.unload);for(const link of [...this.links.values()])link.close();this.early.clear();api('leave',this.payload(),true).catch(()=>{});this.emit('close')}
}
async function create(action,code,options={}){if(!/^https?:$/.test(location.protocol)||!window.RTCPeerConnection)throw new Error(errors.unsupported);const ice=await iceConfiguration();const result=await api(action,{...options,...code?{code}:{}});return new Peer(result,ice)}
return {host:settings=>create('create',null,settings),join:(code,category)=>create('join',code,{category}),watch:code=>create('watch',code)};
})();


;/* progression.js */
/* Catalog mirrored in assets/progression/catalog.json; validated by server tests. */
window.KartProgression=(()=>{const catalog={"missions":[{"id":"first","stat":"races","goal":1,"reward":50,"icon":"flag","title":["Erstes Rennen","First race","Première course"],"description":["Beende ein Rennen","Finish a race","Termine une course"]},{"id":"podium","stat":"podiums","goal":1,"reward":80,"icon":"trophy","title":["Aufs Treppchen","On the podium","Sur le podium"],"description":["Erreiche ein Podium","Reach the podium","Monte sur le podium"]},{"id":"win","stat":"wins","goal":1,"reward":120,"icon":"crown","title":["Sieger","Winner","Vainqueur"],"description":["Gewinne ein Rennen","Win a race","Gagne une course"]},{"id":"t3","stat":"t3","goal":10,"reward":100,"icon":"bolt","title":["Drift-König","Drift king","Roi du drift"],"description":["Zünde 10 Turbos der Stufe III","Trigger 10 tier III boosts","Déclenche 10 turbos de niveau III"]},{"id":"boxes","stat":"boxes","goal":15,"reward":80,"icon":"gift","title":["Glückspilz","Lucky racer","Pilote chanceux"],"description":["Sammle 15 Lucky Blocks","Collect 15 Lucky Blocks","Collecte 15 Lucky Blocks"]},{"id":"draft","stat":"draftT","goal":60,"reward":60,"icon":"globe","title":["Windschattenjäger","Slipstream hunter","Chasseur d’aspiration"],"description":["Fahre 60 Sekunden im Windschatten","Slipstream for 60 seconds","Roule 60 secondes dans l’aspiration"]},{"id":"f1","stat":"f1","goal":3,"reward":200,"icon":"track","title":["F1-Tour","F1 tour","Tournée F1"],"description":["Beende Spa, Monaco und Monza","Finish Spa, Monaco and Monza","Termine Spa, Monaco et Monza"]},{"id":"races10","stat":"races","goal":10,"reward":150,"icon":"star","title":["Dauerbrenner","Regular racer","Pilote régulier"],"description":["Beende 10 Rennen","Finish 10 races","Termine 10 courses"]},{"id":"races25","stat":"races","goal":25,"reward":200,"icon":"flag","title":["Rennfahrer 1","Racer 1","Pilote 1"],"description":["Beende 25 Rennen","Finish 25 races","Termine 25 courses"]},{"id":"races50","stat":"races","goal":50,"reward":400,"icon":"flag","title":["Rennfahrer 2","Racer 2","Pilote 2"],"description":["Beende 50 Rennen","Finish 50 races","Termine 50 courses"]},{"id":"races100","stat":"races","goal":100,"reward":600,"icon":"flag","title":["Rennfahrer 3","Racer 3","Pilote 3"],"description":["Beende 100 Rennen","Finish 100 races","Termine 100 courses"]},{"id":"races250","stat":"races","goal":250,"reward":800,"icon":"flag","title":["Rennfahrer 4","Racer 4","Pilote 4"],"description":["Beende 250 Rennen","Finish 250 races","Termine 250 courses"]},{"id":"races500","stat":"races","goal":500,"reward":1000,"icon":"flag","title":["Rennfahrer 5","Racer 5","Pilote 5"],"description":["Beende 500 Rennen","Finish 500 races","Termine 500 courses"]},{"id":"races1000","stat":"races","goal":1000,"reward":1200,"icon":"flag","title":["Rennfahrer 6","Racer 6","Pilote 6"],"description":["Beende 1000 Rennen","Finish 1000 races","Termine 1000 courses"]},{"id":"wins10","stat":"wins","goal":10,"reward":200,"icon":"crown","title":["Champion 1","Champion 1","Champion 1"],"description":["Gewinne 10 Rennen","Win 10 races","Gagne 10 courses"]},{"id":"wins25","stat":"wins","goal":25,"reward":400,"icon":"crown","title":["Champion 2","Champion 2","Champion 2"],"description":["Gewinne 25 Rennen","Win 25 races","Gagne 25 courses"]},{"id":"wins50","stat":"wins","goal":50,"reward":600,"icon":"crown","title":["Champion 3","Champion 3","Champion 3"],"description":["Gewinne 50 Rennen","Win 50 races","Gagne 50 courses"]},{"id":"wins100","stat":"wins","goal":100,"reward":800,"icon":"crown","title":["Champion 4","Champion 4","Champion 4"],"description":["Gewinne 100 Rennen","Win 100 races","Gagne 100 courses"]},{"id":"wins250","stat":"wins","goal":250,"reward":1000,"icon":"crown","title":["Champion 5","Champion 5","Champion 5"],"description":["Gewinne 250 Rennen","Win 250 races","Gagne 250 courses"]},{"id":"podiums10","stat":"podiums","goal":10,"reward":200,"icon":"trophy","title":["Podium-Serie 1","Podium series 1","Série de podiums 1"],"description":["Erreiche 10 Podien","Reach 10 podiums","Atteins 10 podiums"]},{"id":"podiums50","stat":"podiums","goal":50,"reward":400,"icon":"trophy","title":["Podium-Serie 2","Podium series 2","Série de podiums 2"],"description":["Erreiche 50 Podien","Reach 50 podiums","Atteins 50 podiums"]},{"id":"podiums100","stat":"podiums","goal":100,"reward":600,"icon":"trophy","title":["Podium-Serie 3","Podium series 3","Série de podiums 3"],"description":["Erreiche 100 Podien","Reach 100 podiums","Atteins 100 podiums"]},{"id":"podiums250","stat":"podiums","goal":250,"reward":800,"icon":"trophy","title":["Podium-Serie 4","Podium series 4","Série de podiums 4"],"description":["Erreiche 250 Podien","Reach 250 podiums","Atteins 250 podiums"]},{"id":"t350","stat":"t3","goal":50,"reward":200,"icon":"bolt","title":["Drift-Meister 1","Drift master 1","Maître du drift 1"],"description":["Zünde 50 Turbos der Stufe III","Trigger 50 tier III boosts","Déclenche 50 turbos de niveau III"]},{"id":"t3100","stat":"t3","goal":100,"reward":400,"icon":"bolt","title":["Drift-Meister 2","Drift master 2","Maître du drift 2"],"description":["Zünde 100 Turbos der Stufe III","Trigger 100 tier III boosts","Déclenche 100 turbos de niveau III"]},{"id":"t3250","stat":"t3","goal":250,"reward":600,"icon":"bolt","title":["Drift-Meister 3","Drift master 3","Maître du drift 3"],"description":["Zünde 250 Turbos der Stufe III","Trigger 250 tier III boosts","Déclenche 250 turbos de niveau III"]},{"id":"t3500","stat":"t3","goal":500,"reward":800,"icon":"bolt","title":["Drift-Meister 4","Drift master 4","Maître du drift 4"],"description":["Zünde 500 Turbos der Stufe III","Trigger 500 tier III boosts","Déclenche 500 turbos de niveau III"]},{"id":"t31000","stat":"t3","goal":1000,"reward":1000,"icon":"bolt","title":["Drift-Meister 5","Drift master 5","Maître du drift 5"],"description":["Zünde 1000 Turbos der Stufe III","Trigger 1000 tier III boosts","Déclenche 1000 turbos de niveau III"]},{"id":"boxes50","stat":"boxes","goal":50,"reward":200,"icon":"gift","title":["Block-Sammler 1","Block collector 1","Collectionneur 1"],"description":["Sammle 50 Lucky Blocks","Collect 50 Lucky Blocks","Collecte 50 Lucky Blocks"]},{"id":"boxes100","stat":"boxes","goal":100,"reward":400,"icon":"gift","title":["Block-Sammler 2","Block collector 2","Collectionneur 2"],"description":["Sammle 100 Lucky Blocks","Collect 100 Lucky Blocks","Collecte 100 Lucky Blocks"]},{"id":"boxes250","stat":"boxes","goal":250,"reward":600,"icon":"gift","title":["Block-Sammler 3","Block collector 3","Collectionneur 3"],"description":["Sammle 250 Lucky Blocks","Collect 250 Lucky Blocks","Collecte 250 Lucky Blocks"]},{"id":"boxes500","stat":"boxes","goal":500,"reward":800,"icon":"gift","title":["Block-Sammler 4","Block collector 4","Collectionneur 4"],"description":["Sammle 500 Lucky Blocks","Collect 500 Lucky Blocks","Collecte 500 Lucky Blocks"]},{"id":"boxes1000","stat":"boxes","goal":1000,"reward":1000,"icon":"gift","title":["Block-Sammler 5","Block collector 5","Collectionneur 5"],"description":["Sammle 1000 Lucky Blocks","Collect 1000 Lucky Blocks","Collecte 1000 Lucky Blocks"]},{"id":"draftT300","stat":"draftT","goal":300,"reward":200,"icon":"globe","title":["Windschatten-Profi 1","Slipstream pro 1","Pro de l’aspiration 1"],"description":["Fahre 300 Sekunden im Windschatten","Slipstream for 300 seconds","Roule 300 secondes dans l’aspiration"]},{"id":"draftT900","stat":"draftT","goal":900,"reward":400,"icon":"globe","title":["Windschatten-Profi 2","Slipstream pro 2","Pro de l’aspiration 2"],"description":["Fahre 900 Sekunden im Windschatten","Slipstream for 900 seconds","Roule 900 secondes dans l’aspiration"]},{"id":"draftT1800","stat":"draftT","goal":1800,"reward":600,"icon":"globe","title":["Windschatten-Profi 3","Slipstream pro 3","Pro de l’aspiration 3"],"description":["Fahre 1800 Sekunden im Windschatten","Slipstream for 1800 seconds","Roule 1800 secondes dans l’aspiration"]},{"id":"draftT3600","stat":"draftT","goal":3600,"reward":800,"icon":"globe","title":["Windschatten-Profi 4","Slipstream pro 4","Pro de l’aspiration 4"],"description":["Fahre 3600 Sekunden im Windschatten","Slipstream for 3600 seconds","Roule 3600 secondes dans l’aspiration"]},{"id":"draftT7200","stat":"draftT","goal":7200,"reward":1000,"icon":"globe","title":["Windschatten-Profi 5","Slipstream pro 5","Pro de l’aspiration 5"],"description":["Fahre 7200 Sekunden im Windschatten","Slipstream for 7200 seconds","Roule 7200 secondes dans l’aspiration"]},{"id":"gpTour","stat":"gpTour","goal":5,"reward":800,"icon":"track","title":["GP-Weltreise","GP world tour","Tour du monde GP"],"description":["Beende alle fünf GP-Strecken","Finish all five GP circuits","Termine les cinq circuits GP"]},{"id":"kartTour","stat":"kartTour","goal":2,"reward":400,"icon":"track","title":["Karting-Tour","Karting tour","Tournée karting"],"description":["Beende beide neuen Kartstrecken","Finish both new kart tracks","Termine les deux nouveaux circuits de kart"]}],"levels":[{"level":2,"reward":70},{"level":3,"reward":85},{"level":4,"reward":100},{"level":5,"reward":115},{"level":6,"reward":130},{"level":7,"reward":145},{"level":8,"reward":160},{"level":9,"reward":175},{"level":10,"reward":190},{"level":11,"reward":205},{"level":12,"reward":220},{"level":13,"reward":235},{"level":14,"reward":250},{"level":15,"reward":265},{"level":16,"reward":265},{"level":17,"reward":265},{"level":18,"reward":265},{"level":19,"reward":265},{"level":20,"reward":800},{"level":21,"reward":300},{"level":22,"reward":300},{"level":23,"reward":300},{"level":24,"reward":300},{"level":25,"reward":335},{"level":26,"reward":335},{"level":27,"reward":335},{"level":28,"reward":335},{"level":29,"reward":335},{"level":30,"reward":870},{"level":31,"reward":370},{"level":32,"reward":370},{"level":33,"reward":370},{"level":34,"reward":370},{"level":35,"reward":405},{"level":36,"reward":405},{"level":37,"reward":405},{"level":38,"reward":405},{"level":39,"reward":405},{"level":40,"reward":940},{"level":41,"reward":440},{"level":42,"reward":440},{"level":43,"reward":440},{"level":44,"reward":440},{"level":45,"reward":475},{"level":46,"reward":475},{"level":47,"reward":475},{"level":48,"reward":475},{"level":49,"reward":475},{"level":50,"reward":1010},{"level":51,"reward":510},{"level":52,"reward":510},{"level":53,"reward":510},{"level":54,"reward":510},{"level":55,"reward":545},{"level":56,"reward":545},{"level":57,"reward":545},{"level":58,"reward":545},{"level":59,"reward":545},{"level":60,"reward":1080},{"level":61,"reward":580},{"level":62,"reward":580},{"level":63,"reward":580},{"level":64,"reward":580},{"level":65,"reward":615},{"level":66,"reward":615},{"level":67,"reward":615},{"level":68,"reward":615},{"level":69,"reward":615},{"level":70,"reward":1150},{"level":71,"reward":650},{"level":72,"reward":650},{"level":73,"reward":650},{"level":74,"reward":650},{"level":75,"reward":685},{"level":76,"reward":685},{"level":77,"reward":685},{"level":78,"reward":685},{"level":79,"reward":685},{"level":80,"reward":1220},{"level":81,"reward":720},{"level":82,"reward":720},{"level":83,"reward":720},{"level":84,"reward":720},{"level":85,"reward":755},{"level":86,"reward":755},{"level":87,"reward":755},{"level":88,"reward":755},{"level":89,"reward":755},{"level":90,"reward":1290},{"level":91,"reward":790},{"level":92,"reward":790},{"level":93,"reward":790},{"level":94,"reward":790},{"level":95,"reward":825},{"level":96,"reward":825},{"level":97,"reward":825},{"level":98,"reward":825},{"level":99,"reward":825},{"level":100,"reward":1360}]},index=()=>({de:0,en:1,fr:2}[document.documentElement.lang]??0);const tours={f1:['spa','monaco','monza'],gpTour:['spa','monaco','monza','nurburgring','shanghai'],kartTour:['switchback','hairpin']};const missions=catalog.missions.map(m=>({id:m.id,g:m.goal,r:m.reward,i:m.icon,get t(){return m.title[index()]},get d(){return m.description[index()]},v:s=>tours[m.stat]?tours[m.stat].filter(k=>s.f1[k]).length:Math.floor(s[m.stat]||0)}));return {missions,pass:catalog.levels.map(l=>({lv:l.level,r:l.reward})),catalog};})();


;/* bots.js */
/* Shared, bounded bot configuration. Multiplayer simulation stays on a client. */
window.KartBots=(()=>{
 const levels=['easy','normal','hard'],cars=KartGT3.cars.map(c=>c[0]);
 function normalize(value={},humans=1){return {count:Math.min(Math.max(0,7-humans),Number.isInteger(value.count)?Math.max(0,Math.min(6,value.count)):0),items:value.items===true,cars:Array.from({length:6},(_,i)=>cars.includes(value.cars?.[i])?value.cars[i]:cars[i%3]),difficulties:Array.from({length:6},(_,i)=>levels.includes(value.difficulties?.[i])?value.difficulties[i]:'normal')}}
 function authority(players,order){const active=players.filter(p=>order.includes(p.peer)&&p.presence.racing!==false);return (active.find(p=>p.presence.host===1)||active.sort((a,b)=>a.peer.localeCompare(b.peer))[0])?.peer}
 const fields=['s','o','v','spin','kick','ov','fxT','fxK','ft','held','itemDelay','pit','pitT','pitExit'];
 function packet(bots){return bots.slice(0,6).map(a=>fields.map(k=>k==='held'?Math.max(0,['','boost','oil','rocket'].indexOf(a.held||'')):['fxK','pit','pitExit'].includes(k)?+!!a[k]:Math.round((Number(a[k])||0)*1000)/1000))}
 function clean(data){return Array.isArray(data)&&data.length<=6&&data.every(row=>Array.isArray(row)&&row.length===fields.length&&row.every(n=>Number.isFinite(n)&&Math.abs(n)<=1e8))?data:null}
 function apply(bots,data){if(!clean(data)||data.length!==bots.length)return;data.forEach((row,i)=>{if(bots[i].ft>0)return;fields.forEach((k,j)=>bots[i][k]=k==='held'?['','boost','oil','rocket'][row[j]]||null:['fxK','pit','pitExit'].includes(k)?!!row[j]:row[j])})}
 return {roomStats:category=>KartTuningStats.roomStats(category),normalize,authority,packet,clean,apply};
})();


;/* race-ready.js */
/* Round-scoped loading/ready barrier shared by local and web rooms. */
(function(root){'use strict';
 function coordinator(now=Date.now){let round=0,startAt=0,members=new Map();
  return {begin(id,ids){round=id;startAt=0;members=new Map(ids.map(p=>[p,{loaded:false,ready:false}]))},cancel(){round=0;startAt=0;members.clear()},mark(id,token,kind){const m=members.get(id);if(!round||token!==round||!m||startAt||!['loaded','ready'].includes(kind))return null;if(kind==='ready'&&!m.loaded)return null;if(m[kind])return null;m[kind]=true;if(members.size&&[...members.values()].every(p=>p.ready))startAt=now()+4000;return {loaded:m.loaded,ready:m.ready,startAt}},get startAt(){return startAt},get round(){return round}};
 }
 const words={de:{title:'Startfreigabe',loaded:'Geladen',loading:'Lädt…',ready:'Bereit',wait:'Warten auf alle Spieler',leave:'Zur Lobby',version:'Bitte alle Spieler die Website neu laden. Die Spielversionen passen nicht zusammen.'},en:{title:'Ready to race',loaded:'Loaded',loading:'Loading…',ready:'Ready',wait:'Waiting for all players',leave:'Back to lobby',version:'All players must reload the website. Game versions do not match.'},fr:{title:'Prêts pour la course',loaded:'Chargé',loading:'Chargement…',ready:'Prêt',wait:'En attente de tous les joueurs',leave:'Retour au salon',version:'Tous les joueurs doivent recharger le site. Les versions du jeu sont différentes.'}};
 const text=()=>words[document.documentElement.lang]||words.de;
 function mount(net,leave){const d=document.createElement('dialog');d.id='raceReady';d.className='kr-dialog';d.dataset.noTranslate='';d.innerHTML='<header><h2></h2></header><div class="kr-body"><ul class="ready-roster"></ul><p role="status"></p><button type="button" class="kr-primary" data-ready disabled></button><button type="button" class="kr-primary" data-leave></button></div>';document.body.append(d);let loaded=false,sent=false,dead=false;
  const button=d.querySelector('[data-ready]');function render(){if(dead)return;const t=text(),players=net.room.peers().filter(p=>net.order.includes(p.peer)),me=players.find(p=>p.isMe);d.querySelector('h2').textContent=t.title;d.querySelector('[role=status]').textContent=t.wait+' · '+players.filter(p=>p.presence.raceReady).length+'/'+net.order.length;button.textContent=sent?t.ready:t.ready;button.disabled=!loaded||sent;button.setAttribute('aria-pressed',String(sent));d.querySelector('[data-leave]').textContent=t.leave;const list=d.querySelector('ul');list.replaceChildren();for(const p of players){const li=document.createElement('li'),name=document.createElement('strong'),status=document.createElement('span');name.textContent=p.presence.nm||'Racer';status.textContent=p.presence.raceReady?t.ready:p.presence.loadReady?t.loaded:t.loading;li.classList.toggle('is-ready',!!p.presence.raceReady);li.append(name,status);list.append(li)}}
  button.onclick=()=>{if(!loaded||sent)return;sent=true;net.room.ready(net.round,'ready');render()};d.querySelector('[data-leave]').onclick=leave;d.addEventListener('cancel',e=>{e.preventDefault();leave()});d.addEventListener('keydown',e=>e.stopPropagation());const un=net.room.onPeers(render);render();d.showModal();return {loaded(){if(dead||loaded)return;loaded=true;net.room.ready(net.round,'loaded');render()},close(){if(dead)return;dead=true;un();d.remove()}};
 }
 const api={coordinator,mount,text,protocol:8};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.KartRaceReady=api;
})(typeof window!=='undefined'?window:globalThis);


;/* lobby-vote.js */
(function(root){'use strict';
 function coordinator(valid,random=()=>Math.random()){let vote=null,serial=0,members=new Set();
  function finish(){if(!vote||vote.done||![...members].every(id=>vote.votes[id]))return;const counts=vote.maps.map(map=>[map,Object.values(vote.votes).filter(v=>v===map).length]),max=Math.max(...counts.map(v=>v[1])),ties=counts.filter(v=>v[1]===max);if(!members.size){vote=null;return}vote.done=true;vote.winner=ties[Math.min(ties.length-1,Math.floor(random()*ties.length))][0]}
  return {begin(maps,ids){if(!Array.isArray(maps)||maps.length<2||maps.length>3||new Set(maps).size!==maps.length||maps.some(m=>!valid(m)))return false;members=new Set(ids);vote={id:++serial,maps:[...maps],votes:{},done:false,winner:null};return true},cast(id,token,map){if(!vote||vote.done||vote.id!==token||!members.has(id)||!vote.maps.includes(map))return false;vote.votes[id]=map;finish();return true},roster(ids){if(!vote||vote.done)return;members=new Set(ids);for(const id of Object.keys(vote.votes))if(!members.has(id))delete vote.votes[id];finish()},cancel(){vote=null},snapshot(){return vote?JSON.parse(JSON.stringify(vote)):null}};
 }
 const api={coordinator};if(typeof module!=='undefined'&&module.exports){module.exports=api;return}root.KartMapVote=api;
 const words={de:{title:'Streckenwahl',map:'Strecke',direct:'Map ändern',vote:'Abstimmung starten',choose:'2–3 Strecken auswählen',cast:'Abstimmen',cancel:'Abstimmung abbrechen',winner:'Gewinner',close:'Schließen'},en:{title:'Track selection',map:'Track',direct:'Change map',vote:'Start vote',choose:'Choose 2–3 tracks',cast:'Vote',cancel:'Cancel vote',winner:'Winner',close:'Close'},fr:{title:'Choix du circuit',map:'Circuit',direct:'Changer le circuit',vote:'Lancer le vote',choose:'Choisir 2–3 circuits',cast:'Voter',cancel:'Annuler le vote',winner:'Gagnant',close:'Fermer'}};
 api.install=()=>{const w=()=>words[document.documentElement.lang]||words.de,button=document.createElement('button');button.id='roomMap';button.className='btn btn-small';button.hidden=true;button.dataset.noTranslate='';document.querySelector('#rhost').after(button);const d=document.createElement('dialog');d.id='mapVoteDialog';d.className='kr-dialog';d.dataset.noTranslate='';d.innerHTML='<header><h2></h2><button type="button">×</button></header><div class="kr-body"></div>';document.body.append(d);let signature='';const body=d.querySelector('.kr-body');
  const mapName=id=>({en:{circuit:'Race circuit',snow:'Snowy Mountains',indoor:'Indoor Kart Track'},fr:{circuit:'Circuit de course',snow:'Montagnes enneigées',indoor:'Karting intérieur'}}[document.documentElement.lang]?.[id]||MAPNAMES[id]);
  const element=(tag,text)=>{const e=document.createElement(tag);if(text)e.textContent=text;return e};const btn=(label,fn)=>{const e=element('button',label);e.type='button';e.className='kr-primary';e.onclick=fn;return e};
  function draw(){const hp=cur&&hostPlayer(cur.room.peers())?.presence,v=hp?.vote,t=w();button.hidden=!cur||(!cur.host&&!v);button.disabled=!!hp?.go;button.textContent=cur?.host?t.title:t.cast;if(!cur||hp?.go){d.close();return}if(!d.open)return;d.querySelector('h2').textContent=t.title;d.querySelector('header button').ariaLabel=t.close;const key=JSON.stringify([cur.host,v,hp.map,cur.room.peers().length,document.documentElement.lang]);if(signature===key)return;signature=key;body.replaceChildren();
   if(v){const status=element('p',v.done?t.winner+': '+mapName(v.winner):Object.keys(v.votes).length+' / '+cur.room.peers().length);status.setAttribute('role','status');body.append(status);for(const map of v.maps){const count=Object.values(v.votes).filter(m=>m===map).length,b=btn(mapName(map)+' · '+count,()=>cur.room.vote(v.id,map));b.dataset.voteMap=map;b.disabled=v.done;b.setAttribute('aria-pressed',String(v.votes[cur.room.peers().find(p=>p.isMe)?.peer]===map));body.append(b)}if(cur.host&&!v.done)body.append(btn(t.cancel,()=>cur.room.chooseMap(hp.map)));if(!v.done)return}
   if(!cur.host)return;const label=element('label',t.map),select=element('select');select.id='hostMapSelect';for(const id of TRACKS){const o=element('option',mapName(id));o.value=id;select.append(o)}select.value=hp.map;label.append(select);body.append(label,btn(t.direct,()=>cur.room.chooseMap(select.value)));const field=element('fieldset'),legend=element('legend',t.choose);field.append(legend);const start=btn(t.vote,()=>cur.room.startVote([...field.querySelectorAll('input:checked')].map(i=>i.value)));start.id='startMapVote';start.disabled=true;for(const id of TRACKS){const row=element('label'),input=element('input');input.type='checkbox';input.value=id;input.onchange=()=>{const n=field.querySelectorAll('input:checked').length;start.disabled=n<2||n>3;field.querySelectorAll('input').forEach(i=>i.disabled=n===3&&!i.checked)};row.append(input,document.createTextNode(mapName(id)));field.append(row)}body.append(field,start);
  }
  button.onclick=()=>{if(button.disabled)return;signature='';d.showModal();draw()};d.querySelector('header button').onclick=()=>d.close();d.addEventListener('keydown',e=>e.stopPropagation());api.refresh=draw;new MutationObserver(()=>{signature='';draw()}).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});draw();
 };
})(typeof window!=='undefined'?window:globalThis);


;/* quick-play.js */
window.KartQuick=(()=>{
 const tracks=['circuit','snow','indoor','spa','monaco','monza','nurburgring','shanghai','switchback','hairpin'],cars=KartGT3.cars.map(c=>c[0]),levels=['easy','normal','hard'];
 const keys=['track','laps','comp','upgradesEnabled','category','botCount','botDifficulty','botItems','botCars','botDifficulties'];
 function normalize(input={}){input=input||{};return {track:tracks.includes(input.track)?input.track:'circuit',laps:[1,3,5].includes(input.laps)?input.laps:3,comp:!!input.comp,upgradesEnabled:input.upgradesEnabled!==false,category:input.category==='gt3'?'gt3':'kart',botCount:Number.isInteger(input.botCount)&&input.botCount>=0&&input.botCount<=6?input.botCount:3,botDifficulty:levels.includes(input.botDifficulty)?input.botDifficulty:'normal',botItems:!!input.botItems,botCars:Array.from({length:6},(_,i)=>cars.includes(input.botCars?.[i])?input.botCars[i]:cars[i%3]),botDifficulties:Array.from({length:6},(_,i)=>levels.includes(input.botDifficulties?.[i])?input.botDifficulties[i]:levels.includes(input.botDifficulty)?input.botDifficulty:'normal'),useDaily:!!input.useDaily}}
 function random(seed){return()=>{seed=(seed+0x6D2B79F5)|0;let t=Math.imul(seed^seed>>>15,1|seed);t^=t+Math.imul(t^t>>>7,61|t);return((t^t>>>14)>>>0)/4294967296}}
 function chosen(period,salt){const cycle=Math.floor(period/tracks.length),r=random(cycle^salt),bag=[...tracks];for(let i=bag.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[bag[i],bag[j]]=[bag[j],bag[i]]}return bag[((period%tracks.length)+tracks.length)%tracks.length]}
 const day=now=>Math.floor(now/864e5),daily=(now=Date.now())=>chosen(day(now),0x27ad39);
 function week(now=Date.now()){const n=Math.floor((now-4*864e5)/6048e5),r=random(n^0x6f2a54),pick=a=>a[Math.floor(r()*a.length)],difficulty=pick(levels),settings=normalize({track:chosen(n,0x43a79),laps:pick([1,3,5]),comp:r()>.5,category:pick(['kart','gt3']),botCount:1+Math.floor(r()*6),botDifficulty:difficulty,botItems:r()>.5,botCars:Array.from({length:6},()=>pick(cars)),botDifficulties:Array.from({length:6},()=>pick(levels))});return {track:settings.track,settings,left:4*864e5+(n+1)*6048e5-now}}
 const settings=s=>{const q=normalize(s);if(q.useDaily)q.track=daily();return q};
 return {normalize,keys,daily,week,settings};
})();
