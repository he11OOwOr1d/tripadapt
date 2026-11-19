const {test}=require('node:test');const assert=require('node:assert/strict');const ts=require('typescript');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
function load(file){const out={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.resolve(__dirname,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:out,require:()=>({}),Object,Array,String,Number,Math,JSON});return out;}
const i=load('../lib/trips/intercity.ts');
const stop=(ref)=>({id:'s',name:'X',nights:1,timezone:'UTC',...(ref?{location:{reference_id:ref}}:{})});
test('travel time reads as hours and minutes without false precision',()=>{
  assert.equal(i.formatTravelTime(270),'4 h 30 min');
  assert.equal(i.formatTravelTime(60),'1 h');
  assert.equal(i.formatTravelTime(45),'45 min');
  assert.equal(i.formatTravelTime(0),'0 min');
  assert.equal(i.formatTravelTime(61.6),'1 h 2 min');
  assert.equal(i.formatTravelTime(-5),'0 min');
});
test('both destinations need a retained location and must differ',()=>{
  assert.deepEqual(JSON.parse(JSON.stringify(i.intercityEndpoints(stop('a'),stop('b')))),{from:'a',to:'b'});
  assert.equal(i.intercityEndpoints(stop('a'),stop()),null);
  assert.equal(i.intercityEndpoints(stop(),stop('b')),null);
  assert.equal(i.intercityEndpoints(stop('a'),stop('a')),null);
  assert.equal(i.intercityEndpoints(undefined,stop('b')),null);
  assert.equal(i.intercityEndpoints(stop('a'),undefined),null);
});
test('the headline gives road time and whole kilometres',()=>{
  assert.equal(i.intercityHeadline({travel_minutes:270,distance_meters:281400}),'About 4 h 30 min by road · 281 km');
});
