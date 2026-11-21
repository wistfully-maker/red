import {writeFile} from 'node:fs/promises';
import {GLTFExporter} from './vendor/GLTFExporter.js';
import {makeMapMiniatures} from './overview_miniatures.mjs';
import {MeshoptEncoder} from './vendor/meshopt_encoder.mjs';
globalThis.FileReader=class {readAsArrayBuffer(blob){blob.arrayBuffer().then(buffer=>{this.result=buffer;this.onloadend?.();});}};
const scene=makeMapMiniatures();
const binary=Buffer.from(await new GLTFExporter().parseAsync(scene,{binary:true,onlyVisible:false}));
await MeshoptEncoder.ready;
const jsonLength=binary.readUInt32LE(12);
const json=JSON.parse(binary.toString('utf8',20,20+jsonLength));
const bin=binary.subarray(28+jsonLength);
const chunks=[];
let offset=0;
const extension='EXT_meshopt_compression';
const pad=n=>(4-n%4)%4;
for(let i=0;i<json.bufferViews.length;i++){
  const view=json.bufferViews[i],accessor=json.accessors.find(a=>a.bufferView===i);
  if(!accessor)throw new Error('Unexpected non-geometry buffer view');
  const stride=view.byteStride || ({SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[accessor.type]*{5121:1,5123:2,5125:4,5126:4}[accessor.componentType]);
  const mode=view.target===34963?'TRIANGLES':'ATTRIBUTES';
  const packed=MeshoptEncoder.encodeGltfBuffer(bin.subarray(view.byteOffset,view.byteOffset+view.byteLength),accessor.count,stride,mode);
  view.buffer=1;
  view.extensions={[extension]:{buffer:0,byteOffset:offset,byteLength:packed.byteLength,byteStride:stride,count:accessor.count,mode}};
  chunks.push(Buffer.from(packed),Buffer.alloc(pad(packed.byteLength)));offset+=packed.byteLength+pad(packed.byteLength);
}
json.extensionsUsed=[...(json.extensionsUsed || []),extension];json.extensionsRequired=[...(json.extensionsRequired || []),extension];
json.buffers=[{byteLength:offset},{byteLength:bin.byteLength,extensions:{[extension]:{fallback:true}}}];
const serialized=Buffer.from(JSON.stringify(json));
const encoded=Buffer.concat([serialized,Buffer.alloc(pad(serialized.length),32)]);
const header=Buffer.alloc(20);header.write('glTF');header.writeUInt32LE(2,4);header.writeUInt32LE(28+encoded.length+offset,8);header.writeUInt32LE(encoded.length,12);header.write('JSON',16);
const binHeader=Buffer.alloc(8);binHeader.writeUInt32LE(offset);binHeader.write('BIN\0',4);
const compressed=Buffer.concat([header,encoded,binHeader,...chunks]);
await writeFile(new URL('../assets/models/overview-landmarks.glb',import.meta.url),compressed);
console.log(`overview-landmarks.glb: ${compressed.byteLength} bytes, ${scene.children.length} landmarks`);
for(const group of scene.children){const g=group.children[0].geometry;console.log(`${group.name}: ${(g.index?.count || g.attributes.position.count)/3} triangles, one draw call`);}
