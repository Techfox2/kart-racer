// Shared loader: retry downloads, never re-execute a script after an execution failure.
window.KartAssets=(()=>{
 const scripts=new Map();
 const wait=ms=>new Promise(r=>setTimeout(r,ms));
 const versioned=path=>{const hash=window.KART_BUILD?.versions?.[path];return hash?path+'?v='+hash:path};
 async function download(path){
  for(let attempt=0;attempt<3;attempt++){
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
   try{const response=await fetch(versioned(path),{credentials:'same-origin',signal:controller.signal});
    if(!response.ok){const error=new Error('HTTP '+response.status+' '+path);error.permanent=![408,429,500,502,503,504].includes(response.status);throw error}
    return await response.text();
   }catch(error){if(error.permanent||attempt===2)throw error;await wait(350*2**attempt)}finally{clearTimeout(timer)}
  }
 }
 const downloads=new Map();
 function text(path){if(!downloads.has(path))downloads.set(path,download(path).catch(e=>{downloads.delete(path);throw e}));return downloads.get(path)}
 function script(path){
  if(scripts.has(path))return scripts.get(path);
  const pending=text(path).then(source=>{
   let failure;const capture=e=>{failure=e.error||new Error(e.message)};
   addEventListener('error',capture);const tag=document.createElement('script');tag.textContent=source+'\n//# sourceURL='+new URL(versioned(path),location.href).href;
   try{document.head.append(tag)}finally{removeEventListener('error',capture);tag.remove()}
   if(failure){failure.executed=true;throw failure}
  }).catch(error=>{if(!error.executed)scripts.delete(path);throw error});
  scripts.set(path,pending);return pending;
 }
 return {script,text,versioned};
})();

;﻿// Boot order preserves the original global bindings and source order.
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
