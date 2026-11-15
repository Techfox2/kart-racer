/* Closed loft with outward, hard-edged end caps; body normals stay smooth. */
(function(root){'use strict';
 function loft(T,rings){const p=[],ix=[],n=rings[0].length;for(const ring of rings)for(const v of ring)p.push(...v);
  for(let j=0;j<rings.length-1;j++)for(let k=0;k<n;k++){const a=j*n+k,b=j*n+(k+1)%n,c=(j+1)*n+k,d=(j+1)*n+(k+1)%n;ix.push(a,c,b,b,c,d)}
  for(const j of [0,rings.length-1]){const offset=p.length/3;for(const v of rings[j])p.push(...v);for(let k=1;k<n-1;k++)ix.push(offset,offset+k+(j===0?0:1),offset+k+(j===0?1:0))}
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(p,3));geometry.setIndex(ix);geometry.computeVertexNormals();return geometry;
 }
 const api={loft};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.KartVehicleGeometry=api;
})(typeof window!=='undefined'?window:globalThis);
