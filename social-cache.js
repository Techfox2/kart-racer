// Share only short-lived read results; writes always keep their original server checks.
window.KartSocial=(()=>{
 let value,time=0,pending,generation=0;
 function invalidate(){generation++;value=null;time=0;pending=null}
 function get(){if(value&&Date.now()-time<2000)return Promise.resolve(value);if(pending)return pending;
  const revision=generation;const request=KartAccount.request('/api/social').then(data=>{if(generation===revision){value=data;time=Date.now()}return data}).finally(()=>{if(pending===request)pending=null});pending=request;return request;
 }
 return {get,invalidate};
})();
