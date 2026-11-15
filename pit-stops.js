/* Stylised service bays near the real circuits' start/finish pit complexes.
   Positions are gameplay approximations; references: assets/tracks/SOURCES.md. */
window.KartPits=(()=>{
 const layouts={circuit:[-95,-10],snow:[-80,-8],indoor:[-90,-16],spa:[-110,-15],monaco:[-115,-12],monza:[-210,-15],nurburgring:[-155,-12],shanghai:[-200,-15],switchback:[-72,-12],hairpin:[-72,-12]};
 const words={de:{pit:'BOXENSTOPP',damage:'MOTORSCHADEN · BOXENSTOPP',fixed:'REPARIERT',stop:'ANHALTEN'},en:{pit:'PIT STOP',damage:'ENGINE DAMAGE · PIT STOP',fixed:'REPAIRED',stop:'STOP'},fr:{pit:'ARRÊT AUX STANDS',damage:'PANNE MOTEUR · STANDS',fixed:'RÉPARÉ',stop:'ARRÊTE-TOI'}};
 const label=k=>(words[document.documentElement.lang]||words.de)[k];
 function create(id,P,T,seg,W,BW,co){
  const N=P.length,length=N*seg,[from,to]=layouts[id],ramp=Math.min(24,(to-from)*.23),centre=(from+to)/2;
  const distance=k=>{const d=((k*seg%length)+length)%length;return d>length/2?d-length:d};
  const blend=k=>{const d=distance(k),u=Math.max(0,Math.min(1,(d-from)/ramp,(to-d)/ramp));return u*u*(3-2*u)};
  const boundary=(k,o)=>co(k,o+(o<0?-Math.max(0,W/2+9-BW)*blend(k):0));
  const contains=(k,lat,repair=false)=>{const d=distance(k),margin=repair?ramp:0,near=W/2+(repair?1.5:-.6),far=Math.abs(co(k,-W/2-7))-(repair?1.2:0);return d>=from+margin&&d<=to-margin&&-lat>=near&&-lat<=far};
  const bay={from,to,centre,ramp,N,seg,W,BW,distance,blend,boundary,contains,side:-1,indoor:id==='indoor'};
  return bay;
 }
 function step(pl,bay,dt,active){
  if(!pl.pit)return false;
  if(!active||!bay.contains(pl.idx,pl.lat||0,true)||Math.hypot(pl.vx||0,pl.vz||0)>=.6){pl.pitT=0;return false}
  pl.pitT=Math.min(5,(pl.pitT||0)+Math.max(0,dt));
  if(pl.pitT>=5-1e-8){pl.pit=false;pl.pitT=0;return true}return false;
 }
 function build(scene,bay,P,T,co){
  const root=new THREE.Group();root.name='Pit service area';const {N,seg,W,from,to,ramp}=bay;
  const index=d=>(Math.round(d/seg)%N+N)%N;
  function ribbon(start,end,inner,outer,y,mat,name){
   const pos=[],uv=[],ix=[],a=Math.floor(start/seg),b=Math.ceil(end/seg);
   for(let j=a;j<=b;j++){const k=(j%N+N)%N,p=P[k],t=T[k],s=bay.blend(k),u=co(k,inner),v=co(k,typeof outer==='function'?outer(s):outer);pos.push(p.x+t.z*u,p.y+y,p.z-t.x*u,p.x+t.z*v,p.y+y,p.z-t.x*v);uv.push(0,j*seg/8,1,j*seg/8);if(j<b){const q=(j-a)*2;ix.push(q,q+1,q+2,q+1,q+3,q+2)}}
   const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();const m=new THREE.Mesh(g,mat);m.name=name;m.receiveShadow=true;root.add(m);return m;
  }
  const asphalt=pbr(new THREE.MeshStandardMaterial({roughness:.86,side:THREE.DoubleSide}),bay.winter?'WinterRoad':'Asphalt012',[1,1]);
  ribbon(from,to,-W/2+.6,s=>-W/2-7*s,.12,asphalt,'Pit lane');
  const mat=new THREE.MeshBasicMaterial({color:0xffd24a,transparent:true,opacity:.28,side:THREE.DoubleSide,depthWrite:false});
  ribbon(from+ramp,to-ramp,-W/2-1.5,-W/2-5.8,.14,mat,'Repair zone');
  const white=new THREE.MeshBasicMaterial({color:0xffd24a,side:THREE.DoubleSide});
  ribbon(from+ramp,to-ramp,-W/2-1.4,-W/2-1.6,.15,white,'Pit marking');
  ribbon(from+ramp,to-ramp,-W/2-5.7,-W/2-5.9,.15,white,'Pit marking');
  function box(w,h,d,material,x,y,z,parent){const m=new THREE.Mesh(KartModels.rounded(w,h,d,.12),material);m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;parent.add(m);return m}
  const steel=new THREE.MeshStandardMaterial({color:0xe8dfc9,roughness:.85,metalness:0}),cyan=new THREE.MeshStandardMaterial({color:0xf5c944,roughness:.65}),door=new THREE.MeshStandardMaterial({color:0x427f9c,roughness:.65,metalness:.08});
  const k=index(bay.centre),p=P[k],t=T[k],garage=new THREE.Group(),offset=bay.boundary(k,-bay.BW)-3.3;
  garage.position.set(p.x+t.z*offset,p.y,p.z-t.x*offset);garage.rotation.y=Math.atan2(t.x,t.z);
  box(5.4,4.3,18,steel,0,2.15,0,garage);box(6,.25,19,cyan,0,4.4,0,garage);
  for(const z of [-6,0,6]){box(.12,3.2,4.8,door,2.74,1.7,z,garage);for(let h=.5;h<3.1;h+=.5)box(.15,.045,4.6,cyan,2.82,h,z,garage)}
  // A compact sign faces drivers approaching the service lane.
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;const ctx=canvas.getContext('2d');ctx.fillStyle='#17283b';ctx.fillRect(0,0,512,128);ctx.fillStyle='#ffd24a';ctx.font='bold 66px sans-serif';ctx.textAlign='center';ctx.fillText('PIT  5s',256,87);const texture=new THREE.CanvasTexture(canvas);texture.encoding=THREE.sRGBEncoding;
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(5.4,1.35),new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide}));sign.position.set(0,4.1,-9.2);garage.add(sign);
  const entry=index(from+ramp),ep=P[entry],et=T[entry],eo=co(entry,-W/2-3.6),marker=sign.clone();marker.position.set(ep.x+et.z*eo,ep.y+3.4,ep.z-et.x*eo);marker.rotation.y=Math.atan2(et.x,et.z);root.add(marker);
  garage.visible=!bay.indoor;root.add(garage);KartStyle.apply(asphalt,16,[1,1],false);KartStyle.environment(root);scene.add(root);return mat;
 }
 return {create,step,build,label,layouts};
})();
