const {test}=require('node:test');const assert=require('node:assert/strict');const ts=require('typescript');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
function load(file,deps={}){const out={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.resolve(__dirname,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:out,require:n=>deps[n.replace(/^\.\//,'')]??{},Object,Array,String,Number,Math,JSON});return out;}
const planning=load('../lib/trips/planning.ts');
const t=load('../lib/trips/transfers.ts',{planning});
const J=v=>JSON.parse(JSON.stringify(v));
const stop=(id,nights)=>({id,name:id,nights,timezone:'UTC'});
const act=(id,stopId,day,start,minutes,extra={})=>({id,stopId,day,title:id,start,minutes,fixed:false,completed:false,booked:false,...extra});
const trip=(stops,prefs,acts)=>({origin:'Delhi',stops,returnToOrigin:true,travelPreferences:prefs,activities:acts});
const legKey=(trp,i)=>planning.routeLegs(trp)[i].key;

test('a booking is validated like the server does and trimmed',()=>{
  const ok=J(t.finishBooking({departure:'09:15',arrival:'',reference:'  PNR 4X  ',booked:true}));
  assert.deepEqual(ok,{booking:{departure:'09:15',arrival:'',reference:'PNR 4X',booked:true}});
  for(const bad of [{departure:'24:00'},{departure:'9:15'},{arrival:'noon'},{reference:'x'.repeat(101)},{reference:'a\nb'},{reference:'a\x07'}]){
    assert.ok('error' in t.finishBooking({departure:'',arrival:'',reference:'',booked:false,...bad}),JSON.stringify(bad));
  }
});
test('saving a booking changes only the booking fields of that journey',()=>{
  const prefs={a:{mode:'Rail',hours:'5',overnight:1,rate:'20',basis:'vehicle'},b:{mode:'',hours:'',overnight:0,rate:'',basis:'person'}};
  const next=J(t.withTransferBooking(prefs,'a',{departure:'09:00',arrival:'12:00',reference:'R',booked:true}));
  assert.deepEqual(next.a,{mode:'Rail',hours:'5',overnight:1,rate:'20',basis:'vehicle',departure:'09:00',arrival:'12:00',reference:'R',booked:true});
  assert.deepEqual(next.b,prefs.b);
  assert.deepEqual(J(t.withTransferBooking(undefined,'k',{departure:'',arrival:'10:00',reference:'',booked:false})).k,{mode:'',hours:'',overnight:0,rate:'',basis:'person',departure:'',arrival:'10:00',reference:'',booked:false});
  assert.equal(prefs.a.departure,undefined);
});
test('the summary says what was entered and that it was not checked',()=>{
  assert.equal(t.bookingSummary(undefined),null);
  assert.equal(t.bookingSummary({mode:'',hours:'',overnight:0,rate:'',basis:'person'}),null);
  assert.equal(t.bookingSummary({departure:'09:15',arrival:'12:40',reference:'PNR',booked:true}),'Marked as booked by you · departs 09:15 · arrives 12:40 · reference PNR. As you entered it; not checked with the supplier.');
  assert.match(t.bookingSummary({arrival:'12:40',booked:false}),/^Your planned times · arrives 12:40\./);
});
test('arrival counts on the first day and departure on the last; skipped items never clash',()=>{
  const stops=[stop('s1',2)];
  const base=trip(stops,{},[]);
  const inKey=legKey(base,0),outKey=legKey(base,1);
  const prefs={[inKey]:{mode:'',hours:'',overnight:0,rate:'',basis:'person',arrival:'14:00'},[outKey]:{mode:'',hours:'',overnight:0,rate:'',basis:'person',departure:'11:00'}};
  const acts=[act('early','s1',1,'10:00',60),act('exact','s1',1,'14:00',60),act('late','s1',1,'15:00',60),act('skipped','s1',1,'08:00',60,{skipped:true}),
    act('mid','s1',2,'09:00',60),act('leaves','s1',3,'10:30',60),act('ends','s1',3,'10:00',60),act('tooLate','s1',3,'12:00',30)];
  const trp=trip(stops,prefs,acts);
  assert.deepEqual(J(t.transferConflicts(trp,'s1',1)),{early:['Starts before your recorded arrival at 14:00.']});
  assert.deepEqual(J(t.transferConflicts(trp,'s1',2)),{});
  assert.deepEqual(J(t.transferConflicts(trp,'s1',3)),{leaves:['Runs past your recorded departure at 11:00.'],tooLate:['Runs past your recorded departure at 11:00.']});
});
test('a one-day stop checks both ends, and no recorded time means no conflict',()=>{
  const stops=[stop('s1',0)];
  const base=trip(stops,{},[]);
  const prefs={[legKey(base,0)]:{mode:'',hours:'',overnight:0,rate:'',basis:'person',arrival:'10:00'},[legKey(base,1)]:{mode:'',hours:'',overnight:0,rate:'',basis:'person',departure:'17:00'}};
  const acts=[act('a','s1',1,'09:00',60),act('b','s1',1,'16:30',60),act('c','s1',1,'11:00',60)];
  const out=J(t.transferConflicts(trip(stops,prefs,acts),'s1',1));
  assert.deepEqual(Object.keys(out).sort(),['a','b']);
  assert.deepEqual(J(t.transferConflicts(trip(stops,{},acts),'s1',1)),{});
  assert.deepEqual(J(t.transferConflicts(trip(stops,prefs,acts),'missing',1)),{});
});
test('the second stop uses the legs between the stops, not the trip start',()=>{
  const stops=[stop('s1',0),stop('s2',0)];
  const base=trip(stops,{},[]);
  const prefs={[legKey(base,1)]:{mode:'',hours:'',overnight:0,rate:'',basis:'person',departure:'09:00',arrival:'13:00'}};
  const acts=[act('x','s1',1,'10:00',30),act('y','s2',1,'11:00',30)];
  const trp=trip(stops,prefs,acts);
  assert.deepEqual(J(t.transferConflicts(trp,'s1',1)),{x:['Runs past your recorded departure at 09:00.']});
  assert.deepEqual(J(t.transferConflicts(trp,'s2',1)),{y:['Starts before your recorded arrival at 13:00.']});
});
test('merging keeps both sides',()=>{
  assert.deepEqual(J(t.mergeIssues({a:['x'],b:['y']},{b:['z'],c:['w']})),{a:['x'],b:['y','z'],c:['w']});
});
