const {test}=require('node:test');
const assert=require('node:assert/strict');
const ts=require('typescript');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

for(const intent of ['leave_time_open','replace_place']) test(`weather ${intent} proposal sends only explicit choices with draft preconditions`,async()=>{
  const out={},calls=[];
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.resolve(__dirname,'../lib/trips/proposals.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:out,AbortSignal,require:()=>({accountRequest:async(url,options)=>{calls.push({url,options});return {data:{id:'weather-review'}};}})});
  const abort=new AbortController();
  const body={activity_id:'activity',visit_date:'2026-11-14',intent,...(intent==='replace_place'?{replacement_place_id:'chosen-place'}:{})};
  const result=await out.proposalAdapter.weatherChange('trip','"draft:version:2"',body,'retry-key',abort.signal);
  assert.equal(result.id,'weather-review');
  assert.equal(calls[0].url,'/trips/trip/proposals/weather-change');
  assert.deepEqual(JSON.parse(calls[0].options.body),body);
  assert.equal(calls[0].options.headers['If-Match'],'"draft:version:2"');
  assert.equal(calls[0].options.headers['Idempotency-Key'],'retry-key');
  assert.equal(calls[0].options.method,'POST');
  abort.abort();
  assert.equal(calls[0].options.signal.aborted,true);
});
