const assert=require('assert'),race=require('./racing.js');
function circle(N,seg,s){const a=s/N*Math.PI*2,r=N*seg/(2*Math.PI);return{x:Math.sin(a)*r,y:0,z:Math.cos(a)*r}}
for(const count of [1,2,3])for(const step of [.2,1,2]){
 const N=800,seg=2,g=race.raceProgress(N,seg,-2);let last,events=0;
 for(let s=-2;s<count*N+step/2;s+=step){last=g.step(s,circle(N,seg,s),step*seg/96,96);if(last.completed){events++;assert.equal(last.laps,events)}}
 assert.equal(last.laps,count);assert.equal(events,count);
}
const N=800,seg=2,g=race.raceProgress(N,seg,-2),record=race.progress(N,seg,-2);let result;
for(let s=-2;s<=N+1;s++){const p=circle(N,seg,s);result=g.step(s,p,.04,96);record.step(s,p,.04,(s+2)*.04,s!==300,96)}
assert.equal(result.laps,1,'grass does not invalidate race lap');assert.equal(record.laps,1,'grass contact also preserves record time');
for(const s of [800,799,800,799,800,799,800])result=g.step(s,circle(N,seg,s),.04,96);
assert.equal(result.laps,0,'reverse subtracts credit and line oscillation cannot restore it');
for(let s=801;s<=1600;s++)result=g.step(s,circle(N,seg,s),.04,96);assert.equal(result.laps,1,'new circuit after reversal counts');
const fresh=race.raceProgress(N,seg,-2);for(const s of [-2,-1,0,-1,0,-1,0])result=fresh.step(s,circle(N,seg,s),.04,96);assert.equal(result.laps,0,'first start crossing and oscillation never count');
for(const s of [300,500,799,800])result=fresh.step(s,circle(N,seg,s),.01,96);assert.equal(result.laps,0,'teleports/missing gates do not finish');
const small=race.raceProgress(8,.2,-1);for(const s of [-1,0,1,2,3,4,5,6,6.9,8.1])result=small.step(s,circle(8,.2,s),.05,10);assert.equal(result.laps,1,'last gate and finish in same step');
const reset=race.raceProgress(N,seg,-2);assert.equal(reset.laps,0,'restart resets progress');
console.log('PASS race laps 1/2/3, frame steps, grass vs record, reverse credit, oscillation, teleport, last gate+finish, reset');

// Continuous tighter inner arc: road projection advances much faster than the car.
const shortcut=race.raceProgress(N,seg,-2);for(let s=-2;s<=N;s++){const p=circle(N,seg,s);p.x*=.5;p.z*=.5;result=shortcut.step(s,p,.02,96)}assert.equal(result.laps,1);

const vm=require('vm'),fs=require('fs'),sandbox={window:{},KartGT3:{cars:[['porsche']]},KartTuningStats:{}};vm.runInNewContext(fs.readFileSync('bots.js','utf8'),sandbox);const bots=sandbox.window.KartBots,doneBot={s:800,ft:42,v:0};const stale=bots.packet([{s:700,ft:0,v:15}]);bots.apply([doneBot],stale);assert.equal(doneBot.ft,42);assert.equal(doneBot.s,800);const restartedBot={s:0,ft:0};bots.apply([restartedBot],stale);assert.equal(restartedBot.s,700);console.log('PASS finished bot rejects late state; new race accepts state');
