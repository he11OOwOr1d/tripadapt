const {test}=require('node:test');const assert=require('node:assert/strict');const ts=require('typescript');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
function load(file,deps={}){const out={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.resolve(__dirname,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:out,require:n=>deps[n.replace(/^\.\//,'')]??{},Object,Array,String,Number,Math,JSON});return out;}
const i=load('../lib/trips/intercity.ts');
const J=v=>JSON.parse(JSON.stringify(v));
const stop=(ref,name='X')=>({id:'s',name,nights:1,timezone:'UTC',...(ref?{location:{reference_id:ref}}:{})});
test('travel time reads as hours and minutes without false precision',()=>{
  assert.equal(i.formatTravelTime(270),'4 h 30 min');
  assert.equal(i.formatTravelTime(60),'1 h');
  assert.equal(i.formatTravelTime(45),'45 min');
  assert.equal(i.formatTravelTime(0),'0 min');
  assert.equal(i.formatTravelTime(61.6),'1 h 2 min');
  assert.equal(i.formatTravelTime(-5),'0 min');
});
test('a destination is mapped only with a retained reference',()=>{
  assert.deepEqual(J(i.stopPlace(stop('a','Agra'))),{name:'Agra',end:{reference_id:'a'}});
  assert.deepEqual(J(i.stopPlace(stop(undefined,'Agra'))),{name:'Agra',end:null});
  assert.equal(i.stopPlace(undefined),undefined);
});
test('the starting point is mapped only when it was chosen from a search',()=>{
  assert.deepEqual(J(i.originPlace({origin:'Delhi',originPoint:{latitude:28.6,longitude:77.2}})),{name:'Delhi',end:{latitude:28.6,longitude:77.2}});
  assert.deepEqual(J(i.originPlace({origin:'Delhi'})),{name:'Delhi',end:null});
  assert.equal(i.originPlace({origin:''}).name,'Starting point');
});
test('both ends must be mapped and different, in either form',()=>{
  const a=i.stopPlace(stop('a')),b=i.stopPlace(stop('b')),home=i.originPlace({origin:'D',originPoint:{latitude:1,longitude:2}}),homeAgain=i.originPlace({origin:'D2',originPoint:{latitude:1,longitude:2}}),none=i.stopPlace(stop());
  assert.deepEqual(J(i.intercityEndpoints(a,b)),{origin:{reference_id:'a'},destination:{reference_id:'b'}});
  assert.deepEqual(J(i.intercityEndpoints(home,a)),{origin:{latitude:1,longitude:2},destination:{reference_id:'a'}});
  assert.deepEqual(J(i.intercityEndpoints(a,home)),{origin:{reference_id:'a'},destination:{latitude:1,longitude:2}});
  assert.equal(i.intercityEndpoints(a,a),null);
  assert.equal(i.intercityEndpoints(home,homeAgain),null);
  assert.equal(i.intercityEndpoints(a,none),null);
  assert.equal(i.intercityEndpoints(none,b),null);
  assert.equal(i.intercityEndpoints(undefined,b),null);
  assert.equal(i.intercityEndpoints(a,undefined),null);
  assert.equal(i.intercityEndpoints(i.originPlace({origin:'D'}),a),null);
});
test('the headline gives road time and whole kilometres',()=>{
  assert.equal(i.intercityHeadline({travel_minutes:270,distance_meters:281400}),'About 4 h 30 min by road · 281 km');
});
test('the estimate becomes the traveler\u2019s own hours, rounded up to a hundredth',()=>{
  assert.equal(i.hoursFromMinutes(187),'3.12');
  assert.equal(i.hoursFromMinutes(180),'3');
  assert.equal(i.hoursFromMinutes(270),'4.5');
  assert.equal(i.hoursFromMinutes(1),'0.02');
  assert.equal(i.hoursFromMinutes(0),'0');
  assert.equal(i.hoursFromMinutes(-4),'0');
  assert.match(i.hoursFromMinutes(1234),/^\d+(\.\d{1,2})?$/);
});
test('withTravelHours adds, replaces and leaves other journeys and fields alone',()=>{
  const prefs={a:{mode:'Rail',hours:'5',overnight:1,rate:'20',basis:'vehicle'},b:{mode:'',hours:'',overnight:0,rate:'',basis:'person'}};
  assert.deepEqual(J(i.withTravelHours(prefs,'a','3.12')),{a:{mode:'Rail',hours:'3.12',overnight:1,rate:'20',basis:'vehicle'},b:prefs.b});
  assert.deepEqual(J(i.withTravelHours(undefined,'k','2')),{k:{mode:'',hours:'2',overnight:0,rate:'',basis:'person'}});
  assert.equal(prefs.a.hours,'5');
});

