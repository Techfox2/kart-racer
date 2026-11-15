// Menu layout checks on phone viewports: no sideways overflow, primary actions reachable and
// big enough, tall sheets scrollable by a real touch gesture. Desktop must be unaffected.
//   node mobile/tests/menus.cjs [surface-prefix,...]        exit code = number of failures
//   KM_PROBE=1 prints every measurement instead of only failures; KM_NOCSS=1 blanks mobile-menus.css to show the stock layout's failures.
const lib=require('./lib.cjs'),{SURFACES,reset,wait}=require('./menus-surfaces.cjs');
const VIEWPORTS={'390x844':{width:390,height:844},'360x640':{width:360,height:640},'844x390':{width:844,height:390},'667x375':{width:667,height:375}};
const only=process.argv[2]?process.argv[2].split(','):null;
const MIN=40;

// Runs inside the page. Measures one surface.
function measure({root,actions,hscroll=[],controls,MIN}){
 document.querySelectorAll('[data-kmt]').forEach(e=>delete e.dataset.kmt);   // handles from earlier surfaces
 const vw=document.documentElement.clientWidth,vh=innerHeight,out={vw,vh,problems:[]};
 const rootEl=document.querySelector(root);
 if(!rootEl||!rootEl.checkVisibility())return{...out,missing:true};
 const vis=e=>e.checkVisibility({checkVisibilityCSS:true})&&e.getBoundingClientRect().width>0;
 const R=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,r:r.right,b:r.bottom}};
 const rr=R(rootEl);out.root={x:Math.round(rr.x),y:Math.round(rr.y),w:Math.round(rr.w),h:Math.round(rr.h)};
 out.docOverflow=document.documentElement.scrollWidth-vw;
 // surface must sit inside the viewport
 if(rr.x<-1||rr.r>vw+1||rr.y<-1||rr.b>vh+1)out.problems.push('surface outside viewport '+JSON.stringify(out.root));
 // scrollers inside the surface
 const all=[rootEl,...rootEl.querySelectorAll('*')].filter(vis);
 const scrollers=all.filter(e=>{const o=getComputedStyle(e);return/(auto|scroll)/.test(o.overflowY)&&e.scrollHeight>e.clientHeight+2});
 out.scrollers=scrollers.map(e=>({sel:e.id?'#'+e.id:e.className.toString().split(' ')[0]||e.tagName,sh:e.scrollHeight,ch:e.clientHeight,ta:getComputedStyle(e).touchAction,ob:getComputedStyle(e).overscrollBehaviorY,rect:R(e)}));
 // sideways overflow: inside the surface nothing may stick out of its scroller or the viewport
 const hs=[...new Set([...hscroll.flatMap(s=>[...document.querySelectorAll(s)]),...rootEl.querySelectorAll('.seg')])];
 for(const e of all){
  if(hs.some(h=>h.contains(e)))continue;
  const r=R(e);if(r.w===0)continue;
  const o=getComputedStyle(e);if(o.position==='fixed'&&e!==rootEl)continue;
  let clipped=false;for(let a=e.parentElement;a&&a!==document.body;a=a.parentElement){const ao=getComputedStyle(a);if(ao.overflowX!=='visible'){const ar=R(a);if(r.x<ar.x-1||r.r>ar.r+1){clipped=true;break}}}
  if(clipped)continue;
  if(r.x<-1||r.r>vw+1){out.problems.push('outside viewport x: '+(e.id?'#'+e.id:e.tagName+'.'+e.className)+' '+Math.round(r.x)+'..'+Math.round(r.r));break}
 }
 for(const e of [rootEl,...scrollers]){if(hs.includes(e))continue;if(e.scrollWidth>e.clientWidth+1&&getComputedStyle(e).overflowX!=='visible'&&!/hidden/.test(getComputedStyle(e).overflowX))out.problems.push('sideways overflow in '+(e.id||e.className)+' '+e.scrollWidth+'>'+e.clientWidth)}
 // tab labels spilling out of their pill (wrapped "1-20", "Meine Zeiten", clipped "LUCKYBLO")
 out.spill=[...rootEl.querySelectorAll('.seg button')].filter(vis).filter(b=>b.scrollHeight>b.clientHeight+2||b.scrollWidth>b.clientWidth+2).map(b=>(b.id?'#'+b.id:b.className.toString().split(' ')[0])+'['+b.textContent.trim().slice(0,16)+'] '+b.scrollWidth+'x'+b.scrollHeight+' in '+b.clientWidth+'x'+b.clientHeight);
 // form controls that must stay wide enough to read their value ("3 Runden", "Luckyblock")
 out.narrow=controls?[...document.querySelectorAll(controls)].filter(vis).map(e=>({id:e.id,w:Math.round(e.getBoundingClientRect().width)})).filter(x=>x.w<130):[];
 // horizontal scrollers (tab strips): must be able to scroll sideways with touch
 out.hscrollers=hs.filter(vis).map((e,i)=>(e.dataset.kmt=i,{sel:'[data-kmt="'+i+'"]',sw:e.scrollWidth,cw:e.clientWidth,ta:getComputedStyle(e).touchAction}));
 // actions: fully inside viewport after scrolling into view, not covered, >=MIN in the smaller dimension
 out.buttons=[];
 for(const sel of actions)for(const b of document.querySelectorAll(sel)){
  if(!vis(b))continue;
  const probe=()=>{const r=R(b),cx=r.x+r.w/2,cy=r.y+r.h/2,hit=document.elementFromPoint(Math.min(vw-1,Math.max(0,cx)),Math.min(vh-1,Math.max(0,cy)));
   const inside=r.x>=-1&&r.r<=vw+1&&r.y>=-1&&r.b<=vh+1;
   return{r,inside,covered:!(hit&&(b===hit||b.contains(hit))),by:hit?(hit.id?'#'+hit.id:hit.tagName+'.'+String(hit.className).split(' ')[0]):'none'}};
  // reachable = some scroll position shows it fully and uncovered (centre of the view, or the very end)
  b.scrollIntoView({block:'center',inline:'nearest'});let pr=probe();
  if(!pr.inside||pr.covered){b.scrollIntoView({block:'end',inline:'nearest'});const p2=probe();if(p2.inside&&!p2.covered)pr=p2;
   else{const sc=[...document.querySelectorAll('*')].find(e=>e.contains(b)&&e.scrollHeight>e.clientHeight+2&&/(auto|scroll)/.test(getComputedStyle(e).overflowY));if(sc){sc.scrollTop=sc.scrollHeight;const p3=probe();if(p3.inside&&!p3.covered)pr=p3}}}
  const {r,inside,covered,by}=pr;
  out.buttons.push({sel:b.id?'#'+b.id:sel+(b.textContent.trim().slice(0,14)?'['+b.textContent.trim().slice(0,14)+']':''),w:Math.round(r.w),h:Math.round(r.h),inside,covered,by,sizeOk:Math.min(r.w,r.h)>=MIN-.5});
 }
 return out;
}
const scrollables=(page,sel)=>page.evaluate(s=>{const e=document.querySelector(s);return e?{top:e.scrollTop,left:e.scrollLeft}:null},sel);

