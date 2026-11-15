window.KartRearIndicator={
 create(){
  const e=document.createElement('div');e.id='rearIndicator';e.dataset.noTranslate='';document.body.append(e);
  const rows=new Map();let last=0,wasVisible=false;
  return {update(player,drivers,visible){
   const now=performance.now();if(visible===wasVisible&&visible&&now-last<100)return;last=now;wasVisible=visible;
   const targets=visible?KartRace.relativeDrivers(player,drivers):[],current=new Set(targets.map(t=>t.other));e.hidden=!targets.length;
   for(const [driver,row] of rows)if(!current.has(driver)){row.remove();rows.delete(driver)}
   const words=({de:['Vorn','Hinten','Fahrer'],en:['Ahead','Behind','Driver'],fr:['Devant','Derrière','Pilote']})[document.documentElement.lang]||['Ahead','Behind','Driver'];
   for(const target of targets){
    let row=rows.get(target.other);
    if(!row){row=document.createElement('div');row.className='driver-distance';row.innerHTML='<svg width="25" height="25" viewBox="0 0 40 40" aria-hidden="true"><path d="M20 4 34 31 20 25 6 31Z" fill="currentColor" stroke="#17263b" stroke-width="3" stroke-linejoin="round"/></svg><span></span>';rows.set(target.other,row)}
    const name=target.other.nm||words[2]+' '+(target.index+1),distance=(target.distance<100?target.distance.toFixed(1):Math.round(target.distance))+' m';
    row.dataset.direction=target.ahead?'ahead':'behind';row.querySelector('svg').style.transform='rotate('+target.angle+'rad)';
    row.querySelector('span').textContent=words[target.ahead?0:1]+' '+(target.index+1)+' · '+distance;
    row.setAttribute('aria-label',name+' · '+words[target.ahead?0:1]+' · '+distance);e.append(row);
   }
  },dispose(){rows.clear();e.remove()}};
 }
};

window.KartRaceTelemetry={
 create(config){
  const e=document.createElement('details');e.id='raceTelemetry';e.open=true;e.dataset.noTranslate='';e.innerHTML='<summary></summary><div class="telemetry-values"></div><div class="telemetry-levels"></div>';e.addEventListener('keydown',event=>event.stopPropagation());document.body.append(e);
  const words={de:['Fahrwerte','Aktiv','Serie: Kompetitiv','Serie: Host sperrt Upgrades','Serie: keine Upgrades','Tempo','Max','Limit aktuell','Beschl.','Handling','Lenkreaktion','Stufen aktiv / gekauft'],en:['Race stats','Active','Stock: competitive','Stock: host disabled upgrades','Stock: no upgrades','Speed','Max','Current limit','Accel.','Handling','Steer response','Stages active / owned'],fr:['Valeurs course','Actives','Série : compétition','Série : hôte sans améliorations','Série : aucune amélioration','Vitesse','Max','Limite actuelle','Accél.','Tenue de route','Réactivité','Niveaux actifs / achetés']};
  let last=0;
  return {update(value,visible){
   e.hidden=!visible;if(!visible||performance.now()-last<100)return;last=performance.now();
   const lang=document.documentElement.lang,t=words[lang]||words.en,s=config.stats;
   e.querySelector('summary').textContent=t[0]+' · '+config.id;
   const reason=config.reason==='disabled'?({de:'Upgrades ausgeschaltet',en:'Upgrades switched off',fr:'Améliorations désactivées'}[lang]||'Upgrades switched off'):t[{active:1,host:3,stock:4}[config.reason]];
   e.querySelector('.telemetry-values').textContent=[reason,t[5]+': '+(value.speed*3.6).toFixed(1)+' km/h',t[6]+': '+(s.topSpeed*3.6).toFixed(1)+' km/h',t[7]+': '+(value.maxSpeed*3.6).toFixed(1)+' km/h',t[8]+': '+value.acceleration.toFixed(2)+' m/s²',t[9]+': '+value.handling.toFixed(2)+' m/s²',t[10]+': '+s.steering.toFixed(2)+' /s · '+s.yaw.toFixed(2)+' rad/s'].join('\n');
   e.querySelector('.telemetry-levels').textContent=t[11]+'\n'+Object.keys(KartTuningStats.data.parts).map(part=>(KartTuningStats.data.parts[part].name[lang]||KartTuningStats.data.parts[part].name.en)+': '+(config.upgrades[part]||0)+' / '+(config.stored[part]||0)).join('\n');
  },dispose(){e.remove()}};
 }
};
