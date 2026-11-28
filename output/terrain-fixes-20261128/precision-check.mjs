import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync('assets/terrain-view.js','utf8');
// At the imagery floor, one depth-buffer unit must remain smaller than a
// quarter metre. Otherwise terrain polygon bias can swallow a low roof.
const match=source.match(/this\.camera\.near = ([^;]+);/);
assert.ok(match,'camera clipping expression present');
const nearAt=Function('distance',`return ${match[1]}`);
const samples=[1,3,5.64,8,15,100,1000];
const result=samples.map(distance=>{
 const near=nearAt(distance),quantum=distance*distance*(1/near-1/9500)/(2**24-1)*1000;
 return {distance,near,depthQuantumMetres:quantum};
});
for(const item of result) assert.ok(item.depthQuantumMetres<Math.max(.25,item.distance*.007),`insufficient depth precision at ${item.distance}km: ${item.depthQuantumMetres.toFixed(3)}m`);
assert.ok(!source.includes("dispatchEvent(new Event('luding-arrival'))"),'zoom must stay in terrain');
console.log(JSON.stringify(result,null,2));
