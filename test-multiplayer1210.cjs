const assert=require('assert'),crypto=require('crypto'),fs=require('fs'),cp=require('child_process');
const{chromium}=require(process.env.PLAYWRIGHT_MODULE||'C:/Users/phils/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const origin=process.env.TEST_ORIGIN;assert(/^http:\/\/127\.0\.0\.1:\d+$/.test(origin));
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-features=WebRtcHideLocalIpsWithMdns']});
try{const context=await browser.newContext({viewport:{width:1100,height:700}}),headers={Origin:origin,'X-Kart-Request':'1'};
assert.equal((await context.request.post(origin+'/api/register',{headers,data:{username:'QA'+crypto.randomBytes(6).toString('hex'),password:crypto.randomBytes(24).toString('hex')}})).status(),200);
await context.request.post(origin+'/api/social/seen',{headers,data:{version:JSON.parse(fs.readFileSync('release-notes.json')).current}});
const p=await context.newPage(),errors=[];p.on('pageerror',e=>{errors.push(e.message);console.log('HOST ERROR',e.message)});
// Inspection only: production physics and inputs remain unchanged.
await p.route('**/assets/bundles/game.js*',async route=>{const body=fs.readFileSync('assets/bundles/game.js','utf8').replace('catch(e){if(!job.cancelled){back();', 'catch(e){window.__loadError=e.stack;console.error(e.stack);if(!job.cancelled){back();').replace('function update(dt){','function update(dt){window.__race={stats:CAR_STATS,upgrades:UPGRADES,pl,state,keys,rem,NET};');await route.fulfill({status:200,contentType:'application/javascript',body})});
const boot=async()=>{await p.goto(origin);await p.waitForFunction(()=>!document.getElementById('bootStatus'));await p.evaluate(async()=>{document.querySelectorAll('dialog[open]').forEach(d=>d.close());PREF.quality='low';PREF.shadows=false;savePreferences();await KartAccount.flush()})};await boot();
const id=await p.evaluate(()=>KartAccount.account.id);
cp.execFileSync(process.env.TEST_PYTHON,['-c',`import sqlite3,json,sys
c=sqlite3.connect(sys.argv[1]);uid=c.execute('SELECT id FROM users WHERE player_id=?',(sys.argv[2],)).fetchone()[0]
s=json.loads(c.execute('SELECT state FROM profiles WHERE user_id=?',(uid,)).fetchone()[0]);p=json.loads(s['kart-save']);p['coins']=100000;s['kart-save']=json.dumps(p)
c.execute('UPDATE profiles SET state=?,revision=revision+1 WHERE user_id=?',(json.dumps(s),uid));c.commit();c.close()`,process.env.TEST_DATABASE,id]);
await p.evaluate(()=>KartAccount.refreshForRace());
for(const car of ['porsche'])for(const part of Object.keys(require('./tuning-data.js').parts)){
 const exists=await p.evaluate(part=>!!KartTuningStats.data.parts[part],part);if(exists)await p.evaluate(async({car,part})=>{for(let level=1;level<=3;level++)await KartAccount.buyUpgrade(car,part,level)},{car,part});
}
const saved=await p.evaluate(()=>structuredClone(SAVE.upgrades));assert(saved.porsche.engine===3);
async function start(category,comp=false){await p.evaluate(({category,comp})=>{document.querySelectorAll('dialog[open]').forEach(d=>d.close());window.__race=null;SAVE.category=category;SAVE.car='porsche';persist();launch('circuit',{...SAVE,category,comp,laps:1,botCount:0})},{category,comp});await p.waitForFunction(()=>window.__race?.state==='race',null,{timeout:90000})}

const guestContext=await browser.newContext({viewport:{width:800,height:600}});assert.equal((await guestContext.request.post(origin+'/api/register',{headers,data:{username:'QA'+crypto.randomBytes(6).toString('hex'),password:crypto.randomBytes(24).toString('hex')}})).status(),200);
await guestContext.request.post(origin+'/api/social/seen',{headers,data:{version:JSON.parse(fs.readFileSync('release-notes.json')).current}});
const guest=await guestContext.newPage();guest.on('pageerror',e=>{errors.push(e.message);console.log('GUEST ERROR',e.message)});
await guest.route('**/assets/bundles/game.js*',async route=>{const body=fs.readFileSync('assets/bundles/game.js','utf8').replace('catch(e){if(!job.cancelled){back();', 'catch(e){window.__loadError=e.stack;console.error(e.stack);if(!job.cancelled){back();').replace('function update(dt){','function update(dt){window.__race={stats:CAR_STATS,upgrades:UPGRADES,pl,state,keys,rem,NET};');await route.fulfill({status:200,contentType:'application/javascript',body})});
await guest.goto(origin);await guest.waitForFunction(()=>!document.getElementById('bootStatus'));
for(const [page,category] of [[p,'gt3'],[guest,'kart']])await page.evaluate(async category=>{document.querySelectorAll('dialog[open]').forEach(d=>d.close());PREF.quality='low';PREF.shadows=false;SAVE.category=category;SAVE.car='porsche';SAVE.mpBotCount=0;persist();savePreferences();await KartAccount.flush();await KartAccount.request('/api/social/seen',{version:(await (await fetch('release-notes.json')).json()).current});KartSocial.invalidate()},category);
await p.locator('#mpBtn').click();await p.locator('#lcreate').click();await p.locator('#hostNetwork [data-network=web]').click();await p.locator('#scategory').selectOption('gt3');await p.locator('#smode').selectOption('f');await p.locator('#sUpgrades').check();await p.locator('#mk').click();await p.locator('#paddock').waitFor({state:'visible',timeout:50000});const code=(await p.locator('#rcode').textContent()).trim();console.log('HOST CREATED');assert.equal(await p.locator('#rMixed').isChecked(),false);await p.locator('#rMixed').check();await p.waitForFunction(()=>hostPlayer(cur.room.peers()).presence.mixedClasses);
await guest.evaluate(()=>document.querySelectorAll('dialog[open]').forEach(d=>d.close()));await guest.locator('#mpBtn').click();await guest.locator('#ljoin').click();await guest.locator('#joinNetwork [data-network=web]').click();await guest.locator('#jcode').fill(code);await guest.locator('#jn').click();await guest.locator('#paddock').waitFor({state:'visible',timeout:50000}).catch(async e=>{await guest.screenshot({path:'.work/tuning129b-online-error.png'});console.log('JOIN DIAGNOSTIC',await guest.locator('#lobby').innerText(),errors);throw e});await p.waitForFunction(()=>cur.room.peers().length===2);
console.log('MIXED JOINED');assert.equal(await guest.locator('#rMixed').isDisabled(),true);
await p.locator('#rMixed').uncheck();await guest.waitForFunction(()=>!hostPlayer(cur.room.peers()).presence.mixedClasses);
assert.equal(await p.locator('#rstart').isDisabled(),true);assert.equal(await guest.locator('#rDriverClass option[value=kart]').isDisabled(),true);
await guest.locator('#rDriverClass').selectOption('gt3');await p.waitForFunction(()=>cur.room.peers().every(x=>x.presence.driverClass==='gt3'));
assert.equal(await p.locator('#rstart').isDisabled(),false);console.log('STRICT CLASS CHANGE PASSED');

for(const [comp,enabled] of [[false,true],[false,false],[true,true],[true,false]]){console.log('START CASE',comp,enabled);
 await p.locator(comp?'#rcomp':'#rlucky').click();await guest.waitForFunction(comp=>!!hostPlayer(cur.room.peers()).presence.comp===comp,comp);await p.locator('#rUpgrades').setChecked(enabled);await guest.waitForFunction(enabled=>!!hostPlayer(cur.room.peers()).presence.upgradesAllowed===enabled,enabled);assert.equal(await p.locator('#rUpgrades').isDisabled(),false);
 await p.locator('#rstart').click();await p.locator('#rgo').click();await p.waitForTimeout(5000);console.log('START DIAGNOSTICS',await Promise.all([p,guest].map(page=>page.evaluate(()=>({loadError:window.__loadError,host:hostPlayer(cur.room.peers()).presence.go,loading:!!raceLoad,track:window.kartActiveTrack,ready:document.getElementById('raceReady')?.innerText,text:document.getElementById('toast')?.textContent})))));
 for(const page of [p,guest]){await page.waitForFunction(()=>document.querySelector('#raceReady [data-ready]')&&!document.querySelector('#raceReady [data-ready]').disabled,null,{timeout:60000});await page.locator('#raceReady [data-ready]').click();console.log('CLIENT READY')}
 for(const page of [p,guest])await page.waitForFunction(()=>__race.state==='race',null,{timeout:30000});
 const hostStats=await p.evaluate(()=>__race.stats),guestStats=await guest.evaluate(()=>__race.stats),base=await p.evaluate(()=>KartTuningStats.roomStats('gt3'));
 assert.deepEqual(guestStats,base,'guest uses selected GT3 class without upgrades');
 if(enabled){assert(hostStats.acceleration>base.acceleration&&hostStats.topSpeed>base.topSpeed&&hostStats.grip>base.grip);await p.keyboard.down('ArrowUp');await p.waitForTimeout(1500);await p.keyboard.up('ArrowUp');assert(await p.evaluate(()=>__race.pl.vF>5))}else assert.deepEqual(hostStats,base);
 for(const page of [p,guest])await page.locator('#home').click();
 console.log('PASS two real web clients; competitive='+comp+'; upgrades allowed='+enabled+'; shared class, purchased acceleration/top speed/grip and scene restart');
}

await p.locator('#rMixed').check();await guest.waitForFunction(()=>hostPlayer(cur.room.peers()).presence.mixedClasses);await guest.locator('#rDriverClass').selectOption('kart');await p.waitForFunction(()=>cur.room.peers().some(x=>x.presence.driverClass==='kart'));await p.locator('#rUpgrades').check();
await p.locator('#rstart').click();await p.locator('#rgo').click();
for(const page of [p,guest]){await page.waitForFunction(()=>document.querySelector('#raceReady [data-ready]')&&!document.querySelector('#raceReady [data-ready]').disabled,null,{timeout:90000});await page.locator('#raceReady [data-ready]').click()}
for(const page of [p,guest])await page.waitForFunction(()=>__race.state==='race',null,{timeout:30000});
assert.equal((await guest.evaluate(()=>__race.stats)).topSpeed,40);assert((await p.evaluate(()=>__race.stats)).topSpeed>68);
await p.keyboard.down('ArrowUp');await guest.keyboard.down('ArrowUp');await p.waitForTimeout(1000);await p.keyboard.up('ArrowUp');await guest.keyboard.up('ArrowUp');
for(const page of [p,guest]){await page.waitForFunction(()=>__race.rem.size===1);const remote=await page.evaluate(()=>[...__race.rem.values()].map(q=>({y:q.y,mesh:q.mesh.position.y,pitch:q.pitch,rotation:q.mesh.rotation.x})));for(const q of remote){assert(Math.abs(q.y-q.mesh)<1e-8);assert(Math.abs(q.rotation+q.pitch)<1e-8)}}
await p.screenshot({path:'.work/multiplayer1210-host.png'});await guest.screenshot({path:'.work/multiplayer1210-guest.png'});console.log('PASS mixed classes retain own physics and remote pose height/pitch agrees on both clients');
for(const page of [p,guest])await page.locator('#home').click();
assert.deepEqual(errors,[]);

}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
