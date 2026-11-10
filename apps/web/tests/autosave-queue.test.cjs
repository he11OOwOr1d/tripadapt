const {test}=require('node:test');
const assert=require('node:assert/strict');
const ts=require('typescript');const vm=require('node:vm');const fs=require('node:fs');const path=require('node:path');
const output=ts.transpileModule(fs.readFileSync(path.resolve(__dirname,'../lib/trips/autosave-queue.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const exportsObject={};vm.runInNewContext(output,{exports:exportsObject});const {AutosaveQueue}=exportsObject;
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve}};
test('autosave serializes requests and coalesces intervening edits into the newest snapshot',async()=>{
 const gate=deferred(),written=[],saved=[];let active=0,max=0;
 const queue=new AutosaveQueue(async value=>{active++;max=Math.max(max,active);written.push(value);if(value==='a')await gate.promise;active--;return value;},{start(){},saved(value){saved.push(value)},error(){assert.fail('unexpected failure')}});
 const first=queue.enqueue('a');queue.enqueue('b');queue.enqueue('c');assert.deepEqual(written,['a']);gate.resolve();await first;await queue.flush();assert.deepEqual(written,['a','c']);assert.deepEqual(saved,['a','c']);assert.equal(max,1);
});
test('failed writes pause without loops, preserve the newest edit and retry explicitly',async()=>{
 let failing=true;const written=[],errors=[];
 const queue=new AutosaveQueue(async value=>{written.push(value);if(failing)throw Error('offline');return value;},{start(){},saved(){},error:e=>errors.push(e.message)});
 await queue.enqueue('old');await queue.enqueue('latest');assert.equal(written.length,1);await assert.rejects(queue.flush(),/needs attention/);failing=false;await queue.retry();assert.deepEqual(written,['old','latest']);assert.deepEqual(errors,['offline']);
});
test('switching trips disposes queued work and suppresses stale completion events',async()=>{
 const gate=deferred(),written=[],saved=[];
 const queue=new AutosaveQueue(async value=>{written.push(value);await gate.promise;return value;},{start(){},saved:value=>saved.push(value),error(){}});
 const pending=queue.enqueue('previous trip');queue.enqueue('queued edit');queue.dispose();gate.resolve();await pending;assert.deepEqual(written,['previous trip']);assert.deepEqual(saved,[]);
});
