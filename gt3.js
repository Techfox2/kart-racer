/* Hand-authored stylized GT3 meshes. No downloaded third-party vehicle geometry. */
window.KartGT3={
 cars:[['porsche','Porsche 911 GT3 RS'],['amg','Mercedes-AMG GT3'],['ferrari','Ferrari 296 GT3']],prices:{porsche:0,amg:1500,ferrari:2200},valid:id=>['porsche','amg','ferrari'].includes(id)?id:'porsche',
 make(color,wstyle,scene,id){
 id=this.valid(id);const porsche=id==='porsche',amg=id==='amg',g=new THREE.Group(),body=new THREE.Group();g.add(body);
 const low=typeof PREF!=='undefined'&&PREF.quality==='low',segments=low?16:28;
 const paint=new THREE.MeshPhysicalMaterial({color,metalness:.38,roughness:.25,clearcoat:low?0:1,clearcoatRoughness:.18}),carbon=new THREE.MeshStandardMaterial({color:0x141b23,roughness:.62,metalness:.15}),glass=new THREE.MeshPhysicalMaterial({color:0x153449,metalness:.35,roughness:.12,clearcoat:1}),rubber=new THREE.MeshStandardMaterial({color:0x111419,roughness:.96}),rim=new THREE.MeshStandardMaterial({color:0xb7c1cd,metalness:.8,roughness:.24}),rimDark=new THREE.MeshStandardMaterial({color:0x37424e,metalness:.7,roughness:.3}),lights=new THREE.MeshStandardMaterial({color:0xe6f8ff,emissive:0x9cdfff,emissiveIntensity:.7}),tl=new THREE.MeshStandardMaterial({color:0xd52132,emissive:0}),caliper=new THREE.MeshStandardMaterial({color:porsche?0xefe037:0xe83e31,roughness:.4});
 for(const m of [paint,carbon,glass,rubber,rim,rimDark,lights,tl,caliper]){m.color.convertSRGBToLinear();m.userData.authoredScenery=true}paint.userData.baseColor=color;paint.userData.livery='original';
  const parts=[];
 const add=(geo,mat,x=0,y=0,z=0,parent=body)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=false;parent.add(m);if(parent===body)parts.push(m);return m};
 const box=(w,h,d,mat,x,y,z,parent)=>add(new THREE.BoxGeometry(w,h,d),mat,x,y,z,parent);
 const oval=(x,y,z,sx,sy,sz,mat)=>{const m=add(new THREE.SphereGeometry(1,segments,10),mat,x,y,z);m.scale.set(sx,sy,sz);return m};
 const patch=(points,mat,parent=body)=>{const positions=[],indices=[];points.forEach(p=>positions.push(...p));for(let i=1;i<points.length-1;i++)indices.push(0,i,i+1);const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setIndex(indices);geo.computeVertexNormals();const m=add(geo,mat,0,0,0,parent);m.material.side=THREE.DoubleSide;return m};
 const beam=(from,to,r,mat,parent=body)=>{const a=new THREE.Vector3(...from),b=new THREE.Vector3(...to),m=add(new THREE.CylinderGeometry(r,r,a.distanceTo(b),6),mat,...a.clone().add(b).multiplyScalar(.5).toArray(),parent);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.sub(a).normalize());return m};
 function loft(rings,mat){return add(KartVehicleGeometry.loft(THREE,rings),mat)}
 // Sculpted shoulder line, tapered nose and open wheel-arch lower edges.
 const rings=[],cabinZ=amg?-.48:porsche?-.20:.04;
 for(let i=0;i<=64;i++){const z=-2.08+i*4.16/64,ends=Math.pow(Math.abs(z)/2.1,7),arch=Math.min(Math.abs(z-1.25),Math.abs(z+1.27)),fender=Math.exp(-Math.pow(arch/.45,2));const width=(amg?.96:porsche?.965:.98)-ends*.17+fender*.055,top=(porsche?.83:amg?.84:.77)+fender*.12-ends*.14+(z<-.9&&porsche?.05:0),bottom=arch<.46?.37+Math.sqrt(.46*.46-arch*arch):.34;
 const safeTop=Math.max(top,bottom+.06),cockpitFloor=z>cabinZ-.85&&z<cabinZ+.58?.46:safeTop+.035;
 rings.push([[-width,bottom,z],[-width,Math.max(bottom+.025,safeTop-.1),z],[-width*.86,safeTop,z],[-width*.4,cockpitFloor,z],[width*.4,cockpitFloor,z],[width*.86,safeTop,z],[width,Math.max(bottom+.025,safeTop-.1),z],[width,bottom,z]])}loft(rings,paint);
 box(1.52,.12,3.65,carbon,0,.32,0);box(2.04,.055,.36,carbon,0,.29,1.98);box(1.95,.06,.31,carbon,0,.3,-1.98);
 const rz=cabinZ-.60,fz=cabinZ+.35,back=cabinZ-1.05,front=cabinZ+.92,roof=porsche?1.4:amg?1.35:1.29;
 const cabin=loft([[[-.79,.89,back],[-.62,.98,back],[.62,.98,back],[.79,.89,back]],[[-.76,.89,rz],[-.60,roof-.025,rz],[.60,roof-.025,rz],[.76,.89,rz]],[[-.75,.89,fz],[-.60,roof,fz],[.60,roof,fz],[.75,.89,fz]],[[-.78,.87,front],[-.73,.92,front],[.73,.92,front],[.78,.87,front]]],glass);
 const roofMesh=loft([[[-.61,roof-.035,rz-.09],[-.46,roof+.025,rz-.09],[.46,roof+.025,rz-.09],[.61,roof-.035,rz-.09]],[[-.61,roof-.005,fz+.035],[-.46,roof+.05,fz+.035],[.46,roof+.05,fz+.035],[.61,roof-.005,fz+.035]]],paint);
 // Roof pillars, window frames, mirrors and door shut lines.
 for(const side of [-1,1]){beam([side*.78,.9,front],[side*.61,roof,fz],.035,paint);beam([side*.78,.9,back],[side*.61,roof-.025,rz],.045,paint);beam([side*.76,.91,cabinZ-.30],[side*.61,roof,cabinZ-.30],.022,carbon);beam([side*.77,.89,back],[side*.78,.89,front],.02,carbon);
 beam([side*.83,.91,cabinZ+.65],[side*1.06,1.04,cabinZ+.59],.025,carbon);oval(side*1.10,1.045,cabinZ+.58,.13,.065,.19,paint);
 box(.075,.13,1.54,carbon,side*1.005,.34,0);box(.012,.022,.24,rimDark,side*.981,.79,cabinZ-.43);
 beam([side*.985,.41,-.71],[side*.99,.79,-.71],.009,carbon);beam([side*.99,.79,-.71],[side*.99,.79,.65],.009,carbon);
 for(const z of [1.25,-1.27]){const curve=new THREE.CatmullRomCurve3(Array.from({length:19},(_,i)=>{const angle=i*Math.PI/18;return new THREE.Vector3(side*1.022,.38+Math.sin(angle)*.447,z+Math.cos(angle)*.447)}));add(new THREE.TubeGeometry(curve,18,.018,5,false),carbon)}
 // Front lamp housings and distinctive light signatures.
 if(porsche){const housing=oval(side*.70,.878,1.72,.21,.055,.29,carbon);housing.rotation.x=.35;const lamp=oval(side*.70,.903,1.72,.175,.025,.245,glass);lamp.rotation.x=.35;for(const x of [-.065,.065])for(const z of [-.10,.10])oval(side*.70+x,.93,1.72+z,.035,.015,.046,lights);}
 else {const z=1.91,x=side*.69;patch([[x-side*.27,.77,z-.03],[x+side*.24,.82,z-.07],[x+side*.22,.72,z+.035],[x-side*.24,.70,z+.06]],carbon);beam([x-side*.23,.785,z+.01],[x+side*.19,.79,z-.035],.021,lights);if(!amg)beam([x-side*.23,.785,z+.01],[x-side*.23,.735,z+.025],.018,lights)}
 box(.35,.16,.075,carbon,side*.76,.49,2.025);for(let j=0;j<3;j++)box(.30,.013,.025,rimDark,side*.76,.44+j*.045,2.071);
 // Brake lights and side air intakes.
 if(porsche){box(.83,.035,.04,tl,side*.45,.78,-2.065);for(let n=0;n<6;n++)box(.10,.012,.025,carbon,side*(.12+n*.085),.88,-1.65);}else if(amg){const m=box(.55,.055,.045,tl,side*.65,.77,-2.07);m.rotation.z=-side*.12}else{const lamp=box(.31,.065,.045,tl,side*.65,.75,-2.085);box(.21,.026,.05,carbon,side*.65,.75,-2.09)}
 if(!porsche){patch([[side*1.024,.43,-.73],[side*1.04,.78,-.78],[side*1.014,.71,-.18],[side*1.014,.51,-.28]],carbon);beam([side*1.03,.43,-.73],[side*1.015,.71,-.18],.024,paint)}
 // Swan-neck / pedestal rear wing supports and thin endplates.
 if(porsche){beam([side*.65,.83,-1.4],[side*.65,1.49,-1.58],.035,carbon);beam([side*.65,1.49,-1.58],[side*.65,1.49,-1.87],.035,carbon)}else beam([side*.66,.84,-1.50],[side*.66,1.37,-1.78],.04,carbon);
 box(.035,.23,.58,carbon,side*1.095,porsche?1.38:1.28,-1.81);
 }
 const wing=box(2.20,.065,.55,carbon,0,porsche?1.40:1.30,-1.81);wing.rotation.x=-.10;
 box(amg?1.30:.92,amg?.29:.22,.06,carbon,0,.52,2.09);if(amg){for(let x=-.50;x<.51;x+=.10)box(.018,.18,.028,rim,x,.52,2.13)}else for(let x=-.4;x<.41;x+=.10)box(.014,.13,.02,rimDark,x,.50,2.13);
 for(const side of [-1,1])for(let i=0;i<(porsche?4:3);i++){const vent=box(.24,.012,.035,carbon,side*.67,.96,1.30-i*.09);if(!porsche)vent.position.set(side*.30,.87,1.22-i*.09)}
 for(let x=-.7;x<=.7;x+=.23)box(.025,.14,.36,carbon,x,.31,-2.02);
 for(const side of [-1,1]){const pipe=add(new THREE.CylinderGeometry(.07,.07,.16,14),rim,side*(porsche?.20:.60),.42,-2.10);pipe.rotation.x=Math.PI/2;const hole=add(new THREE.CylinderGeometry(.048,.048,.17,12),carbon,side*(porsche?.20:.60),.42,-2.11);hole.rotation.x=Math.PI/2;}
 // Merge static details by material to keep seven-car grids inexpensive.
 const hide=[cabin,roofMesh],batches=new Map();for(const m of parts){if(hide.includes(m))continue;m.updateMatrix();const geo=m.geometry.index?m.geometry.toNonIndexed():m.geometry.clone();geo.applyMatrix4(m.matrix);const list=batches.get(m.material)||[];list.push(geo);batches.set(m.material,list);body.remove(m);m.geometry.dispose()}
 for(const [mat,geos] of batches){const p=[],n=[];for(const geo of geos){p.push(...geo.attributes.position.array);n.push(...geo.attributes.normal.array);geo.dispose()}const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geo.setAttribute('normal',new THREE.Float32BufferAttribute(n,3));const m=new THREE.Mesh(geo,mat);m.castShadow=true;m.receiveShadow=false;body.add(m)}
 const wheels=[],pivots=[];
 for(const [x,z,frontWheel] of [[-1.015,1.25,1],[1.015,1.25,1],[-1.025,-1.27,0],[1.025,-1.27,0]]){const pivot=new THREE.Group();pivot.position.set(x,.38,z);g.add(pivot);const wheel=new THREE.Group();pivot.add(wheel);wheels.push(wheel);if(frontWheel)pivots.push(pivot);const sign=Math.sign(x);
 const tire=add(new THREE.CylinderGeometry(.375,.375,.27,segments),rubber,0,0,0,wheel);tire.rotation.z=Math.PI/2;
 const disc=add(new THREE.CylinderGeometry(.248,.248,.026,segments),rimDark,sign*.145,0,0,wheel);disc.rotation.z=Math.PI/2;
 const lip=add(new THREE.TorusGeometry(.262,.018,6,segments),rim,sign*.161,0,0,wheel);lip.rotation.y=Math.PI/2;
 const spokeGeo=new THREE.BufferGeometry(),positions=[],normals=[];for(let i=0;i<10;i++){const a=i*Math.PI/5,geo=new THREE.BoxGeometry(.027,.026,.23);geo.rotateX(a);geo.translate(sign*.166,-Math.sin(a)*.145,Math.cos(a)*.145);const flat=geo.toNonIndexed();positions.push(...flat.attributes.position.array);normals.push(...flat.attributes.normal.array);geo.dispose();flat.dispose()}spokeGeo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));spokeGeo.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));add(spokeGeo,rim,0,0,0,wheel);
 const cap=add(new THREE.CylinderGeometry(.067,.067,.035,12),carbon,sign*.18,0,0,wheel);cap.rotation.z=Math.PI/2;box(.035,.13,.06,caliper,sign*.135,.06,-.15,pivot);
 }
 const steerG=new THREE.Group();steerG.position.set(-.34,1.0,.25);steerG.add(makeWheel(wstyle));steerG.scale.setScalar(.65);body.add(steerG);const driver=KartModels.driver(color);driver.scale.setScalar(.60);driver.position.set(-.34,.08,-.25);body.add(driver);
 g.rotation.order='YXZ';g.userData={vehicle:'gt3',car:id,body,wheels,pivots,tl,steerG,fpHide:[driver,...hide],modelRevision:3};scene.add(g);return g;
 }
};
