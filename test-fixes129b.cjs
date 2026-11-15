const assert=require('assert'),race=require('./racing.js'),tuning=require('./tuning-stats.js');
const N=800,seg=2;
function point(s,r=250){const a=s/N*Math.PI*2;return{x:Math.sin(a)*r,y:0,z:Math.cos(a)*r}}
// Continuous shortcut near a bend: projection jumps across multiple sectors.
const g=race.raceProgress(N,seg,-1);let r;
for(let s=-1;s<=800;s++){
 if(s>200&&s<350)continue;
 const p=s===350?{x:200,y:60,z:0}:{x:s<350?s:s-150,y:0,z:0};
 r=g.step(s,p,.05,110);
}
assert.equal(r.laps,1,'continuous off-road projection jump must not cancel lap');
// Reject crossing suggested only by road projection, not the actual finish plane.
const physical=race.raceProgress(N,seg,-1,{x:0,z:250,tx:1,tz:0});
physical.step(799,{x:-1,y:0,z:250},.05);
physical.step(0,{x:-.1,y:0,z:250},.05);
physical.step(.1,{x:.1,y:0,z:250},.05);
for(let s=1;s<800;s++)r=physical.step(s,point(s),.05);
r=physical.step(800,{x:.01,y:0,z:250},.05);
assert.equal(r.laps,1,'physical finish completes once');
r=physical.step(799.9,{x:-.01,y:0,z:250},.05);assert.equal(r.laps,0);
for(let i=0;i<12;i++)r=physical.step(i%2?799.9:.1,{x:i%2?-.01:.01,y:0,z:250},.05);
assert.equal(r.laps,0,'physical oscillation cannot earn credit');
const full=Object.fromEntries(Object.keys(tuning.data.parts).map(k=>[k,3]));
for(const id of Object.keys(tuning.data.cars))for(const category of [undefined,'kart','gt3']){
 const stock=tuning.raceStats(id,{},category),tuned=tuning.raceStats(id,full,category);
 assert(tuned.acceleration>stock.acceleration,id+' acceleration');assert(tuned.topSpeed>stock.topSpeed,id+' top speed');
 assert(tuned.grip>stock.grip&&tuned.steering>stock.steering,id+' handling');assert(Object.isFrozen(tuned));
 if(category)assert.deepEqual(stock,tuning.roomStats(category));
 let a=0,b=0;for(let i=0;i<600;i++){a=race.speed(a,1/60,{throttle:true,acceleration:tuning.acceleration(stock,a),vmax:stock.topSpeed});b=race.speed(b,1/60,{throttle:true,acceleration:tuning.acceleration(tuned,b),vmax:tuned.topSpeed})}
 assert(b>a,id+' actual acceleration simulation');
}
console.log('PASS shortcut projection, physical finish/reverse/oscillation, all vehicle upgrades with both room classes and actual speed simulation');
