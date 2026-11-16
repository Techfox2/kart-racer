// Mobile performance layer (assets/mobile/mobile-perf.js) checks against the isolated sandbox.
//   node mobile/tests/perf.cjs                       all parts
//   KM_PARTS=grid,crash,desktop node mobile/tests/perf.cjs
//   KM_TRACKS=circuit:kart,monaco:gt3                subset of the grid comparison tracks
//   KM_SHOTS=/some/dir                               save off/balanced/performance screenshots there
// Exit code = number of failed checks. Software GL is slow (about one frame per second at dpr 3),
// so every comparison happens on a paused race (the game keeps rendering while paused, but nothing
// moves), which also makes "same camera, same moment" comparisons exact.
const fs=require('fs'),path=require('path');
const {environment,open,reporter}=require('./lib.cjs');
const report=reporter('perf');
const PHONE={width:844,height:390},DPR=3;
const BUDGET={quality:1.6e6,balanced:1.1e6,performance:.75e6};
const parts=(process.env.KM_PARTS||'grid,crash,desktop').split(',');
const tracks=(process.env.KM_TRACKS||'circuit:kart,nurburgring:gt3,monaco:gt3,snow:kart').split(',').map(s=>s.split(':'));
const ACCEPT=new Set(['circuit','nurburgring','monaco']); // PLAN-PERF acceptance tracks
const shots=process.env.KM_SHOTS||'';
const consoleIssues=[];

// Outermost qualityRender wrapper: when window.__kmCap is set, counts one real race frame with
// renderer.info.autoReset off (shadow + main pass together), plus scene object counts.
function installCapture(){
 const inner=window.qualityRender;
 window.qualityRender=function(r,scene){
  const cap=window.__kmCap&&scene===window.kartRaceScene;
  if(cap){r.info.autoReset=false;r.info.reset()}
  try{return inner.apply(this,arguments)}
  finally{if(cap){let objects=0;scene.traverse(()=>objects++);const gl=r.getContext();
   window.__kmCapResult={calls:r.info.render.calls,triangles:r.info.render.triangles,programs:r.info.programs.length,buffer:[r.domElement.width,r.domElement.height],
    pixelRatio:r.getPixelRatio(),objects,children:scene.children.length,antialias:gl.getContextAttributes().antialias,warmups:window.KartMobile?.perf?.stats().warmups??0};
   r.info.autoReset=true;window.__kmCap=0}}
 };
}
async function capture(page){
 await page.evaluate(()=>{window.__kmCapResult=null;window.__kmCap=1});
 await page.waitForFunction(()=>window.__kmCapResult,null,{timeout:180000,polling:200});
 return page.evaluate(()=>window.__kmCapResult);
}
// Captures twice and keeps the second, so a warm-up or re-application frame is never counted.
async function settle(page){await capture(page);return capture(page)}
async function phone(env,{perf='balanced',hook=false}={}){
 const o=await open(env,{viewport:PHONE,deviceScaleFactor:DPR,query:'?mobile=1',setup:async(page)=>{
  page.on('console',m=>{if(m.type()==='warning'||m.type()==='error')consoleIssues.push(m.type()+': '+m.text().slice(0,200))});
  await page.addInitScript(p=>{try{localStorage.setItem('kart-mobile',JSON.stringify({perf:p}))}catch{}},perf);
  if(hook){
   // Exposes the game's barrier internals to the crash check (test-only, like controls.cjs).
   await page.route('**/assets/bundles/game.js*',async route=>{const response=await route.fetch();
    const body=(await response.text()).replace('function update(dt){','function update(dt){window.__drive?.({pl,keys,state,flying});');
    await route.fulfill({response,body})});
  }
 }});
 await o.page.evaluate(installCapture);
 await o.page.evaluate(()=>{if(window.KartMobile?.perf)KartMobile.perf.adaptive=false});
 return o;
}
async function launch(page,{track,category,bots=6,comp=true}){
 await page.evaluate(o=>{document.querySelectorAll('dialog[open]').forEach(d=>d.close());launch(o.track,{...SAVE,laps:3,category:o.category,botCount:o.bots,comp:o.comp})},{track,category,bots,comp});
 await page.waitForFunction(t=>window.kartActiveTrack===t&&window.KartRaceDebug?.current&&!document.getElementById('raceLoading'),track,{timeout:180000,polling:200});
}
async function pause(page){
 await page.evaluate(()=>document.getElementById('gear').click());
 await page.waitForFunction(()=>document.getElementById('panel')?.classList.contains('on'),null,{timeout:60000});
 await page.addStyleTag({content:'#panel,#kmControls,#touch,#rearIndicator{visibility:hidden!important}'});
}
async function setTier(page,tier){await page.evaluate(t=>KartMobile.set('perf',t),tier);return settle(page)}
async function shot(page,name){if(!shots)return;fs.mkdirSync(shots,{recursive:true});await page.screenshot({path:path.join(shots,name+'.png'),timeout:180000})}
const fmt=c=>`${c.calls} calls, ${Math.round(c.triangles/1000)}k tris, ${c.buffer.join('x')}, ${c.objects} objects`;

