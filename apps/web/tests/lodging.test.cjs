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
