// Stylized materials shared by all graphics levels. Original sources remain available.
const artMaterials=new Set(),artTextureCache=new Map();
function restyleKartPaint(m,color){
  const c=m.userData.art.modern.image,ctx=c.getContext('2d');
  ctx.fillStyle='#'+new THREE.Color(color).getHexString();ctx.fillRect(0,0,1024,1024);
  ctx.fillStyle='#f4eed8';ctx.beginPath();ctx.moveTo(160,0);ctx.lineTo(330,0);ctx.lineTo(840,1024);ctx.lineTo(670,1024);ctx.fill();
  ctx.fillStyle='#142c42';ctx.beginPath();ctx.moveTo(355,0);ctx.lineTo(400,0);ctx.lineTo(910,1024);ctx.lineTo(865,1024);ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,.16)';ctx.lineWidth=2;for(let x=0;x<1024;x+=12){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,1024);ctx.stroke()}
  m.userData.art.newRoughness=.35;m.userData.art.modern.needsUpdate=true;refreshArt(m);
}
function upgradeArt(root){
  root.traverse(o=>{
    if(o.userData.driverVariants){o.userData.driverVariants[0].visible=false;o.userData.driverVariants[1].visible=true}
    if(!o.isMesh||!o.material)return;
    for(const m of [].concat(o.material)){
      if(!m.isMeshStandardMaterial&&!m.isMeshBasicMaterial)return;
      const kind=m.metalness>.35?'metal':m.roughness>.85?'matte':'paint';
      detailMaterial(m,kind);if(m.userData.art)refreshArt(m);
    }
  });
}
function refreshArt(m){
  const a=m.userData.art;if(!a)return;
  m.map=a.modern;
  m.roughness=a.newRoughness;
  if(KartSeason.skin(m.userData.livery)==='christmas')christmasPaint().then(t=>{if(artMaterials.has(m)&&KartSeason.skin(m.userData.livery)==='christmas'){m.map=t;m.roughness=.36;m.needsUpdate=true}}).catch(()=>{});
  m.needsUpdate=true;
}
let christmasTexture;
function christmasPaint(){return christmasTexture||(christmasTexture=new Promise((resolve,reject)=>new THREE.TextureLoader().load('assets/vehicles/liveries/christmas-sleigh-v2.webp',t=>{t.encoding=THREE.sRGBEncoding;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.userData={sharedSurface:true,christmas:true};resolve(t)},undefined,e=>{christmasTexture=null;reject(e)})))}
function detailMaterial(m,kind='paint'){
  if(m.userData.stylized||m.userData.authoredScenery||m.userData.art||m.userData.surface||!m.color)return;
  const key=(m.map?.uuid||'plain')+':'+kind,cached=artTextureCache.get(key);
  if(cached){attachArt(m,cached,kind);return}
  const original=m.map,c=document.createElement('canvas');c.width=c.height=1024;const ctx=c.getContext('2d');
  ctx.fillStyle='#ffffff';ctx.fillRect(0,0,1024,1024);
  if(original?.image){try{ctx.drawImage(original.image,0,0,1024,1024)}catch(e){}}
  else {const gr=ctx.createLinearGradient(0,0,1024,1024);gr.addColorStop(0,'#ffffff');gr.addColorStop(.45,'#e5e8ed');gr.addColorStop(1,'#fafbff');ctx.fillStyle=gr;ctx.fillRect(0,0,1024,1024)}
  let seed=17;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return(seed>>>0)/4294967296};
  for(let i=0;i<14000;i++){ctx.fillStyle=rnd()>.5?'rgba(255,255,255,.045)':'rgba(0,0,0,.035)';ctx.fillRect(rnd()*1024,rnd()*1024,kind==='metal'?12:2,1)}
  if(kind==='fabric'){ctx.strokeStyle='rgba(15,25,40,.12)';ctx.lineWidth=1;for(let i=0;i<1024;i+=6){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,1024);ctx.moveTo(0,i);ctx.lineTo(1024,i);ctx.stroke()}}
  if(kind==='rubber'){ctx.strokeStyle='rgba(0,0,0,.2)';ctx.lineWidth=5;for(let i=-1024;i<2048;i+=40){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i+512,1024);ctx.stroke()}}
  const modern=new THREE.CanvasTexture(c);modern.encoding=THREE.sRGBEncoding;modern.wrapS=modern.wrapT=THREE.RepeatWrapping;modern.userData={sharedSurface:true};
  if(original){modern.repeat.copy(original.repeat);modern.offset.copy(original.offset);modern.rotation=original.rotation}
  artTextureCache.set(key,modern);attachArt(m,modern,kind);
}
function attachArt(m,modern,kind){m.userData.art={original:m.map,modern,roughness:m.roughness,newRoughness:kind==='metal'?.4:kind==='fabric'?.88:kind==='rubber'?.94:.65};artMaterials.add(m);m.addEventListener('dispose',()=>{artMaterials.delete(m)});refreshArt(m)}
function modernDriver(color){if(window.KartModels)return KartModels.driver(color);
  const group=new THREE.Group();group.name='Modern racer';
  const suit=new THREE.MeshStandardMaterial({color,roughness:.8}),ivory=new THREE.MeshStandardMaterial({color:0xf5f1dc,roughness:.65}),dark=new THREE.MeshStandardMaterial({color:0x18283a,roughness:.8}),visor=new THREE.MeshStandardMaterial({color:0x193c54,metalness:.45,roughness:.22}),gold=new THREE.MeshStandardMaterial({color:0xffcb32,roughness:.5});
  detailMaterial(suit,'fabric');detailMaterial(dark,'fabric');detailMaterial(ivory);detailMaterial(gold,'metal');
  function ell(x,y,z,sx,sy,sz,m){const mesh=new THREE.Mesh(new THREE.SphereGeometry(1,24,16),m);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);mesh.castShadow=true;group.add(mesh);return mesh}
  function limb(a,b,r,m){const A=new THREE.Vector3(...a),B=new THREE.Vector3(...b),mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r*1.05,A.distanceTo(B),12),m);mesh.position.copy(A).add(B).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),B.sub(A).normalize());mesh.castShadow=true;group.add(mesh)}
  ell(0,.86,-.37,.29,.34,.22,suit);ell(0,.92,-.17,.22,.23,.045,ivory);
  limb([0,.72,-.12],[0,1.11,-.12],.018,dark);
  for(const side of [-1,1]){
    ell(side*.26,1.03,-.32,.14,.16,.15,suit);
    limb([side*.26,1.04,-.28],[side*.36,.86,-.01],.085,suit);
    limb([side*.36,.86,-.01],[side*.19,1,.16],.077,ivory);
    ell(side*.19,1,.16,.09,.075,.095,dark);
    limb([side*.13,.67,-.36],[side*.18,.48,.15],.105,suit);
    ell(side*.18,.4,.35,.12,.095,.22,dark);
    limb([side*.21,.97,-.108],[side*.21,.78,-.108],.025,gold);
  }
  ell(0,1.22,-.34,.12,.09,.12,dark);
  ell(0,1.49,-.32,.33,.35,.32,ivory);
  ell(0,1.51,-.04,.285,.16,.085,dark);
  ell(0,1.525,.015,.25,.115,.03,visor);
  ell(0,1.30,-.045,.26,.075,.085,ivory);
  ell(0,1.79,-.32,.055,.045,.21,gold);
  for(const side of [-1,1])ell(side*.325,1.48,-.29,.025,.06,.06,gold);
  return group;
}
const lobbyArt={textures:{},pending:{},retryAfter:{},placeholder:new THREE.Color(0x243342)};
function drawLobbyArt(r,scene,camera){
  const multi=!!podiumStage,kind=multi?'multiplayer':'singleplayer',path=KartSeason.background(kind),id=kind+(KartSeason.active()?'-christmas':'');
  if(!lobbyArt.textures[id]&&!lobbyArt.pending[id]&&Date.now()>=(lobbyArt.retryAfter[id]||0)){
    lobbyArt.pending[id]=true;
    new THREE.TextureLoader().load(path,t=>{t.encoding=THREE.sRGBEncoding;lobbyArt.textures[id]=t;delete lobbyArt.pending[id]},undefined,()=>{delete lobbyArt.pending[id];lobbyArt.retryAfter[id]=Date.now()+5000});
  }
  const texture=lobbyArt.textures[id];
  if(texture?.image){const aspect=texture.image.width/texture.image.height,view=camera.aspect;
    texture.repeat.set(view<aspect?view/aspect:1,view>aspect?aspect/view:1);texture.offset.set((1-texture.repeat.x)/2,(1-texture.repeat.y)/2);
  }
  if(!scene.userData.artStage){
    const stage=new THREE.Group();stage.add(new THREE.HemisphereLight(0xe6f3ff,0x535365,1.1));
    const key=new THREE.DirectionalLight(0xfff1db,1.2);key.position.set(-8,14,8);key.castShadow=true;key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-25,right:25,top:30,bottom:-25});stage.add(key);
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(90,90),new THREE.ShadowMaterial({opacity:.2}));floor.rotation.x=-Math.PI/2;floor.position.y=.49;floor.receiveShadow=true;stage.add(floor);stage.visible=false;scene.add(stage);scene.userData.artStage=stage;
  }
  const old=scene.children.map(o=>[o,o.visible]),bg=scene.background,fog=scene.fog;
  for(const [o] of old)o.visible=o===SR.kart||o===scene.userData.artStage||(multi&&[...podiumStage.karts.values()].includes(o));
  scene.background=texture||lobbyArt.placeholder;scene.fog=null;
  try{r.render(scene,camera)}finally{for(const [o,v] of old)o.visible=v;scene.background=bg;scene.fog=fog}
  return true;
}

function pruneArtTextures(){
 const used=new Set([...artMaterials].map(m=>m.userData.art?.modern));
 for(const [key,texture] of artTextureCache)if(!used.has(texture)){artTextureCache.delete(key);texture.dispose()}
}
