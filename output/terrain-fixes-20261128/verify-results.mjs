import fs from 'node:fs';
import assert from 'node:assert/strict';
const read=name=>JSON.parse(fs.readFileSync(new URL(name,import.meta.url),'utf8').replace(/^\uFEFF/,''));
const first=read('all-19-stations.json'),final=read('all-water-final.json');
const expected=Object.keys(JSON.parse(fs.readFileSync('assets/terrain/manifest.json')).stations).sort();
assert.deepEqual(first.results.map(r=>r.id).sort(),expected);
assert.deepEqual(final.results.map(r=>r.id).sort(),expected);
assert.equal(first.totalFrames,752);assert.equal(final.totalFrames,304);
for(const run of [first,final]){
 assert.deepEqual(run.errors,[]);
 for(const station of run.results){
  assert.equal(station.arrivals,0,station.id+' automatically entered a model');
  assert.equal(station.display,'terrain',station.id+' left terrain');
  assert.equal(station.goal,station.limit,station.id+' zoom did not stop at the imagery floor');
  assert.equal(station.shader,true,station.id+' used an old terrain shader');
  assert.equal(station.clipped,false,station.id+' near plane crossed the ground safety margin');
  for(const f of station.frames.filter(f=>f.phase==='fixed'))assert.equal(f.changed,0,station.id+' changed with a fixed camera/time');
 }
}
for(const station of final.results){
 assert.equal(station.waterShader,true,station.id+' used an old water shader');
 assert.ok(Math.max(...station.frames.filter(f=>f.phase==='subpixel').map(f=>f.blue))<8,station.id+' still has a blue flicker patch');
}
const river=read('river-projection-ab.json');
const average=frames=>frames.slice(1).reduce((a,r)=>a+r.blue,0)/(frames.length-1);
assert.ok(average(river.scenarios[1].frames)<average(river.scenarios[0].frames)*.02,'water projection did not remove the outlier');
const summary={stations:19,initialFrames:first.totalFrames,finalFrames:final.totalFrames,errors:0,autoModelEntries:0,staticChangedPixels:0,
 finalMaximumBluePixels:Math.max(...final.results.flatMap(s=>s.frames.filter(f=>f.phase==='subpixel').map(f=>f.blue))),
 perStation:final.results.map(s=>({id:s.id,frames:s.frames.length,maximumBluePixels:Math.max(...s.frames.filter(f=>f.phase==='subpixel').map(f=>f.blue))}))};
fs.writeFileSync(new URL('verification-summary.json',import.meta.url),JSON.stringify(summary,null,2));
console.log(JSON.stringify(summary,null,2));
