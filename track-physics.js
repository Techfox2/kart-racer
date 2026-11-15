/* Collision normal from the actual visible barrier segment, not the centre-line tangent. */
window.KartTrackPhysics={
 segmentHit(cx,cz,r,A,B,inside,out){
  const ex=B.x-A.x,ez=B.z-A.z,len=Math.hypot(ex,ez);if(len<.0001)return 0;
  const raw=((cx-A.x)*ex+(cz-A.z)*ez)/(len*len),u=Math.max(0,Math.min(1,raw)),qx=A.x+ex*u,qz=A.z+ez*u,dx=cx-qx,dz=cz-qz,distance=Math.hypot(dx,dz);
  if(distance>r+3)return 0;
  let nx=-ez/len,nz=ex/len;if((inside.x-qx)*nx+(inside.z-qz)*nz<0){nx=-nx;nz=-nz}
  let signed=dx*nx+dz*nz;
  if(raw<0||raw>1){if(distance>=r)return 0;if(distance>.0001&&signed>=0){nx=dx/distance;nz=dz/distance;signed=distance}}
  const penetration=r-signed;if(penetration<=0)return 0;
  out.nx=nx;out.nz=nz;return penetration;
 }
};
