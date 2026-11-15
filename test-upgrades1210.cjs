const assert=require('assert'),fs=require('fs'),THREE=require('./vendor/three.min.js');
const stats=require('./tuning-stats.js'),race=require('./racing.js'),driving=require('./bot-driving.js');
const parts=Object.keys(stats.data.parts),full=Object.fromEntries(parts.map(p=>[p,3]));
for(const id of Object.keys(stats.data.cars)){
 const stock=stats.carStats(id,{});
 for(let level=1;level<=3;level++){
  for(const [part,key] of [['engine','acceleration'],['induction','topSpeed'],['tyres','grip'],['suspension','steering'],['brakes','braking']])assert(Math.abs(stats.carStats(id,{[part]:level})[key]/stock[key]-(1+.1*level))<1e-10,id+' '+part+' 10% per stage');
  assert(stats.carStats(id,{suspension:level}).yaw>stats.carStats(id,{suspension:level-1}).yaw);
  for(const part of parts){const current=stats.carStats(id,{...full,[part]:level}),before=stats.carStats(id,{...full,[part]:level-1});assert.notDeepEqual(current,before,part+' must still affect a fully upgraded car');}
 }
 const progress={ownedCars:[id],ownedKarts:[id.replace('kart-','')],upgrades:{[id]:{...full}}};
 const config=stats.prepareRace(id,progress,{},stats.definition(id).category);progress.upgrades[id].engine=0;
 assert.equal(config.upgrades.engine,3);assert(Object.isFrozen(config.stats)&&Object.isFrozen(config.upgrades));
 for(const mode of [{competitive:true,allowed:false},{online:true,allowed:false}]){const disabled=stats.prepareRace(id,progress,mode);assert.deepEqual(disabled.stats,stock);assert(disabled.stored.induction===3);assert.deepEqual(disabled.upgrades,{});}
 let slow=0,fast=0,slowDistance=0,fastDistance=0;
 for(let frame=0;frame<360;frame++){slow=race.speed(slow,1/120,{throttle:true,vmax:stock.topSpeed,acceleration:stats.acceleration(stock,slow)});fast=race.speed(fast,1/120,{throttle:true,vmax:config.stats.topSpeed,acceleration:stats.acceleration(config.stats,fast)});slowDistance+=slow/120;fastDistance+=fast/120;}
 assert(fastDistance>slowDistance*1.2,id+' >20% distance advantage after 3s');
}
// Screen-right must match the real Three.js camera basis, not world +X.
for(const h of [0,Math.PI/2,Math.PI,-Math.PI/2,.7]){
 const p={x:3,z:5,h},forward=new THREE.Vector3(Math.sin(h),0,Math.cos(h)),camera=new THREE.PerspectiveCamera();camera.position.set(p.x,2,p.z);camera.lookAt(camera.position.clone().add(forward));camera.updateMatrixWorld();const right=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0);
 for(const side of [-1,1])for(const front of [-1,1]){const d={x:p.x+right.x*side*4+forward.x*front*8,z:p.z+right.z*side*4+forward.z*front*8};const t=race.relativeDrivers(p,[d])[0];assert.equal(Math.sign(Math.sin(t.angle)),side);assert.equal(t.ahead,front===1);assert(Math.abs(t.distance-Math.sqrt(80))<1e-9);}
}
const drivers=[{x:-4,z:10},{x:4,z:-5},{x:0,z:1000},{x:0,y:12,z:-20},{x:0,z:20,fin:1},{x:NaN,z:1}];
assert.equal(race.relativeDrivers({x:0,z:0,h:0},drivers).length,4,'all active opponents, ahead/behind/far/elevated');
const profiles=driving.profiles(Array(200).fill(0),2,false,1),bot={s:0,o:0,v:5,phase:0,level:'hard',draft:0},env={N:200,seg:2,width:12,K:Array(200).fill(0),profiles,traffic:[],time:0,gt3:false,bay:{}};
assert.equal(driving.plan({...bot},env).speed,40);assert.equal(driving.plan({...bot},env).acceleration,24);
assert(!fs.readFileSync('bot-driving.js','utf8').includes('SAVE.upgrades'));
console.log('PASS all vehicle stages, effective speed advantage, immutable race snapshots, mode reasons, camera-correct arrows/all opponents, stock AI');
