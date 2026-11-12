const {test}=require('node:test');const assert=require('node:assert/strict');const ts=require('typescript');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
const out={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.resolve(__dirname,'../lib/trips/day-hours.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:out});
const a=(id,kind='custom',mapped=true)=>({id,title:id,start:'10:00',kind,place:mapped?{id:'source'}:undefined});
test('meal, rest and free-time blocks are not silently treated as venues',()=>{assert.equal(out.dayHours([a('m','meal',false),a('r','rest',false),a('f','free_time',false)],{}).items.length,0);});
test('manual and unchecked mapped visits keep opening-hour coverage unknown',()=>{const r=out.dayHours([a('manual','custom',false),a('mapped')],{});assert.equal(r.unknown,2);assert.equal(r.fits,0);assert.equal(r.items[0].state,'missing_location');});
test('closed and outside-hour visits are conflicts while incomplete provider evidence remains unknown',()=>{const list=['fits_reported_hours','reported_closed','outside_reported_hours','hours_unknown','outside_coverage','date_needed','unexpected'];const items=list.map(s=>a(s));const checks=Object.fromEntries(list.map(s=>[s,{status:s}]));const r=out.dayHours(items,checks);assert.equal(r.fits,1);assert.equal(r.conflicts,2);assert.equal(r.unknown,4);});
test('removing a mapped place cannot retain a previously fitting-hours claim',()=>{assert.equal(out.dayHours([a('id','custom',false)],{id:{status:'fits_reported_hours'}}).unknown,1);});

test("a sourced meal still counts as a venue visit",()=>{assert.equal(out.dayHours([a("m","meal")],{}).items.length,1);});
