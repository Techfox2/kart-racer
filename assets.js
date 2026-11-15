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