// ---------------------------------------------------------------- grid comparisons
// One race per track started with perf 'off' (stock), paused on the grid with all 7 cars bunched
// (the worst case for the shadow pass), then switched live: off -> balanced -> performance ->
// quality -> off. The final 'off' frame must equal the first one exactly.
async function grid(env,track,category){
 console.log(`\n[grid] ${track} (${category}), 6 bots, ${PHONE.width}x${PHONE.height} @${DPR}`);
 const {page,context,errors}=await phone(env,{perf:'off'});
 try{
  await launch(page,{track,category});await pause(page);
  const off=await settle(page);await shot(page,track+'-off');
  const res={off};
  for(const tier of ['balanced','performance','quality']){res[tier]=await setTier(page,tier);await shot(page,track+'-'+tier)}
  const back=await setTier(page,'off');
  const st=await page.evaluate(()=>KartMobile.perf.stats());
  for(const k of ['off','balanced','performance','quality'])console.log('   '+k.padEnd(12)+fmt(res[k]));
  if(ACCEPT.has(track)){
   report.ok(res.balanced.calls<=res.off.calls/2,`${track}: balanced draw calls at most half (${res.balanced.calls} vs ${res.off.calls})`);
   report.ok(res.balanced.triangles<=res.off.triangles/2,`${track}: balanced triangles at most half (${res.balanced.triangles} vs ${res.off.triangles})`);
   report.ok(res.performance.triangles<=res.balanced.triangles,`${track}: performance triangles not above balanced`);
  }
  for(const tier of ['balanced','performance','quality']){const px=res[tier].buffer[0]*res[tier].buffer[1];report.ok(px<=BUDGET[tier],`${track}: ${tier} drawing buffer ${px} px within ${BUDGET[tier]}`)}
  report.ok(back.calls===off.calls&&back.triangles===off.triangles&&back.objects===off.objects&&back.children===off.children&&back.pixelRatio===off.pixelRatio,
   `${track}: switching back to off restores the stock scene`,`${fmt(back)} vs ${fmt(off)}`);
  report.ok(st.broken.length===0,`${track}: no optimisation switched itself off`,st.broken.join(','));
  report.ok(!errors.length,`${track}: no page errors`,errors.join(' | '));
  return res;
 }finally{await context.close()}
}

