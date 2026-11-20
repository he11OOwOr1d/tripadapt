const {test}=require('node:test');const assert=require('node:assert/strict');const ts=require('typescript');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
function load(file,deps={}){const out={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.resolve(__dirname,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:out,require:n=>deps[n.replace(/^\.\//,'')]??{},Object,Array,String,Number,JSON});return out;}
const map=load('../lib/trips/day-map.ts',{lodging:{lodgingPoint:()=>null}});
const out=load('../lib/trips/lodging.ts',{'day-map':map});
const J=v=>JSON.parse(JSON.stringify(v));
const PID='7a5c1f0e-33d8-4a8e-9b7d-0d6e2f7f9a11';
const place={id:PID,destination_reference_id:'d',external_id:'geoapify/51abc',name:'Hotel Aurora',category:'lodging',latitude:26.91,longitude:75.78,source:'Geoapify / OpenStreetMap contributors',retrieved_at:'2026-11-19T00:00:00Z'};

test('a name alone is a valid stay; a searched place needs coordinates',()=>{
  assert.equal(out.isLodging({name:'Haveli'}),true);
  assert.equal(out.isLodging({name:'Haveli',external_id:'geoapify/1'}),false);
  assert.equal(out.isLodging({name:'Haveli',external_id:'geoapify/1',latitude:1,longitude:2}),true);
});
test('invalid records are rejected like the backend does',()=>{
  const bad=[{name:''},{name:'  '},{name:'x'.repeat(121)},{name:'a\x07'},{name:'a',address:'l\nb'},{name:'a',latitude:1},{name:'a',latitude:0,longitude:0},{name:'a',latitude:91,longitude:0},{name:'a',check_in:'25:00'},{name:'a',check_out:'9:00'},{name:'a',extra:1},{name:'a',booked:'yes'},{name:'a',external_id:'https://x.test/1',latitude:1,longitude:2},[],null,'x'];
  for(const b of bad)assert.equal(out.isLodging(b),false,JSON.stringify(b));
});
test('nulls the server returns for unset fields are accepted',()=>{
  assert.equal(out.isLodging({name:'A',address:'',latitude:null,longitude:null,external_id:null,source:'',booked:false,check_in:'',check_out:''}),true);
});
test('choosing a place keeps the traveler’s own times, flag and address',()=>{
  const l=J(out.lodgingFromPlace(place,{name:'Old',address:'Gate 2',booked:true,check_in:'14:00',check_out:'11:00'}));
  assert.deepEqual(l,{name:'Hotel Aurora',address:'Gate 2',latitude:26.91,longitude:75.78,external_id:'geoapify/51abc',source:'Geoapify / OpenStreetMap contributors',place_id:PID,booked:true,check_in:'14:00',check_out:'11:00'});
  assert.equal(out.isLodging(l),true);
  assert.equal(J(out.lodgingFromPlace(place)).booked,false);
});
test('withLodging adds, replaces and removes without touching other stays or the allowance',()=>{
  const prefs={a:{style:'Hotel',rate:'100',basis:'bed'},b:{style:'',rate:'',basis:'room'}};
  const added=J(out.withLodging(prefs,'a',{name:'X'}));
  assert.deepEqual(added.a,{style:'Hotel',rate:'100',basis:'bed',lodging:{name:'X'}});
  assert.deepEqual(added.b,prefs.b);
  assert.equal('lodging' in J(out.withLodging(added,'a',null)).a,false);
  assert.deepEqual(J(out.withLodging(undefined,'z',{name:'Y'})),{z:{style:'',rate:'',basis:'room',lodging:{name:'Y'}}});
  assert.equal(prefs.a.lodging,undefined);
});
test('the summary never claims a booking the traveler did not mark',()=>{
  assert.match(out.lodgingSummary(null),/No place to stay recorded/);
  assert.match(out.lodgingSummary({name:'X'}),/not marked as booked/);
  assert.match(out.lodgingSummary({name:'X',booked:true,check_in:'14:00',check_out:'11:00'}),/marked as booked by you · check-in 14:00, check-out 11:00/);
});
test('a retained place id is accepted as a uuid on a searched stay and rejected elsewhere',()=>{
  const searched={name:'A',latitude:1,longitude:2,external_id:'geoapify/1'};
  assert.equal(out.isLodging({...searched,place_id:PID}),true);
  assert.equal(out.isLodging({...searched,place_id:null}),true);
  assert.equal(out.isLodging({name:'A',place_id:null}),true);
  assert.equal(out.isLodging({...searched,place_id:'p'}),false);
  assert.equal(out.isLodging({...searched,place_id:5}),false);
  assert.equal(out.isLodging({name:'A',place_id:PID}),false);
});
test('costs linked to a stay are listed as entered, with no totals',()=>{
  const recs=[
    {id:'1',category:'accommodation',label:'Room',unit:'per_group',quantity:2,amount:'120.00',status:'estimated',stop_id:'s1'},
    {id:'2',category:'food',label:'Breakfast',unit:'per_person',quantity:1,amount:'',status:'estimated',stop_id:'s1'},
    {id:'3',category:'accommodation',label:'Deposit',unit:'per_group',quantity:1,amount:'50',status:'paid',stop_id:'s1',currency:'usd'},
    {id:'4',category:'accommodation',label:'Other stay',unit:'per_group',quantity:1,amount:'9',status:'estimated',stop_id:'s2'},
    {id:'5',category:'activity',label:'Tour',unit:'per_person',quantity:1,amount:'9',status:'estimated',activity_id:'a1'}];
  assert.deepEqual(J(out.stayCostLines(recs,'s1','INR')),['Room · INR 120.00 per group × 2 · estimated','Breakfast · amount not entered · estimated','Deposit · usd 50 per group · marked paid by you']);
  assert.deepEqual(J(out.stayCostLines(undefined,'s1','INR')),[]);
  assert.deepEqual(J(out.stayCostLines(recs,'none','INR')),[]);
});
test('booked nights are validated like the backend and shown in the summary',()=>{
  assert.equal(out.isLodging({name:'A',booked:true,booked_nights:3}),true);
  assert.equal(out.isLodging({name:'A',booked_nights:null}),true);
  for(const n of [0,366,1.5,'3','many',NaN])assert.equal(out.isLodging({name:'A',booked_nights:n}),false,String(n));
  assert.equal(out.lodgingSummary({name:'Haveli',booked:true,booked_nights:3}),'Haveli · marked as booked by you for 3 nights');
  assert.equal(out.lodgingSummary({name:'Haveli',booked:true,booked_nights:1,check_in:'14:00'}),'Haveli · marked as booked by you for 1 night · check-in 14:00');
  assert.equal(out.lodgingSummary({name:'Haveli',booked:false,booked_nights:3}),'Haveli · not marked as booked');
});
test('a booked stay that no longer matches the plan’s nights is flagged, and only then',()=>{
  const stay={name:'H',booked:true,booked_nights:3};
  assert.equal(out.bookedNightsNote(stay,3),null);
  assert.match(out.bookedNightsNote(stay,2),/booked for 3 nights, but your plan now has 2 nights here/);
  assert.match(out.bookedNightsNote({...stay,booked_nights:1},2),/booked for 1 night, but your plan now has 2 nights/);
  assert.equal(out.bookedNightsNote({name:'H',booked:true},2),null);
  assert.equal(out.bookedNightsNote({name:'H',booked_nights:3},2),null);
  assert.equal(out.bookedNightsNote(stay,0),null);
  assert.equal(out.bookedNightsNote(null,2),null);
});
test('a stay’s nights are validated like the backend: both or neither, in order',()=>{
  assert.equal(out.isLodging({name:'A',first_night:1,last_night:2}),true);
  assert.equal(out.isLodging({name:'A',first_night:null,last_night:null}),true);
  for(const bad of [{first_night:2},{last_night:2},{first_night:3,last_night:2},{first_night:0,last_night:1},{first_night:1,last_night:366},{first_night:1.5,last_night:2},{first_night:'1',last_night:2}])assert.equal(out.isLodging({name:'A',...bad}),false,JSON.stringify(bad));
  assert.equal(out.lodgingSummary({name:'Lake view',first_night:3,last_night:4,booked:true,booked_nights:2}),'Lake view · nights 3–4 · marked as booked by you for 2 nights');
  assert.equal(out.lodgingSummary({name:'Hostel',first_night:5,last_night:5}),'Hostel · night 5 · not marked as booked');
});
test('several stays must have their own nights and never share one',()=>{
  const e=(name,a,b)=>({name,first_night:a,last_night:b});
  assert.equal(out.validStays({lodging:{name:'Main'},extra_lodgings:[e('B',3,4),e('C',5,5)]}),true);
  assert.equal(out.validStays({lodging:e('Main',1,2),extra_lodgings:[e('B',3,4)]}),true);
  assert.equal(out.validStays({lodging:e('Main',1,3),extra_lodgings:[e('B',3,4)]}),false);
  assert.equal(out.validStays({extra_lodgings:[e('A',1,3),e('B',3,4)]}),false);
  assert.equal(out.validStays({extra_lodgings:[{name:'No range'}]}),false);
  assert.equal(out.validStays({extra_lodgings:[1,2,3,4,5].map(i=>e('S'+i,i,i))}),false);
  assert.equal(out.validStays({}),true);
});
test('other stays are added, replaced and removed without touching the main stay or other destinations',()=>{
  const prefs={a:{style:'Hotel',rate:'1',basis:'room',lodging:{name:'Main'}},b:{style:'',rate:'',basis:'room'}};
  const one=J(out.withExtraLodging(prefs,'a',null,{name:'B',first_night:3,last_night:3}));
  assert.deepEqual(one.a.extra_lodgings,[{name:'B',first_night:3,last_night:3}]);assert.deepEqual(one.a.lodging,{name:'Main'});assert.deepEqual(one.b,prefs.b);
  const two=J(out.withExtraLodging(one,'a',0,{name:'B2',first_night:3,last_night:4}));assert.equal(two.a.extra_lodgings[0].name,'B2');
  const none=J(out.withExtraLodging(two,'a',0,null));assert.equal('extra_lodgings' in none.a,false);assert.deepEqual(none.a.lodging,{name:'Main'});
  assert.deepEqual(J(out.withExtraLodging(undefined,'k',null,{name:'X',first_night:1,last_night:1})).k.extra_lodgings,[{name:'X',first_night:1,last_night:1}]);
  assert.deepEqual(J(out.staysOf(two.a)).map(s=>s.name),['Main','B2']);
});
test('coverage notes name nights with no stay or beyond the plan, and stay quiet otherwise',()=>{
  const e=(name,a,b)=>({name,first_night:a,last_night:b});
  assert.deepEqual(J(out.coverageNotes(undefined,3)),[]);
  assert.deepEqual(J(out.coverageNotes({lodging:{name:'M'}},3)),[]);
  assert.deepEqual(J(out.coverageNotes({lodging:{name:'M'},extra_lodgings:[e('B',3,3)]},3)),[]);
  assert.deepEqual(J(out.coverageNotes({extra_lodgings:[e('B',3,4)]},4)),['No stay is recorded for nights 1–2.']);
  assert.deepEqual(J(out.coverageNotes({lodging:e('M',1,1),extra_lodgings:[e('B',3,3)]},4)),['No stay is recorded for night 2 and night 4.']);
  assert.deepEqual(J(out.coverageNotes({lodging:{name:'M'},extra_lodgings:[e('B',3,5)]},3)),['B is set for nights 3–5, but your plan has 3 nights here.']);
});
test('the stay for a night is the one whose nights hold it, else the main stay',()=>{
  const pref={lodging:{name:'Main'},extra_lodgings:[{name:'B',first_night:3,last_night:4}]};
  assert.equal(out.stayForNight(pref,1).name,'Main');assert.equal(out.stayForNight(pref,3).name,'B');assert.equal(out.stayForNight(pref,4).name,'B');assert.equal(out.stayForNight(pref,5).name,'Main');
  assert.equal(out.stayForNight({extra_lodgings:[{name:'B',first_night:3,last_night:4}]},1),null);
  assert.equal(out.stayForNight(undefined,1),null);
});
test('the nights a stay is meant to cover are its range, or what the others leave',()=>{
  const main={name:'Main'},b={name:'B',first_night:3,last_night:4},c={name:'C',first_night:6,last_night:9};
  const pref={lodging:main,extra_lodgings:[b,c]};
  assert.equal(out.nightsFor(pref,b,5),2);
  assert.equal(out.nightsFor(pref,c,7),2);
  assert.equal(out.nightsFor(pref,main,7),3);
  assert.equal(out.nightsFor({lodging:main},main,4),4);
  assert.equal(out.nightsFor(undefined,main,4),4);
});
test('a stay without nights spans the unclaimed nights when they form one run',()=>{
  const main={name:'M'};
  assert.deepEqual(J(out.unclaimedSpan({lodging:main,extra_lodgings:[{name:'B',first_night:2,last_night:2}]},main,2)),[1,1]);
  assert.deepEqual(J(out.unclaimedSpan({lodging:main,extra_lodgings:[{name:'B',first_night:3,last_night:4}]},main,4)),[1,2]);
  assert.deepEqual(J(out.unclaimedSpan({lodging:main},main,3)),[1,3]);
  assert.equal(out.unclaimedSpan({lodging:main,extra_lodgings:[{name:'B',first_night:2,last_night:2}]},main,3),null,'split run');
  assert.equal(out.unclaimedSpan({lodging:main,extra_lodgings:[{name:'B',first_night:1,last_night:2}]},main,2),null,'nothing left');
});
test('a fixed stay is validated, shown in the summary, and is not a booking',()=>{
  assert.equal(out.isLodging({name:'A',locked:true}),true);
  assert.equal(out.isLodging({name:'A',locked:false}),true);
  for(const bad of ['yes',1,null])assert.equal(out.isLodging({name:'A',locked:bad}),false,String(bad));
  assert.equal(out.lodgingSummary({name:'Haveli',locked:true}),'Haveli · not marked as booked · kept fixed');
  assert.equal(out.lodgingSummary({name:'Haveli',locked:true,booked:true,booked_nights:2,check_in:'14:00'}),'Haveli · marked as booked by you for 2 nights · kept fixed · check-in 14:00');
  assert.equal(out.lodgingSummary({name:'Haveli',locked:false}),'Haveli · not marked as booked');
});
test('a confirmation reference is plain text up to 100 characters and shown as entered',()=>{
  assert.equal(out.isLodging({name:'A',reference:'Conf 88/12'}),true);
  for(const bad of ['x'.repeat(101),'a\nb','a\x07',5,null])assert.equal(out.isLodging({name:'A',reference:bad}),false,String(bad));
  assert.equal(out.lodgingSummary({name:'Haveli',booked:true,reference:'Conf 88/12'}),'Haveli · marked as booked by you · reference Conf 88/12');
  assert.equal(out.lodgingSummary({name:'Haveli',reference:''}),'Haveli · not marked as booked');
});
