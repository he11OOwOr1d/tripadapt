const {test}=require('node:test');const assert=require('node:assert/strict');const ts=require('typescript');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
function load(file,deps={}){const out={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.resolve(__dirname,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:out,require:n=>deps[n.replace(/^\.\//,'')]??{},Object,Array,String,Number,Math,JSON});return out;}
const dm=load('../lib/trips/day-map.ts',{lodging:{lodgingPoint:()=>null}});
const o=load('../lib/trips/origin-point.ts',{'day-map':dm});
const J=v=>JSON.parse(JSON.stringify(v));
test('the server returns decimals as strings; a valid pair becomes numbers',()=>{
  assert.deepEqual(J(o.originPointFrom({label:'Delhi',latitude:'28.6139',longitude:'77.2090'})),{originPoint:{latitude:28.6139,longitude:77.209}});
  assert.deepEqual(J(o.originPointFrom({label:'D',latitude:28.6,longitude:77.2})),{originPoint:{latitude:28.6,longitude:77.2}});
});
test('missing, null, partial or out-of-range coordinates give no point',()=>{
  for(const v of [null,undefined,{label:'D'},{label:'D',latitude:null,longitude:null},{label:'D',latitude:'28'},{label:'D',latitude:'91',longitude:'0'},{label:'D',latitude:'x',longitude:'1'},{label:'D',latitude:'1',longitude:'181'},{label:'D',latitude:'',longitude:''},{label:'D',latitude:0,longitude:0}])assert.deepEqual(J(o.originPointFrom(v)),{},JSON.stringify(v));
});
