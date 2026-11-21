const {test}=require('node:test');const assert=require('node:assert/strict');const ts=require('typescript');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
function load(file){const out={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.resolve(__dirname,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:out,require:()=>({}),Object,Array,String,Number,Math,JSON,Error,Promise},{});return out;}
const {deleteAccountTrip}=load('../lib/trips/trip-delete.ts');
const fail=(status)=>Object.assign(new Error('failed '+status),{status});
// A scripted account service: each call takes the next step; a step is a result or an Error to throw.
const script=(steps)=>{const calls=[];const request=async(p,o={})=>{calls.push({path:p,method:o.method||'GET',ifMatch:o.headers&&o.headers['If-Match']});const step=steps.shift();if(!step)throw new Error('unexpected extra request '+p);if(step instanceof Error)throw step;return step;};return {request,calls,left:()=>steps.length};};
test('a trip is read, then deleted with the version that was read',async()=>{
  const s=script([{etag:'"trip:t1:4"'},{etag:null}]);
  assert.equal(await deleteAccountTrip(s.request,'t1'),'deleted');
  assert.deepEqual(s.calls,[{path:'/trips/t1',method:'GET',ifMatch:undefined},{path:'/trips/t1',method:'DELETE',ifMatch:'"trip:t1:4"'}]);
});
test('a trip that is already gone counts as deleted, whether the read or the delete says so',async()=>{
  assert.equal(await deleteAccountTrip(script([fail(404)]).request,'t1'),'gone');
  const s=script([{etag:'"e"'},fail(404)]);assert.equal(await deleteAccountTrip(s.request,'t1'),'gone');assert.equal(s.calls.length,2);
});
test('a trip that changed in between is read again and the delete retried with the new version',async()=>{
  const s=script([{etag:'"trip:t1:4"'},fail(412),{etag:'"trip:t1:5"'},{etag:null}]);
  assert.equal(await deleteAccountTrip(s.request,'t1'),'deleted');
  assert.deepEqual(s.calls.map(c=>c.ifMatch),[undefined,'"trip:t1:4"',undefined,'"trip:t1:5"']);
});
test('retries are bounded, and then nothing is claimed deleted',async()=>{
  const s=script([{etag:'"a"'},fail(412),{etag:'"b"'},fail(412),{etag:'"c"'},fail(412)]);
  await assert.rejects(()=>deleteAccountTrip(s.request,'t1'),(e)=>e.status===412);
  assert.equal(s.calls.length,6);assert.equal(s.left(),0);
  const one=script([{etag:'"a"'},fail(412)]);await assert.rejects(()=>deleteAccountTrip(one.request,'t1',1),(e)=>e.status===412);
});
test('other failures are passed on untouched and are not retried',async()=>{
  for(const status of [401,403,500,503]){
    const s=script([{etag:'"a"'},fail(status),{etag:'"b"'},{etag:null}]);
    await assert.rejects(()=>deleteAccountTrip(s.request,'t1'),(e)=>e.status===status);assert.equal(s.calls.length,2,String(status));
  }
  const read=script([fail(503)]);await assert.rejects(()=>deleteAccountTrip(read.request,'t1'),(e)=>e.status===503);assert.equal(read.calls.length,1);
  const network=script([new TypeError('Failed to fetch')]);await assert.rejects(()=>deleteAccountTrip(network.request,'t1'),TypeError);
});
test('a missing version is never replaced by a guess',async()=>{
  const s=script([{etag:null}]);
  await assert.rejects(()=>deleteAccountTrip(s.request,'t1'),/nothing was deleted/);
  assert.equal(s.calls.length,1);
});
