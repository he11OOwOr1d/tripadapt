const {test}=require('node:test');const assert=require('node:assert/strict');const ts=require('typescript');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
const out={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.resolve(__dirname,'../lib/trips/day-map.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:out});
const J=v=>JSON.parse(JSON.stringify(v));
const place=(lat,lng)=>({id:'p',latitude:lat,longitude:lng});
const act=(id,start,lat,lng,extra={})=>({id,title:id,start,minutes:60,kind:'custom',place:lat===undefined?undefined:place(lat,lng),...extra});
const stop={id:'s1',name:'San Francisco',nights:2,location:{latitude:37.77,longitude:-122.42}};

test('visits are numbered in timeline order regardless of input order, and the stay centre is order 0',()=>{
  const m=out.dayMapModel(stop,[act('b','12:00',37.78,-122.4),act('a','10:00',37.79,-122.41),act('c','10:00',37.8,-122.39)]);
  assert.deepEqual(J(m.points.map(p=>[p.id,p.order,p.kind])),[['stop:s1',0,'stop'],['a',1,'activity'],['c',2,'activity'],['b',3,'activity']]);
  assert.equal(m.points[1].detail,'10:00 · 60 min');
});
test('straight links join only consecutive visits, never the destination centre',()=>{
  const m=out.dayMapModel(stop,[act('a','10:00',37.79,-122.41),act('b','12:00',37.78,-122.4),act('c','14:00',37.8,-122.39)]);
  assert.deepEqual(J(m.links),[{from:'a',to:'b'},{from:'b',to:'c'}]);
  assert.equal(out.dayMapModel(stop,[act('a','10:00',37.79,-122.41)]).links.length,0);
});
test('activities without usable coordinates stay in the list, and only venues count as missing',()=>{
  const bad=[act('nan','09:00',NaN,1),act('big','09:10',91,1),act('wide','09:20',1,181),act('null-island','09:30',0,0),act('none','09:40'),act('str','09:50','1','2')];
  const m=out.dayMapModel(stop,[...bad,act('meal','11:00',undefined,undefined,{kind:'meal'}),act('rest','11:30',undefined,undefined,{kind:'rest'}),act('ok','12:00',37.78,-122.4)]);
  assert.deepEqual(J(m.points.filter(p=>p.kind==='activity').map(p=>p.id)),['ok']);
  assert.deepEqual(J(m.unmapped.map(u=>u.id).sort()),['big','nan','none','null-island','str','wide']);
});
test('skipped visits leave the map; completed ones stay',()=>{
  const m=out.dayMapModel(stop,[act('skip','10:00',37.79,-122.41,{skipped:true}),act('done','11:00',37.78,-122.4,{completed:true})]);
  assert.deepEqual(J(m.points.filter(p=>p.kind==='activity').map(p=>p.id)),['done']);
  assert.equal(m.unmapped.length,0);
});
test('bounds cover every marker, and a single marker centres instead of fitting',()=>{
  const m=out.dayMapModel(stop,[act('a','10:00',37.7,-122.5),act('b','12:00',37.9,-122.3)]);
  assert.deepEqual(J(m.bounds),[[-122.5,37.7],[-122.3,37.9]]);
  assert.equal(m.center,null);
  const one=out.dayMapModel(undefined,[act('a','10:00',37.7,-122.5)]);
  assert.equal(one.bounds,null);assert.deepEqual(J(one.center),[-122.5,37.7]);
  const none=out.dayMapModel(undefined,[]);
  assert.equal(none.bounds,null);assert.equal(none.center,null);assert.equal(none.points.length,0);
});
test('a stay without a usable centre falls back to its visits; a missing stop is tolerated',()=>{
  assert.equal(out.dayMapModel({id:'s',name:'X',nights:1},[act('a','10:00',37.7,-122.5)]).points.length,1);
  assert.equal(out.dayMapModel({id:'s',name:'X',nights:1,location:{latitude:0,longitude:0}},[]).points.length,0);
  assert.equal(out.dayMapModel(undefined,[]).points.length,0);
});
test('the route model numbers destinations, links them in order and lists those without a location',()=>{
  const m=out.routeMapModel([{id:'1',name:'Kyoto',nights:3,location:{latitude:35,longitude:135.7}},{id:'2',name:'Nowhere',nights:1},{id:'3',name:'Tokyo',nights:1,location:{latitude:35.7,longitude:139.7}}]);
  assert.deepEqual(J(m.points.map(p=>[p.id,p.order,p.detail])),[['stop:1',1,'3 nights'],['stop:3',2,'1 night']]);
  assert.deepEqual(J(m.links),[{from:'stop:1',to:'stop:3'}]);
  assert.deepEqual(J(m.unmapped),[{id:'2',label:'Nowhere'}]);
  assert.equal(m.scope,'route');
});
test('the text alternative agrees with the model and is honest about what is missing',()=>{
  const m=out.dayMapModel(stop,[act('a','10:00',37.79,-122.41),act('b','11:00')]);
  assert.equal(out.mapSummary(m),'1 mapped visit shown; 1 without a map location stay in the list only.');
  assert.equal(out.mapSummary(out.dayMapModel(stop,[])),'0 mapped visits shown.');
  assert.equal(out.mapSummary(out.routeMapModel([{id:'1',name:'K',nights:1,location:{latitude:35,longitude:135}}])),'1 destination shown.');
});
test('the input is never mutated',()=>{
  const list=[act('b','12:00',37.78,-122.4),act('a','10:00',37.79,-122.41)];const before=JSON.stringify(list);out.dayMapModel(stop,list);assert.equal(JSON.stringify(list),before);
});

const home={name:'Hotel Aurora',latitude:37.775,longitude:-122.41,booked:true};
test('a recorded stay with a location is an unnumbered pin outside the visit line',()=>{
  const m=out.dayMapModel(stop,[act('a','10:00',37.79,-122.41),act('b','12:00',37.78,-122.4)],home);
  const l=m.points.find(p=>p.kind==='lodging');
  assert.deepEqual(J([l.id,l.order,l.label,l.detail]),['lodging:s1',0,'Hotel Aurora','Your stay · marked booked by you']);
  assert.deepEqual(J(m.links),[{from:'a',to:'b'}]);
  assert.match(out.mapSummary(m),/2 mapped visits shown; your recorded stay is marked/);
});
test('a stay without a usable location, or without a stop, adds nothing',()=>{
  for(const bad of [{name:'X'},{name:'X',latitude:0,longitude:0},{name:'X',latitude:91,longitude:1},null,undefined])
    assert.equal(out.dayMapModel(stop,[],bad).points.filter(p=>p.kind==='lodging').length,0);
  assert.equal(out.dayMapModel(undefined,[],home).points.length,0);
});
test('the stay widens the bounds so it is never off screen',()=>{
  const m=out.dayMapModel(stop,[act('a','10:00',37.79,-122.41)],{name:'Far',latitude:37.5,longitude:-122.6});
  assert.deepEqual(J(m.bounds),[[-122.6,37.5],[-122.41,37.79]]);
});
