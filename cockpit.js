/* Driver-only GT3 interior; no additional model or texture downloads. */
window.KartCockpit={
 create(car,style=0){
  const g=new THREE.Group();g.name='GT3 cockpit';g.visible=false;car.add(g);
  const dark=new THREE.MeshStandardMaterial({color:0x111820,roughness:.9}),trim=new THREE.MeshStandardMaterial({color:0x314251,roughness:.65}),rubber=new THREE.MeshStandardMaterial({color:0x090b0f,roughness:1}),alloy=new THREE.MeshStandardMaterial({color:0x77818a,roughness:.5,metalness:.3}),ivory=new THREE.MeshStandardMaterial({color:0xd7dbe0,roughness:.85});
  for(const m of [dark,trim,rubber,alloy,ivory])m.userData.authoredScenery=true;
  function box(w,h,d,m,x,y,z,parent=g){const o=new THREE.Mesh(KartModels.rounded(w,h,d,.025),m);o.position.set(x,y,z);parent.add(o);return o}
  function beam(a,b,r,m){const A=new THREE.Vector3(...a),B=new THREE.Vector3(...b),o=new THREE.Mesh(new THREE.CylinderGeometry(r,r,A.distanceTo(B),8),m);o.position.copy(A).add(B).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),B.sub(A).normalize());g.add(o)}
  box(1.55,.20,.5,dark,0,.76,.65);box(1.58,.06,.55,trim,0,.88,.63);box(.23,.42,.85,dark,.23,.46,.02);box(1.6,.05,1.5,dark,0,.33,-.15);
  for(const side of [-1,1]){box(.07,.45,1.5,dark,side*.77,.61,-.12);beam([side*.73,.83,.85],[side*.58,1.28,.14],.035,trim);beam([side*.58,1.28,.14],[side*.6,1.27,-.85],.035,trim);box(.22,.06,.10,alloy,side*.75,.72,-.15);for(let n=0;n<4;n++)box(.012,.07,.012,alloy,side*.57+n*.022,.84,.38)}
  box(.20,.03,.37,trim,.23,.7,.16);for(let row=0;row<3;row++)for(let col=0;col<2;col++){const m=new THREE.MeshBasicMaterial({color:[0xf5c943,0xe55c4f,0x68a9cd][row]});box(.045,.025,.04,m,.18+col*.09,.73,.05+row*.09)}
  const wheel=new THREE.Group();wheel.position.set(-.34,.91,.25);g.add(wheel);
  let selectedWheel;
  function setWheel(value){if(selectedWheel){wheel.remove(selectedWheel);selectedWheel.traverse(o=>{if(o.geometry)o.geometry.dispose()})}selectedWheel=makeWheel(value);selectedWheel.name='Cockpit wheel '+value;selectedWheel.rotation.y=Math.PI;selectedWheel.scale.setScalar(.86);wheel.add(selectedWheel)}
  setWheel(style);wheel.rotation.x=-.18;
  for(const side of [-1,1]){box(.045,.13,.022,alloy,side*.12,0,.06,wheel);const glove=new THREE.Mesh(new THREE.SphereGeometry(.048,12,8),ivory);glove.position.set(side*.17,0,-.02);glove.scale.set(.7,1.1,.8);wheel.add(glove)}
  const canvas=document.createElement('canvas');canvas.width=384;canvas.height=160;const texture=new THREE.CanvasTexture(canvas);texture.encoding=THREE.sRGBEncoding;
  const screen=new THREE.Mesh(new THREE.PlaneGeometry(.39,.16),new THREE.MeshBasicMaterial({map:texture,toneMapped:false}));screen.material.userData.authoredScenery=true;screen.rotation.y=Math.PI;screen.position.set(.20,.91,.35);g.add(screen);box(.43,.20,.035,dark,.20,.91,.37);
  const ctx=canvas.getContext('2d');let previous='',last=-1;
  return {group:g,wheel,setWheel,update(speed,steer,now){if(!g.visible)return;wheel.rotation.z=-steer*1.25;const km=Math.round(Math.abs(speed)*3.6),gear=speed<-.5?'R':km<2?'N':String(Math.min(6,Math.floor(km/45)+1)),key=km+':'+gear;if(key===previous||now-last<.1)return;last=now;previous=key;ctx.fillStyle='#07121b';ctx.fillRect(0,0,384,160);for(let i=0;i<10;i++){ctx.fillStyle=i<(km%45)/4.5?(i>7?'#ff6055':'#68e6a0'):'#203640';ctx.fillRect(12+i*36,9,28,11)}ctx.textAlign='left';ctx.fillStyle='#e9f7ff';ctx.font='bold 91px Arial';ctx.fillText(String(km),14,111);ctx.font='22px Arial';ctx.fillStyle='#91c7d9';ctx.fillText('km/h',17,145);ctx.font='bold 108px Arial';ctx.fillStyle='#ffcf3b';ctx.fillText(gear,280,129);texture.needsUpdate=true}};
 }
};
