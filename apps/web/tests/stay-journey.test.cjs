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
test('the last visit is the one that ends latest, ignoring skipped ones',()=>{
  assert.equal(s.lastVisit([]),undefined);
  assert.equal(s.lastVisit([act('a','09:00'),act('b','14:00')]).id,'b');
  assert.equal(s.lastVisit([act('a','09:00',{minutes:600}),act('b','14:00')]).id,'a');
  assert.equal(s.lastVisit([act('a','09:00'),act('b','20:00',{skipped:true})]).id,'a');
});
test('a visit running past midnight has no end clock time',()=>{
  assert.equal(s.visitEnd(act('a','09:05')),'10:05');
  assert.equal(s.visitEnd(act('a','23:00',{minutes:59})),'23:59');
  assert.equal(s.visitEnd(act('a','23:00')),null);
});
test('the return headline gives an arrive-by time or says after midnight',()=>{
  assert.match(s.stayReturnHeadline({status:'arrive_by',arrive_by:'18:20'},'Fort','18:00'),/back at your stay by 18:20/);
  assert.match(s.stayReturnHeadline({status:'after_midnight',arrive_by:null},'Fort','23:50'),/after midnight/);
});
test('check-in matters only on the arrival day and check-out only on the departure day',()=>{
  const stay={name:'H',check_in:'14:00',check_out:'11:00'};
  assert.match(s.stayTimingNote(stay,'out',act('a','09:00'),true,false),/Check-in is from 14:00/);
  assert.equal(s.stayTimingNote(stay,'out',act('a','15:00'),true,false),null);
  assert.equal(s.stayTimingNote(stay,'out',act('a','09:00'),false,false),null);
  assert.match(s.stayTimingNote(stay,'back',act('a','10:00',{minutes:60}),true,false),/Check-in is from 14:00/);
  assert.equal(s.stayTimingNote(stay,'back',act('a','15:00'),true,false),null);
  assert.equal(s.stayTimingNote(stay,'back',act('a','13:00',{minutes:60}),true,false),null);
  assert.match(s.stayTimingNote(stay,'out',act('a','12:00'),false,true),/check out at 11:00/);
  assert.match(s.stayTimingNote(stay,'back',act('a','11:00'),false,true),/check out at 11:00/);
  assert.match(s.stayTimingNote(stay,'back',act('a','10:00',{minutes:180}),false,true),/before this visit ends/);
  assert.equal(s.stayTimingNote(stay,'back',act('a','09:00',{minutes:120}),false,true),null);
  assert.equal(s.stayTimingNote(stay,'back',act('a','13:00',{minutes:60}),true,false),null);
  assert.equal(s.stayTimingNote(stay,'back',act('a','13:00',{minutes:60}),true,false),null);
  assert.equal(s.stayTimingNote(stay,'out',act('a','10:59'),false,true),null);
  assert.equal(s.stayTimingNote({name:'H'},'out',act('a','09:00'),true,true),null);
  assert.equal(s.stayTimingNote(null,'out',act('a','09:00'),true,true),null);
});
