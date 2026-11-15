// Kenney CC0 models, loaded on demand for races at every quality level.
function createTrackScenery(scene,points,settings){
 scene.userData.sceneryRequest={points,settings,loading:false,ready:false};ensureTrackScenery(scene);
}
function ensureTrackScenery(scene){
 const request=scene.userData.sceneryRequest;
 if(!request||request.disposed||request.loading||request.ready)return;
 request.loading=true;
 KartAssets.script('assets/scenery/models.js').then(()=>{request.loading=false;if(request.disposed)return;KartWorld.models();buildTrackScenery(scene,request.points,request.settings);KartWorld.decorate(scene,request.points,request.settings);request.ready=true;updateTrackScenery(scene)}).catch(()=>{request.loading=false});
}
function buildTrackScenery(scene,points,settings){
  const root=new THREE.Group();root.name='Kenney track scenery';root.userData.modernScenery=true;
  const batches=new Map(),placed=[];let state=settings.seed>>>0;
  const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296};
  function trackDistance(x,z){
    let best=Infinity;
    for(let i=0;i<points.length;i++){
      const a=points[i],b=points[(i+1)%points.length],dx=b.x-a.x,dz=b.z-a.z;
      const t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz||1)));
      best=Math.min(best,Math.hypot(x-a.x-t*dx,z-a.z-t*dz));
    }
    return best;
  }
  function place(id,index,side,height,extra=0){
    const source=window.KART_SCENERY_MODELS[id];if(!source)return;
    const radius=source.radius*height,a=points[index%points.length],b=points[(index+2)%points.length];
    const dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz)||1,nx=side*dz/length,nz=-side*dx/length;
    const distance=(settings.indoor?settings.width/2+.15:settings.border+9)+radius+extra;
    const x=a.x+nx*distance,z=a.z+nz*distance;
    const clearance=settings.indoor?settings.width/2+.1:settings.border+5;
    if(trackDistance(x,z)<clearance+radius)return;
    if(placed.some(o=>Math.hypot(x-o.x,z-o.z)<radius+o.radius+2))return;
    const y=settings.indoor?a.y:settings.height(x,z),heights=[[radius,0],[-radius,0],[0,radius],[0,-radius]].map(([ox,oz])=>settings.indoor?a.y:settings.height(x+ox,z+oz));
    if(Math.max(...heights,y)-Math.min(...heights,y)>Math.max(.8,height*.16))return;
    const transform=new THREE.Object3D();transform.position.set(x,Math.min(y,...heights)-.06,z);transform.rotation.y=Math.atan2(nx,nz);transform.scale.setScalar(height);transform.updateMatrix();
    if(!batches.has(id))batches.set(id,[]);batches.get(id).push(transform.matrix.clone());placed.push({id,x,z,radius,clearance});
  }
  const n=points.length,spacing=Math.max(1,Math.floor(n/80));
  if(!settings.indoor){
    for(const f of [.22,.46,.7,.9])place('tent',Math.floor(n*f),-1,3.5,1);
    for(const f of [.015,.035,.065])place('pylon',Math.floor(n*f),-1,1.1,0);
    const trees=settings.snow?['tree_pineRoundA','tree_pineTallA']:settings.city?['tree_default','plant_bushDetailed']:['tree_oak','tree_default','tree_pineRoundA'];
    for(let i=0;i<80;i++)for(const side of [-1,1]){
      const index=(i*spacing+Math.floor(random()*spacing))%n;
      const tree=trees[Math.floor(random()*trees.length)];place(tree,index,side,tree.startsWith('plant')?2:5+random()*4,10+random()*28);
      if(i%2===0)place(i%4===0?(i%8===0?'rock_largeA':'rock_largeC'):'plant_bushDetailed',(index+Math.floor(spacing*.45))%n,side,1.2+random()*1.8,3+random()*6);
    }

  }
  // Roadside floodlights removed; authored sources remain available for rollback.
  for(const [id,transforms] of batches){
    const source=window.KART_SCENERY_MODELS[id],geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(source.p,3));
    const colors=[];
    for(let i=0;i<source.c.length;i+=3){const c=new THREE.Color().setRGB(source.c[i],source.c[i+1],source.c[i+2]);if(settings.snow&&id.startsWith('tree')&&c.g>c.r*1.2)c.setRGB(.77,.87,.89);c.convertSRGBToLinear();colors.push(c.r,c.g,c.b)}
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.computeVertexNormals();geometry.computeBoundingSphere();
    const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.9,flatShading:true});material.userData.authoredScenery=true;KartStyle.uv(geometry);
    const mesh=new THREE.InstancedMesh(geometry,material,transforms.length);transforms.forEach((m,i)=>{mesh.setMatrixAt(i,m);const tint=new THREE.Color().setScalar(.88+(i%5)*.03);mesh.setColorAt(i,tint)});mesh.castShadow=mesh.receiveShadow=true;mesh.frustumCulled=false;mesh.name=id;root.add(mesh);
  }
  if(settings.winter)KartWinter.trees(root,batches);
  root.userData.placements=placed;root.visible=true;scene.add(root);return root;
}
function updateTrackScenery(scene){ensureTrackScenery(scene);updateHighGrass(scene);scene.traverse(o=>{
  if(o.userData.modernScenery)o.visible=true;
  if(o.userData.legacyScenery)o.visible=false;
})}
function disposeTrackScenery(scene){if(scene.userData.sceneryRequest)scene.userData.sceneryRequest.disposed=true}

function updateHighGrass(scene){const request=scene.userData.sceneryRequest;if(!request||request.disposed)return;const enabled=PREF.quality==='high'&&!request.settings.snow&&!request.settings.indoor;if(request.grass){request.grass.visible=enabled;return}if(!enabled||request.grassLoading)return;request.grassLoading=true;KartAssets.script('assets/scenery/grass-high.js').then(()=>{request.grassLoading=false;if(request.disposed||PREF.quality!=='high')return;request.grass=KartHighGrass.build(scene,request.points,request.settings)}).catch(()=>{request.grassLoading=false})}
