const {test}=require('node:test');const assert=require('node:assert/strict');const ts=require('typescript');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
function load(file,deps={}){const out={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.resolve(__dirname,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:out,require:n=>deps[n.replace(/^\.\//,'')]??{},Object,Array,String,Number,Math,JSON,Date,Intl});return out;}
const planning=load('../lib/trips/planning.ts');
const itinerary=load('../lib/trips/itinerary.ts',{planning});
const d=load('../lib/trips/stay-dates.ts',{itinerary});
const J=v=>JSON.parse(JSON.stringify(v));
test('dates follow the trip: arrival day and departure day of the stop',()=>{
  const trip={mode:'exact',start:'2026-11-24'};
  assert.deepEqual(J(d.stayDates(trip,1,3)),{checkIn:'Tue, Nov 24',checkOut:'Thu, Nov 26'});
  assert.deepEqual(J(d.stayDates(trip,4,6)),{checkIn:'Fri, Nov 27',checkOut:'Sun, Nov 29'});
});
test('a trip without exact dates has no stay dates',()=>{
  assert.deepEqual(J(d.stayDates({mode:'window',start:'2026-11-24'},1,3)),{checkIn:null,checkOut:null});
  assert.deepEqual(J(d.stayDates({mode:'exact',start:''},1,3)),{checkIn:null,checkOut:null});
  assert.deepEqual(J(d.stayDates({mode:'duration',start:''},1,3)),{checkIn:null,checkOut:null});
});
