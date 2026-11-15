// Boot order preserves the original global bindings and source order.
(async()=>{
 const overlay=document.getElementById('bootStatus'),label=document.getElementById('bootMessage'),button=document.getElementById('bootRetry');
 const language=()=>{try{return window.KART_ACCOUNT?.state?.['kart-language']||document.documentElement.lang}catch{return document.documentElement.lang}};
 const words={de:['Spiel wird geladen …','Laden fehlgeschlagen. Bitte erneut versuchen.','Erneut versuchen'],en:['Loading game …','Loading failed. Please try again.','Try again'],fr:['Chargement du jeu …','Échec du chargement. Réessaie.','Réessayer']};
 const w=words[language()]||words.de;label.textContent=w[0];button.textContent=w[2];
 let index=0,running=false,reload=false,stylesReady=false;
 async function start(){if(running)return;if(reload){location.reload();return}running=true;button.hidden=true;label.textContent=w[0];
  try{
   await Promise.all([...KART_BUILD.scripts.slice(index).map(path=>KartAssets.text(path)),...[...document.querySelectorAll('link[data-boot-style]')].map(async link=>{const css=await KartAssets.text(link.getAttribute('href'));const style=document.createElement('style');style.textContent=css;document.head.append(style);link.remove()})]);stylesReady=true;
   for(;index<KART_BUILD.scripts.length;index++){
    await KartAssets.script(KART_BUILD.scripts[index]);
    if(index===1&&window.KartSeason){const preload=document.createElement('link');preload.rel='preload';preload.as='image';preload.crossOrigin='anonymous';preload.href=KartSeason.background('singleplayer');document.head.append(preload)}
   }
   document.documentElement.classList.remove('booting');overlay.remove();dispatchEvent(new Event('kart-ready'));
  }catch(e){reload=!!e.executed;label.textContent=w[1];button.hidden=false;console.warn('Game startup failed',e.message)}finally{running=false}
 }
 button.onclick=start;await start();
})();
