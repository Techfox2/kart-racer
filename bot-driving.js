/* Deterministic racing decisions; no distance-to-player speed bonuses. */
(function(root){'use strict';
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),mod=(v,n)=>(v%n+n)%n;
 const levels={easy:{pace:.8,grip:.62,brake:17,look:9,error:.85,mistake:.009,pass:false,draft:false},normal:{pace:.94,grip:.82,brake:25,look:24,error:.20,mistake:.0015,pass:true,draft:false},hard:{pace:1,grip:.96,brake:34,look:48,error:.06,mistake:0,pass:true,draft:true}};
 function profiles(curvature,seg,gt3,grip){const out={},N=curvature.length;for(const [name,l]of Object.entries(levels)){const v=curvature.map(k=>Math.min((gt3?68:40)*l.pace,Math.sqrt((gt3?40:30)*grip*l.grip/Math.max(.0001,Math.abs(k)))));for(let pass=0;pass<3;pass++)for(let i=N-1;i>=0;i--)v[i]=Math.min(v[i],Math.sqrt(v[(i+1)%N]**2+2*l.brake*seg));out[name]=v}return out}
 function plan(a,env){const {N,seg,width,K,profiles,traffic,time,gt3,bay}=env,l=levels[a.level]||levels.normal,i=mod(Math.floor(a.s),N),far=mod(i+Math.round(l.look/seg),N),near=mod(i+Math.round(8/seg),N),edge=Math.max(.4,width/2-1.45),k=K[i],future=K[far];
  let want=a.level==='hard'?(Math.abs(k)>.006?clamp(k*100,-edge*.7,edge*.7):-clamp(future*90,-edge*.65,edge*.65)):clamp(K[near]*45,-edge*.4,edge*.4);
  want+=Math.sin(time*(a.level==='easy'?.65:.42)+a.phase)*l.error;
  let speed=profiles[a.level][i],front=null,behind=null;
  for(const b of traffic){if(b.source===a||b.finished)continue;const gap=(b.s-a.s)*seg;if(gap>0&&gap<45&&(!front||gap<front.gap))front={...b,gap};if(gap<0&&gap>-14&&(!behind||gap>behind.gap))behind={...b,gap}}
  const safeLane=lane=>traffic.every(b=>b.source===a||b.finished||Math.abs((b.s-a.s)*seg)>Math.max(6,a.v*.32)||Math.abs(lane-b.o)>2.8);
  if(front&&Math.abs(front.o-a.o)<3){
   if(l.draft&&front.gap>13&&front.gap<35&&Math.abs(future)<.012)want=front.o;
   if(front.gap<Math.max(12,a.v*.65)){
    const choices=[front.o-3.15,front.o+3.15].filter(o=>Math.abs(o)<=edge&&safeLane(o));
    if((l.pass||front.v<2)&&choices.length){want=choices.sort((x,y)=>Math.abs(x-a.o)-Math.abs(y-a.o))[0];a.passing=true}
    else{speed=Math.min(speed,Math.max(0,front.v+(front.gap-7)*.65));a.passing=false}
   }
  }else{a.passing=false;if(a.level==='hard'&&behind&&behind.gap<-5&&Math.abs(future)<.009){const lane=clamp(behind.o,-edge*.55,edge*.55);if(safeLane(lane))want=lane}}
  if(a.pit||a.pitExit){const d=bay.distance(i);if(d>=bay.from-35&&d<=bay.to+3){const blend=bay.blend(i);want=-(width/2+3.5)*blend;speed=Math.min(speed,12);if(a.pit){const remaining=bay.centre-d;if(remaining>=-.8&&remaining<55){speed=Math.min(speed,Math.sqrt(2*12*Math.max(0,remaining-.2)));if(remaining<.5)speed=0}}}if(a.pitExit&&d>bay.to+1)a.pitExit=false}
  const max=(gt3?68:40)+(l.draft?a.draft*5:0)+(a.fxT>0&&a.fxK?8:0);
  if(a.fxT>0)speed*=a.fxK?(Math.abs(future)<.012?1.13:1):.75;
  if(l.draft&&Math.abs(future)<.012)speed+=a.draft*5;
  if(a.pit)speed*=.65;
  return {speed:clamp(speed,0,max),offset:clamp(want,a.pit||a.pitExit?-width/2-4:-(width/2-.7),width/2-.7),brake:l.brake,acceleration:(gt3?34:24)*(a.level==='easy'?.78:a.level==='normal'?.92:1),lateral:a.level==='easy'?1.7:a.level==='hard'?3.5:2.8,mistake:l.mistake};
 }
 function useful(a,item,traffic,seg,curvature){if(a.level!=='hard')return true;if(item==='boost')return Math.abs(curvature)<.009&&!a.pit&&!a.pitExit;if(item==='rocket')return traffic.some(b=>b.source!==a&&!b.finished&&(b.s-a.s)*seg>3&&(b.s-a.s)*seg<65&&Math.abs((b.y||0)-(a.y||0))<3);return traffic.some(b=>b.source!==a&&!b.finished&&(b.s-a.s)*seg<0&&(b.s-a.s)*seg>-20&&Math.abs(b.o-a.o)<3)}
 const api={profiles,plan,useful,levels};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.KartDriving=api;
})(typeof window!=='undefined'?window:globalThis);
