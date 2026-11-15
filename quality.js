// Quality presets and locally bundled CC0 ambientCG materials.
const QUALITY_PRESETS={low:{scale:.65,shadow:512,anisotropy:1},medium:{scale:1,shadow:1024,anisotropy:4},high:{scale:1.6,shadow:4096,anisotropy:16}};
const surfaceMaterials=new Set(),surfaceTextures=new Map();
function materialTexture(id,tier,role,repeat,road=false,neutral=false){
 const tile={WinterRoad:20,WinterSnow:21,WinterFir:22,WinterTrail:23,Asphalt012:16,PaintedCurb:18,Grass001:19,Concrete034:2,Snow001:11,Metal012:5}[id]??5;
 return KartStyle.texture(tile,repeat,neutral||id==='Metal012');
}
function pbr(material,id,repeat=[1,1],options={}){
  material.userData.surface={id,repeat,options,original:{map:material.map,normalMap:material.normalMap,roughnessMap:material.roughnessMap,bumpMap:material.bumpMap,color:material.color.clone(),roughness:material.roughness},revision:0};
  surfaceMaterials.add(material);
  material.addEventListener('dispose',()=>{surfaceMaterials.delete(material);material.userData.surface.disposed=true});
  updateSurface(material);return material;
}
function updateSurface(material){
  const s=material.userData.surface,tier=PREF.quality,revision=++s.revision;
  const roles=['Color'];
  Promise.all(roles.map(role=>materialTexture(s.id,tier,role,s.options.road&&role!=='Color'?[4,8]:s.repeat,s.options.road,material.vertexColors))).then(maps=>{
    if(s.disposed||revision!==s.revision)return;
    material.map=s.options.keepColor?s.original.map:maps[0];
    material.normalMap=maps[1]||null;material.roughnessMap=maps[2]||null;material.bumpMap=null;
    material.normalScale.setScalar(s.options.normal??.3);
    material.color.set(s.options.tint??(s.id==='Asphalt012'?0x626d82:s.id==='Grass001'?0x849577:s.id==='Metal012'||s.options.keepColor?s.original.color:0xffffff));
    material.roughness=s.options.roughness??s.original.roughness;material.needsUpdate=true;
  }).catch(error=>console.warn('Material fallback:',s.id,error));
}
function applyQuality(r){
  const preset=QUALITY_PRESETS[PREF.quality];
  // Supersampling differs even on a display with devicePixelRatio = 1.
  const size=r.getSize(new THREE.Vector2()),w=size.x||innerWidth,h=size.y||innerHeight;
  const ratio=Math.min(Math.max(1,devicePixelRatio)*preset.scale,2.5,Math.sqrt(12000000/(w*h)));
  if(r.getPixelRatio()!==ratio)r.setPixelRatio(ratio);
  r.shadowMap.enabled=PREF.shadows;r.shadowMap.type=PREF.quality==='low'?THREE.BasicShadowMap:THREE.PCFSoftShadowMap;
  r.shadowMap.needsUpdate=true;r.toneMappingExposure=PREF.brightness;
  if(r._kartScene)r._kartScene.traverse(o=>{
    if(o.isLight&&o.shadow){const n=Math.min(preset.shadow,r.capabilities.maxTextureSize);if(o.shadow.mapSize.x!==n){o.shadow.map?.dispose();o.shadow.map=null;o.shadow.mapSize.set(n,n)}o.shadow.normalBias=.025}
    if(o.material)for(const m of [].concat(o.material)){
      for(const key of ['map','normalMap','roughnessMap','bumpMap'])if(m[key]){const a=Math.min(preset.anisotropy,r.capabilities.getMaxAnisotropy());if(m[key].anisotropy!==a){m[key].anisotropy=a;m[key].needsUpdate=true}}
      if(m.isMeshStandardMaterial){m.envMap=PREF.quality==='high'?r._studioEnv?.texture||null:null;m.envMapIntensity=.35;m.needsUpdate=true}
    }
  });
}
function qualityRender(r,scene,camera){
  r._kartScene=scene;
  const key=[PREF.quality,PREF.shadows,PREF.brightness].join(':');
  if(r._qualityKey!==key){
    if(PREF.quality==='high'&&!r._studioEnv){
      const room=new THREE.Scene();room.background=new THREE.Color(0x9badc0);
      const shapes=[];
      for(const [x,y,z,w,h,d,color] of [[0,12,0,30,.2,30,0xe8f1ff],[-12,5,0,.2,6,18,0xffffff],[12,3,0,.2,4,18,0x6d8ba6],[0,-3,0,30,.2,30,0x25313a]]){
        const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshBasicMaterial({color}));mesh.position.set(x,y,z);room.add(mesh);shapes.push(mesh);
      }
      const pmrem=new THREE.PMREMGenerator(r);r._studioEnv=pmrem.fromScene(room,.04);pmrem.dispose();for(const m of shapes){m.geometry.dispose();m.material.dispose()}
    }
    if(typeof SR!=='undefined'&&scene===SR.scene){if(SR.kart)upgradeArt(SR.kart);if(podiumStage)for(const kart of podiumStage.karts.values())upgradeArt(kart)}
    else {upgradeArt(scene);updateTrackScenery(scene)}
    applyQuality(r);r._qualityKey=key;
  }
  if(typeof SR!=='undefined'&&scene===SR.scene&&drawLobbyArt(r,scene,camera))return;
  if(PREF.quality==='high'&&PREF.experimentalShaders&&scene===window.kartRaceScene){
    if(window.KartExperimental){KartExperimental.render(r,scene,camera);return}
    if(!r._experimentalLoading){r._experimentalLoading=true;KartAssets.script('experimental-shaders.js').then(()=>r._experimentalLoading=false).catch(()=>{r._experimentalLoading=false})}
  }else if(r._kartExperimental)KartExperimental.dispose(r);
  r.render(scene,camera);
}
function disposeQuality(r){window.KartExperimental?.dispose(r);r._studioEnv?.dispose();r._studioEnv=null;r._kartScene=null}
function releaseSurfaceMaterials(root){
  const shared=new Set([wRub,wChr,wAcc,wWood,wMark]);
  root.traverse(o=>{if(o.material)for(const m of [].concat(o.material))if(!shared.has(m)&&(m.userData.art||(m.userData.surface&&!m.userData.surface.disposed)))m.dispose()});
}

function disposeRaceScene(scene){
 if(window.kartRaceScene===scene)window.kartRaceScene=null;
 const protectedMaterials=new Set([wRub,wChr,wAcc,wWood,wMark]),protectedTextures=new Set([radT,tireSide,tireCap]);
 const geometries=new Set(),materials=new Set(),textures=new Set();
 scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)for(const m of [].concat(o.material))if(!protectedMaterials.has(m))materials.add(m);if(o.isLight&&o.shadow)o.shadow.dispose()});
 if(scene.background?.isTexture)textures.add(scene.background);
 for(const m of materials){if(m.userData.art?.original&&!m.userData.art.original.userData?.sharedSurface)textures.add(m.userData.art.original);for(const k of ['map','normalMap','roughnessMap','bumpMap'])if(m[k]&&!m[k].userData?.sharedSurface)textures.add(m[k]);m.dispose()}
 for(const g of geometries)g.dispose();for(const t of textures)if(!protectedTextures.has(t))t.dispose();scene.clear();pruneArtTextures();
}
