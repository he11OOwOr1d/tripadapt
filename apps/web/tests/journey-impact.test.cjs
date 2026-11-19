const {test}=require('node:test'),assert=require('node:assert/strict'),ts=require('typescript'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function load(file,cache={}){if(cache[file])return cache[file];const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:m.exports,JSON,Set,Object,Array,require:n=>load(path.resolve(path.dirname(file),n+'.ts'),cache)});return cache[file]=m.exports;}
const j=load(path.resolve(__dirname,'../lib/trips/journey-impact.ts'));
const plain=v=>JSON.parse(JSON.stringify(v));
const J={id:'j',name:'Jaipur',timezone:'Asia/Kolkata',nights:2},U={id:'u',name:'Udaipur',timezone:'Asia/Kolkata',nights:2};
const key=(a,b)=>JSON.stringify([a,b]);
function trip(stops){return {title:'t',mode:'duration',start:'',end:'',days:6,travelers:2,rooms:1,budget:'',currency:'INR',pace:'balanced',interests:'',origin:'Delhi',returnToOrigin:true,stops,activities:[],
 travelPreferences:{[key('origin:Delhi','j')]:{mode:'Rail',hours:'',overnight:0,rate:'500',basis:'person'}},
 costRecords:[{id:'1',category:'transport',label:'Train ticket',unit:'per_person',quantity:1,amount:'500',status:'paid',leg_key:key('origin:Delhi','j')},{id:'2',category:'food',label:'Train snacks',unit:'per_person',quantity:1,amount:'50',status:'estimated',leg_key:key('origin:Delhi','j')},{id:'3',category:'food',label:'Dinner',unit:'per_person',quantity:1,amount:'50',status:'estimated'}]};}
test('a swap lists the removed journey, what depends on it and the new journeys',()=>{const before=trip([J,U]),after={...before,stops:[U,J]};const i=plain(j.journeyImpact(before,after));
 assert.deepEqual(i.lost.map(l=>[l.label,l.mode,l.rate,l.estimates,l.payments]),[['Delhi → Jaipur','Rail','500',['Train snacks'],['Train ticket']]]);
 assert.deepEqual(i.added.map(a=>a.label),['Delhi → Udaipur','Udaipur → Jaipur','Jaipur → Delhi']);
 assert.deepEqual(plain(j.journeyImpact(before,before)),{lost:[],added:[]});});
test('carrying over moves details and linked costs exactly once and nothing else',()=>{const before=trip([J,U]),after={...before,stops:[U,J]};const to=key('origin:Delhi','u'),from=key('origin:Delhi','j');const patch=plain(j.carryJourney(after,from,to));
 assert.equal(patch.travelPreferences[to].rate,'500');assert.equal(patch.travelPreferences[from],undefined);
 assert.deepEqual(patch.costRecords.map(c=>c.leg_key??null),[to,to,null]);
 assert.deepEqual(plain(j.journeyImpact(before,{...after,...patch})).lost,[],'nothing left behind');
 assert.deepEqual(plain(j.carryJourney(after,from,key('nowhere','x'))),{},'only to a journey that exists');
 assert.deepEqual(plain(j.carryJourney(before,from,to)),{},'never from a journey that still exists');});
test('an existing new-journey detail is never overwritten',()=>{const before=trip([J,U]);const after={...before,stops:[U,J],travelPreferences:{...before.travelPreferences,[key('origin:Delhi','u')]:{mode:'Bus',hours:'',overnight:0,rate:'200',basis:'person'}}};const patch=plain(j.carryJourney(after,key('origin:Delhi','j'),key('origin:Delhi','u')));assert.equal(patch.travelPreferences[key('origin:Delhi','u')].mode,'Bus');});

test('hours-only and overnight-only journey details are disclosed and carried once',()=>{
 for(const timing of [{hours:'8',overnight:0},{hours:'',overnight:1}]) {
  const before=trip([J,U]),from=key('origin:Delhi','j'),to=key('origin:Delhi','u');
  before.costRecords=[];
  before.travelPreferences[from]={mode:'',rate:'',basis:'person',...timing};
  const after={...before,stops:[U,J]},impact=plain(j.journeyImpact(before,after));
  assert.equal(impact.lost.length,1);
  assert.equal(impact.lost[0].hours,timing.hours);
  assert.equal(impact.lost[0].overnight,timing.overnight);
  const patch=plain(j.carryJourney(after,from,to));
  assert.deepEqual(patch.travelPreferences[to],before.travelPreferences[from]);
  assert.equal(patch.travelPreferences[from],undefined);
  assert.equal(j.journeyImpact(before,{...after,...patch}).lost.length,0);
 }
});
