import assert from 'node:assert/strict';
import {places} from '../assets/places.js';

assert.equal(places.zunyi.close,undefined,'Remove the Zunyi dive camera');
assert.equal(places.luding.close,undefined,'Remove the terrain-to-bridge shortcut');
assert.equal(places.luding.historic,undefined,'Remove the terrain history toggle');
const {stationViewHref,sceneModeFromHash,museumSceneHref}=await import('../assets/scene-navigation.js');
for(const id of Object.keys(places)){
  assert.equal(stationViewHref(id,'terrain'),'#station/'+id);
  assert.equal(stationViewHref(id,'model'),'#station/'+id+'/model');
  assert.equal(museumSceneHref(id,'#station/ruijin/model'),'#station/'+id+'/model');
  assert.equal(museumSceneHref(id,'#station/ruijin'),'#station/'+id);
}
for(const kind of ['model','deck','bridgehead','pavilion']){
  assert.equal(sceneModeFromHash('#station/luding/'+kind),'model');
}
for(const hash of ['#station/yudu','#station/yudu/terrain','#explore','#museum']){
  assert.equal(sceneModeFromHash(hash),'terrain');
}
console.log(JSON.stringify({passed:true,stations:Object.keys(places).length,
  terrainAndModelContinuity:true,museumReturn:true,removedTerrainActions:true}));
