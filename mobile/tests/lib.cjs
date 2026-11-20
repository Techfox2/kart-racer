// Shared helpers for the mobile tests (Playwright + the isolated sandbox server).
const crypto=require('crypto'),{chromium}=require('playwright');
const sandbox=require('../tools/sandbox.cjs');
const VIEWPORTS={landscape:{width:844,height:390},landscapeSmall:{width:667,height:375},portrait:{width:390,height:844},portraitSmall:{width:360,height:640},tablet:{width:1024,height:768}};
async function environment(port=13990+Math.floor(Math.random()*500)){
 const box=sandbox.start(port,{quiet:!process.env.KM_VERBOSE});await sandbox.ready(box.origin);
 const browser=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
 return{origin:box.origin,browser,async close(){await browser.close();box.stop()}};
}
// Opens the logged-in game. touch:false gives a desktop context (mobile layer must stay inactive).
// setup(page,context) runs before navigation (e.g. to install page.route hooks).
// deviceScaleFactor (optional) emulates a high-density phone screen (e.g. 3).
// rotatePrompt:false (default) dismisses the lobby's "turn your device" prompt so menu checks see the menus.
async function open(env,{viewport=VIEWPORTS.landscape,touch=true,query='',setup=null,deviceScaleFactor,rotatePrompt=false}={}){
 const context=await env.browser.newContext({viewport,hasTouch:touch,isMobile:touch,...(deviceScaleFactor?{deviceScaleFactor}:{})});
 const response=await context.request.post(env.origin+'/api/register',{headers:{Origin:env.origin,'X-Kart-Request':'1'},
  data:{username:'QA'+crypto.randomBytes(5).toString('hex'),password:crypto.randomBytes(24).toString('hex')}});
 if(!response.ok())throw new Error('register failed: '+response.status());
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(String(e.message||e)));
 if(setup)await setup(page,context);
 await page.goto(env.origin+'/'+query);
 await page.waitForFunction(()=>!document.getElementById('bootStatus'),null,{timeout:90000});
 await page.evaluate(()=>document.querySelectorAll('dialog[open]').forEach(d=>d.close()));
 if(!rotatePrompt)await page.evaluate(()=>window.KartMobile?.orientation?.dismiss());
 return{page,context,errors};
}
// Starts a solo race and waits until the countdown is over and the kart accepts input.
async function startRace(page,{track='circuit',bots=0,laps=1,category='kart'}={}){
 // updates.js may auto-open its modal (and set the game's paused flag) after open() returned;
 // a real player could not start a race behind it, so close any open dialog first.
 await page.evaluate(o=>{document.querySelectorAll('dialog[open]').forEach(d=>d.close());launch(o.track,{...SAVE,laps:o.laps,category:o.category,botCount:o.bots,comp:true})},{track,bots,laps,category});
 await page.waitForFunction(t=>window.kartActiveTrack===t&&window.KartRaceDebug?.current,track,{timeout:90000});
 await page.waitForFunction(()=>document.getElementById('msg')?.textContent.includes('LOS')||document.getElementById('msg')?.textContent==='',null,{timeout:90000}).catch(()=>{});
 await page.waitForTimeout(1200);
}
const speed=page=>page.evaluate(()=>window.KartRaceDebug?.current?.speed??null);
const rect=(page,selector)=>page.evaluate(s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect(),c=getComputedStyle(e);return{x:r.x,y:r.y,w:r.width,h:r.height,visible:c.display!=='none'&&c.visibility!=='hidden'&&r.width>0&&r.height>0}},selector);
const overlap=(a,b)=>!!a&&!!b&&a.visible&&b.visible&&a.x<b.x+b.w&&b.x<a.x+a.w&&a.y<b.y+b.h&&b.y<a.y+a.h;
function reporter(name){let failed=0;return{ok(condition,label,detail=''){if(condition)console.log('  ok   '+label);else{failed++;console.log('  FAIL '+label+(detail?' — '+detail:''))}},done(){console.log(failed?name+': '+failed+' failed':name+': all passed');return failed}}}
module.exports={VIEWPORTS,environment,open,startRace,speed,rect,overlap,reporter};
