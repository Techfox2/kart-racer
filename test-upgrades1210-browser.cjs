const assert=require('assert'),crypto=require('crypto'),fs=require('fs'),cp=require('child_process');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'C:/Users/phils/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const origin=process.env.TEST_ORIGIN;assert(/^http:\/\/127\.0\.0\.1:\d+$/.test(origin));
const qa={username:'QA'+crypto.randomBytes(6).toString('hex'),password:crypto.randomBytes(24).toString('hex')},headers={Origin:origin,'X-Kart-Request':'1'},errors=[];
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
 let context=await browser.newContext({viewport:{width:1100,height:700}});
 assert.equal((await context.request.post(origin+'/api/register',{headers,data:qa})).status(),200);
 const version=JSON.parse(fs.readFileSync('release-notes.json')).current;
 await context.request.post(origin+'/api/social/seen',{headers,data:{version}});
 async function pageFor(ctx){const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));
  // Expose production simulation for a controlled A/B experiment; no replacement physics.
  await p.route('**/assets/bundles/game.js*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('function update(dt){','function update(dt){window.__physics={update,pl,ai,keys,state};')})});
  await p.goto(origin);await p.waitForFunction(()=>!document.getElementById('bootStatus'));await p.evaluate(async()=>{document.querySelectorAll('dialog[open]').forEach(d=>d.close());PREF.quality='low';PREF.shadows=false;savePreferences();await KartAccount.flush()});return p;
 }
 let p=await pageFor(context);
 const id=await p.evaluate(()=>KartAccount.account.id);
 cp.execFileSync(process.env.TEST_PYTHON,['-c',`import sqlite3,json,sys
c=sqlite3.connect(sys.argv[1]);uid=c.execute('SELECT id FROM users WHERE player_id=?',(sys.argv[2],)).fetchone()[0]
s=json.loads(c.execute('SELECT state FROM profiles WHERE user_id=?',(uid,)).fetchone()[0]);p=json.loads(s['kart-save']);p['coins']=100000;s['kart-save']=json.dumps(p)
c.execute('UPDATE profiles SET state=?,revision=revision+1 WHERE user_id=?',(json.dumps(s),uid));c.commit();c.close()`,process.env.TEST_DATABASE,id]);
 await p.evaluate(()=>KartAccount.refreshForRace());
 async function start(category='kart',comp=false,bots=0,upgradesEnabled=true){await p.evaluate(({category,comp,bots,upgradesEnabled})=>{document.querySelectorAll('dialog[open]').forEach(d=>d.close());window.__physics=null;SAVE.category=category;SAVE.car='porsche';persist();launch('circuit',{...SAVE,category,comp,upgradesEnabled,laps:1,botCount:bots})},{category,comp,bots,upgradesEnabled});await p.waitForFunction(()=>window.__physics?.state==='race',null,{timeout:60000});}
 const simulate=()=>p.evaluate(()=>{
  const {pl,keys,update}=__physics,start={x:pl.x,z:pl.z,h:pl.h};keys.up=1;
  for(let i=0;i<120;i++)update(1/120);keys.up=0;
  const straight={distance:Math.hypot(pl.x-start.x,pl.z-start.z),speed:pl.vF};
  // Start the steering comparison at the same speed and heading in both runs.
  pl.vx=Math.sin(pl.h)*8;pl.vz=Math.cos(pl.h)*8;pl.steer=0;const heading=pl.h;keys.left=1;
  for(let i=0;i<30;i++)update(1/120);keys.left=0;
  return {...straight,turn:Math.abs(pl.h-heading),debug:KartRaceDebug.current};
 });
 await start();const stock=await simulate();await p.evaluate(()=>leaveSingleRace());
 for(const part of Object.keys(require('./tuning-data.js').parts))await p.evaluate(async part=>{for(let level=1;level<=3;level++)await KartAccount.buyUpgrade('kart',part,level)},part);
 const saved=await p.evaluate(()=>structuredClone(SAVE.upgrades));
 await start();const tuned=await simulate();console.log(JSON.stringify({stock,tuned}));assert(tuned.distance>stock.distance*1.2);assert(tuned.speed>stock.speed*1.2);assert(tuned.turn>stock.turn*1.1);
 assert.equal(tuned.debug.upgrades.engine,3);assert.equal(tuned.debug.reason,'active');
 await p.locator('#raceTelemetry summary').click();assert.equal(await p.locator('#raceTelemetry').getAttribute('open'),null);await p.locator('#raceTelemetry summary').click();
 for(const lang of ['de','en','fr']){await p.evaluate(lang=>{document.documentElement.lang=lang},lang);await p.waitForTimeout(150);const text=await p.locator('#raceTelemetry').innerText();assert(text.includes('3 / 3'));assert(!text.includes('undefined'));}
 await p.evaluate(()=>document.documentElement.lang='de');await p.screenshot({path:'.work/upgrades1210-desktop.png'});
 await p.setViewportSize({width:390,height:700});await p.waitForTimeout(150);await p.screenshot({path:'.work/upgrades1210-mobile.png'});const box=await p.locator('#raceTelemetry').boundingBox();assert(box.x>=0&&box.x+box.width<=390&&box.y+box.height<=700);
 await p.evaluate(()=>leaveSingleRace());assert.equal(await p.locator('#raceTelemetry,#rearIndicator').count(),0);
 // A fresh browser context and a real login ensure persistence is server-side.
 await context.close();context=await browser.newContext({viewport:{width:1100,height:700}});assert.equal((await context.request.post(origin+'/api/login',{headers,data:qa})).status(),200);p=await pageFor(context);assert.deepEqual(await p.evaluate(()=>SAVE.upgrades),saved);
 await start();assert.equal(await p.evaluate(()=>KartRaceDebug.current.upgrades.induction),3);await p.locator('#gear').click();await p.locator('#reset').click();await p.waitForFunction(()=>window.KartRaceDebug?.current.upgrades.engine===3&&__physics?.state==='race',null,{timeout:60000});await p.evaluate(()=>leaveSingleRace());
 for(const comp of [true,false])for(const enabled of [true,false]){await start('kart',comp,0,enabled);assert.equal(await p.evaluate(()=>KartRaceDebug.current.upgrades.engine||0),enabled?3:0);assert.equal(await p.evaluate(()=>KartRaceDebug.current.stored.engine),3);assert.equal(await p.evaluate(()=>KartRaceDebug.current.reason),enabled?'active':'disabled');await p.evaluate(()=>leaveSingleRace());}
 await p.evaluate(()=>openCustom());await p.locator('#cUpgrades').uncheck();await p.locator('#cMode [data-v=c]').click();assert.equal(await p.locator('#cUpgrades').isChecked(),false);await p.evaluate(async()=>{closeSheet();await KartAccount.flush()});await p.reload();await p.waitForFunction(()=>!document.getElementById('bootStatus'));assert.equal(await p.evaluate(()=>SAVE.upgradesEnabled),false);
 await p.evaluate(()=>{document.querySelectorAll('dialog[open]').forEach(d=>d.close());openCustom('quick')});await p.locator('#cUpgrades').uncheck();await p.locator('#sheetFoot button').click();await p.waitForFunction(()=>document.getElementById('sheetWrap').hidden);await p.reload();await p.waitForFunction(()=>!document.getElementById('bootStatus'));assert.equal(await p.evaluate(()=>SAVE.quickPlay.upgradesEnabled),false);
 await start('kart',false,6);
 // Render deterministic opponents on both sides and at different elevations.
 await p.evaluate(()=>{document.getElementById('rearIndicator').style.visibility='hidden';window.__indicatorFixture=KartRearIndicator.create();const pl={x:0,z:0,h:0};__indicatorFixture.update(pl,[{x:-4,z:12},{x:4,z:-8},{x:-12,z:-8},{x:2,z:80},{x:0,y:12,z:40},{x:0,z:-300}],true)});
 const rows=p.locator('#rearIndicator').last().locator('.driver-distance');assert.equal(await rows.count(),6);assert.equal(await p.locator('#rearIndicator').last().locator('[data-direction=ahead]').count(),3);assert.equal(await p.locator('#rearIndicator').last().locator('[data-direction=behind]').count(),3);
 await p.screenshot({path:'.work/distances1210-desktop.png'});await p.setViewportSize({width:390,height:700});await p.screenshot({path:'.work/distances1210-mobile.png'});
 await p.evaluate(()=>{__indicatorFixture.dispose();leaveSingleRace()});assert.equal(await p.locator('#raceTelemetry,#rearIndicator').count(),0);
 assert.deepEqual(errors,[]);fs.writeFileSync('.work/upgrades1210-results.json',JSON.stringify({stock,tuned,checks:['real purchases','production update A/B straight and steering','fresh browser login persistence','race restart','independent mode switches and cloud persistence','DE/EN/FR telemetry','all six driver arrows','desktop/mobile'],errors},null,2));
 console.log('PASS production physics A/B:',JSON.stringify({stock,tuned}));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
