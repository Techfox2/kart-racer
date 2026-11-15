/* Original stylised Mediterranean harbour; no third-party textures or geometry. */
window.KartMonaco={create(P,T,border){
 const N=P.length,anchor=P[Math.round(N*.78)],cx=anchor.x+155,cz=anchor.z-18,rx=135,rz=155;
 function nearest(x,z){let d=Infinity,i=0;for(let j=0;j<N;j+=4){const q=(x-P[j].x)**2+(z-P[j].z)**2;if(q<d){d=q;i=j}}return {d:Math.sqrt(d),i}}
 function basin(x,z){const r=Math.hypot((x-cx)/rx,(z-cz)/rz);if(r>=1)return 0;return Math.max(0,Math.min(1,(1-r)*12,(nearest(x,z).d-border-12)/10))}
 function height(x,z,y){const b=basin(x,z);return y*(1-b)-7*b}
 function build(scene,terrain,winter){
  const g=new THREE.Group();g.name='Monaco harbour and terraces';scene.add(g);
  const mats={stone:new THREE.MeshStandardMaterial({color:0xc9b9a0,roughness:1}),roof:new THREE.MeshStandardMaterial({color:winter?0xe0edf0:0xb87960,roughness:1}),glass:new THREE.MeshStandardMaterial({color:0x476f83,roughness:.7}),white:new THREE.MeshStandardMaterial({color:0xf0e9d9,roughness:.8}),deck:new THREE.MeshStandardMaterial({color:0xc6a579,roughness:1}),water:new THREE.MeshStandardMaterial({color:0x2e929e,roughness:.35,metalness:.12})};Object.values(mats).forEach(m=>m.userData.authoredScenery=true);
  const batches=new Map(),o=new THREE.Object3D(),color=new THREE.Color();
  function box(mat,x,y,z,w,h,d,angle=0,tint){const list=batches.get(mat)||[];o.position.set(x,y,z);o.scale.set(w,h,d);o.rotation.set(0,angle,0);o.updateMatrix();list.push({matrix:o.matrix.clone(),color:color.setHex(tint??0xffffff).clone()});batches.set(mat,list)}
  const pos=[];for(let x=cx-rx;x<cx+rx;x+=5)for(let z=cz-rz;z<cz+rz;z+=5){const corners=[[x,z],[x+5,z],[x,z+5],[x+5,z+5]];if(corners.every(([a,b])=>basin(a,b)>.85))for(const j of [0,2,1,1,2,3])pos.push(corners[j][0],-3.9,corners[j][1])}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.computeVertexNormals();g.add(new THREE.Mesh(geo,mats.water));
  for(let n=0;n<10;n++){const x=cx-65+(n%3)*48,z=cz-100+Math.floor(n/3)*57;if(basin(x,z)<.95)continue;box(mats.white,x,-3.2,z,9,2,23);box(mats.deck,x,-2.1,z,7,.3,19);box(mats.white,x,-.9,z+1,6,2,10);box(mats.glass,x,.15,z+2,5,.7,7);box(mats.white,x,.6,z+2,5.6,.25,8);}
  const minX=Math.min(...P.map(p=>p.x)),maxX=Math.max(...P.map(p=>p.x)),minZ=Math.min(...P.map(p=>p.z)),maxZ=Math.max(...P.map(p=>p.z));let count=0;
  for(let x=minX-110;x<maxX+90;x+=31)for(let z=minZ-90;z<maxZ+85;z+=32){const n=nearest(x,z);if(n.d<border+26||n.d>125||basin(x,z)>.01)continue;const angle=Math.atan2(T[n.i].x,T[n.i].z),h=10+(count%5)*4,w=17+(count%3)*2,d=18,y=terrain(x,z),tint=[0xf0dcc0,0xe9c9ad,0xf0e7d7,0xd6b59f][count%4];
   box(mats.stone,x,y-1,z,w+4,2,d+4,angle);box(mats.white,x,y+h/2,z,w,h,d,angle,tint);box(mats.roof,x,y+h+.35,z,w+1,.8,d+1,angle);const sx=Math.cos(angle),sz=-Math.sin(angle),fx=Math.sin(angle),fz=Math.cos(angle);
   for(let floor=0;floor<Math.floor(h/3);floor++)for(const side of [-1,1]){box(mats.stone,x+fx*side*(d/2+.45),y+floor*3+.6,z+fz*side*(d/2+.45),w+1,.3,1.6,angle);for(let k=-1;k<=1;k++)box(mats.glass,x+sx*k*5+fx*side*(d/2+.02),y+floor*3+1.9,z+sz*k*5+fz*side*(d/2+.02),1.5,1.8,.08,angle)}count++;
  }
  for(const [mat,list]of batches){const mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),mat,list.length);list.forEach((v,i)=>{mesh.setMatrixAt(i,v.matrix);mesh.setColorAt(i,v.color)});mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;g.add(mesh)}return g;
 }
 return {height,build,basin};
}};
