/* Shared race math. Server and client use assets/tracks/race-rules.json. */
(function(root){'use strict';
 const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),mod=(x,n)=>(x%n+n)%n;
 let rules,pending;
 const api={
  prepare(){return pending||(pending=fetch('assets/tracks/race-rules.json',{credentials:'same-origin'}).then(r=>{if(!r.ok)throw Error('Race rules');return r.json()}).then(r=>rules=r).catch(e=>{pending=null;throw e}))},
  setRules(r){rules=r},
  remotePose(previous,packet,dt){
   if(!['x','y','z','h'].every(key=>Number.isFinite(packet[key])))return null;
   const snap=!previous||Math.hypot(packet.x-previous.x,packet.y-previous.y,packet.z-previous.z)>60,k=snap?1:1-Math.exp(-14*Math.max(0,dt)),pose={};
   for(const key of ['x','y','z','pitch','roll']){const target=Number.isFinite(packet[key])?packet[key]:0;pose[key]=snap?target:(previous[key]||0)+(target-(previous[key]||0))*k;}
   const before=previous?.h||0,delta=mod(packet.h-before+Math.PI,2*Math.PI)-Math.PI;pose.h=snap?packet.h:before+delta*k;
   return pose;
  },
  minLap(track,category,mode){return rules?.tracks[track]?rules.tracks[track].length*rules.distanceMargin/rules.maxSpeed[mode][category]:Infinity},
  speed(v,dt,o){
   if(o.throttle)v+=o.acceleration*Math.max(.1,1-Math.max(0,v)/o.vmax)*dt;
   else v*=Math.exp(-.28*(1-(o.draft||0)*.7)*dt);
   if(o.boost&&v>0)v+=o.boost*dt;
   if(o.brake)v-=(v>.5?o.braking:12)*dt;
   v-=9.8*(o.slope||0)*dt;
   return clamp(v,-9,o.vmax);
  },
  nearest(P,x,y,z,previous,window){let best=mod(Math.round(previous),P.length),distance=Infinity;
   for(let d=-Math.min(window,P.length);d<=Math.min(window,P.length);d++){const i=mod(Math.round(previous)+d,P.length),p=P[i],q=(x-p.x)**2+(z-p.z)**2+(Number.isFinite(y)?(y-p.y)**2*4:0);if(q<distance){distance=q;best=i}}return best;
  },
  progress(N,seg,start,finish=null){const guard=api.raceProgress(N,seg,start,finish);let startTime=0,timed=false,valid=false;
   return {
    step(s,position,dt,now,onCourse,maxSpeed=110){
     // Surface does not invalidate a lap; ordered sectors and the actual finish do.
     const mark=guard.step(s,position,dt,maxSpeed);let completed=0;
     if(mark.crossedForward){if(mark.completed&&timed)completed=now-startTime;startTime=now;timed=true}
     if(!mark.armed)timed=false;valid=mark.armed;
     return {completed,laps:mark.laps,total:mark.total,lapTime:timed?now-startTime:0,valid};
    },
    invalidate(){guard.invalidate();timed=false;valid=false},get laps(){return guard.laps},get sectors(){return guard.sectors},get nextGate(){return guard.nextGate},get invalid(){return !valid}
   };
  },
  // Race distance is independent of record validity: grass does not cancel a lap.
  // Forward gates establish a whole circuit. Reversing over the line consumes
  // the last credit and requires a new full circuit, so line oscillation cannot farm laps.
  raceProgress(N,seg,start,finish=null){let cursor=start,last=null,armed=false,next=1,epoch=0,laps=0;
   const sectors=Math.max(8,Math.min(32,Math.ceil(N*seg/120))),spacing=N/sectors;
   return {step(s,position,dt,maxSpeed=110){
    let d=mod(s,N)-mod(cursor,N);if(d>N/2)d-=N;if(d<-N/2)d+=N;
    const moved=last?Math.hypot(position.x-last.x,position.z-last.z):0;
    // Projection can jump multiple sectors on a continuous grass shortcut.
    // Only actual horizontal movement can invalidate race distance; projected
    // road height is not the car's physical displacement off the road.
    const plausible=Number.isFinite(d)&&Number.isFinite(moved)&&dt>=0&&(!last||moved<=maxSpeed*dt+1.2);
    const side=p=>finish?(p.x-finish.x)*finish.tx+(p.z-finish.z)*finish.tz:0;
    const previousSide=last?side(last):null,currentSide=side(position);
    const before=cursor;cursor+=d;last={...position};let completed=false;
    const nearFinish=mod(cursor,N)<spacing||mod(cursor,N)>N-spacing||mod(before,N)<spacing||mod(before,N)>N-spacing;
    const forward=finish?nearFinish&&previousSide!==null&&previousSide<0&&currentSide>=0:d>0&&Math.floor(before/N)<Math.floor(cursor/N);
    const backward=finish?nearFinish&&previousSide!==null&&previousSide>=0&&currentSide<0:d<0&&Math.floor(before/N)>Math.floor(cursor/N);
    if(!plausible){armed=false;next=1}
    else if(backward){if(laps>0)laps--;armed=false;next=1}
    else{
     if(armed&&d>0){while(next<sectors&&before<epoch+next*spacing&&cursor>=epoch+next*spacing)next++}
     if(forward){if(armed&&next===sectors){laps++;completed=true}armed=true;epoch=Math.round(cursor/N)*N;next=1}
    }
    return {laps,completed,armed,crossedForward:plausible&&forward&&!backward,total:armed?laps*N+mod(cursor,N):Math.min(laps*N-.001,laps*N+mod(cursor,N)-N)};
   },invalidate(){armed=false;next=1},get sectors(){return sectors},get laps(){return laps},get nextGate(){return armed?mod(epoch+next*spacing,N):0}};
  },
  relativeDrivers(player,drivers){const fx=Math.sin(player.h),fz=Math.cos(player.h),targets=[];
   for(const [index,other] of drivers.entries()){
    if(other===player||other.fin||other.ft||!Number.isFinite(other.x)||!Number.isFinite(other.z))continue;
    const dx=other.x-player.x,dz=other.z-player.z,dy=(other.y||0)-(player.y||0),distance=Math.hypot(dx,dy,dz),forward=dx*fx+dz*fz;
    if(distance<.01)continue;
    // Three.js camera looks along +forward: screen-right is (-cos(h), sin(h)).
    const right=dz*fx-dx*fz;
    targets.push({other,index,distance,ahead:forward>=0,angle:Math.atan2(right,forward)});
   }
   return targets.sort((a,b)=>a.distance-b.distance);
  },
  behind(player,drivers){return api.relativeDrivers(player,drivers).find(t=>!t.ahead&&Math.abs((t.other.y||0)-(player.y||0))<=8)||null}
 };
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.KartRace=api;
})(typeof window!=='undefined'?window:globalThis);
