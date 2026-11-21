import * as THREE from './vendor/three.module.min.js';
import {loadModel} from './scene-models.js?v=green-atlas';
const names=['camphor','willow','fir','bamboo'];
let library;
const barkAndLeaves=new THREE.MeshStandardMaterial({color:'#bcc3a7',vertexColors:true,roughness:.92,side:THREE.DoubleSide});
function templates(){
  library??=loadModel('green-groves','summer-forest-2').then(scene=>names.flatMap(s=>[0,1].map(v=>[0,1,2,3].map(l=>{
    const obj=scene.getObjectByName(s+'_'+v+'_'+l);
    if(!obj?.isMesh)throw Error('Missing tree mesh '+s+v+l);
    return obj.geometry;
  })))).catch(e=>{library=null;throw e;});
  return library;
}
export async function plantedGrove(meta) {
  if(!meta.groveInstances)return null;
  const geo=await templates();
  const bytes=Uint8Array.from(atob(meta.groveInstances),c=>c.charCodeAt(0));
  const view=new DataView(bytes.buffer), scale=meta.plateWidth/16384,trees=[];
  const counts=Array(8).fill(0);
  for(let i=0;i<bytes.length;i+=12){
    const type=view.getUint8(i+10);
    const p=new THREE.Vector3(view.getInt16(i,true)*scale,view.getInt16(i+2,true)*scale,view.getInt16(i+4,true)*scale);
    let h=view.getUint16(i+6,true)/100,w=view.getUint16(i+8,true)/100;
    if(meta.surveyPlate==='dadu-wide'&&h>=9){
      const near=Math.hypot(p.x,p.z)<160;
      if((i/12)%(near?4:3)!==0)continue;
      h*=near?.65:.82;w*=near?.54:.72;
    }
    trees.push({p,h,w,type,yaw:view.getUint8(i+11)*Math.PI/128});
    counts[type]++;
  }
  const root=new THREE.Group();root.name='Summer woodland';root.userData.treeCount=trees.length;
  const batches=geo.map((levels,type)=>levels.map((geometry,lod)=>{
    if(!counts[type])return null;
    const batch=new THREE.InstancedMesh(geometry,barkAndLeaves,counts[type]);batch.count=0;
    batch.name=names[type>>1]+' / '+['canopy','branch','leaf','distant'][lod];batch.userData.sharedTree=true;
    batch.frustumCulled=false;batch.receiveShadow=true;batch.castShadow=true;
    batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);root.add(batch);return batch;
  }));
  const position=new THREE.Vector3(Infinity,0,0),lastTurn=new THREE.Quaternion(),temp=new THREE.Object3D(),projected=new THREE.Vector3();
  let previousH=0,previousW=0;
  root.userData.update=(camera,width,height)=>{
    if(previousH===height&&previousW===width&&position.distanceToSquared(camera.position)<.10 && lastTurn.angleTo(camera.quaternion)<.008)return;
    previousH=height;previousW=width;position.copy(camera.position);lastTurn.copy(camera.quaternion);
    const narrow=width<720, focal=height/(2*Math.tan(camera.fov*Math.PI/360));const candidates=[];
    for(const tree of trees){
      projected.copy(tree.p);projected.y+=tree.h*.45;projected.project(camera);
      if(projected.z<0||projected.z>1||Math.abs(projected.x)>1.30||Math.abs(projected.y)>1.35)continue;
      const px=tree.h*focal/Math.max(1,tree.p.distanceTo(camera.position));
      if(px>.83)candidates.push({tree,px});
    }
    candidates.sort((a,b)=>b.px-a.px);
    root.children.forEach(b=>b.count=0);
    let fine=0,medium=0,coarse=0;
    for(const {tree,px} of candidates){
      const lod=px>105&&fine<(narrow?2:5)?2:px>24&&medium<(narrow?18:46)?1:px>8&&coarse<(narrow?230:650)?0:3;
      if(lod===2)fine++;if(lod===1)medium++;if(lod===0)coarse++;
      const b=batches[tree.type][lod];temp.position.copy(tree.p);temp.rotation.set(0,tree.yaw,0);
      temp.scale.set(tree.w*1.22,tree.h,tree.w*1.22);temp.updateMatrix();b.setMatrixAt(b.count++,temp.matrix);
    }
    root.children.forEach(b=>{b.visible=b.count>0;b.instanceMatrix.needsUpdate=true;});
  };
  return root;
}