// Real touch drag (touchStart, a run of touchMoves, touchEnd) through CDP; the finger moves against the scroll direction.
async function touchScroll(page,cdp,rect,dx,dy,keepNews){
 if(!keepNews)await page.evaluate(()=>{const u=document.querySelector('#updatesDialog[open] header button');if(u)u.click()});   // the automatic "What's new" popup would swallow the gesture
 const x0=Math.round(rect.x+rect.w/2+(dx<0?rect.w*.25:-rect.w*.25)*(dx?1:0)),y0=Math.round(rect.y+rect.h/2+(dy<0?rect.h*.25:-rect.h*.25)*(dy?1:0)),n=15;
 const send=(type,pts)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:pts});
 await send('touchStart',[{x:x0,y:y0}]);
 for(let i=1;i<=n;i++){await send('touchMove',[{x:Math.round(x0+dx*i/n),y:Math.round(y0+dy*i/n)}]);await page.waitForTimeout(30)}
 await send('touchEnd',[]);await page.waitForTimeout(1200);
}

async function run(){
 const t=lib.reporter('menus'),probe=!!process.env.KM_PROBE;
 const env=await lib.environment();
 const skipped=[];
 try{
  for(const [vn,vp] of Object.entries(VIEWPORTS)){
   console.log('== '+vn);
   const {page,context,errors}=await lib.open(env,{viewport:vp});page.setDefaultTimeout(15000);
   const cdp=await context.newCDPSession(page);
   t.ok(await page.evaluate(()=>KartMobile.active&&document.documentElement.classList.contains('km-on')),vn+' mobile layer active');
   await page.waitForFunction(()=>document.querySelector('style[data-km*="mobile-menus"]')?.textContent.length>100,null,{timeout:20000}).catch(()=>{});
   if(process.env.KM_NOCSS)await page.evaluate(()=>{document.querySelector('style[data-km*="mobile-menus"]').textContent=''});   // baseline: stock game layout
   for(const s of SURFACES){
    if(only&&!only.some(o=>s.name.startsWith(o)))continue;
    const tag=vn+' '+s.name;
    try{
     await reset(page);await s.open(page);
     await page.waitForFunction(r=>{const e=document.querySelector(r);return e&&e.checkVisibility()&&!e.getAnimations({subtree:true}).some(a=>a.effect.getComputedTiming().iterations!==Infinity&&a.playState==='running')},s.root,{timeout:6000}).catch(()=>{});
    }catch(e){if(s.optional){skipped.push(tag+' (could not open: '+e.message.split('\n')[0]+')');continue}t.ok(false,tag+' opens',e.message.split('\n')[0]);continue}
    if(s.name!=='updates')await page.evaluate(()=>{const u=document.querySelector('#updatesDialog[open] header button');if(u)u.click()});   // auto "What's new" popup
    const m=await page.evaluate(measure,{root:s.root,actions:s.actions,hscroll:s.hscroll||[],controls:s.controls,MIN});
    if(m.missing){if(s.optional){skipped.push(tag+' (not shown)');continue}t.ok(false,tag+' is shown');continue}
    if(probe)console.log(JSON.stringify(m));
    t.ok(m.docOverflow<=0,tag+' no horizontal page overflow',m.docOverflow+'px');
    t.ok(m.spill.length===0,tag+' tab labels fit',m.spill.slice(0,4).join('; '));
    t.ok(m.narrow.length===0,tag+' form controls wide enough',JSON.stringify(m.narrow));
    t.ok(m.problems.length===0,tag+' layout inside viewport',m.problems.join('; '));
    for(const b of m.buttons){
     t.ok(b.inside&&!b.covered,tag+' '+b.sel+' reachable',`inside=${b.inside} covered=${b.covered} by ${b.by}`);
     t.ok(b.sizeOk,tag+' '+b.sel+' >= '+MIN+'px',b.w+'x'+b.h);
    }
    // a sheet's scrolling body must keep a usable share of a short screen
    if(!/^lobby$|^room-paddock$/.test(s.name)){const big=m.scrollers.filter(x=>/sheetBody|sheet-body|resBody|kr-body|tw-panel|tw-layout/.test(x.sel)).sort((a,b)=>b.sh-a.sh)[0];
     if(big)t.ok(big.ch>=Math.min(200,m.vh*.5),tag+' scrolling body is usable',big.sel+' visible height '+Math.round(big.ch)+'px of '+m.vh)}
    // tall content must scroll with a finger: scroll container needs a pan-y capable touch-action
    for(const sc of m.scrollers.filter(x=>x.rect.h>60&&x.sh-x.ch>=40)){
     const sel=sc.sel.startsWith('#')?sc.sel:null;
     if(!sel&&!sc.sel)continue;
     const handle=await page.evaluateHandle(({s,root})=>{const r=document.querySelector(root);const c=[r,...r.querySelectorAll('*')].find(e=>(e.id?'#'+e.id:e.className.toString().split(' ')[0]||e.tagName)===s&&e.scrollHeight>e.clientHeight+2&&e.checkVisibility());return c},{s:sc.sel,root:s.root});
     const el=handle.asElement();if(!el)continue;
     await el.evaluate(e=>{e.scrollTop=0});
     await touchScroll(page,cdp,sc.rect,0,-Math.min(sc.rect.h*.4,sc.sh-sc.ch),s.name==='updates');
     const moved=await el.evaluate(e=>e.scrollTop);
     const fing=moved>5?'':await page.evaluate(({x,y})=>{const e=document.elementFromPoint(x,y);return e?(e.id||e.tagName+'.'+e.className):'none'},{x:Math.round(sc.rect.x+sc.rect.w/2),y:Math.round(sc.rect.y+sc.rect.h*.75)});
     t.ok(moved>5,tag+' '+sc.sel+' scrolls by touch',`scrollTop after swipe ${moved}, touch-action ${sc.ta}, rect ${JSON.stringify(sc.rect)}, scrollable ${sc.sh-sc.ch}px, element at finger ${fing}`);
    }
    for(const h of m.hscrollers.filter(x=>x.sw>x.cw+20)){
     const rect=await page.evaluate(sel=>{const e=document.querySelector(sel);e.scrollIntoView({block:'center',behavior:'instant'});const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height}},h.sel);
     await page.evaluate(sel=>{document.querySelector(sel).scrollLeft=0},h.sel);await wait(page,300);
     await touchScroll(page,cdp,rect,-Math.min(rect.w*.4,h.sw-h.cw),0);const hit=await page.evaluate(({x,y})=>{const e=document.elementFromPoint(x,y);return e?(e.id||e.tagName+'.'+e.className):'none'},{x:Math.round(rect.x+rect.w*.75),y:Math.round(rect.y+rect.h/2)});
     const left=(await scrollables(page,h.sel)).left;
     t.ok(left>5,tag+' '+h.sel+' scrolls sideways by touch',`scrollLeft ${left}, touch-action ${h.ta}, rect ${JSON.stringify(rect)}, element at finger ${hit}`);
    }
   }
   t.ok(errors.length===0,vn+' no page errors',errors.join(' | '));
   await context.close();
  }
  // Desktop: the mobile layer must stay out, and its rules must not change what desktop renders.
  console.log('== desktop 1280x720');
  const d=await lib.open(env,{viewport:{width:1280,height:720},touch:false});
  const dp=d.page;
  t.ok(await dp.evaluate(()=>KartMobile.active===false&&!document.documentElement.classList.contains('km-on')),'desktop: KartMobile.active is false');
  await dp.waitForFunction(()=>document.querySelector('style[data-km*="mobile-menus"]')?.textContent.length>100,null,{timeout:20000}).catch(()=>{});
  const snap=()=>dp.evaluate(()=>{
   const S=[['#menu','gridTemplateRows'],['#menu','paddingBottom'],['.lb-nav','position'],['.sheet','maxHeight'],['.sheet-head','paddingTop'],['.sheet-foot','paddingBottom'],['#panel .sheet','maxHeight'],['.sheet-body','touchAction'],['.lb-actions','display']];
   return S.map(([s,p])=>s+' '+p+'='+getComputedStyle(document.querySelector(s))[p]);
  });
  await dp.evaluate(()=>document.getElementById('customBtn').click());await dp.waitForTimeout(800);
  const loaded=await dp.evaluate(()=>document.querySelector('style[data-km*="mobile-menus"]')?.textContent.length||0);
  t.ok(loaded>100,'desktop: mobile-menus.css loaded ('+loaded+' chars) so the comparison is meaningful');
  const withCss=await snap();
  await dp.evaluate(()=>{const s=document.querySelector('style[data-km*="mobile-menus"]');s.dataset.saved=s.textContent;s.textContent=''});
  const withoutCss=await snap();
  t.ok(JSON.stringify(withCss)===JSON.stringify(withoutCss),'desktop: computed styles identical with and without mobile-menus.css',withCss.filter((x,i)=>x!==withoutCss[i]).join(' | '));
  // sanity: the same rules do apply once the layer is forced on (proves the check above can fail)
  await dp.evaluate(()=>{const s=document.querySelector('style[data-km*="mobile-menus"]');s.textContent=s.dataset.saved;document.documentElement.classList.add('km-on')});
  await dp.setViewportSize({width:667,height:375});await dp.waitForTimeout(300);
  const forced=await snap();
  t.ok(JSON.stringify(forced)!==JSON.stringify(withCss),'desktop: rules take effect when km-on is forced (check is not vacuous)');
  t.ok(d.errors.length===0,'desktop: no page errors',d.errors.join(' | '));
  await d.context.close();
 }finally{await env.close()}
 if(skipped.length)console.log('skipped:\n  '+skipped.join('\n  '));
 return t.done();
}
run().then(n=>process.exit(Math.min(n,255)),e=>{console.error(e);process.exit(99)});