// ---------------------------------------------------------------- warm-up, crash, restart
async function crash(env){
 console.log('\n[crash] circuit, balanced from the start, items on (barriers break only outside competitive mode)');
 const {page,context,errors}=await phone(env,{perf:'balanced',hook:true});
 try{
  await launch(page,{track:'circuit',category:'kart',comp:false});
  const first=await settle(page);
  report.ok(first.antialias===false,'race renderer created without MSAA on the mobile profile');
  report.ok(first.buffer[0]*first.buffer[1]<=BUDGET.balanced,`balanced drawing buffer ${first.buffer.join('x')} within budget`);
  const shadow=await page.evaluate(()=>KartMobile.perf.stats().shadowMap);
  report.ok(shadow==='1024 pcf',`balanced shadow map capped (${shadow})`);
  await page.waitForFunction(()=>document.getElementById('msg')?.textContent===''||document.getElementById('msg')?.textContent.includes('LOS'),null,{timeout:120000});
  const before=await page.evaluate(()=>({programs:KartMobile.perf.stats().programs,growth:KartMobile.perf.stats().programGrowth,warmups:KartMobile.perf.stats().warmups,
   chunks:KartMobile.perf.barrierChunks().map(m=>Array.from(m.instanceMatrix.array))}));
  report.ok(before.warmups>=2,`shaders warmed during loading and on the first frame (${before.warmups} warm-ups)`);
  // Full throttle with drift (smoke/spark sprites), then a hard sideways hit on the barrier.
  await page.evaluate(()=>{window.__fly=0;window.__slam=0;window.__drive=({pl,keys,state,flying})=>{window.__flyNow=flying.length;if(flying.length>window.__fly)window.__fly=flying.length;keys.up=1;
   if(state==='race'){window.__frames=(window.__frames||0)+1;keys.drift=window.__frames%40<20?1:0;keys.left=window.__frames%40<20?1:0;
    if(window.__slam>0){window.__slam--;const sx=Math.cos(pl.h),sz=-Math.sin(pl.h);pl.vx=sx*45;pl.vz=sz*45}}}});
  await page.waitForTimeout(8000);
  await page.evaluate(()=>{window.__slam=6});
  await page.waitForFunction(()=>window.__fly>0,null,{timeout:60000,polling:100}).catch(()=>{});
  await page.waitForTimeout(1500);
  const after=await page.evaluate(()=>({fly:window.__fly,chunks:KartMobile.perf.barrierChunks().map(m=>Array.from(m.instanceMatrix.array)),sprites:(()=>{let n=0;window.kartRaceScene.traverse(o=>{if(o.isSprite&&o.visible)n++});return n})()}));
  const moved=after.chunks.filter((c,i)=>c.some((v,j)=>v!==before.chunks[i][j])).length;
  report.ok(after.fly>0,`crash breaks barrier parts (${after.fly} flying)`);
  report.ok(moved>0,`crash animation moves instances in the barrier chunks (${moved} chunk(s) changed)`);
  // Parts fly for 3.5 s of game time; at software-GL frame rates (dt clamped to 50 ms) that is longer in real time.
  await page.waitForFunction(()=>window.__flyNow===0,null,{timeout:120000,polling:250}).catch(()=>{});
  await page.waitForTimeout(3000);
  const end=await page.evaluate(()=>{const s=KartMobile.perf.stats();return{programs:s.programs,growth:s.programGrowth}});
  report.ok(end.programs===before.programs&&end.growth===0,`no new shader program during the race after warm-up (${before.programs} -> ${end.programs})`);
  const restored=await page.evaluate(()=>KartMobile.perf.barrierChunks().map(m=>Array.from(m.instanceMatrix.array)));
  report.ok(restored.every((c,i)=>c.every((v,j)=>Math.abs(v-before.chunks[i][j])<1e-4)),'broken barrier parts return to their place after the animation');
  console.log(`   visible sprites during the run: ${after.sprites}`);
  // Settings block survives drawPreferences() rebuilding the Graphics section.
  const ui=await page.evaluate(async()=>{drawPreferences();await new Promise(r=>setTimeout(r,50));const box=document.querySelector('#settings-graphics > #kmPerfSettings');
   return{box:!!box,options:box?[...box.querySelectorAll('option')].map(o=>o.textContent).join('|'):'',value:box?.querySelector('select').value}});
  report.ok(ui.box&&ui.value==='balanced'&&!ui.options.includes('||'),'performance settings re-attached to the Graphics tab after drawPreferences()',JSON.stringify(ui));
  // 30 fps cap: the game loop keeps running (frames still advance) while capped.
  const capped=await page.evaluate(async()=>{KartMobile.set('fps30',true);let n=0;const d=window.__drive;window.__drive=x=>{n++;d(x)};await new Promise(r=>setTimeout(r,5000));window.__drive=d;KartMobile.set('fps30',false);return n});
  report.ok(capped>0,`game keeps updating with the 30 fps cap on (${capped} updates in 5 s)`);
  // Leave the race and start another one on the same page.
  await page.evaluate(()=>leaveSingleRace());
  await page.waitForFunction(()=>document.body.classList.contains('lobby')&&!window.kartActiveTrack,null,{timeout:60000});
  report.ok(await page.evaluate(()=>KartMobile.perf.debug()===null),'session dropped after leaving the race');
  await launch(page,{track:'nurburgring',category:'gt3',bots:2});
  const second=await settle(page);
  const dbg=await page.evaluate(()=>KartMobile.perf.debug());
  report.ok(!!dbg&&dbg.terrainTiles>0&&dbg.barrierChunks>0&&second.antialias===false,'second race is restructured again',JSON.stringify(dbg));
  report.ok(!errors.length,'crash/restart: no page errors',errors.join(' | '));
 }finally{await context.close()}
}

