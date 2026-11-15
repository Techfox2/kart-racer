/* Shared, transient clipboard feedback for every copy control. */
(()=>{'use strict';
 const words={de:{copied:'Kopiert.',failed:'Kopieren fehlgeschlagen.'},en:{copied:'Copied.',failed:'Could not copy.'},fr:{copied:'Copié.',failed:'Copie impossible.'}};
 let toast,timer,closeTimer,frame;
 function notify(ok){
  if(!toast){toast=document.createElement('div');toast.id='copyToast';toast.className='kr-copy-toast';toast.dataset.noTranslate='';toast.setAttribute('role','status');toast.setAttribute('aria-live','polite');toast.setAttribute('aria-atomic','true');toast.setAttribute('popover','manual');document.body.append(toast)}
  clearTimeout(timer);clearTimeout(closeTimer);cancelAnimationFrame(frame);
  const text=words[document.documentElement.lang]||words.de;
  toast.textContent=text[ok?'copied':'failed'];
  if(typeof toast.showPopover==='function'&&!toast.matches(':popover-open'))toast.showPopover();
  frame=requestAnimationFrame(()=>toast.classList.add('is-visible'));
  timer=setTimeout(()=>{toast.classList.remove('is-visible');closeTimer=setTimeout(()=>{if(typeof toast.hidePopover==='function'&&toast.matches(':popover-open'))toast.hidePopover();toast.textContent=''},200)},1800);
 }
 window.KartClipboard={async copy(value){try{await navigator.clipboard.writeText(String(value));notify(true);return true}catch{notify(false);return false}}};
})();
