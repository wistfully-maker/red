async page => {
 await page.setViewportSize({width:1440,height:900});
 await page.waitForFunction(()=>window.__terrainReview?.local?.name==='hadapu'&&!window.__terrainReview.waitingForTerrain&&!window.__terrainReview.flight,null,{timeout:90000});
 await page.evaluate(()=>{const v=window.__terrainReview;v.zoom(.00001);});
 await page.waitForTimeout(4000);
 const result=await page.evaluate(async()=>{
  const v=window.__terrainReview;
  const trace=async(label,change)=>{
   change?.();
   const canvas=document.createElement('canvas');canvas.width=360;canvas.height=225;
   const ctx=canvas.getContext('2d',{willReadFrequently:true}),old=v.onFrame,rows=[];let previous;
   await new Promise(resolve=>{v.onFrame=function(w){old(w);ctx.drawImage(w.renderer.domElement,0,0,360,225);const p=ctx.getImageData(0,0,360,225).data;
    let changed=0,total=0,max=0;if(previous)for(let i=0;i<p.length;i+=4){const d=Math.max(...[0,1,2].map(c=>Math.abs(p[i+c]-previous[i+c])));total+=d;max=Math.max(max,d);if(d>12)changed++;}
    rows.push({changed,total,max,camera:w.camera.position.toArray(),distance:w.view.distance,pitch:w.view.pitch});previous=p;
    if(rows.length===90){v.onFrame=old;resolve();}};});
   return {label,rows};
  };
  const before=await trace('normal');
  const draw=v.draw;v.draw=function(time,dt){return draw.call(this,0,dt)};
  const calm=await trace('time-fixed');
  const offset=await trace('time-fixed-no-polygon-offset',()=>{v.near.mesh.material.polygonOffset=false;v.local.mesh.material.polygonOffset=false;});
  const nofeatures=await trace('time-fixed-no-features',()=>{v.near.features.visible=false;v.near.features.traverse(o=>{o.layers.set(3);});});
  v.draw=draw;
  return {view:v.view,goal:v.goal,near:v.camera.near,far:v.camera.far,local:v.local.name,patches:[v.base,v.region,v.local,v.near].map(p=>({name:p.name,bounds:p.bounds,cut:p.mesh.material.uniforms.cut.value.toArray(),cutting:p.mesh.material.uniforms.hasCut.value,features:p.features?.children.map(c=>({kind:c.material.type,count:c.geometry.attributes.position.count}))})),traces:[before,calm,offset,nofeatures]};
 });
 await page.screenshot({path:'output/terrain-fixes-20261128/hadapu-diagnose.png'});
 return result;
}
