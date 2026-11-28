async page=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:1440,height:900});
 const cdp=await page.context().newCDPSession(page);await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('http://127.0.0.1:8873/?terrainReview=1&renderFix='+Date.now()+'#station/hadapu');
 await page.waitForFunction(()=>window.__terrainReview?.focus==='hadapu'&&!window.__terrainReview.waitingForTerrain&&!window.__terrainReview.flight,null,{timeout:90000});
 if(!await page.evaluate(()=>window.__terrainReview.draw.toString().includes('distance / 100')))throw Error('Stale terrain module');
 // The loop below owns requestAnimationFrame and draws every sampled frame.
 // Avoid also rendering an unrelated background frame during GPU warm-up.
 await page.evaluate(()=>window.__terrainReview.renderer.setAnimationLoop(null));
 const ids=await page.evaluate(()=>Object.keys(window.__terrainReview.data.stations));
 const named=new Set(['hadapu','huining','jiangtai','ruijin','yudu','luding']);
 const results=[];
 for(const id of ids){
  await page.evaluate(id=>{window.__terrainReview.suspended=false;location.hash='station/'+id;},id);
  await page.waitForFunction(id=>window.__terrainReview?.focus===id&&window.__terrainReview.local?.name===id&&!window.__terrainReview.waitingForTerrain&&!window.__terrainReview.flight,id,{timeout:90000});
  await page.evaluate(async()=>{const v=window.__terrainReview;await v.near?.featuresReady;v.suspended=true;v.renderer.setPixelRatio(.5);v.zoom(.000001);v.view={...v.goal};v.cameraVelocity={};v.cameraGroundY=undefined;});
  await page.emulateMedia({reducedMotion:'no-preference'});
  const result=await page.evaluate(async({id,long})=>{
   const v=window.__terrainReview,initial={...v.goal},old=v.onFrame;
   const c=document.createElement('canvas');c.width=720;c.height=450;
   const ctx=c.getContext('2d',{willReadFrequently:true});let previous;
   const frames=[];v.onFrame=()=>{};
   // Render consecutive animation frames through the real scene/film pipeline.
   // First keep the camera fixed, then add a subpixel orbit, then approach the
   // same imagery floor with the production camera follower.
   const phases=[['fixed',4],['subpixel',12]];
   for(const [phase,count] of phases){
    previous=null;if(phase==='approach'){v.view={...initial,distance:initial.distance*1.025};v.goal={...initial};v.cameraVelocity={};}
    for(let i=0;i<count;i++){
     await new Promise(requestAnimationFrame);
     if(phase==='subpixel')v.view={...initial,bearing:initial.bearing+Math.sin(i*Math.PI/2)*.000001};
     else if(phase==='fixed')v.view={...initial};
     else v.updateFlight(v.clock.getElapsedTime(),.033);
     v.draw(17,.033);ctx.drawImage(v.renderer.domElement,0,0,720,450);const p=ctx.getImageData(0,0,720,450).data;
     let changed=0,strong=0,blue=0,total=0;
     if(previous)for(let j=0;j<p.length;j+=4){let d=0;for(let k=0;k<3;k++)d=Math.max(d,Math.abs(p[j+k]-previous[j+k]));total+=d;if(d>12)changed++;if(d>35){strong++;if(p[j+2]-p[j]>12||previous[j+2]-previous[j]>12)blue++;}}
     frames.push({phase,changed,strong,blue,total,distance:v.view.distance,camera:v.camera.position.toArray(),near:v.camera.near});previous=p;
    }
    v.view={...initial};v.goal={...initial};
   }
   v.onFrame=old;v.view={...initial};v.cameraGroundY=v.height(initial.x,initial.z);v.draw(17,.033);
   let arrivals=0;const onArrival=()=>arrivals++;v.container.addEventListener('luding-arrival',onArrival);
   for(let i=0;i<8;i++)v.zoom(.5);
   v.container.removeEventListener('luding-arrival',onArrival);
   return {id,frames,limit:v.zoomMinimum(),goal:v.goal.distance,display:document.body.dataset.display,hash:location.hash,arrivals,features:v.near?.features?.children.length||0,waterShader:!v.near.features.userData.river||v.near.features.userData.river.material.vertexShader.includes('vec4 eyePosition'),shader:v.near.mesh.material.vertexShader.includes('vec4 eyePosition'),clipped:v.camera.near>=Math.max(.09,initial.distance*.013)};
  },{id,long:named.has(id)});
  results.push(result);
  if(named.has(id)||id==='jiaoping'){
   await page.evaluate(()=>{const v=window.__terrainReview;v.renderer.setPixelRatio(1);v.draw(17,.033);});
   await page.screenshot({path:'output/terrain-fixes-20261128/'+id+'-max-fixed.png'});
  }
  await page.emulateMedia({reducedMotion:'reduce'});
 }
 return {results,errors,totalFrames:results.reduce((n,r)=>n+r.frames.length,0)};
}
