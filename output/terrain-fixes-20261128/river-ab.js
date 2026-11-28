async page=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.evaluate(()=>{window.__terrainReview.suspended=false;location.hash='station/jiaoping';});
 await page.waitForFunction(()=>window.__terrainReview?.focus==='jiaoping'&&window.__terrainReview.local?.name==='jiaoping'&&!window.__terrainReview.waitingForTerrain&&!window.__terrainReview.flight,null,{timeout:90000});
 await page.evaluate(async()=>{const v=window.__terrainReview;await v.near.featuresReady;v.suspended=true;v.renderer.setPixelRatio(.5);v.zoom(.00001);v.view={...v.goal};v.cameraGroundY=undefined;});
 await page.emulateMedia({reducedMotion:'no-preference'});
 return await page.evaluate(async()=>{
  const v=window.__terrainReview,initial={...v.view},old=v.onFrame;v.onFrame=()=>{};
  const c=document.createElement('canvas');c.width=720;c.height=450;const ctx=c.getContext('2d',{willReadFrequently:true});
  const river=v.near.features.userData.river,material=river.material;
  const scenarios=[];
  for(const mode of ['original','eye-projection']){
   river.layers.set(mode==='no-river'?3:0);material.polygonOffset=mode==='matching-bias';material.polygonOffsetFactor=-1;material.polygonOffsetUnits=-5;
   if(mode==='eye-projection'){material.vertexShader=material.vertexShader.replace('gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);','vec4 eyePosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * eyePosition;');material.needsUpdate=true;}
   let previous;const frames=[];
   for(let i=0;i<16;i++){
    await new Promise(requestAnimationFrame);v.view={...initial,bearing:initial.bearing+Math.sin(i*Math.PI/2)*.000001};v.draw(17,.033);
    ctx.drawImage(v.renderer.domElement,0,0,720,450);const p=ctx.getImageData(0,0,720,450).data;let strong=0,blue=0;
    if(previous)for(let j=0;j<p.length;j+=4){let d=0;for(let k=0;k<3;k++)d=Math.max(d,Math.abs(p[j+k]-previous[j+k]));if(d>35){strong++;if(p[j+2]-p[j]>12||previous[j+2]-previous[j]>12)blue++;}}
    frames.push({strong,blue});previous=p;
   }
   scenarios.push({mode,frames});
  }
  river.layers.set(0);material.polygonOffset=false;v.view=initial;v.onFrame=old;
  return {scenarios,id:v.focus,near:v.camera.near,distance:v.view.distance};
 });
}
