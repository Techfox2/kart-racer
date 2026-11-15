// Optional consoles load only when settings are opened. Server permissions remain authoritative.
(()=>{
 let pending;
 const panel=document.getElementById('panel');
 function loadConsoles(){if(!window.KartAccount||pending)return;pending=KartAssets.script('admin.js').then(()=>KartAssets.script('developer.js')).catch(()=>{pending=null});}
 new MutationObserver(()=>{if(panel.classList.contains('on'))loadConsoles()}).observe(panel,{attributes:true,attributeFilter:['class']});
 if(panel.classList.contains('on'))loadConsoles();
 const times=document.querySelector('[data-open=times]');
 let rankingPending;
 function rankings(){return rankingPending||(rankingPending=KartAssets.script('rankings.js').catch(e=>{rankingPending=null;throw e}))}
 times.onclick=async()=>{times.disabled=true;try{await rankings();times.disabled=false;times.click()}catch{const words={de:'Laden fehlgeschlagen. Bitte erneut versuchen.',en:'Loading failed. Please try again.',fr:'Échec du chargement. Réessaie.'};flash(words[document.documentElement.lang]||words.de)}finally{times.disabled=false}};
 // Load before replaying the first reward, so lazy loading never hides a record bonus.
 addEventListener('kart-record-reward',async e=>{if(document.getElementById('rankingsDialog'))return;try{await rankings();dispatchEvent(new CustomEvent('kart-record-reward',{detail:e.detail}))}catch{}},{once:true});
})();

(()=>{const link=document.createElement('link');link.rel='stylesheet';link.href='https://fonts.googleapis.com/css2?family=Lilita+One&family=Nunito:wght@700;800;900&display=swap';document.head.append(link)})();
