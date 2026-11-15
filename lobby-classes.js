(function(root){'use strict';
 const valid=c=>c==='kart'||c==='gt3',accepts=(policy,category)=>valid(category)&&(policy.mixedClasses===true||category===policy.category);
 const allReady=(policy,players)=>players.every(p=>accepts(policy,p.presence.driverClass));
 const words={de:{mixed:'Gemischt',allow:'Gemischte Klassen erlauben',car:'Deine Fahrzeugklasse',policy:'Fahrzeugklasse',kart:'Diese Lobby erlaubt nur Karts.',gt3:'Diese Lobby erlaubt nur GT3.',blocked:'Klasse wechseln: Rennen wartet auf passende Fahrzeuge.'},en:{mixed:'Mixed',allow:'Allow mixed classes',car:'Your vehicle class',policy:'Vehicle class',kart:'This lobby only allows karts.',gt3:'This lobby only allows GT3.',blocked:'Change class: the race is waiting for matching vehicles.'},fr:{mixed:'Mixte',allow:'Autoriser les classes mixtes',car:'Ta classe de véhicule',policy:'Classe de véhicule',kart:'Ce salon accepte uniquement les karts.',gt3:'Ce salon accepte uniquement les GT3.',blocked:'Change de classe : la course attend des véhicules autorisés.'}};
 const text=()=>words[typeof document==='undefined'?'en':document.documentElement.lang]||words.en;
 const message=category=>text()[category]||text().blocked;
 function render(session){
  const players=session.room.peers(),policy=players.find(p=>p.presence.host===1)?.presence,me=players.find(p=>p.isMe)?.presence;if(!policy||!me)return;
  const t=text(),select=document.getElementById('rClass'),mixed=document.getElementById('rMixed'),driver=document.getElementById('rDriverClass');
  document.querySelector('[for=rClass]').textContent=t.policy;document.querySelector('[for=rDriverClass]').textContent=t.car;document.querySelector('#rMixedLabel span').textContent=t.allow;
  select.value=policy.category;select.disabled=!session.host||!!policy.go;mixed.checked=policy.mixedClasses===true;mixed.disabled=!session.host||!!policy.go;
  driver.value=me.driverClass;driver.disabled=!!policy.go;for(const option of driver.options)option.disabled=!accepts(policy,option.value);
  const notice=document.getElementById('rClassNotice');notice.hidden=allReady(policy,players);notice.textContent=accepts(policy,me.driverClass)?t.blocked:message(policy.category);
  const changePolicy=async()=>{try{await session.room.presence({category:select.value,mixedClasses:mixed.checked})}catch(error){notice.hidden=false;notice.textContent=error.message}finally{render(session)}};
  select.onchange=mixed.onchange=changePolicy;
  driver.onchange=async()=>{const category=driver.value;try{await session.room.setVehicleClass(category);SAVE.category=category;persist();await window.KartAccount?.flush();showroomKart()}catch(error){notice.hidden=false;notice.textContent=error.message}finally{render(session)}};
 }
 const api={valid,accepts,allReady,message,render};if(typeof module!=='undefined')module.exports=api;else root.KartLobbyClasses=api;
})(typeof window!=='undefined'?window:globalThis);
