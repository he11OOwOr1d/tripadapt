const {test} = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const exportsObject = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.resolve(__dirname,'../lib/trips/day-feasibility.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:exportsObject});
const {dayFeasibility:review,pairKey}=exportsObject;
const activity=(id,start,minutes=60,mapped=true)=>({id,title:id,start,minutes,place:mapped?{id:'source-'+id}:undefined});
const estimate=(gap,spare=10,warnings=[])=>({gap_minutes:gap,spare_minutes:spare,mode:'WALK',buffer_minutes:10,warnings,status:spare<0?'shortfall':'fits_estimate'});
test('nested nonconsecutive overlaps are all reported without false adjacent-only clearance',()=>{
 const r=review([activity('long','09:00',240),activity('short','10:00',20),activity('later','11:00',20)],{},'WALK',10);
 assert.equal(r.conflicts.length,2);assert.equal(r.conflicts[1].to.id,'later');assert.equal(r.title,'Some timing needs a look');
});
test('manual intermediate items remain unknown and cannot be skipped for a direct mapped route',()=>{
 const r=review([activity('a','09:00'),activity('manual','11:00',60,false),activity('b','13:00')],{},'WALK',10);
 assert.equal(r.pairs.length,2);assert.equal(r.missing,2);assert.equal(r.checked,0);assert.equal(r.unchecked,0);
});
test('partial coverage keeps unknown journeys visible while retaining checked pairs',()=>{
 const a=activity('a','09:00'),b=activity('b','11:00'),c=activity('c','13:00');
 const results={[pairKey(a,b)]:estimate(60)};
 const partial=review([c,b,a],results,'WALK',10);
 assert.equal(partial.checked,1);assert.equal(partial.unchecked,1);assert.equal(partial.title,'A few gaps to check');
 results[pairKey(b,c)]=estimate(60);
 const complete=review([a,b,c],results,'WALK',10);
 assert.equal(complete.checked,2);assert.equal(complete.title,'Checked journeys fit the estimates');
});
test('shortfalls and access warnings prevent an unqualified fit summary',()=>{
 const a=activity('a','09:00'),b=activity('b','11:00');
 const key=pairKey(a,b);
 assert.equal(review([a,b],{[key]:estimate(60,-5)},'WALK',10).title,'Some timing needs a look');
 const warning=review([a,b],{[key]:estimate(60,10,['Private road'])},'WALK',10);
 assert.equal(warning.title,'Route warnings to review');assert.equal(warning.pairs[0].state,'warning');
});
test('mode, buffer or timing mismatches never count stale results as checked',()=>{
 const a=activity('a','09:00'),b=activity('b','11:00');const results={[pairKey(a,b)]:estimate(60)};
 assert.equal(review([a,b],results,'DRIVE',10).checked,0);
 assert.equal(review([a,b],results,'WALK',20).checked,0);
 assert.equal(review([a,{...b,start:'12:00'}],results,'WALK',10).checked,0);
});
test('empty, single-item and overnight plans never become fully verified days',()=>{
 assert.equal(review([],{},'WALK',10).title,'A day still open');
 assert.equal(review([activity('a','09:00')],{},'WALK',10).title,'One activity, no journeys to compare');
 const late=review([activity('late','23:00',120)],{},'WALK',10);
 assert.equal(late.overnight.length,1);assert.equal(late.title,'Some timing needs a look');
});
