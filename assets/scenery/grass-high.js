/* Original procedural grass geometry. Loaded on demand exclusively for High quality. */
window.KartHighGrass={build(scene,points,settings){
 const geometry=new THREE.BufferGeometry(),positions=[],colors=[];
 for(let blade=0;blade<3;blade++){const angle=blade*Math.PI*2/3,dx=Math.cos(angle)*.07,dz=Math.sin(angle)*.07,leanX=Math.sin(angle)*.13,leanZ=Math.cos(angle)*.13,height=.32+blade*.09;positions.push(-dx,0,-dz,dx,0,dz,leanX+dx*.45,height*.55,leanZ+dz*.45,-dx,0,-dz,leanX+dx*.45,height*.55,leanZ+dz*.45,leanX-dx*.45,height*.55,leanZ-dz*.45,leanX-dx*.45,height*.55,leanZ-dz*.45,leanX+dx*.45,height*.55,leanZ+dz*.45,leanX*1.5,height,leanZ*1.5);for(let j=0;j<9;j++){const tip=j===8;colors.push(tip?.76:.5,tip?.91:.69,tip?.55:.36)}}
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.computeVertexNormals();
 const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,side:THREE.DoubleSide});material.userData.authoredScenery=true;
 const count=Math.min(2400,Math.max(800,points.length)),mesh=new THREE.InstancedMesh(geometry,material,count),transform=new THREE.Object3D(),color=new THREE.Color();mesh.name='High detail grass';mesh.userData.highGrass=true;mesh.receiveShadow=true;mesh.frustumCulled=false;
 let seed=(settings.seed^0x72534)>>>0,used=0;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
 for(let attempt=0;attempt<count*3&&used<count;attempt++){const index=Math.floor(random()*points.length),p=points[index],next=points[(index+1)%points.length],dx=next.x-p.x,dz=next.z-p.z,len=Math.hypot(dx,dz)||1,side=random()<.5?-1:1,offset=side*(settings.border+11+random()*28),x=p.x+dz/len*offset,z=p.z-dx/len*offset;
  let clear=true;for(let k=0;k<points.length;k+=3)if(Math.hypot(x-points[k].x,z-points[k].z)<settings.border+9){clear=false;break}if(!clear)continue;
  const y=settings.height(x,z),scale=.8+random()*.9;transform.position.set(x,y-.015,z);transform.rotation.y=random()*Math.PI*2;transform.scale.set(scale,scale*(.8+random()*.5),scale);transform.updateMatrix();mesh.setMatrixAt(used,transform.matrix);color.setHex([0x97b679,0x7eaa68,0xa7b579,0x77955e][used%4]);mesh.setColorAt(used,color);used++;
 }
 mesh.count=used;scene.add(mesh);return mesh;
}};
