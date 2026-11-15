/* Road-conforming terrain: local segment height, not an average of nearby decks. */
(function(root){'use strict';
 function create(P,T,seg,border,noise=5){const N=P.length,cell=32,buckets=new Map();
  const key=(x,z)=>x+','+z;P.forEach((p,i)=>{const k=key(Math.floor(p.x/cell),Math.floor(p.z/cell));if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(i)});
  function candidates(x,z){const cx=Math.floor(x/cell),cz=Math.floor(z/cell),list=[];for(let a=-2;a<=2;a++)for(let b=-2;b<=2;b++){const q=buckets.get(key(cx+a,cz+b));if(q)list.push(...q)}if(!list.length)for(let i=0;i<N;i+=8)list.push(i);return list}
  function height(x,z){let best=Infinity,y=0,ceiling=Infinity;for(const i of candidates(x,z)){const p=P[i],q=P[(i+1)%N],dx=q.x-p.x,dz=q.z-p.z,u=Math.max(0,Math.min(1,((x-p.x)*dx+(z-p.z)*dz)/(dx*dx+dz*dz||1))),d=Math.hypot(x-p.x-u*dx,z-p.z-u*dz),h=p.y+(q.y-p.y)*u;
    if(d<best){best=d;y=h}if(d<border+20)ceiling=Math.min(ceiling,h-.3+Math.max(0,d-border-4)*.55)}
   const blend=Math.max(0,Math.min(1,(best-border-12)/140)),n=(Math.sin(x*.012)+Math.cos(z*.01)+Math.sin((x+z)*.02))*noise;
   return Math.min(ceiling,(y-1.2)*(1-blend)+n*blend);
  }
  function width(i,side,max){const p=P[i],t=T[i];let result=max;for(const j of candidates(p.x,p.z)){const arc=Math.min(Math.abs(j-i),N-Math.abs(j-i))*seg;if(arc<60)continue;const q=P[j],dx=q.x-p.x,dz=q.z-p.z,along=Math.abs(dx*t.x+dz*t.z),lateral=(dx*t.z-dz*t.x)*side;if(lateral>0&&along<max)result=Math.min(result,Math.max(border+.8,Math.hypot(dx,dz)*.46))}return result}
  return {height,width};
 }
 const api={create};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.KartTerrain=api;
})(typeof window!=='undefined'?window:globalThis);
