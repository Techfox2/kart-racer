/* Shared, bounded bot configuration. Multiplayer simulation stays on a client. */
window.KartBots=(()=>{
 const levels=['easy','normal','hard'],cars=KartGT3.cars.map(c=>c[0]);
 function normalize(value={},humans=1){return {count:Math.min(Math.max(0,7-humans),Number.isInteger(value.count)?Math.max(0,Math.min(6,value.count)):0),items:value.items===true,cars:Array.from({length:6},(_,i)=>cars.includes(value.cars?.[i])?value.cars[i]:cars[i%3]),difficulties:Array.from({length:6},(_,i)=>levels.includes(value.difficulties?.[i])?value.difficulties[i]:'normal')}}
 function authority(players,order){const active=players.filter(p=>order.includes(p.peer)&&p.presence.racing!==false);return (active.find(p=>p.presence.host===1)||active.sort((a,b)=>a.peer.localeCompare(b.peer))[0])?.peer}
 const fields=['s','o','v','spin','kick','ov','fxT','fxK','ft','held','itemDelay','pit','pitT','pitExit'];
 function packet(bots){return bots.slice(0,6).map(a=>fields.map(k=>k==='held'?Math.max(0,['','boost','oil','rocket'].indexOf(a.held||'')):['fxK','pit','pitExit'].includes(k)?+!!a[k]:Math.round((Number(a[k])||0)*1000)/1000))}
 function clean(data){return Array.isArray(data)&&data.length<=6&&data.every(row=>Array.isArray(row)&&row.length===fields.length&&row.every(n=>Number.isFinite(n)&&Math.abs(n)<=1e8))?data:null}
 function apply(bots,data){if(!clean(data)||data.length!==bots.length)return;data.forEach((row,i)=>{if(bots[i].ft>0)return;fields.forEach((k,j)=>bots[i][k]=k==='held'?['','boost','oil','rocket'][row[j]]||null:['fxK','pit','pitExit'].includes(k)?!!row[j]:row[j])})}
 return {roomStats:category=>KartTuningStats.roomStats(category),normalize,authority,packet,clean,apply};
})();
