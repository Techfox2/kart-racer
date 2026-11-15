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