// ---------------------------------------------------------------- desktop
async function desktop(env){
 console.log('\n[desktop] 1280x720 without touch: module present vs ?mobile=0');
 const out=[];
 for(const query of ['','?mobile=0']){
  const {page,context,errors}=await open(env,{viewport:{width:1280,height:720},touch:false,query});
  try{
   const state=await page.evaluate(()=>({active:KartMobile.active,stockRender:String(qualityRender).includes('r._kartScene=scene'),stockRenderer:!String(THREE.WebGLRenderer).includes('parameters.canvas'),perfApi:!!KartMobile.perf}));
   await page.evaluate(installCapture);
   await launch(page,{track:'circuit',category:'kart'});await pause(page);
   const c=await settle(page);out.push(c);
   console.log(`   ${query||'(no query)'}`.padEnd(14)+fmt(c));
   report.ok(!state.active&&state.stockRender&&state.stockRenderer,`desktop ${query||'default'}: layer inactive, no hooks installed`,JSON.stringify(state));
   report.ok(!errors.length,`desktop ${query||'default'}: no page errors`,errors.join(' | '));
  }finally{await context.close()}
 }
 report.ok(out[0].calls===out[1].calls&&out[0].triangles===out[1].triangles&&out[0].buffer.join()===out[1].buffer.join(),'desktop draw calls, triangles and buffer identical with and without the module');
}

(async()=>{
 const env=await environment();
 const table=[];
 try{
  if(parts.includes('grid'))for(const [track,category] of tracks)table.push([track,await grid(env,track,category)]);
  if(parts.includes('crash'))await crash(env);
  if(parts.includes('desktop'))await desktop(env);
 }catch(e){report.ok(false,'test run',e.stack||String(e))}
 finally{await env.close()}
 if(table.length){
  console.log('\n| track | tier | draw calls | triangles | buffer |\n|---|---|---|---|---|');
  for(const [t,r] of table)for(const k of ['off','balanced','performance','quality'])console.log(`| ${t} | ${k} | ${r[k].calls} | ${r[k].triangles} | ${r[k].buffer.join('x')} |`);
 }
 const webgl=consoleIssues.filter(m=>/webgl|three|shader|GL_|program/i.test(m));
 console.log('\nconsole warnings/errors ('+consoleIssues.length+'):'+(consoleIssues.length?'\n  '+[...new Set(consoleIssues)].slice(0,30).join('\n  '):' none'));
 report.ok(!webgl.length,'no WebGL/three.js warnings or errors in the console',webgl.slice(0,5).join(' | '));
 process.exit(report.done());
})();
