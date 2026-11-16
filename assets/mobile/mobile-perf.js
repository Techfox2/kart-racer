// Grand Poly mobile layer · performance.
// Additive add-on (see mobile/PLAN-PERF.md). It never writes PREF, QUALITY_PRESETS or SAVE and
// never calls savePreferences. Everything works on the race renderer and the race scene AFTER
// the game's own functions ran, and only caps what the player's own quality setting produced.
//
// Hooks (all installed once, the first time the mobile layer is active; every wrapper falls
// straight through to the original when the layer is inactive, perf is 'off', or the scene is
// not the race scene, e.g. the lobby showroom):
//   THREE.WebGLRenderer       constructor wrapper: no MSAA for the race renderer (canvas-less)
//   window.qualityRender      per-frame entry: session bookkeeping before/after the game's frame
//   window.applyQuality       caps (pixel budget, shadow map, anisotropy, env map) after the game
//   window.disposeRaceScene   drops the session before the game disposes the scene
//   window.kartRaceScene      accessor: prepares + warms shaders while the loading dialog is up
//   KartAssets.script         blocks the high-quality grass download on tiers without grass
//   requestAnimationFrame     optional 30 fps cap (pass-through unless the cap is on)
//   #minimap.getContext       20 Hz minimap: other frames draw into a no-op context
// Per race renderer (instance properties, removed again on teardown):
//   renderer.render           shader warm-up right before a real frame
//   renderer.shadowMap.render shadow-pass-only caster policy (car shadow proxies)
//   renderer.setSize          skips identical sizes, debounces URL-bar height jitter
//
// Scene changes (all undone by teardown(), all disposed by the game's own traversal otherwise):
//   terrain   'Road terrain' split into tiles sharing its vertex buffers (own index + bounds)
//   barriers  the rounded-box InstancedMesh replaced by culled chunks of a lighter rounded box;
//             chunk instance matrices are views into the original buffer, so flyBars() keeps
//             animating them; changed chunks are re-uploaded when the original's version changes
//   scenery   static InstancedMeshes (trees, props, Monaco buildings, grass) split into culled
//             spatial chunks; clouds and hills stay as they are (tiny)
//   cars      shadow proxies (one draw call per car) used in the shadow pass on lower tiers
// Originals are hidden through layers.mask=0 (never through `visible`, which the game owns),
// and each chunk group mirrors the original's `visible` every frame.
(()=>{'use strict';
 const KM=window.KartMobile;
 if(!KM||KM.perf||typeof THREE==='undefined')return;

 // ---------------------------------------------------------------- tiers
 // budget: cap on drawing-buffer pixels; shadow: max shadow map size; aniso: max anisotropy.
 // carShadow 'mesh' = stock (every car mesh casts), 'proxy' = one merged proxy per car.
 const TIERS={
  quality:    {budget:1.6e6, shadow:2048,shadowType:'pcf',  env:true, aniso:8,grass:true, carShadow:'mesh', proxyRange:Infinity,sceneryShadow:true, barrierShadow:true, shadowEvery:1},
  balanced:   {budget:1.1e6, shadow:1024,shadowType:'pcf',  env:false,aniso:4,grass:false,carShadow:'proxy',proxyRange:Infinity,sceneryShadow:true, barrierShadow:true, shadowEvery:1},
  performance:{budget:0.75e6,shadow:512, shadowType:'basic',env:false,aniso:2,grass:false,carShadow:'proxy',proxyRange:22,      sceneryShadow:false,barrierShadow:false,shadowEvery:2},
 };
 const ORDER=['quality','balanced','performance'];
 const AUTO_KEY='kart-mobile-perf'; // device memory for the auto tier (plain localStorage, per device)
 const CALL_COST=1500,FAR_BARRIER=70,SCALE_MIN=.6,SCALE_STEP=.1,ADAPT_MS=2000;
 const STATIC_GROUPS=new Set(['Kenney track scenery','Poly sky and landscape','Monaco harbour and terraces']);
 const CHUNK_GROUPS=new Set(['Kenney track scenery','Monaco harbour and terraces']);
 const KEEP_WHOLE=new Set(['Soft polygon clouds','Rounded polygon hills']);
 const TEXT={
  perf:{de:'Mobile Leistung',en:'Mobile performance',fr:'Performances mobiles'},
  auto:{de:'Automatisch',en:'Automatic',fr:'Automatique'},
  quality:{de:'Qualität',en:'Quality',fr:'Qualité'},
  balanced:{de:'Ausgewogen',en:'Balanced',fr:'Équilibré'},
  performance:{de:'Leistung',en:'Performance',fr:'Performance'},
  off:{de:'Aus (Originalgrafik)',en:'Off (original graphics)',fr:'Désactivé (graphismes d’origine)'},
  fps30:{de:'Auf 30 FPS begrenzen (Akku)',en:'Limit to 30 FPS (battery)',fr:'Limiter à 30 FPS (batterie)'},
 };

 // ---------------------------------------------------------------- failure isolation
 // Every optimisation runs through safe(): a failure logs one warning and switches only that
 // optimisation off for the rest of the page's life; the game keeps running unmodified.
 const broken=new Set();
 function safe(key,fn,fallback){
  if(broken.has(key))return fallback;
  try{return fn()}catch(e){broken.add(key);console.warn('KartMobile perf: "'+key+'" switched off after an error',e);return fallback}
 }
 const enabled=()=>KM.active&&KM.get('perf')!=='off';
 let autoTier='balanced';
 try{const t=JSON.parse(localStorage.getItem(AUTO_KEY)||'{}').tier;if(TIERS[t])autoTier=t}catch{}
 const tierName=()=>{const p=KM.get('perf');return TIERS[p]?p:autoTier};

 // ---------------------------------------------------------------- small geometry helpers
 const V3=()=>new THREE.Vector3();
 // Rounded box exactly like KartModels.rounded(), but with fewer segments. With 3 segments every
 // interior vertex stays on the flat part of each face (as with the original 4), so shading and
 // the BoxGeometry face UVs (the barrier texture's edge lines) match; 108 instead of 192 triangles.
 function roundedBox(w,h,d,r,seg){
  r=Math.min(r,w*.28,h*.28,d*.28);
  const g=new THREE.BoxGeometry(w,h,d,seg,seg,seg),p=g.attributes.position,n=g.attributes.normal;
  const inner=new THREE.Vector3(w/2-r,h/2-r,d/2-r),q=V3(),c=V3(),normal=V3();
  for(let i=0;i<p.count;i++){
   q.fromBufferAttribute(p,i);
   c.set(Math.max(-inner.x,Math.min(inner.x,q.x)),Math.max(-inner.y,Math.min(inner.y,q.y)),Math.max(-inner.z,Math.min(inner.z,q.z)));
   normal.copy(q).sub(c);if(normal.lengthSq()<1e-12)normal.fromBufferAttribute(n,i);normal.normalize();
   q.copy(c).addScaledVector(normal,r);p.setXYZ(i,q.x,q.y,q.z);n.setXYZ(i,normal.x,normal.y,normal.z);
  }
  g.computeBoundingSphere();return g;
 }
 // A geometry that shares every attribute (and optionally the index) of `base` but carries its own
 // bounding sphere, so three.js frustum culling (which reads geometry.boundingSphere) works per
 // chunk/tile. Shared attributes are uploaded once (WebGLAttributes is keyed by attribute object).
 function sharedGeometry(base,sphere,index=base.index){
  const g=new THREE.BufferGeometry();
  for(const k in base.attributes)g.setAttribute(k,base.attributes[k]);
  if(index)g.setIndex(index);
  g.boundingSphere=sphere;g.userData.kmShared=true;
  return g;
 }
 // Releases only what a shared geometry owns (its VAO state and, if requested, its index) without
 // deleting GPU buffers that the original geometry still uses.
 function disposeShared(g,keepIndex){
  for(const k of Object.keys(g.attributes))g.deleteAttribute(k);
  if(keepIndex)g.index=null;
  g.dispose();
 }
 const maxScale=(e,o)=>Math.sqrt(Math.max(e[o]*e[o]+e[o+1]*e[o+1]+e[o+2]*e[o+2],e[o+4]*e[o+4]+e[o+5]*e[o+5]+e[o+6]*e[o+6],e[o+8]*e[o+8]+e[o+9]*e[o+9]+e[o+10]*e[o+10]));
 // Bounding sphere of instances [start,end) of a column-major instance matrix array, around the
 // instanced geometry's own bounding sphere.
 function instancesSphere(arr,list,base,out=new THREE.Sphere()){
  const bc=base.boundingSphere.center,br=base.boundingSphere.radius,box=new THREE.Box3(),p=V3();
  const at=(i,v)=>{const o=i*16;return v.set(arr[o]*bc.x+arr[o+4]*bc.y+arr[o+8]*bc.z+arr[o+12],arr[o+1]*bc.x+arr[o+5]*bc.y+arr[o+9]*bc.z+arr[o+13],arr[o+2]*bc.x+arr[o+6]*bc.y+arr[o+10]*bc.z+arr[o+14])};
  for(const i of list)box.expandByPoint(at(i,p));
  box.getCenter(out.center);let r=0;
  for(const i of list)r=Math.max(r,at(i,p).distanceTo(out.center)+br*maxScale(arr,i*16));
  out.radius=r;return out;
 }
 const range=(s,e)=>{const a=new Array(e-s);for(let i=0;i<a.length;i++)a[i]=s+i;return a};
 function visibleChain(o,stop){for(let p=o;p&&p!==stop;p=p.parent)if(!p.visible)return false;return true}
 const isCar=o=>!!(o&&o.userData&&o.userData.wheels);
 function isBarrier(o){
  const g=o.geometry,p=g&&g.parameters;
  return o.isInstancedMesh&&o.parent&&o.parent.isScene&&g.type==='BoxGeometry'&&p&&p.width===.6&&p.height===1.1&&p.depth===1&&p.widthSegments===4;
 }
 function topGroup(o,scene){let p=o;while(p.parent&&p.parent!==scene)p=p.parent;return p.parent===scene?p:null}

 // ---------------------------------------------------------------- per-race session
 const sessions=new Map();
 const current=()=>{const s=window.kartRaceScene&&sessions.get(window.kartRaceScene);return s&&s.alive?s:null};
 const tmpV2=new THREE.Vector2(),tmpM=new THREE.Matrix4(),frustum=new THREE.Frustum();

 class Session{
  constructor(scene){
   this.scene=scene;this.r=null;this.alive=true;
   this.tierName=tierName();this.tier=TIERS[this.tierName];
   this.done=new WeakSet();          // originals already restructured, cars already scanned
   this.added=[];                    // {obj,parent} objects we added to the scene graph
   this.mirrors=[];                  // {group,orig,grass} chunk groups mirroring orig.visible
   this.hidden=[];                   // {obj,mask} originals hidden through layers
   this.statics=[];                  // objects whose matrixAutoUpdate we switched off
   this.geoms=[];                    // {g,keepIndex,shared} geometries we created
   this.cars=[];                     // {root,proxy,meshes}
   this.barrier=null;
   this.childCount=-1;this.known=new WeakSet();
   this.warmAll=true;this.warmSubset=[];this.warmups=0;this.programsAfterWarm=null;
   this.frame=0;this.player=null;this.scale=1;this.gameRatio=null;
   this.restore={};                  // renderer overrides to undo
   this.adapt={last:0,t0:0,samples:[],bad:0,good:0,low:0};
   this.proxyMaterial=null;this.probe=null;
   this.info={calls:0,triangles:0,shadowCalls:0,shadowTriangles:0};
  }
  // --- attach to the race renderer (idempotent) -------------------------------------------
  attach(r){
   if(!r||this.r===r)return;
   this.r=r;const self=this;
   r._qualityKey=null; // let the game re-run applyQuality() so applyCaps() follows on the next frame
   if(!this.tier.env&&!r._studioEnv)r._studioEnv={texture:null,dispose(){},kmPlaceholder:true}; // the game then skips building its PMREM env map
   safe('warmup',()=>{
    const render=r.render;this.restore.render=render;
    r.render=function(scene,camera){
     if(self.alive&&scene===self.scene&&enabled()&&(self.warmAll||self.warmSubset.length))safe('warmup',()=>self.warm(camera,render));
     return render.apply(this,arguments);
    };
   });
   safe('shadows',()=>{
    const sm=r.shadowMap,render=sm.render;this.restore.shadowRender=render;
    sm.render=function(lights,scene,camera){
     if(!(self.alive&&scene===self.scene&&enabled()))return render.apply(this,arguments);
     const undo=safe('shadows',()=>self.shadowBegin(),null),info=r.info.render,c0=info.calls,t0=info.triangles;
     try{return render.apply(this,arguments)}
     finally{if(undo)safe('shadows',undo);if(sm.enabled&&(sm.autoUpdate||c0!==info.calls)){self.info.shadowCalls=info.calls-c0;self.info.shadowTriangles=info.triangles-t0}}
    };
   });
   safe('resize',()=>{
    const setSize=r.setSize;this.restore.setSize=setSize;let timer=0,pending=null;
    r.setSize=function(w,h,updateStyle){
     if(!(self.alive&&enabled())||updateStyle===false)return setSize.apply(this,arguments);
     const cur=this.getSize(tmpV2);
     if(cur.x===w&&cur.y===h){ // identical: the game calls this on every window resize
      if(pending){clearTimeout(timer);pending=null;this.domElement.style.height=h+'px'}
      return;
     }
     // Height-only jitter (mobile URL bar): restyle now, reallocate the drawing buffer later.
     // The stretched old buffer keeps the right aspect because the camera already uses the new one.
     if(cur.x===w&&Math.abs(h-cur.y)<cur.y*.2){
      this.domElement.style.height=h+'px';pending=[w,h];clearTimeout(timer);
      timer=setTimeout(()=>{if(!pending||!self.alive)return;const [a,b]=pending;pending=null;setSize.call(r,a,b);safe('ratio',()=>self.applyRatio())},300);
      return;
     }
     clearTimeout(timer);pending=null;setSize.apply(this,arguments);
     safe('ratio',()=>self.applyRatio());
    };
   });
  }
  // --- restructure the scene (incremental, idempotent) ------------------------------------
  prepare(){
   if(!this.alive)return;
   safe('terrain',()=>this.tileTerrain());
   safe('barriers',()=>this.chunkBarriers());
   safe('scenery',()=>this.chunkScenery());
   safe('static',()=>this.markStatic());
   safe('cars',()=>this.scanCars());
   safe('probes',()=>this.addProbes());
   this.childCount=this.scene.children.length;
  }
  add(obj,parent){parent.add(obj);this.added.push({obj,parent});obj.userData.kmPerf=true}
  hide(obj){this.hidden.push({obj,mask:obj.layers.mask});obj.layers.mask=0}
  makeStatic(o){if(!o.matrixAutoUpdate)return;o.updateMatrix();o.matrixAutoUpdate=false;this.statics.push(o)}
  group(name,orig,parent){
   const g=new THREE.Group();g.name=name;g.matrixAutoUpdate=false;g.updateMatrix();
   this.add(g,parent);this.mirrors.push({group:g,orig,grass:!!orig.userData.highGrass,mask:orig.layers.mask,fixed:isBarrier(orig),useOrig:false,want:true});return g;
  }
  // Terrain: tile-major copy of the PlaneGeometry index, one drawRange + bounding sphere per tile.
  tileTerrain(){
   const t=this.scene.children.find(o=>o.isMesh&&o.name==='Road terrain'&&!this.done.has(o));
   if(!t)return;this.done.add(t);
   const g=t.geometry,p=g.parameters,idx=g.index,pos=g.attributes.position;
   if(!idx||!p||!p.widthSegments||!pos)return;
   const nx=p.widthSegments,nz=p.heightSegments,stride=nx+1,src=idx.array;
   // PlaneGeometry layout: cell (ix,iy) = indices a,b,d,b,c,d at 6*(iy*nx+ix). Verify before relying on it.
   if(idx.count!==nx*nz*6||src[0]!==0||src[1]!==stride||src[2]!==1||src[4]!==stride+1)return;
   const TS=Math.max(16,Math.ceil(Math.max(nx,nz)/6)),out=new src.constructor(src.length),tiles=[];
   let o=0;
   for(let z0=0;z0<nz;z0+=TS)for(let x0=0;x0<nx;x0+=TS){
    const z1=Math.min(nz,z0+TS),x1=Math.min(nx,x0+TS),start=o;
    for(let iy=z0;iy<z1;iy++){const row=iy*nx*6;out.set(src.subarray(row+x0*6,row+x1*6),o);o+=(x1-x0)*6}
    const box=new THREE.Box3(),v=V3();
    for(let iy=z0;iy<=z1;iy++)for(let ix=x0;ix<=x1;ix++){const k=iy*stride+ix;box.expandByPoint(v.set(pos.getX(k),pos.getY(k),pos.getZ(k)))}
    tiles.push({start,count:o-start,sphere:box.getBoundingSphere(new THREE.Sphere()),box});
   }
   const index=new THREE.BufferAttribute(out,1),group=this.group('KM terrain tiles',t,t.parent);
   tiles.forEach((tile,i)=>{
    const tg=sharedGeometry(g,tile.sphere,index);tg.boundingBox=tile.box;tg.setDrawRange(tile.start,tile.count);
    const m=new THREE.Mesh(tg,t.material);m.name='Road terrain tile '+i;
    m.position.copy(t.position);m.quaternion.copy(t.quaternion);m.scale.copy(t.scale);
    m.receiveShadow=t.receiveShadow;m.castShadow=t.castShadow;m.renderOrder=t.renderOrder;m.userData.kmPerf=true;
    m.matrixAutoUpdate=false;m.updateMatrix();group.add(m);
    this.geoms.push({g:tg,keepIndex:i>0,shared:true}); // the shared tile index is freed once, with tile 0
   });
   this.hide(t);this.terrain={orig:t,tiles:tiles.length};
  }
  // Barriers: consecutive instances (they run along the track) grouped into ~90 m chunks.
  chunkBarriers(){
   const bl=this.scene.children.find(o=>!this.done.has(o)&&isBarrier(o));
   if(!bl)return;this.done.add(bl);
   // far: plain box for chunks beyond FAR_BARRIER m, where the 14 cm rounding is about a pixel.
   const base=roundedBox(.6,1.1,1,.14,3),far=new THREE.BoxGeometry(.6,1.1,1),arr=bl.instanceMatrix.array,n=bl.count,ranges=[];
   let s=0;const p0=V3(),q=V3();
   for(let i=0;i<n;i++){
    q.set(arr[i*16+12],arr[i*16+13],arr[i*16+14]);
    if(i===s){p0.copy(q);continue}
    if(q.distanceTo(p0)>60||i-s>=120){ranges.push([s,i]);s=i;p0.copy(q)}
   }
   if(s<n)ranges.push([s,n]);
   const group=this.group('KM barrier chunks',bl,bl.parent),chunks=[];
   for(const [a,b] of ranges){
    const sphere=instancesSphere(arr,range(a,b),base),geometry=sharedGeometry(base,sphere),farGeometry=sharedGeometry(far,sphere);
    const m=new THREE.InstancedMesh(geometry,bl.material,b-a);
    // Views into the original buffers: flyBars()/setBar() writes reach the chunks directly.
    m.instanceMatrix=new THREE.InstancedBufferAttribute(arr.subarray(a*16,b*16),16);
    if(bl.instanceColor)m.instanceColor=new THREE.InstancedBufferAttribute(bl.instanceColor.array.subarray(a*3,b*3),3);
    m.count=b-a;m.frustumCulled=true;m.castShadow=bl.castShadow&&this.tier.barrierShadow;m.receiveShadow=bl.receiveShadow;
    m.name='KM barriers '+a;m.userData.kmPerf=true;m.position.copy(bl.position);m.quaternion.copy(bl.quaternion);m.scale.copy(bl.scale);
    m.matrixAutoUpdate=false;m.updateMatrix();group.add(m);
    chunks.push({mesh:m,a,b,near:geometry,far:farGeometry});this.geoms.push({g:geometry,keepIndex:false,shared:false},{g:farGeometry,keepIndex:false,shared:false});
   }
   this.hide(bl);
   this.barrier={orig:bl,base,far,chunks,version:bl.instanceMatrix.version,colorVersion:bl.instanceColor?bl.instanceColor.version:0,snap:arr.slice()};
  }
  // Mirrors a changed original instance buffer (crash animation) into the chunks that changed.
  syncBarriers(){
   const B=this.barrier;if(!B)return;
   const im=B.orig.instanceMatrix,arr=im.array;
   if(im.version!==B.version){
    B.version=im.version;
    for(const c of B.chunks){
     let changed=false;for(let i=c.a*16,e=c.b*16;i<e;i++)if(arr[i]!==B.snap[i]){changed=true;break}
     if(!changed)continue;
     B.snap.set(arr.subarray(c.a*16,c.b*16),c.a*16);
     c.mesh.instanceMatrix.needsUpdate=true;
     instancesSphere(arr,range(c.a,c.b),B.base,c.near.boundingSphere); // shared by c.far // flying bars leave the old bounds
    }
   }
   // Distance LOD: the chunk's bounding sphere decides between the rounded and the plain box.
   const cam=this.camera&&this.camera.position;
   if(cam)for(const c of B.chunks){const sp=c.near.boundingSphere,g=cam.distanceTo(sp.center)-sp.radius>FAR_BARRIER?c.far:c.near;if(c.mesh.geometry!==g)c.mesh.geometry=g}
   const ic=B.orig.instanceColor;
   if(ic&&ic.version!==B.colorVersion){B.colorVersion=ic.version;for(const c of B.chunks)if(c.mesh.instanceColor)c.mesh.instanceColor.needsUpdate=true}
  }
  // Static scenery InstancedMeshes: median (k-d) split into compact spatial chunks.
  chunkScenery(){
   const list=[];
   this.scene.traverse(o=>{
    if(!o.isInstancedMesh||this.done.has(o)||o.userData.kmPerf||o.frustumCulled!==false||KEEP_WHOLE.has(o.name))return;
    if(o.instanceMatrix.usage!==THREE.StaticDrawUsage||o.count<24||isBarrier(o))return;
    const top=topGroup(o,this.scene);
    if(!(o.userData.highGrass||(top&&CHUNK_GROUPS.has(top.name))))return;
    list.push(o);
   });
   for(const o of list){
    this.done.add(o);
    const arr=o.instanceMatrix.array,n=o.count,base=o.geometry;
    if(!base.boundingSphere)base.computeBoundingSphere();
    const leafMax=Math.max(32,Math.ceil(n/8)),leaves=[];
    const split=ids=>{
     if(ids.length<=leafMax){leaves.push(ids);return}
     let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
     for(const i of ids){const x=arr[i*16+12],z=arr[i*16+14];if(x<minX)minX=x;if(x>maxX)maxX=x;if(z<minZ)minZ=z;if(z>maxZ)maxZ=z}
     const k=maxX-minX>=maxZ-minZ?12:14;ids.sort((a,b)=>arr[a*16+k]-arr[b*16+k]);
     const mid=ids.length>>1;split(ids.slice(0,mid));split(ids.slice(mid));
    };
    split(range(0,n));
    const group=this.group('KM chunks '+(o.name||'instanced'),o,o.parent);
    for(const ids of leaves){
     const geometry=sharedGeometry(base,instancesSphere(arr,ids,base));
     const m=new THREE.InstancedMesh(geometry,o.material,ids.length);
     ids.forEach((id,j)=>{m.instanceMatrix.array.set(arr.subarray(id*16,id*16+16),j*16)});
     if(o.instanceColor){const c=new Float32Array(ids.length*3),src=o.instanceColor.array;ids.forEach((id,j)=>{c[j*3]=src[id*3];c[j*3+1]=src[id*3+1];c[j*3+2]=src[id*3+2]});m.instanceColor=new THREE.InstancedBufferAttribute(c,3)}
     m.frustumCulled=true;m.castShadow=o.castShadow&&this.tier.sceneryShadow;m.receiveShadow=o.receiveShadow;m.renderOrder=o.renderOrder;
     m.name='KM '+(o.name||'chunk');m.userData.kmPerf=true;m.position.copy(o.position);m.quaternion.copy(o.quaternion);m.scale.copy(o.scale);
     m.matrixAutoUpdate=false;m.updateMatrix();group.add(m);
     this.geoms.push({g:geometry,keepIndex:true,shared:true}); // the index (if any) belongs to the original
    }
    this.hide(o);
   }
  }
  markStatic(){
   for(const c of this.scene.children){
    if(c.userData.kmPerf)continue;
    if(STATIC_GROUPS.has(c.name))c.traverse(o=>this.makeStatic(o));
    else if(c.name==='Road terrain'||c.name==='Road banks'||(this.barrier&&c===this.barrier.orig))this.makeStatic(c);
   }
  }
  // Car shadow proxies: merged triangles of the car's visible shadow-casting meshes, in car space.
  // Used only inside the shadow pass (shadowBegin), so the main pass never sees them.
  scanCars(){
   for(const c of this.scene.children){
    if(!isCar(c)||this.done.has(c))continue;
    this.done.add(c);
    const meshes=[];c.traverse(o=>{if(o.isMesh&&!o.userData.kmPerf)meshes.push(o)});
    const entry={root:c,meshes,proxy:null};this.cars.push(entry);
    if(this.tier.carShadow==='proxy')safe('proxies',()=>{entry.proxy=this.buildProxy(c,meshes)});
   }
   this.cars=this.cars.filter(e=>e.root.parent===this.scene);
  }
  buildProxy(root,meshes){
   root.updateMatrixWorld(true);
   // One oriented box per mesh (its geometry bounding box, in car space): 12 triangles per part.
   // At 1024 px over the 90 m shadow frustum a texel is ~9 cm, so the boxes cast nearly the same
   // shadow as the ~30k-triangle car while costing one draw call and a few hundred triangles.
   const inv=new THREE.Matrix4().copy(root.matrixWorld).invert(),m=new THREE.Matrix4(),v=V3(),pos=[],ix=[];
   const FACES=[0,1,3,0,3,2,4,6,7,4,7,5,0,4,5,0,5,1,2,3,7,2,7,6,0,2,6,0,6,4,1,5,7,1,7,3];
   for(const o of meshes){
    if(!o.castShadow||!visibleChain(o,root.parent))continue;
    const g=o.geometry;if(!g.attributes.position)continue;
    if(!g.boundingBox)g.computeBoundingBox();const b=g.boundingBox;if(b.isEmpty())continue;
    m.multiplyMatrices(inv,o.matrixWorld);const off=pos.length/3;
    for(let c=0;c<8;c++){v.set(c&4?b.max.x:b.min.x,c&2?b.max.y:b.min.y,c&1?b.max.z:b.min.z).applyMatrix4(m);pos.push(v.x,v.y,v.z)}
    for(const f of FACES)ix.push(f+off);
   }
   if(!ix.length)return null;
   const geometry=new THREE.BufferGeometry();
   geometry.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
   geometry.setIndex(ix);
   geometry.computeBoundingSphere();
   // MeshDepthMaterial: never touched by upgradeArt()/pbr(), and the shadow pass uses its own depth material anyway.
   if(!this.proxyMaterial)this.proxyMaterial=new THREE.MeshDepthMaterial();
   const proxy=new THREE.Mesh(geometry,this.proxyMaterial);
   proxy.name='KM car shadow proxy';proxy.castShadow=true;proxy.receiveShadow=false;proxy.visible=false;proxy.userData.kmSkipWarm=true;
   proxy.matrixAutoUpdate=false;proxy.updateMatrix();
   this.add(proxy,root);this.geoms.push({g:geometry,keepIndex:false,shared:false});
   return proxy;
  }
  // Pre-compiles programs for things that only enter the scene later (dropped oil uses a plain
  // transparent MeshStandardMaterial). Kept alive (hidden) so the program is not released.
  addProbes(){
   if(this.probe)return;
   const g=new THREE.Group();g.name='KM shader probes';g.visible=false;
   const oil=new THREE.Mesh(new THREE.BoxGeometry(.01,.01,.01),new THREE.MeshStandardMaterial({color:0x0b0b0c,roughness:.15,metalness:.6,transparent:true,opacity:.9}));
   oil.receiveShadow=true;g.add(oil);this.add(g,this.scene);this.probe=g;
  }
  // --- shader warm-up -----------------------------------------------------------------------
  // Renders the scene once into a 1x1 viewport with everything (pooled sprites, cockpit, hidden
  // driver variants, probes) visible and unculled, right before a real frame, so every program
  // and shadow depth program is compiled with the exact renderer state of the real frames.
  warm(camera,render){
   const r=this.r,scene=this.scene;
   if(!r||r.getRenderTarget()!==null)return;
   const subset=this.warmAll?null:this.warmSubset.splice(0);this.warmAll=false;
   const vis=[],cull=[],off=[];
   const force=o=>{
    if(o.layers.mask===0||o.userData.kmSkipWarm||o.isLight)return;
    if(!o.visible){vis.push(o);o.visible=true}
    if(o.frustumCulled){cull.push(o);o.frustumCulled=false}
    for(const c of o.children)force(c);
   };
   if(subset){for(const c of scene.children)if(!subset.includes(c)&&c.visible&&!c.isLight){off.push(c);c.visible=false}subset.forEach(force)}
   else for(const c of scene.children)force(c);
   for(const m of this.mirrors)if(m.grass&&!this.tier.grass&&m.group.visible){off.push(m.group);m.group.visible=false}
   const vp=r.getViewport(new THREE.Vector4());
   r.setViewport(0,0,1,1);r.shadowMap.needsUpdate=true;
   try{render.call(r,scene,camera)}
   finally{
    r.setViewport(vp);r.shadowMap.needsUpdate=true;
    for(const o of vis)o.visible=false;for(const o of cull)o.frustumCulled=true;for(const o of off)o.visible=true;
   }
   this.warmups++;
   if(!subset||this.programsAfterWarm===null)this.programsAfterWarm=r.info.programs?r.info.programs.length:0;
  }
  // --- per frame ------------------------------------------------------------------------------
  before(r,camera){
   this.attach(r);this.camera=camera;this.frame++;
   if(this.scene.children.length!==this.childCount){
    const fresh=this.scene.children.filter(c=>!this.known.has(c)&&!c.userData.kmPerf);
    this.prepare();
    if(this.frame>1&&fresh.length)this.warmSubset.push(...fresh.filter(c=>c.parent===this.scene));
    for(const c of this.scene.children)this.known.add(c);
   }
   safe('representation',()=>this.chooseRepresentation(camera));
   safe('barrier-sync',()=>this.syncBarriers());
   if(this.frame%30===1)safe('cars',()=>this.findPlayer(camera));
   const sm=r.shadowMap;
   if(this.tier.shadowEvery>1){sm.autoUpdate=false;if(this.frame%this.tier.shadowEvery===0)sm.needsUpdate=true}
   safe('adaptive',()=>this.adaptTick());
  }
  after(r){
   const i=r.info.render;this.info.calls=i.calls;this.info.triangles=i.triangles;
   stats.push(performance.now());
  }
  findPlayer(camera){
   let best=Infinity,player=null;
   for(const e of this.cars){if(e.root.parent!==this.scene)continue;const d=e.root.position.distanceToSquared(camera.position);if(d<best){best=d;player=e.root}}
   this.player=player;
  }
  // Main pass: per chunked original, draw either the original (one call, every instance) or the
  // chunks that pass the camera frustum, whichever is cheaper (a draw call is weighed as
  // CALL_COST triangles). When most of a mesh is in view anyway (trees in front of the grid,
  // Monaco's facades all around the harbour) the original wins; the shadow pass always uses chunks.
  chooseRepresentation(camera){
   camera.updateMatrixWorld();
   frustum.setFromProjectionMatrix(tmpM.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
   for(const m of this.mirrors){
    m.want=m.orig.visible&&(!m.grass||this.tier.grass);
    let useOrig=false;
    if(m.want&&!m.fixed){
     const o=m.orig,g=o.geometry,tri=(g.index?g.index.count:g.attributes.position.count)/3*(o.isInstancedMesh?o.count:1);
     let cost=0;
     for(const c of m.group.children){if(!frustum.intersectsObject(c))continue;const cg=c.geometry;cost+=CALL_COST+(cg.index?Math.min(cg.index.count,cg.drawRange.count):cg.attributes.position.count)/3*(c.isInstancedMesh?c.count:1)}
     useOrig=CALL_COST+tri<cost;
    }
    m.useOrig=useOrig;m.group.visible=m.want&&!useOrig;m.orig.layers.mask=useOrig?m.mask:0;
   }
  }
  // Inside the shadow pass only: chunked originals drawn whole in the main pass switch to their
  // chunks (culled to the shadow frustum), and cars cast through their proxy (one draw call)
  // instead of ~38 meshes; on 'performance' only the player and cars near it cast at all.
  shadowBegin(){
   const swapped=[];
   for(const m of this.mirrors)if(m.want&&m.useOrig){m.group.visible=true;m.orig.layers.mask=0;swapped.push(m)}
   const back=()=>{for(const m of swapped){m.group.visible=false;m.orig.layers.mask=m.mask}};
   if(this.tier.carShadow!=='proxy')return back;
   const off=[],on=[],range2=this.tier.proxyRange**2,pp=this.player&&this.player.position;
   for(const e of this.cars){
    if(e.root.parent!==this.scene)continue;
    const near=!pp||e.root===this.player||e.root.position.distanceToSquared(pp)<=range2;
    for(const m of e.meshes)if(m.castShadow){m.castShadow=false;off.push(m)}
    if(near&&e.proxy){e.proxy.visible=true;on.push(e.proxy)}
   }
   return()=>{back();for(const m of off)m.castShadow=true;for(const p of on)p.visible=false};
  }
  // --- render-state caps (after the game's applyQuality) --------------------------------------
  applyCaps(r){
   const t=this.tier;
   this.gameRatio=r.getPixelRatio();
   safe('ratio',()=>this.applyRatio());
   safe('caps',()=>{
    if(r.shadowMap.enabled){
     if(t.shadowType==='basic')r.shadowMap.type=THREE.BasicShadowMap;
     else if(r.shadowMap.type===THREE.PCFSoftShadowMap)r.shadowMap.type=THREE.PCFShadowMap;
    }
    const maxA=t.aniso,env=r._studioEnv&&r._studioEnv.texture;
    this.scene.traverse(o=>{
     if(o.isLight&&o.shadow&&o.shadow.mapSize.x>t.shadow){o.shadow.map?.dispose();o.shadow.map=null;o.shadow.mapSize.set(t.shadow,t.shadow)}
     if(!o.material)return;
     for(const m of [].concat(o.material)){
      for(const k of ['map','normalMap','roughnessMap','bumpMap'])if(m[k]&&m[k].anisotropy>maxA){m[k].anisotropy=maxA;m[k].needsUpdate=true}
      if(!t.env&&env&&m.envMap===env){m.envMap=null;m.needsUpdate=true}
     }
    });
   });
  }
  applyRatio(){
   const r=this.r;if(!r)return;
   const size=r.getSize(tmpV2),w=size.x||innerWidth,h=size.y||innerHeight;
   const game=this.gameRatio??r.getPixelRatio();
   const target=Math.min(game,Math.sqrt(this.tier.budget*this.scale/(w*h)));
   if(Math.abs(r.getPixelRatio()-target)>1e-3)r.setPixelRatio(target);
  }
  // Adaptive resolution: mean frame time over 2 s windows steers the pixel budget between 60 %
  // and 100 % (at most one buffer reallocation per window). In 'auto', a sustained low frame
  // rate at minimum resolution steps the tier down and remembers it on this device.
  adaptTick(){
   const a=this.adapt,now=performance.now();
   if(!api.adaptive||KM.state!=='race'||document.hidden||this.warmups===0){a.last=0;a.samples.length=0;return}
   if(a.last){const dt=now-a.last;if(dt<250)a.samples.push(dt)}
   a.last=now;if(!a.t0)a.t0=now;
   if(now-a.t0<ADAPT_MS)return;
   a.t0=now;const n=a.samples.length;if(n<10){a.samples.length=0;return}
   const mean=a.samples.reduce((x,y)=>x+y,0)/n;a.samples.length=0;
   const target=KM.get('fps30')?30:60,slow=mean>1000/(target*.85),fast=mean<1000/(target*.95);
   if(slow){a.good=0;if(this.scale>SCALE_MIN+1e-6){this.scale=Math.max(SCALE_MIN,this.scale-SCALE_STEP);this.applyRatio()}
    else if(KM.get('perf')==='auto'&&mean>1000/(target*.6)&&++a.low>=3)stepDown();}
   else{a.low=0;if(fast&&this.scale<1&&++a.good>=2){a.good=0;this.scale=Math.min(1,this.scale+SCALE_STEP);this.applyRatio()}}
  }
  // --- teardown -------------------------------------------------------------------------------
  // restore=true: put the stock scene back (perf switched off / tier change). restore=false: the
  // game is about to dispose the scene; its traversal disposes our geometries and materials.
  teardown(restore){
   if(!this.alive)return;this.alive=false;
   const r=this.r;
   if(r){
    if(this.restore.render)r.render=this.restore.render;
    if(this.restore.shadowRender)r.shadowMap.render=this.restore.shadowRender;
    if(this.restore.setSize)r.setSize=this.restore.setSize;
    r.shadowMap.autoUpdate=true;
   }
   if(!restore)return;
   for(const {obj,parent} of this.added.reverse())parent.remove(obj);
   for(const {obj,mask} of this.hidden)obj.layers.mask=mask;
   for(const o of this.statics)o.matrixAutoUpdate=true;
   for(const e of this.geoms)safe('dispose',()=>{if(e.shared)disposeShared(e.g,e.keepIndex);else e.g.dispose()});
   const freeMeshes=o=>o.traverse(x=>{if(x.isInstancedMesh&&x.userData.kmPerf)x.dispose()});
   for(const {obj} of this.added)freeMeshes(obj);
   if(this.barrier){this.barrier.base.dispose();this.barrier.far.dispose()}
   if(this.proxyMaterial)this.proxyMaterial.dispose();
   if(this.probe)this.probe.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose()}});
   if(r){
    if(r._studioEnv&&r._studioEnv.kmPlaceholder)r._studioEnv=null;
    r._qualityKey=null; // the game re-applies its own quality (pixel ratio, shadow map, anisotropy, env) next frame
    r.shadowMap.needsUpdate=true;
   }
  }
 }

 function stepDown(){
  const i=ORDER.indexOf(autoTier);if(i<0||i>=ORDER.length-1)return;
  autoTier=ORDER[i+1];try{localStorage.setItem(AUTO_KEY,JSON.stringify({tier:autoTier}))}catch{}
  retier();
 }
 // Rebuilds the current race session for the current setting (tier change, 'off', inactive).
 function retier(){
  const scene=window.kartRaceScene,s=scene&&sessions.get(scene);
  if(!s)return;
  const r=s.r;s.teardown(true);sessions.delete(scene);
  if(enabled()&&r){
   const n=new Session(scene);sessions.set(scene,n);n.attach(r);n.prepare();
   if(n.tier.grass)safe('grass',()=>window.updateHighGrass?.(scene));
  }
  if(r)r._qualityKey=null;
 }
 function raceRenderer(scene){
  if(typeof graphicsRenderers==='undefined')return null;
  for(const r of graphicsRenderers)if(r._kartScene===scene)return r;
  return null;
 }

 // ---------------------------------------------------------------- frame statistics
 const stats={
  times:new Float64Array(600),n:0,
  push(t){this.times[this.n%600]=t;this.n++},
  intervals(){const out=[],count=Math.min(this.n,600);for(let i=this.n-count+1;i<this.n;i++){const d=this.times[i%600]-this.times[(i-1)%600];if(d>0&&d<1000)out.push(d)}return out},
 };

 // ---------------------------------------------------------------- hooks
 let installed=false;
 function install(){
  if(installed)return;installed=true;
  safe('msaa',()=>{
   // Race renderers are created per race with {antialias:true} and no canvas; the showroom passes
   // its own canvas and keeps MSAA. instanceof keeps working through the shared prototype.
   const Original=THREE.WebGLRenderer;
   function WebGLRenderer(parameters={}){
    if(enabled()&&parameters&&!parameters.canvas&&parameters.antialias)parameters={...parameters,antialias:false};
    return new Original(parameters);
   }
   WebGLRenderer.prototype=Original.prototype;Object.setPrototypeOf(WebGLRenderer,Original);
   THREE.WebGLRenderer=WebGLRenderer;
  });
  const qualityRender=window.qualityRender;
  if(typeof qualityRender==='function')window.qualityRender=function(r,scene,camera){
   if(!scene||scene!==window.kartRaceScene||!enabled())return qualityRender.apply(this,arguments);
   let s=sessions.get(scene);
   if(!s||!s.alive){s=new Session(scene);sessions.set(scene,s)}
   safe('session',()=>s.before(r,camera));
   try{return qualityRender.apply(this,arguments)}
   finally{safe('session',()=>s.after(r))}
  };
  const applyQuality=window.applyQuality;
  if(typeof applyQuality==='function')window.applyQuality=function(r){
   const result=applyQuality.apply(this,arguments);
   const scene=r&&r._kartScene;
   if(scene&&scene===window.kartRaceScene&&enabled()){const s=sessions.get(scene);if(s&&s.alive){s.attach(r);s.applyCaps(r)}}
   return result;
  };
  const disposeRaceScene=window.disposeRaceScene;
  if(typeof disposeRaceScene==='function')window.disposeRaceScene=function(scene){
   const s=scene&&sessions.get(scene);
   if(s){sessions.delete(scene);safe('session',()=>s.teardown(false))}
   return disposeRaceScene.apply(this,arguments);
  };
  safe('early',()=>{
   // game.js assigns window.kartRaceScene during buildRace(), before the player kart is added and
   // while the loading dialog is still open. One task later (the game's next checkpoint yields)
   // the scene holds terrain, barriers, scenery, the player kart and the particle pools: prepare
   // and compile there, before the countdown clock starts.
   let value=window.kartRaceScene;
   Object.defineProperty(window,'kartRaceScene',{configurable:true,enumerable:true,get:()=>value,set(scene){
    value=scene;
    if(scene&&enabled()&&!sessions.has(scene))setTimeout(()=>safe('early',()=>early(scene)),0);
   }});
  });
  safe('grass',()=>{
   const script=KartAssets.script;
   KartAssets.script=function(path){
    if(typeof path==='string'&&path.includes('grass-high.js')&&enabled()&&window.kartRaceScene){
     const s=current(),tier=s?s.tier:TIERS[tierName()];
     if(!tier.grass)return Promise.reject(new Error('KartMobile perf: 3D grass is off for this tier'));
    }
    return script.apply(this,arguments);
   };
  });
  safe('fps30',installFrameCap);
  safe('minimap',installMinimap);
  safe('settings',installSettings);
  if(new URLSearchParams(location.search).get('kmperf')==='1')safe('overlay',installOverlay);
 }
 function early(scene){
  if(scene!==window.kartRaceScene||sessions.has(scene)||!enabled())return;
  const r=raceRenderer(scene);if(!r)return;
  const s=new Session(scene);sessions.set(scene,s);
  s.attach(r);s.prepare();
  for(const c of scene.children)s.known.add(c);
  // With the game's env map still to be built on the first frame, every standard material changes
  // program then anyway; warming now would compile everything twice.
  if(s.tier.env&&PREF.quality==='high')return;
  window.applyQuality(r); // the game re-runs it on the first frame; programs then come from the cache
  const camera=new THREE.PerspectiveCamera(62,innerWidth/innerHeight,1,900);
  s.warm(camera,s.restore.render||r.render);
  s.warmAll=true; // once more on the first real frame: particle pools, bots and item boxes are added after this point
 }

 // 30 fps cap: every requestAnimationFrame callback (game loop, controls driver, HUD) is batched
 // onto every other display frame, so they stay in step. Game time is unaffected: the game derives
 // dt from the timestamps (clamped to 0.05 s), so 33 ms frames simply advance 33 ms.
 function installFrameCap(){
  const nativeRequest=window.requestAnimationFrame.bind(window),nativeCancel=window.cancelAnimationFrame.bind(window);
  const queue=new Map();let nextId=1e9,pending=0,lastServed=0;
  const capping=()=>enabled()&&KM.get('fps30')&&!!window.kartActiveTrack&&!document.hidden;
  function flush(ts){const callbacks=[...queue.values()];queue.clear();for(const cb of callbacks){try{cb(ts)}catch(e){setTimeout(()=>{throw e})}}}
  function tick(ts){pending=0;if(capping()&&ts-lastServed<1000/30-4){pending=nativeRequest(tick);return}lastServed=ts;flush(ts)}
  window.requestAnimationFrame=function(cb){
   if(!capping()&&!queue.size)return nativeRequest(cb);
   const id=++nextId;queue.set(id,cb);if(!pending)pending=nativeRequest(tick);return id;
  };
  window.cancelAnimationFrame=function(id){if(queue.delete(id))return;nativeCancel(id)};
 }
 // drawMinimap() fetches the 2D context every frame; between 20 Hz updates it gets a context whose
 // methods do nothing, so the canvas keeps its last image and the path is never rasterised.
 function installMinimap(){
  const proto=CanvasRenderingContext2D.prototype,stub={};
  for(const k of Object.getOwnPropertyNames(proto))if(typeof Object.getOwnPropertyDescriptor(proto,k).value==='function')stub[k]=()=>{};
  stub.getLineDash=()=>[];stub.measureText=()=>({width:0});
  let last=0;
  const attach=()=>{
   const cv=document.getElementById('minimap');if(!cv||cv.kmPerf)return;cv.kmPerf=true;
   cv.getContext=function(type){
    const real=HTMLCanvasElement.prototype.getContext.apply(this,arguments);
    if(type!=='2d'||!real||!enabled()||KM.state!=='race')return real;
    const now=performance.now();if(now-last>=48||now<last){last=now;return real}
    stub.canvas=this;return stub;
   };
  };
  attach();KM.on('state',attach);
 }

 // ---------------------------------------------------------------- settings (Graphics tab)
 function installSettings(){
  let box=null;
  const build=()=>{
   box=document.createElement('div');box.id='kmPerfSettings';box.dataset.noTranslate='';
   box.innerHTML='<label class="pref-row"><span data-t="perf"></span><select data-km-perf="perf">'+['auto','quality','balanced','performance','off'].map(v=>'<option value="'+v+'" data-t="'+v+'"></option>').join('')+'</select></label>'+
    '<label class="pref-row"><span data-t="fps30"></span><input type="checkbox" data-km-perf="fps30"></label>';
   box.addEventListener('change',e=>{const c=e.target.closest('[data-km-perf]');if(c)KM.set(c.dataset.kmPerf,c.type==='checkbox'?c.checked:c.value)});
  };
  const sync=()=>{
   if(!box)return;
   for(const n of box.querySelectorAll('[data-t]'))n.textContent=KM.text(TEXT[n.dataset.t]);
   box.querySelector('select').value=KM.get('perf');box.querySelector('input').checked=KM.get('fps30');
   box.hidden=!KM.active;
  };
  const ensure=()=>{
   const host=document.getElementById('settings-graphics');if(!host)return;
   if(!box)build();
   if(box.parentElement!==host||host.lastElementChild!==box){host.append(box);sync()}
  };
  // drawPreferences() replaces the section's innerHTML; put the block back after every rebuild.
  const host=document.getElementById('settings-graphics');
  if(host)new MutationObserver(ensure).observe(host,{childList:true});
  ensure();KM.on('setting',sync);KM.on('lang',sync);KM.on('active',sync);
 }
 function installOverlay(){
  const el=document.createElement('div');el.id='kmPerfOverlay';el.dataset.noTranslate='';
  el.style.cssText='position:fixed;left:4px;top:4px;z-index:99998;pointer-events:none;font:11px/1.3 ui-monospace,monospace;color:#fff;background:rgba(0,0,0,.55);padding:3px 6px;border-radius:4px;white-space:pre';
  document.body.append(el);
  setInterval(()=>{const s=api.stats();el.hidden=!s.race;if(s.race)el.textContent=`${s.tier} ${s.fps} fps p95 ${s.p95} ms\n${s.buffer[0]}x${s.buffer[1]} @${s.pixelRatio} · ${s.calls} calls · ${Math.round(s.triangles/1000)}k tris\nshadow ${s.shadowMap} · programs ${s.programs}${s.programGrowth?' (+'+s.programGrowth+')':''}`},500);
 }

 // ---------------------------------------------------------------- public API
 const api={
  adaptive:true, // tests switch this off for reproducible counts
  get tier(){const s=current();return s?s.tierName:tierName()},
  stats(){
   const s=current(),r=s&&s.r,iv=stats.intervals().slice(-300).sort((a,b)=>a-b),q=p=>iv.length?+iv[Math.min(iv.length-1,Math.floor(p*iv.length))].toFixed(1):0;
   const mean=iv.length?iv.reduce((a,b)=>a+b,0)/iv.length:0;
   const light=s&&s.scene.children.find(o=>o.isDirectionalLight&&o.castShadow);
   return{race:!!s,tier:s?s.tierName:enabled()?tierName():'off',fps:mean?Math.round(1000/mean):0,p50:q(.5),p95:q(.95),p99:q(.99),
    pixelRatio:r?+r.getPixelRatio().toFixed(3):null,buffer:r?[r.domElement.width,r.domElement.height]:[0,0],scale:s?s.scale:1,
    calls:s?s.info.calls:0,triangles:s?s.info.triangles:0,shadowCalls:s?s.info.shadowCalls:0,shadowTriangles:s?s.info.shadowTriangles:0,
    shadowMap:light?light.shadow.mapSize.x+(r.shadowMap.type===THREE.BasicShadowMap?' basic':r.shadowMap.type===THREE.PCFShadowMap?' pcf':' pcf-soft'):'none',
    programs:r&&r.info.programs?r.info.programs.length:0,programGrowth:s&&s.programsAfterWarm!==null&&r?r.info.programs.length-s.programsAfterWarm:0,
    warmups:s?s.warmups:0,broken:[...broken]};
  },
  // Structure of the current race session (for tests and debugging).
  debug(){
   const s=current();if(!s)return null;
   return{tier:s.tierName,terrainTiles:s.terrain?s.terrain.tiles:0,barrierChunks:s.barrier?s.barrier.chunks.length:0,
    chunkGroups:s.mirrors.length,cars:s.cars.length,proxies:s.cars.filter(e=>e.proxy).length,hidden:s.hidden.length,statics:s.statics.length,warmups:s.warmups};
  },
  barrierChunks(){const s=current();return s&&s.barrier?s.barrier.chunks.map(c=>c.mesh):[]},
 };
 KM.perf=api;

 KM.on('setting',({key})=>{if(key==='perf')retier()});
 KM.on('active',active=>{if(active)install();else if(installed)retier()});
 if(KM.active)install();
})();
