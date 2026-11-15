// Shared generated surface atlas. Only requested tiles become GPU textures.
window.KartStyle=(()=>{
 const cache=new Map();let source,trackSource,winterSource;
 const loadWinter=()=>winterSource||(winterSource=new Promise((resolve,reject)=>{const i=new Image(),timer=setTimeout(()=>{i.onload=i.onerror=null;winterSource=null;reject(Error('Winter atlas timeout'))},20000);i.onload=()=>{clearTimeout(timer);resolve(i)};i.onerror=()=>{clearTimeout(timer);winterSource=null;reject(Error('Winter atlas unavailable'))};i.src='assets/materials/stylized/winter-surfaces-v1.webp'}));
 const loadTrack=()=>trackSource||(trackSource=new Promise((resolve,reject)=>{const i=new Image(),timer=setTimeout(()=>{i.onload=i.onerror=null;trackSource=null;reject(Error('Track atlas timeout'))},20000);i.onload=()=>{clearTimeout(timer);resolve(i)};i.onerror=()=>{clearTimeout(timer);trackSource=null;reject(Error('Track atlas unavailable'))};i.src='assets/materials/stylized/track-surfaces-v2.webp'}));
 const load=()=>source||(source=new Promise((resolve,reject)=>{const i=new Image(),timer=setTimeout(()=>{i.onload=i.onerror=null;source=null;reject(Error('Surface atlas timeout'))},20000);i.onload=()=>{clearTimeout(timer);resolve(i)};i.onerror=()=>{clearTimeout(timer);source=null;reject(Error('Surface atlas unavailable'))};i.src='assets/materials/stylized/surfaces-v1.webp'}));
 function texture(tile,repeat=[1,1],neutral=false,facade=false){const key=[tile,...repeat,neutral,facade].join(':');if(cache.has(key))return cache.get(key);
  const winter=tile>=20,track=tile>=16,localTile=winter?tile-20:track?tile-16:tile,grid=track?2:4;
  const task=(winter?loadWinter():track?loadTrack():load()).then(i=>{const c=document.createElement('canvas');c.width=c.height=512;const g=c.getContext('2d'),w=i.width/grid,h=i.height/grid;
   // Mirrored quadrants make edges continuous, including generated tile seams.
   for(let y=0;y<2;y++)for(let x=0;x<2;x++){g.save();g.translate(x?512:0,y?512:0);g.scale(x?-1:1,y?-1:1);g.drawImage(i,(localTile%grid)*w+2,Math.floor(localTile/grid)*h+2,w-4,h-4,0,0,256,256);g.restore()}
   if(neutral&&!track){const p=g.getImageData(0,0,512,512);for(let j=0;j<p.data.length;j+=4){const v=225+(p.data[j]+p.data[j+1]+p.data[j+2])/765*30;p.data[j]=p.data[j+1]=p.data[j+2]=v}g.putImageData(p,0,0)}
   if(tile===17){g.fillStyle='rgba(38,43,47,.16)';g.fillRect(0,0,4,512);g.fillRect(508,0,4,512);g.fillStyle='rgba(255,255,255,.25)';g.fillRect(4,0,4,512);g.fillRect(504,0,4,512)}
   if(facade){g.fillStyle='#eee9da';g.fillRect(0,0,512,16);g.fillRect(0,496,512,16);for(let y=42;y<480;y+=108)for(let x=28;x<490;x+=98){g.fillStyle='#d8d6ca';g.fillRect(x-5,y-5,64,74);g.fillStyle='#71a6c3';g.fillRect(x,y,54,62);g.fillStyle='#304e68';g.fillRect(x,y+4,54,4);g.fillStyle='#e5e9dd';g.fillRect(x+25,y,4,62);g.fillRect(x-7,y+63,68,6)}}
   const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(...repeat);t.anisotropy=QUALITY_PRESETS[PREF.quality].anisotropy;t.userData={sharedSurface:true,stylized:true,tile};return t;
  }).catch(e=>{cache.delete(key);throw e});cache.set(key,task);return task;
 }
 function apply(m,tile=5,repeat=[1,1],neutral=true,facade=false){if(m.userData.stylized)return m;m.userData.stylized=true;let disposed=false;m.addEventListener('dispose',()=>disposed=true);texture(tile,repeat,neutral,facade).then(t=>{if(disposed)return;m.map=t;m.normalMap=m.roughnessMap=m.bumpMap=null;m.needsUpdate=true}).catch(()=>{m.userData.stylized=false});return m}
 function environment(root){root.traverse(o=>{if(!o.isMesh||o.userData.legacyScenery)return;for(const m of [].concat(o.material)){if(!m.isMeshStandardMaterial||m.userData.surface||m.map||m.userData.art||m.userData.authoredScenery||m.transparent)continue;apply(m)}})}
 function uv(geometry){if(geometry.attributes.uv)return;const p=geometry.attributes.position,n=geometry.attributes.normal,a=[];for(let i=0;i<p.count;i++){const x=Math.abs(n.getX(i)),y=Math.abs(n.getY(i)),z=Math.abs(n.getZ(i));a.push((x>y&&x>z?p.getZ(i):p.getX(i))*1.5,(y>x&&y>z?p.getZ(i):p.getY(i))*1.5)}geometry.setAttribute('uv',new THREE.Float32BufferAttribute(a,2))}
 return {texture,apply,environment,uv,prepare:(winter=false)=>Promise.all([load(),loadTrack(),...(winter?[loadWinter()]:[])])};
})();
