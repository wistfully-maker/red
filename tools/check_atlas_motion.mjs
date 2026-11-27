import assert from 'node:assert/strict';
import * as camera from '../assets/atlas-camera.js';

assert.equal(typeof camera.nearestBearing,'function','Missing shortest-arc bearing interpolation');
assert.equal(typeof camera.sampleAtlasFlight,'function','Missing continuous atlas flight sampler');
assert.equal(typeof camera.stepAtlasCamera,'function','Missing velocity-continuous camera follow');
const from={x:0,z:0,distance:8,pitch:.7,bearing:6.20};
const to={x:400,z:-250,distance:11,pitch:.8,bearing:.05};
const adjusted=camera.nearestBearing(from,to);
assert.ok(Math.abs(adjusted.bearing-from.bearing)<.2);
let previous=camera.sampleAtlasFlight(from,adjusted,0);
assert.deepEqual(previous,from);
for(let n=1;n<=400;n++){
  const view=camera.sampleAtlasFlight(from,adjusted,n/400);
  assert.ok(Object.values(view).every(Number.isFinite));
  assert.ok(view.distance>0 && view.pitch>=.6 && view.pitch<=1.3);
  assert.ok(Math.abs(view.bearing-previous.bearing)<.01,'Bearing took the long arc');
  previous=view;
}
assert.deepEqual(previous,adjusted);
const first=camera.sampleAtlasFlight(from,adjusted,.001);
assert.ok(Math.hypot(first.x-from.x,first.z-from.z)<.001,'Nonzero departure velocity');
let view={...from},velocity={};const goal={...from,distance:30,bearing:.05};
let lastVelocity=0;
for(let n=0;n<120;n++){
  const result=camera.stepAtlasCamera(view,goal,velocity,1/60,false);
  view=result.view;velocity=result.velocity;
  assert.ok(view.distance>0 && view.distance<=30.001);
  assert.ok(Number.isFinite(velocity.distance));lastVelocity=velocity.distance;
}
assert.ok(Math.abs(view.distance-30)<.001 && Math.abs(lastVelocity)<.001);
const reduced=camera.stepAtlasCamera(from,to,{},1/60,true);
assert.deepEqual(reduced.view,camera.nearestBearing(from,to));
assert.ok(Object.values(reduced.velocity).every(value=>value===0));
let elapsed=0,state={...from},frames=0,maxLogStep=0;
while(elapsed<2.1 && frames<2000){
  const result=camera.advanceAtlasFlight(from,adjusted,2.1,elapsed,frames%17===0?.3:1/60);
  maxLogStep=Math.max(maxLogStep,Math.abs(Math.log(result.view.distance/state.distance)));
  assert.ok(Math.abs(result.view.bearing-state.bearing)<=.04501);
  assert.ok(maxLogStep<=.07501,'Rendering stall skipped a large zoom step');
  elapsed=result.elapsed;state=result.view;frames++;
}
assert.ok(frames<2000 && elapsed===2.1);


const {AtlasImagery}=await import('../assets/atlas-imagery.js');
const {AtlasRelief}=await import('../assets/atlas-relief.js');
const imagery=new AtlasImagery([0,0],{},1);
const areaA={key:'a',bounds:[-40,-40,40,40],span:80,size:1600,texture:{}};
const areaB={key:'b',bounds:[-20,-20,20,20],span:40,size:1600,texture:{}};
const sampleView={x:0,z:0,distance:40};
imagery.select(areaA);
for(let n=0;n<90;n++)imagery.update(sampleView,sampleView,1.6,false,720,true,1/60);
const visible=imagery.uniforms.atlasPhotoOpacity.value;
imagery.update(sampleView,sampleView,1.6,false,720,false,1/60);
assert.ok(imagery.uniforms.atlasPhotoOpacity.value>visible*.8,'Imagery disappeared at flight takeoff');
imagery.select(areaB);
for(let n=0;n<90;n++){
 imagery.update(sampleView,sampleView,1.6,false,720,true,1/60);
 const sum=imagery.uniforms.atlasPhotoOpacity.value+imagery.uniforms.previousAtlasOpacity.value;
 assert.ok(sum>=0 && sum<=1.000001);
}
imagery.update(sampleView,sampleView,1.6,false,720,false,1/60,true);
assert.equal(imagery.uniforms.atlasPhotoOpacity.value,0);
clearTimeout(imagery.timer);
let retired=false;
const relief=new AtlasRelief([0,0],()=>0,()=>0,{uniforms:{reliefTransition:{value:.2}}},{},()=>{});
relief.current={mesh:{geometry:{dispose(){retired=true;}},children:[]}};
relief.update({x:0,z:0,distance:1000},1.6,false,false,0,10);
assert.ok(relief.current,'DEM removed before the camera had left it');
relief.animate(.016,true);assert.equal(relief.material.uniforms.reliefTransition.value,1);
relief.update({x:0,z:0,distance:1000},1.6,false,false,1,200);
assert.equal(relief.current,null);assert.ok(retired);
console.log(JSON.stringify({passed:true,flightSamples:401,followFrames:120,stallFrames:frames,
 shortestArc:true,reducedMotion:true,imageryFade:true,demRetainedAtTakeoff:true,maxLogZoomStep:maxLogStep}));
