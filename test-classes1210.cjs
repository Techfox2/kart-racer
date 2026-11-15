const assert=require('assert'),classes=require('./lobby-classes.js'),race=require('./racing.js');
for(const category of ['kart','gt3']){
 const same={presence:{driverClass:category}},different={presence:{driverClass:category==='kart'?'gt3':'kart'}};
 assert(classes.allReady({category,mixedClasses:false},[same]));assert(!classes.allReady({category,mixedClasses:false},[same,different]));assert(classes.allReady({category,mixedClasses:true},[same,different]));
 assert(!classes.accepts({category,mixedClasses:true},'plane'));
}
const low={x:0,y:0,z:0,h:Math.PI-.1,pitch:.1,roll:-.05},upperRoad={y:25};
const packet={x:1,y:0,z:2,h:-Math.PI+.1,pitch:.15,roll:.02};
const pose=race.remotePose(low,packet,1/60);assert.equal(pose.y,0,'no unrelated upper road projection');assert(Math.abs(pose.h-low.h)<.1);assert(pose.pitch>.1&&pose.pitch<.15);assert(pose.roll>-.05&&pose.roll<.02);
const slope=race.remotePose({...low,y:1},{...packet,y:2},1/60);assert(slope.y>1&&slope.y<2);
assert.deepEqual(race.remotePose(null,packet,.1),packet);assert.equal(race.remotePose(low,{...packet,y:NaN},.1),null);
const teleport={...packet,x:150,y:4};assert.deepEqual(race.remotePose(low,teleport,.1),teleport);
console.log('PASS strict/mixed class eligibility and synchronized remote height/pitch/roll, wrapped headings and rejoin snap');
