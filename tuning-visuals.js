/* Hand-built primitive engines and bolt-on parts. No imported geometry or logos. */
window.KartTuningVisuals=(()=>{'use strict';
 function isolateMaterials(root,shared){const copies=new Map(),set=new Set(shared);root.traverse(o=>{if(!o.material)return;const own=m=>{if(!set.has(m))return m;if(!copies.has(m))copies.set(m,m.clone());return copies.get(m)};o.material=Array.isArray(o.material)?o.material.map(own):own(o.material)})}
 function dispose(root){const geos=new Set(),mats=new Set();root.traverse(o=>{if(o.geometry)geos.add(o.geometry);for(const m of (Array.isArray(o.material)?o.material:[o.material]))if(m)mats.add(m)});geos.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());if(root.parent)root.parent.remove(root)}
 function make(id,levels={},workshop=false,low=false){const def=KartTuningStats.definition(id),gt=def.category==='gt3',root=new THREE.Group(),groups={},segments=low?8:18,z=def.layout==='front'?1.14:def.layout==='rear'?-1.28:-.70,ey=gt?.93:.52;
  root.name='Tuning '+id;
  for(const part of Object.keys(KartTuningStats.data.parts)){groups[part]=new THREE.Group();groups[part].userData.part=part;root.add(groups[part])}
  const material=(level=0,color=0x596779)=>new THREE.MeshStandardMaterial({color:level?[0x82909f,0x27bbc5,0xffbe49][level-1]:color,roughness:level?.35:.7,metalness:.45,emissive:level===3&&!low?0x463006:0,emissiveIntensity:.25});
  const mats=Object.fromEntries(Object.keys(groups).map(k=>[k,material(levels[k]||0)]));
  function mesh(part,geo,x,y,z,rx=0,rz=0,mat=mats[part]){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.rotation.set(rx,0,rz);m.userData.part=part;groups[part].add(m);return m}
  const box=(p,w,h,d,x,y,z)=>mesh(p,new THREE.BoxGeometry(w,h,d),x,y,z);
  const cyl=(p,r,h,x,y,z,rx=0,rz=0)=>mesh(p,new THREE.CylinderGeometry(r,r,h,segments),x,y,z,rx,rz);
  if(workshop){
   const signature=[...id].reduce((n,c)=>n+c.charCodeAt(0),0)%7;groups.engine.scale.z=1+signature*.025;
   box('engine',gt?.65:.34,.24,gt?.78:.38,0,ey,z);
   const trim=material(0,[0xb74935,0x2d99a5,0xe8b84c,0x99a8b8,0x5d79b0,0x85a45c,0x9d719e][signature]);mesh('engine',new THREE.BoxGeometry(gt?.38:.20,.04,.10),0,ey+.39,z,0,0,trim);
   const kind=def.engine,count={single:1,twin:2,inline6:6,v6:6,v8:8,v10:10,boxer:6}[kind]||6;
   for(let i=0;i<count;i++){const bank=kind==='single'||kind==='twin'||kind==='inline6'?0:i%2?1:-1,row=bank?Math.floor(i/2):i,n=bank?count/2:count,zz=z+(row-(n-1)/2)*(gt?.19:.14),xx=bank*(kind==='boxer'?.38:.22),angle=kind==='boxer'?bank*Math.PI/2:bank*.55;
    cyl('engine',gt?.12:.10,kind==='boxer'?.35:.28,xx,ey+.16,zz,0,angle);
    box('engine',.16,.06,.13,xx,ey+.31,zz);
   }
   const boost=levels.induction||0;
   if(kind==='single'||kind==='twin'){cyl('induction',.09+boost*.015,.22,.23,ey+.18,z,Math.PI/2)}
   else for(const side of [-1,1]){mesh('induction',new THREE.TorusGeometry(.12+boost*.025,.055,low?5:8,segments),side*.51,ey+.12,z+.25,Math.PI/2);box('induction',.10,.10,.65,side*.35,ey+.34,z)}
   box('gearbox',.32,.22,.42,0,ey-.05,z+(def.layout==='front'?-.6:.6));
   for(const side of [-1,1])cyl('suspension',.04,.62,side*.6,.6,gt?1.15:.6,0,side*.3);
  }
  for(const side of [-1,1]){
   if(workshop||levels.induction)cyl('induction',.06+(levels.induction||0)*.014,.32,side*(gt?.58:.35),.36,gt?-2.12:-1.05,Math.PI/2);
   for(const zz of gt?[-1.27,1.25]:[-.68,.65]){
    const x=side*(gt?1.02:.83),rad=gt?.34:.26;
    if(workshop||levels.brakes){cyl('brakes',rad*.62,.035,x,.36,zz,0,Math.PI/2);box('brakes',.07,.18,.12,x+side*.03,.38,zz+.12)}
    if(workshop||levels.tyres){const m=mesh('tyres',new THREE.TorusGeometry(rad-.04,.025+(levels.tyres||0)*.004,low?4:6,segments),x+side*.04,.36,zz);m.rotation.y=Math.PI/2;for(let n=0;n<5;n++){const angle=n*Math.PI*2/5;const spoke=box('tyres',.035,.025,rad*1.6,x+side*.045,.36,zz);spoke.rotation.x=angle}}
   }
  }
  if(workshop||levels.aero){const l=levels.aero||0,span=gt?1.9:1.4,back=gt?-1.88:-1.04;box('aero',span,.055,.25+l*.06,0,gt?1.4:.94,back);for(const side of [-1,1])box('aero',.06,.34,.08,side*span*.33,gt?1.22:.77,back)}
  if(workshop||levels.weight){for(const side of [-1,1])box('weight',.045,.13,gt?1.65:.80,side*(gt?.98:.65),.28,0)}
  // Batch fixed details by part and material; hotspots and installation groups stay separate.
  for(const [part,group]of Object.entries(groups)){const batches=new Map();for(const m of [...group.children]){m.updateMatrix();const geo=m.geometry.index?m.geometry.toNonIndexed():m.geometry.clone();geo.applyMatrix4(m.matrix);const list=batches.get(m.material)||[];list.push(geo);batches.set(m.material,list);group.remove(m);m.geometry.dispose()}for(const [mat,geos]of batches){const geo=new THREE.BufferGeometry();for(const [key,size]of [['position',3],['normal',3],['uv',2]]){const values=new Float32Array(geos.reduce((n,g)=>n+g.attributes[key].array.length,0));let at=0;for(const g of geos){values.set(g.attributes[key].array,at);at+=g.attributes[key].array.length}geo.setAttribute(key,new THREE.BufferAttribute(values,size))}geos.forEach(g=>g.dispose());const m=new THREE.Mesh(geo,mat);m.userData.part=part;group.add(m)}}
  const used=new Set();root.traverse(o=>{if(o.material)used.add(o.material)});for(const m of Object.values(mats))if(!used.has(m))m.dispose();
  root.userData.groups=groups;root.userData.engine={type:def.engine,layout:def.layout,position:new THREE.Vector3(0,ey,z)};return root;
 }
 function attach(vehicle,id,levels){if(!Object.values(levels||{}).some(Boolean))return;const old=vehicle.getObjectByName('Tuning '+id);if(old)dispose(old);vehicle.add(make(id,levels,false,typeof PREF!=='undefined'&&PREF.quality==='low'))}
 return {make,attach,dispose,isolateMaterials};
})();
