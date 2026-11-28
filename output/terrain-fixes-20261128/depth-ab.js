async page=>{
 const result=await page.evaluate(async()=>{
  const v=window.__terrainReview;v.suspended=true;v.onFrame=()=>{};v.near.features.traverse(o=>o.layers.set(0));
  v.near.mesh.material.polygonOffset=true;v.local.mesh.material.polygonOffset=true;
  const draw=Object.getPrototypeOf(v).draw;
  const canvas=document.createElement('canvas');canvas.width=720;canvas.height=450;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  const originalUpdate=v.camera.updateProjectionMatrix;
  const scenario=async(name,nearDivisor,offset,factor=-1,units=-5)=>{
   v.camera.updateProjectionMatrix=function(){this.near=Math.max(.012,v.view.distance/nearDivisor);return originalUpdate.call(this);};
   v.near.mesh.material.polygonOffset=offset;v.local.mesh.material.polygonOffset=offset;
   v.near.mesh.material.polygonOffsetFactor=factor;v.near.mesh.material.polygonOffsetUnits=units;
   v.local.mesh.material.polygonOffsetFactor=factor;v.local.mesh.material.polygonOffsetUnits=units;
   const initial={...v.view};let previous;const rows=[];
   for(let i=0;i<16;i++){
    v.view={...initial,bearing:initial.bearing+Math.sin(i*Math.PI/2)*.000001};
    draw.call(v,0,.016);ctx.drawImage(v.renderer.domElement,0,0,720,450);const p=ctx.getImageData(0,0,720,450).data;
    let changed=0,total=0,strong=0;if(previous)for(let j=0;j<p.length;j+=4){let d=0;for(let c=0;c<3;c++)d=Math.max(d,Math.abs(p[j+c]-previous[j+c]));total+=d;if(d>12)changed++;if(d>35)strong++;}
    rows.push({changed,strong,total});previous=p;await new Promise(requestAnimationFrame);
   }
   v.view=initial;return {name,near:v.camera.near,rows};
  };
  const rows=[];rows.push(await scenario('new-depth-old-projection',100,true));
  for(const patch of [v.base,v.region,v.local,v.near])patch.mesh.traverse(o=>{if(o.material?.vertexShader?.includes('vec3 visibleGround')){o.material.vertexShader=o.material.vertexShader.replace('gl_Position = projectionMatrix * viewMatrix * vec4(visibleGround, 1.0);','vec4 eyePosition = viewMatrix * vec4(visibleGround, 1.0); gl_Position = projectionMatrix * eyePosition;');o.material.needsUpdate=true;}});
  rows.push(await scenario('new-depth-eye-projection',100,true));
  v.camera.updateProjectionMatrix=originalUpdate;v.near.mesh.material.polygonOffset=true;v.local.mesh.material.polygonOffset=true;
  return rows;
 });
 return result;
}
