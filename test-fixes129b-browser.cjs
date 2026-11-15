const assert=require('assert'),crypto=require('crypto'),fs=require('fs'),cp=require('child_process');
const{chromium}=require(process.env.PLAYWRIGHT_MODULE||'C:/Users/phils/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const origin=process.env.TEST_ORIGIN;assert(/^http:\/\/127\.0\.0\.1:\d+$/.test(origin));
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{const context=await browser.newContext({viewport:{width:1100,height:700}}),headers={Origin:origin,'X-Kart-Request':'1'};
assert.equal((await context.request.post(origin+'/api/register',{headers,data:{username:'QA'+crypto.randomBytes(6).toString('hex'),password:crypto.randomBytes(24).toString('hex')}})).status(),200);
await context.request.post(origin+'/api/social/seen',{headers,data:{version:JSON.parse(fs.readFileSync('release-notes.json')).current}});
const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
// Inspection only: production physics and inputs remain unchanged.
await p.route('**/assets/bundles/game.js*',async route=>{const response=await route.fetch();const body=(await response.text()).replace('function update(dt){','function update(dt){window.__race={stats:CAR_STATS,upgrades:UPGRADES,pl,state,keys};');await route.fulfill({response,body})});
const boot=async()=>{await p.goto(origin);await p.waitForFunction(()=>!document.getElementById('bootStatus'));await p.evaluate(async()=>{document.querySelectorAll('dialog[open]').forEach(d=>d.close());PREF.quality='low';PREF.shadows=false;savePreferences();await KartAccount.flush()})};await boot();
const id=await p.evaluate(()=>KartAccount.account.id);
cp.execFileSync(process.env.TEST_PYTHON,['-c',`import sqlite3,json,sys
c=sqlite3.connect(sys.argv[1]);uid=c.execute('SELECT id FROM users WHERE player_id=?',(sys.argv[2],)).fetchone()[0]
s=json.loads(c.execute('SELECT state FROM profiles WHERE user_id=?',(uid,)).fetchone()[0]);p=json.loads(s['kart-save']);p['coins']=100000;s['kart-save']=json.dumps(p)
c.execute('UPDATE profiles SET state=?,revision=revision+1 WHERE user_id=?',(json.dumps(s),uid));c.commit();c.close()`,process.env.TEST_DATABASE,id]);
await p.evaluate(()=>KartAccount.refreshForRace());
for(const car of ['kart','porsche'])for(const part of Object.keys(require('./tuning-data.js').parts)){
 const exists=await p.evaluate(part=>!!KartTuningStats.data.parts[part],part);if(exists)await p.evaluate(async({car,part})=>{for(let level=1;level<=3;level++)await KartAccount.buyUpgrade(car,part,level)},{car,part});
}
const saved=await p.evaluate(()=>structuredClone(SAVE.upgrades));assert(saved.kart.engine===3&&saved.porsche.engine===3);
async function start(category,comp=false){await p.evaluate(({category,comp})=>{document.querySelectorAll('dialog[open]').forEach(d=>d.close());window.__race=null;SAVE.category=category;SAVE.car='porsche';persist();launch('circuit',{...SAVE,category,comp,laps:1,botCount:0})},{category,comp});await p.waitForFunction(()=>window.__race?.state==='race',null,{timeout:60000})}
for(const category of ['kart','gt3']){
 await start(category);
 const result=await p.evaluate(()=>({actual:__race.stats,expected:KartTuningStats.carStats(KartTuning.id(),KartTuning.levels(KartTuning.id())),upgrades:__race.upgrades}));assert.deepEqual(result.actual,result.expected);assert(Object.keys(result.upgrades).length);
 if(category==='gt3'){
  await p.keyboard.press('c');await p.keyboard.press('c');
  await p.waitForTimeout(200);assert.equal(await p.locator('dialog[open]').count(),0);assert(await p.locator('#sp').evaluate(e=>e.classList.contains('cockpit-speed')));
  await p.screenshot({path:'.work/cockpit129b-desktop.png'});
  let box=await p.locator('#sp').boundingBox();assert(box.x>700&&box.y>500);
  await p.setViewportSize({width:390,height:700});await p.screenshot({path:'.work/cockpit129b-mobile.png'});box=await p.locator('#sp').boundingBox();assert(box.x>=0&&box.x+box.width<=390&&box.y+box.height<=700);
  await p.setViewportSize({width:1100,height:700});
 }
 await p.keyboard.down('ArrowUp');await p.waitForTimeout(1800);await p.keyboard.up('ArrowUp');
 const speed=await p.evaluate(()=>({value:__race.pl.vF,text:document.getElementById('sp').textContent}));assert(speed.value>5);assert(speed.text.includes('Speed')&&speed.text.includes('Max'));
 await p.evaluate(()=>leaveSingleRace());
}
await boot();assert.deepEqual(await p.evaluate(()=>SAVE.upgrades),saved);await start('kart');assert.equal(await p.evaluate(()=>__race.upgrades.engine),3);await p.evaluate(()=>leaveSingleRace());
await start('kart',true);assert.equal(await p.evaluate(()=>__race.upgrades.engine),3);await p.evaluate(()=>leaveSingleRace());
assert.deepEqual(errors,[]);console.log('PASS real HTTP purchases, refreshed upgrades, kart/GT3 actual race stats and moving Speed output, scene change/reload, mode-independent upgrades, desktop/mobile cockpit');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
