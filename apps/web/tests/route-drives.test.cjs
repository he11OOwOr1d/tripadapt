const {test}=require('node:test');const assert=require('node:assert/strict');const ts=require('typescript');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
function load(file,deps={}){const out={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.resolve(__dirname,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:out,require:n=>deps[n.replace(/^\.\//,'')]??{},Object,Array,String,Number,Math,JSON});return out;}
const planning=load('../lib/trips/planning.ts');
const intercity=load('../lib/trips/intercity.ts');
const r=load('../lib/trips/route-drives.ts',{planning,intercity});
const J=v=>JSON.parse(JSON.stringify(v));
const stop=(id,name,ref)=>({id,name,nights:1,timezone:'UTC',...(ref?{location:{reference_id:ref}}:{})});
const trip=(extra={})=>({origin:'Delhi',originPoint:{latitude:28.6,longitude:77.2},stops:[stop('s1','Jaipur','a'),stop('s2','Agra','b')],returnToOrigin:true,...extra});
const check=(m,d)=>({travel_minutes:m,distance_meters:d});

test('journeys run from the start through each stop and back to the start',()=>{
  const j=r.routeJourneys(trip());
  assert.deepEqual(J(j.map(x=>x.from.name+'>'+x.to.name)),['Delhi>Jaipur','Jaipur>Agra','Agra>Delhi']);
  assert.deepEqual(J(j[0].from.end),{latitude:28.6,longitude:77.2});
  assert.deepEqual(J(j[1].to.end),{reference_id:'b'});
  assert.deepEqual(J(j[2].to.end),{latitude:28.6,longitude:77.2});
});
test('without returning to the start the last journey ends at a typed finish, which is never mapped',()=>{
  const j=r.routeJourneys(trip({returnToOrigin:false,finish:'Goa'}));
  assert.deepEqual(J(j.map(x=>x.to.name)),['Jaipur','Agra','Goa']);
  assert.equal(j[2].to.end,null);
  assert.equal(r.routeJourneys(trip({returnToOrigin:false})).length,2);
  assert.deepEqual(J(r.routeJourneys(trip({stops:[]}))),[]);
});
test('a journey is estimable only when both ends are mapped and different',()=>{
  const j=r.routeJourneys(trip({originPoint:undefined,stops:[stop('s1','Jaipur','a'),stop('s2','Agra'),stop('s3','Kota','c')]}));
  assert.deepEqual(J(j.map(r.estimable)),[false,false,false,false]);
  const k=r.routeJourneys(trip({stops:[stop('s1','Jaipur','a'),stop('s2','Agra'),stop('s3','Kota','c')]}));
  assert.deepEqual(J(k.map(r.estimable)),[true,false,false,true]);
});
test('totals count only journeys that were estimated and say when the route is complete',()=>{
  const j=r.routeJourneys(trip());
  const none=r.driveSummary(j,{});
  assert.equal(none.checked,0);assert.equal(none.complete,false);assert.equal(r.driveSummaryLine(none),'No journeys estimated yet.');
  const some=r.driveSummary(j,{[j[0].key]:check(187,304000)});
  assert.deepEqual(J([some.checked,some.total,some.minutes,some.meters,some.complete]),[1,3,187,304000,false]);
  assert.equal(r.driveSummaryLine(some),'About 3 h 7 min of driving · 304 km across the 1 of 3 journeys estimated so far.');
  const all=r.driveSummary(j,{[j[0].key]:check(187,304000),[j[1].key]:check(203,269000),[j[2].key]:check(250,240000)});
  assert.equal(all.complete,true);assert.equal(all.minutes,640);
  assert.equal(r.driveSummaryLine(all),'About 10 h 40 min of driving · 813 km across 3 journeys.');
  assert.equal(r.driveSummary([],{}).complete,false);
});
