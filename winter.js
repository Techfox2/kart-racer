/* Seasonal geometry. Loaded only for snowy December/authorized preview races. */
window.KartWinter=(()=>{
 function merged(parts){const positions=[],uv=[];for(const [geometry,matrix] of parts){const g=geometry.index?geometry.toNonIndexed():geometry.clone();g.applyMatrix4(matrix);positions.push(...g.attributes.position.array);uv.push(...g.attributes.uv.array);g.dispose();geometry.dispose()}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.computeVertexNormals();return g}
 function trees(root,batches){
  const instances=[];for(const [id,transforms] of batches)if(id.startsWith('tree')){instances.push(...transforms);const old=root.getObjectByName(id);if(old){root.remove(old);old.geometry.dispose();old.material.dispose()}}
  if(!instances.length)return;
  const parts=[[],[],[],[],[],[]],o=new THREE.Object3D();
  function part(slot,g,x,y,z,sx=1,sy=1,sz=1){o.position.set(x,y,z);o.rotation.set(0,0,0);o.scale.set(sx,sy,sz);o.updateMatrix();parts[slot].push([g,o.matrix.clone()])}
  part(2,new THREE.CylinderGeometry(.035,.06,.45,7),0,.225,0);
  for(let i=0;i<3;i++){const r=.34-i*.075,h=.48-i*.045,y=.39+i*.20;part(0,new THREE.ConeGeometry(r,h,9),0,y,0);part(1,new THREE.ConeGeometry(r*.77,h*.77,9),0,y+h*.12+.012,0);
   for(let j=0;j<7;j++){const a=j*Math.PI*2/7+i*.6;part(3+j%2,new THREE.IcosahedronGeometry(.024,1),Math.cos(a)*r*.84,y-h*.27,Math.sin(a)*r*.84)}
  }
  part(5,new THREE.OctahedronGeometry(.063,0),0,1.04,0,1,.95,.3);
  const materials=[new THREE.MeshStandardMaterial({roughness:1}),new THREE.MeshStandardMaterial({roughness:1}),new THREE.MeshStandardMaterial({color:0x765034,roughness:1}),new THREE.MeshStandardMaterial({color:0xd94f47,roughness:.4}),new THREE.MeshStandardMaterial({color:0xf1bd42,roughness:.4}),new THREE.MeshStandardMaterial({color:0xffd45e,emissive:0xffd45e,emissiveIntensity:.25,roughness:.5})];
  for(const m of materials)m.userData.authoredScenery=true;KartStyle.apply(materials[0],22,[1,1],false);KartStyle.apply(materials[1],21,[1,1],false);
  parts.forEach((p,j)=>{const mesh=new THREE.InstancedMesh(merged(p),materials[j],instances.length);mesh.name='Christmas trees '+j;instances.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.castShadow=mesh.receiveShadow=true;mesh.frustumCulled=false;root.add(mesh)});
  // Existing rocks and bushes also receive the generated snow material.
  root.traverse(m=>{if(m.isMesh&&/^(rock_|plant_)/.test(m.name)){m.material.vertexColors=false;KartStyle.apply(m.material,21,[1,1],false);m.material.needsUpdate=true}});
 }
 function trails(scene,height){
  const capacity=900,material=new THREE.MeshBasicMaterial({transparent:true,opacity:.55,depthWrite:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2});material.userData.authoredScenery=true;
  KartStyle.texture(23,[1,1]).then(t=>{material.map=t;material.needsUpdate=true});
  material.onBeforeCompile=s=>{s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\n diffuseColor.a *= 1.0-smoothstep(0.40,0.88,dot(diffuseColor.rgb,vec3(0.3333))); diffuseColor.rgb=vec3(0.24,0.31,0.37);')};
  const geo=new THREE.PlaneGeometry(1,1);geo.rotateX(-Math.PI/2);const mesh=new THREE.InstancedMesh(geo,material,capacity);mesh.name='Snow tire trails';mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.count=0;scene.add(mesh);
  const previous=new WeakMap(),ages=new Float32Array(capacity),o=new THREE.Object3D();let cursor=0,time=0;
  return {mesh,update(dt,cars){time+=dt;let changed=false;
   for(const car of cars){if(!car.visible)continue;const h=car.rotation.y,x=car.position.x-Math.sin(h)*.75,z=car.position.z-Math.cos(h)*.75,last=previous.get(car);if(!last){previous.set(car,{x,z});continue}const distance=Math.hypot(x-last.x,z-last.z);if(distance<.5)continue;if(distance<6){o.position.set((x+last.x)/2,0,(z+last.z)/2);o.position.y=height(o.position.x,o.position.z,car)+.055;o.rotation.set(car.rotation.x,Math.atan2(x-last.x,z-last.z),car.rotation.z);o.scale.set(1.65,1,distance+.07);o.updateMatrix();mesh.setMatrixAt(cursor,o.matrix);ages[cursor]=time+25;cursor=(cursor+1)%capacity;mesh.count=Math.min(capacity,mesh.count+1);changed=true}previous.set(car,{x,z})}
   for(let i=0;i<mesh.count;i++)if(ages[i]&&ages[i]<time){o.scale.setScalar(0);o.updateMatrix();mesh.setMatrixAt(i,o.matrix);ages[i]=0;changed=true}if(changed)mesh.instanceMatrix.needsUpdate=true;
  }};
 }
 return {trees,trails};
})();
