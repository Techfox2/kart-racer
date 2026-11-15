window.KartAmbient=(()=>{
 const themes=[
  {id:'default',level:1,price:0,n:['Original','Original','Original'],colors:['#171329','#241d40','#332a5c','#c9c2e8','#0e0b1f','#8c42f5']},
  {id:'ocean',level:5,price:3000,n:['Ozean','Ocean','Océan'],colors:['#0b1b35','#123350','#1b5074','#c3e4f7','#071323','#1685ce']},
  {id:'forest',level:10,price:6000,n:['Wald','Forest','Forêt'],colors:['#10251f','#1b3a2e','#2d5941','#d2edce','#091811','#3b9764']},
  {id:'sunset',level:20,price:12000,n:['Sonnenuntergang','Sunset','Coucher de soleil'],colors:['#301923','#4a2931','#75403b','#f6ddca','#1d111a','#b94e4c']},
  {id:'midnight',level:30,price:20000,n:['Mitternacht','Midnight','Minuit'],colors:['#121a22','#222f3a','#364651','#d6e5eb','#090f15','#347c8f']}
 ];
 const idx=()=>({de:0,en:1,fr:2}[document.documentElement.lang]??0),words={equip:['Ausrüsten','Equip','Équiper'],equipped:['Ausgerüstet','Equipped','Équipé'],level:['Ab Level','From level','Dès le niveau'],coins:['Zu wenig Münzen','Not enough coins','Pas assez de pièces'],locked:['Level noch nicht erreicht','Level not reached','Niveau insuffisant'],failed:['Kauf fehlgeschlagen. Bitte erneut versuchen.','Purchase failed. Please try again.','Achat échoué. Réessaie.'],conflict:['Bitte lade die Seite neu.','Please reload the page.','Recharge la page.']};const word=k=>words[k][idx()];
 function normalize(s){s.ownedAmbient=[...new Set(['default',...(Array.isArray(s.ownedAmbient)?s.ownedAmbient:[]).filter(id=>themes.some(t=>t.id===id))])];if(!s.ownedAmbient.includes(s.ambient))s.ambient='default';return s}
 function apply(s){normalize(s);const t=themes.find(t=>t.id===s.ambient)||themes[0];['--navy','--navy-2','--navy-3','--ink-soft','--bg','--ambient-accent'].forEach((k,i)=>document.documentElement.style.setProperty(k,t.colors[i]));document.documentElement.dataset.ambient=t.id}
 function cards(s){const lv=Math.floor(s.xp/250)+1;return '<div class="vehicle-grid ambient-grid" data-no-translate>'+themes.map(t=>{const own=s.ownedAmbient.includes(t.id),selected=s.ambient===t.id,locked=lv<t.level;return '<button type="button" class="card-btn ambient-card" data-ambient="'+t.id+'" aria-pressed="'+selected+'"'+(!own&&(locked||s.coins<t.price)?' disabled':'')+'><span class="ambient-sample" style="background:'+t.colors[1]+';border-color:'+t.colors[0]+'"><i style="background:'+t.colors[2]+'"></i><i style="background:'+t.colors[5]+'"></i><i style="background:'+t.colors[2]+'"></i></span><b>'+t.n[idx()]+'</b><small>'+(selected?word('equipped'):own?word('equip'):word('level')+' '+t.level+' · '+t.price.toLocaleString(document.documentElement.lang)+' 🪙')+'</small></button>'}).join('')+'</div>'}
 async function choose(id){const t=themes.find(t=>t.id===id);if(!t||vehiclePurchasePending)return;vehiclePurchasePending=true;const inert=document.getElementById('menu').inert;document.getElementById('menu').inert=true;document.getElementById('sheetClose').disabled=true;
  try{if(!SAVE.ownedAmbient.includes(id)){if(window.KartAccount)await KartAccount.buyCosmetic('ambient',id);else{if(Math.floor(SAVE.xp/250)+1<t.level)throw {code:'level'};if(SAVE.coins<t.price)throw {code:'coins'};SAVE.coins-=t.price;SAVE.ownedAmbient.push(id)}}SAVE.ambient=id;persist();apply(SAVE);renderLobby();if(window.KartAccount)await KartAccount.flush()}
  catch(e){flash(word(e.code==='coins'?'coins':e.code==='level'?'locked':e.code==='conflict'?'conflict':'failed'),'var(--red)')}
  finally{vehiclePurchasePending=false;document.getElementById('menu').inert=inert;document.getElementById('sheetClose').disabled=false}
 }
 return {themes,normalize,apply,cards,choose};
})();
