const {test}=require('node:test');const assert=require('node:assert/strict');const ts=require('typescript');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
function load(file){const out={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.resolve(__dirname,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:out,require:()=>({}),Object,Array,String,Number,JSON});return out;}
const s=load('../lib/trips/stay-journey.ts');
const act=(id,start,extra={})=>({id,stopId:'s',day:1,title:id,start,minutes:60,fixed:false,completed:false,booked:false,...extra});
const place={id:'p'};
test('the first visit is the earliest one that has not been marked as skipped',()=>{
  assert.equal(s.firstVisit([]),undefined);
  assert.equal(s.firstVisit([act('b','10:00'),act('a','09:00')]).id,'a');
  assert.equal(s.firstVisit([act('a','08:00',{skipped:true}),act('b','10:00')]).id,'b');
  assert.equal(s.firstVisit([act('b','09:00'),act('a','09:00')]).id,'a');
});
test('both the stay and the first visit need a map location',()=>{
  const stay={name:'H',latitude:1,longitude:2};
  assert.equal(s.stayLegReady(stay,act('a','09:00',{place})),true);
  assert.equal(s.stayLegReady(stay,act('a','09:00')),false);
  assert.equal(s.stayLegReady({name:'H'},act('a','09:00',{place})),false);
  assert.equal(s.stayLegReady(null,act('a','09:00',{place})),false);
  assert.equal(s.stayLegReady(stay,undefined),false);
});
test('the headline gives a leave-by time or says the visit starts too early',()=>{
  assert.equal(s.stayJourneyHeadline({status:'leave_by',leave_by:'08:30'},'Fort','09:00'),'Leave by 08:30 to reach Fort at 09:00');
  assert.match(s.stayJourneyHeadline({status:'needs_earlier_start',leave_by:null},'Fort','00:10'),/too early/);
});
