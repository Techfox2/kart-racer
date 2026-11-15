/* Pure vehicle stats: no save, clock, mode or DOM dependencies. Units: m/s, m/s², kg. */
(function(root){'use strict';
 const data=typeof module!=='undefined'?require('./tuning-data.js'):root.KartTuningData;
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 function definition(id){return data.cars[id]||(id.startsWith('kart-')?data.cars.kart:{...data.cars.porsche,engine:'inline6',layout:'front'})}
 function clean(value,ids=Object.keys(data.cars)){const result={};if(!value||typeof value!=='object'||Array.isArray(value))return result;for(const id of ids){const entry=value[id];if(!entry||typeof entry!=='object'||Array.isArray(entry))continue;const p={};for(const part of Object.keys(data.parts))if(Number.isInteger(entry[part])&&entry[part]>=1&&entry[part]<=3)p[part]=entry[part];if(Object.keys(p).length)result[id]=p}return result}
 function carStats(id,upgrades={}){const def=definition(id),gt3=def.category==='gt3',u=clean({[id]:upgrades},[id])[id]||{},e={};for(const [part,level]of Object.entries(u)){for(const [key,n]of Object.entries(def.parts[part][level-1].effects))e[key]=(e[key]||0)+n}
  const stock={acceleration:gt3?34:24,topSpeed:gt3?68:40,offSpeed:gt3?21:16,grip:gt3?40:30,braking:gt3?52:40,weight:gt3?1300:160,downforce:0,drag:0,steering:10,yaw:2.3,stability:1,terrainGrip:1,response:1,highAcceleration:1,damage:1};
  const s={...stock,acceleration:stock.acceleration*(1+clamp(e.acceleration||0,0,.5)),topSpeed:stock.topSpeed*(1+clamp((e.topSpeed||0)-(e.drag||0),-.04,.35)),grip:stock.grip*(1+clamp(e.grip||0,0,.4)),braking:stock.braking*(1+clamp(e.braking||0,0,.4)),weight:stock.weight*(1+clamp(e.weight||0,-.12,0)),downforce:clamp(e.downforce||0,0,.35),drag:clamp(e.drag||0,0,.04),steering:stock.steering*(1+clamp(e.steering||0,0,.5)),yaw:stock.yaw*(1+clamp(e.yaw||0,0,.3)),stability:1+clamp(e.stability||0,0,.3),terrainGrip:1+clamp(e.terrainGrip||0,0,.35),response:1+clamp(e.response||0,0,.2),highAcceleration:1+clamp(e.highAcceleration||0,0,.35),damage:1+clamp(e.damage||0,0,.20)};
  s.pi=Math.round((gt3?600:300)*(1+.26*(s.acceleration/stock.acceleration-1)+.3*(s.topSpeed/stock.topSpeed-1)+.14*(s.grip/stock.grip-1)+.08*(s.braking/stock.braking-1)+.08*(s.highAcceleration-1)+.07*s.downforce+.07*(s.steering/stock.steering-1)));return Object.freeze(s)
 }
 function roomStats(category){return carStats(category==='gt3'?'porsche':'kart',{})}
 function raceStats(id,upgrades,category){
  const tuned=carStats(id,upgrades);if(!category)return tuned;
  // Room class defines base physics even when a player uses a different body.
  // Apply that vehicle's purchased effects to the room base instead of dropping them.
  const stock=carStats(id,{}),base=roomStats(category),result={...tuned};
  for(const key of ['acceleration','topSpeed','offSpeed','grip','braking','weight','steering','yaw'])result[key]=base[key]*tuned[key]/stock[key];
  result.pi=Math.round(base.pi*tuned.pi/stock.pi);
  return Object.freeze(result);
 }
 function active(mode){return mode.online?mode.allowed===true:mode.allowed!==false}
 function prepareRace(id,progress,mode={},category){
  const owned=id==='kart'||(id.startsWith('kart-')?(progress.ownedKarts||[]).includes(id.slice(5)):(progress.ownedCars||[]).includes(id));
  const stored=Object.freeze(owned?{...(clean(progress.upgrades,[id])[id]||{})}:{});
  const reason=!active(mode)?mode.online?'host':'disabled':Object.keys(stored).length?'active':'stock';
  const upgrades=Object.freeze(active(mode)?{...stored}:{});
  return Object.freeze({id,stored,upgrades,reason,stats:raceStats(id,upgrades,category)});
 }
 function acceleration(stats,speed){const ratio=clamp(Math.abs(speed)/stats.topSpeed,0,1);return stats.acceleration*(1+(stats.highAcceleration-1)*ratio)*(1+(stats.response-1)*(1-ratio))}
 const api={roomStats,raceStats,prepareRace,data,definition,clean,carStats,active,acceleration};if(typeof module!=='undefined')module.exports=api;else{root.KartTuningStats=api;root.carStats=carStats}
})(typeof window!=='undefined'?window:globalThis);
