const assert=require('assert'),fs=require('fs'),vm=require('vm'),THREE=require('./vendor/three.min.js');
const race=require('./racing.js'),driving=require('./bot-driving.js'),geometry=require('./vehicle-geometry.js'),terrain=require('./track-terrain.js');
const rules=require('./assets/tracks/race-rules.json');race.setRules(rules);
for(const vmax of [40,68,53,81]){const results=[];for(const factor of [.5,1,1.9]){let v=0,early;for(let i=0;i<30000;i++){v=race.speed(v,1/120,{throttle:true,vmax,acceleration:24*factor});if(i===240)early=v}results.push(early);assert(Math.abs(v-vmax)<1e-8)}assert(results[0]<results[1]&&results[1]<results[2])}
assert(race.speed(50,.1,{throttle:true,vmax:40,acceleration:24,boost:20,slope:-1})<=40);
const stacked=[{x:0,y:0,z:0},{x:0,y:10,z:0},{x:10,y:0,z:0}];assert.equal(race.nearest(stacked,0,10,0,0,3),1);assert.equal(race.nearest(stacked,0,0,0,1,3),0);
const maps=JSON.parse(fs.readFileSync('game.js','utf8').match(/const MAPS=(\{.*\});/)[1]),ctx={window:{}};vm.runInNewContext(fs.readFileSync('kart-tracks.js','utf8'),ctx);ctx.window.KartTracks.install(maps);
for(const [id,m]of Object.entries(maps)){
 const c=new THREE.CatmullRomCurve3(m.ctrl.map(p=>new THREE.Vector3(p[0]*m.S,p[2]||0,p[1]*m.S)),true,m.curveType||'catmullrom',.5);c.arcLengthDivisions=m.arcDivisions||Math.max(2000,m.ctrl.length*8);c.updateArcLengths();const length=c.getLength(),N=Math.max(800,Math.round(length/2)),seg=length/N,P=Array.from({length:N},(_,i)=>c.getPointAt(i/N)),T=Array.from({length:N},(_,i)=>c.getTangentAt(i/N).setY(0).normalize());assert(Math.abs(length-rules.tracks[id].length)<.02,id+' rules drift');
 const g=race.progress(N,seg,-2);let laps=0,now=0;for(let i=-2;i<=N*2+1;i++){now+=seg/25;const r=g.step((i+N)%N,P[(i+N)%N],seg/25,now,true);if(r.completed)laps++}assert.equal(laps,2,id+' complete ordered laps');
 const bad=race.progress(N,seg,-2);let finish;for(const i of [-2,-1,0,...Array.from({length:80},(_,j)=>Math.round((j+1)*N/80))])finish=bad.step((i+N)%N,P[(i+N)%N],.01,.01,true);assert.equal(finish.laps,0,id+' rejects shortcut');
 for(const mode of ['competitive','luckyblock'])for(const category of ['kart','gt3'])assert(Number.isFinite(race.minLap(id,category,mode))&&race.minLap(id,category,mode)>5);
 if(m.terrain){const land=terrain.create(P,T,seg,m.W/2+m.bw,m.tn);for(let i=0;i<N;i+=5)assert(land.height(P[i].x,P[i].z)<P[i].y-.25,id+' ground must stay below road')}
}
const guard=race.progress(800,2,-1);for(let i=-1;i<=801;i++)guard.step((i+800)%800,{x:i*2,y:0,z:0},.1,i*.1,i!==300);assert.equal(guard.laps,1,'grass contact preserves a complete record lap');
assert.equal(race.behind({x:0,z:0,h:0},[{x:0,z:5},{x:1,z:-3},{x:0,z:-10}]).distance,Math.sqrt(10));assert.equal(race.behind({x:0,z:0,h:0},[{x:0,z:5}]),null);
const loft=geometry.loft(THREE,[[[-1,0,-1],[-1,1,-1],[1,1,-1],[1,0,-1]],[[-1,0,1],[-1,1,1],[1,1,1],[1,0,1]]]);const pos=loft.attributes.position,norm=loft.attributes.normal;assert(Array.from(norm.array).every(Number.isFinite));for(let i=8;i<pos.count;i++)assert(Math.sign(norm.getZ(i))===Math.sign(pos.getZ(i)),'outward cap normals');
const prof=driving.profiles(Array(100).fill(.01),2,false,1);assert(prof.easy[0]<prof.normal[0]&&prof.normal[0]<prof.hard[0]);
console.log('PASS acceleration caps, height-aware matching, all 10 tracks/checkpoints/shortcuts/minimums, road clearance, rear arrow, GT3 cap normals, bot levels.');
