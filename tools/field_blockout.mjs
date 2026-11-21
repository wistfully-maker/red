// One metre in this Three.js study equals one Blender metre in the final scenes.
import * as THREE from '../assets/vendor/three.module.min.js';
import {GLTFExporter} from './vendor/GLTFExporter.js';
import {readFile,writeFile} from 'node:fs/promises';
const scale=JSON.parse(await readFile(new URL('./field-scale.json',import.meta.url),'utf8'));
const plate=new THREE.Scene();
const palette={water:0x567b78,hull:0x78583f,coat:0x526579,paper:0xdad4bf};
function block(group,name,w,h,d,x,y,z,color) {
 const object=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshStandardMaterial({color}));
 object.name=name;object.position.set(x,y,z);group.add(object);return object;
}
let offset=0;
for (const [id,site] of Object.entries(scale.rivers)) {
 const reach=new THREE.Group();reach.name=id;reach.position.x=offset;plate.add(reach);
 block(reach,'Cross section',30,.05,site.waterWidth,0,-.025,-site.waterWidth/2,palette.water);
 const [l,b]=site.hull;
 const boat=block(reach,'Hull envelope',l,site.hullHeight||1,b,0,.2,-3,palette.hull);
 const person=block(reach,'Standing adult',.46,scale.adult.nominal,.27,0,scale.adult.nominal/2,1,palette.coat);
 const dimensions=mesh=>new THREE.Box3().setFromObject(mesh).getSize(new THREE.Vector3());
 if(Math.abs(dimensions(boat).x-l)>1e-4 || Math.abs(dimensions(person).y-scale.adult.nominal)>1e-4) throw Error(id+' scale mismatch');
 console.log(id,site.waterWidth+' m river',l+' × '+b+' m hull',Math.round(site.waterWidth/l)+' boat lengths');
 offset+=48;
}
globalThis.FileReader=class{readAsArrayBuffer(blob){blob.arrayBuffer().then(data=>{this.result=data;this.onloadend?.();});}};
const glb=await new GLTFExporter().parseAsync(plate,{binary:true});
await writeFile(new URL('../.playwright-cli/river-blockout.glb',import.meta.url),Buffer.from(glb));

