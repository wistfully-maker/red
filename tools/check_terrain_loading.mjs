import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
assert.ok(existsSync(new URL('../assets/terrain-work.js',import.meta.url)),'Missing cooperative terrain work and navigation state');
const {runTerrainWork,TerrainNavigation}=await import('../assets/terrain-work.js');
const navigation=new TerrainNavigation();
const a=navigation.begin('a');navigation.pass(a);assert.equal(navigation.commit(a),null);
const b=navigation.begin('b');navigation.ready(a,{name:'stale'});assert.equal(navigation.commit(a),null);
navigation.ready(b,{name:'b'});assert.equal(navigation.commit(b),null);
navigation.pass(b);assert.deepEqual(navigation.commit(b),{name:'b'});assert.equal(navigation.commit(b),null);
const c=navigation.begin('c');navigation.pass(c);navigation.ready(c,{name:'c'});
assert.deepEqual(navigation.commit(c),{name:'c'});
const d=navigation.begin('d');navigation.cancel();navigation.ready(d,{name:'d'});navigation.pass(d);
assert.equal(navigation.commit(d),null);
let yields=0;
function* work(){let sum=0;for(let i=0;i<100;i++){sum+=i;yield;}return sum;}
assert.equal(await runTerrainWork(work(),{budgetMs:0,yieldTask:async()=>{yields++;}}),4950);
assert.equal(yields,100);
console.log(JSON.stringify({passed:true,staleCommits:0,readyAndPassBothRequired:true,workSlices:yields}));
