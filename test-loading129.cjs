// Real local HTTP/browser regression tests; all accounts live in the runner's temporary DB.
const assert=require('assert'),crypto=require('crypto'),fs=require('fs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'C:/Users/phils/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const origin=process.env.TEST_ORIGIN;assert(/^http:\/\/127\.0\.0\.1:\d+$/.test(origin));
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});try{
 const c=await browser.newContext({viewport:{width:1280,height:900}}),headers={Origin:origin,'X-Kart-Request':'1'};
 assert.equal((await c.request.post(origin+'/api/register',{headers,data:{username:'QA'+crypto.randomBytes(6).toString('hex'),password:crypto.randomBytes(24).toString('hex')}})).status(),200);
 headers.Cookie=(await c.cookies()).map(x=>x.name+'='+x.value).join('; ');await c.request.post(origin+'/api/social/seen',{headers,data:{version:JSON.parse(fs.readFileSync('release-notes.json')).current}});
 const p=await c.newPage(),errors=[];p.setDefaultTimeout(25000);p.on('pageerror',e=>errors.push(e.message));
 // Test-only pause at a real asynchronous construction boundary, without changing game state.
 await p.route('**/assets/bundles/game.js*',async r=>{const response=await r.fetch(),body=(await response.text()).replace('const checkpoint=async()=>{','const checkpoint=async()=>{if(window.__buildCheckpoint)await window.__buildCheckpoint();');await r.fulfill({response,body})});
 await p.goto(origin);await p.waitForFunction(()=>!document.getElementById('bootStatus'));await p.evaluate(()=>{document.querySelectorAll('dialog[open]').forEach(d=>d.close());PREF.quality='low';PREF.shadows=false;savePreferences()});
 await p.locator('#setBtn').click();await p.evaluate(()=>selectSettings('graphics'));await p.waitForFunction(()=>document.querySelectorAll('#panel .sheet-body>section:not([hidden])').length===1&&!document.getElementById('settings-graphics').hidden&&document.getElementById('panel').getAnimations({subtree:true}).every(a=>a.playState!=='running'));await p.screenshot({path:'.work/settings129-desktop.png'});await p.setViewportSize({width:390,height:844});await p.screenshot({path:'.work/settings129-mobile.png'});await p.locator('#close').click();await p.setViewportSize({width:800,height:600});
 const baselineCanvases=await p.locator('body>canvas').count();const before=await p.evaluate(()=>({r:SAVE.races,c:SAVE.coins,x:SAVE.xp}));
 const launch=()=>p.evaluate(()=>launch('circuit',{...SAVE,laps:1,botCount:0,comp:true}));
 let release,held=0;const gate=new Promise(r=>release=r);await p.route('**/assets/scenery/models.js*',async r=>{held++;await gate;await r.continue()});
 await launch();await p.waitForFunction(()=>!!document.getElementById('raceLoading'));await p.waitForTimeout(300);assert.equal(held,1);await p.locator('#raceLoading button').click();assert.equal(await p.locator('#raceLoading').count(),0);
 await launch();await p.locator('#raceLoading').waitFor();release();await p.waitForFunction(()=>window.kartActiveTrack==='circuit',null,{timeout:60000});assert.deepEqual(await p.evaluate(()=>({r:SAVE.races,c:SAVE.coins,x:SAVE.xp})),before);await p.locator('#home').click();await p.unroute('**/assets/scenery/models.js*');
 console.log('PASS intercepted shared asset: cancel, immediate retry, late old completion, no reward');
 for(const boundary of [1,4]){
  await p.evaluate(n=>{let calls=0;window.__checkpointWaiting=false;window.__buildCheckpoint=()=>{if(++calls===n)return new Promise(r=>{window.__checkpointWaiting=true;window.__checkpointResume=r})}},boundary);
  await launch();await p.waitForFunction(()=>window.__checkpointWaiting);await p.locator('#raceLoading button').click();assert.equal(await p.locator('#raceLoading').count(),0);assert.equal(await p.evaluate(()=>window.kartActiveTrack),null);assert.equal(await p.locator('body>canvas').count(),baselineCanvases);
  await p.evaluate(()=>{window.__buildCheckpoint=null;window.__checkpointResume()});await launch();await p.waitForFunction(()=>window.kartActiveTrack==='circuit',null,{timeout:60000});await p.locator('#home').click();
 }
 await p.route('**/api/rankings/season',r=>r.fulfill({status:503,contentType:'application/json',body:'{"error":"network"}'}));await launch();await p.waitForFunction(()=>!document.getElementById('raceLoading'));assert.equal(await p.evaluate(()=>window.kartActiveTrack),null);await p.unroute('**/api/rankings/season');await launch();await p.waitForFunction(()=>window.kartActiveTrack==='circuit',null,{timeout:60000});await p.locator('#home').click();
 assert.deepEqual(await p.evaluate(()=>({r:SAVE.races,c:SAVE.coins,x:SAVE.xp})),before);assert.deepEqual(errors,[]);console.log('PASS early/late partial construction cleanup, fresh retry, request failure/recovery, no rewards or JS errors');await c.close();
 }finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
