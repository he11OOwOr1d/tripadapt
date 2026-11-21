const {test}=require('node:test');const assert=require('node:assert/strict');const ts=require('typescript');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
function load(file,deps={}){const out={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.resolve(__dirname,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:out,require:n=>deps[n.replace(/^\.\//,'')]??{},Object,Array,String,Number,Math,JSON,Date,Intl,TextEncoder,Set,Map,URL},{});return out;}
const planning=load('../lib/trips/planning.ts');
const itinerary=load('../lib/trips/itinerary.ts',{planning});
const dayMap=load('../lib/trips/day-map.ts',{lodging:{lodgingPoint:()=>null}});
const lodging=load('../lib/trips/lodging.ts',{'day-map':dayMap});
const events=load('../lib/trips/trip-events.ts',{itinerary,planning,lodging});
const agenda=load('../lib/trips/trip-agenda.ts',{itinerary,'trip-events':events});
const grid=load('../lib/trips/trip-grid.ts',{});
const J=v=>JSON.parse(JSON.stringify(v));
const h=(hh,mm=0)=>hh*60+mm;

test('spans that do not overlap each get the whole width',()=>{
  assert.deepEqual(J(grid.packLanes([{start:h(9),end:h(10)},{start:h(10),end:h(11)},{start:h(13),end:h(14)}])),[{lane:0,lanes:1},{lane:0,lanes:1},{lane:0,lanes:1}]);
  assert.deepEqual(J(grid.packLanes([])),[]);
});
test('overlapping spans sit side by side and share the width equally',()=>{
  assert.deepEqual(J(grid.packLanes([{start:h(9),end:h(11)},{start:h(10),end:h(12)}])),[{lane:0,lanes:2},{lane:1,lanes:2}]);
  assert.deepEqual(J(grid.packLanes([{start:h(9),end:h(12)},{start:h(10),end:h(11)},{start:h(10,30),end:h(11,30)}])),[{lane:0,lanes:3},{lane:1,lanes:3},{lane:2,lanes:3}]);
  // input order does not matter, and the result keeps input order
  assert.deepEqual(J(grid.packLanes([{start:h(10),end:h(12)},{start:h(9),end:h(11)}])),[{lane:1,lanes:2},{lane:0,lanes:2}]);
});
test('a chain of overlaps shares one stretch, reuses a free lane, and a later gap starts afresh',()=>{
  // A 9-11, B 10-12, C 11-13: C starts when A ends, so it takes A's lane; all three are one cluster of two lanes
  assert.deepEqual(J(grid.packLanes([{start:h(9),end:h(11)},{start:h(10),end:h(12)},{start:h(11),end:h(13)},{start:h(15),end:h(16)}])),[{lane:0,lanes:2},{lane:1,lanes:2},{lane:0,lanes:2},{lane:0,lanes:1}]);
});
test('a span that touches the next one at its end does not count as overlapping',()=>{
  assert.deepEqual(J(grid.packLanes([{start:h(9),end:h(10)},{start:h(10),end:h(10,30)}])),[{lane:0,lanes:1},{lane:0,lanes:1}]);
  // and it must not widen its neighbours' lane count: A ends exactly when B starts, and only B and C overlap, so A keeps the full width
  assert.deepEqual(J(grid.packLanes([{start:h(9),end:h(10)},{start:h(10),end:h(12)},{start:h(11),end:h(12)}])),[{lane:0,lanes:1},{lane:0,lanes:2},{lane:1,lanes:2}]);
});

const item=(key,startMin,endMin,extra={})=>({key,eventId:key,kind:'activity',role:'event',title:key,when:'',note:'',skipped:false,open:null,sort:'',startMin,endMin,...extra});
const dayOf=(date,items)=>({date,label:date,tripDay:1,place:'Jaipur',open:null,items});
test('days are split into pages of five, and a short last page is kept',()=>{
  const days=Array.from({length:9},(_,i)=>dayOf('2026-12-0'+(i+1),[]));
  const pages=grid.gridPages(days);
  assert.deepEqual(J(pages.map(p=>p.columns.length)),[5,4]);
  assert.deepEqual(J(pages[1].columns.map(c=>c.day.date)),['2026-12-06','2026-12-07','2026-12-08','2026-12-09']);
  assert.equal(grid.gridPages(days,3).length,3);
  assert.deepEqual(J(grid.gridPages([])),[]);
  assert.equal(grid.gridPages(days,0).length,9);
});
test('the hours always cover a working day and stretch to fit anything earlier or later',()=>{
  const quiet=grid.gridPages([dayOf('2026-12-04',[item('a',h(10),h(11))])])[0];
  assert.deepEqual([quiet.from,quiet.to],[8,20]);
  const none=grid.gridPages([dayOf('2026-12-04',[])])[0];assert.deepEqual([none.from,none.to],[8,20]);
  const early=grid.gridPages([dayOf('2026-12-04',[item('a',h(5,45),h(7))])])[0];assert.equal(early.from,5);
  const late=grid.gridPages([dayOf('2026-12-04',[item('a',h(21),h(22,30))])])[0];assert.equal(late.to,23);
  const midnight=grid.gridPages([dayOf('2026-12-04',[item('a',h(0),h(2)),item('b',h(23),1440)])])[0];assert.deepEqual([midnight.from,midnight.to],[0,24]);
  // the axis is shared by every column on the page, so the earliest line on any day sets it
  const shared=grid.gridPages([dayOf('2026-12-04',[item('a',h(10),h(11))]),dayOf('2026-12-05',[item('b',h(6),h(7))])])[0];assert.equal(shared.from,6);
});
test('lines without real times go to the all-day band, the rest to the hours, with short ones drawn at least half an hour tall',()=>{
  const col=grid.gridPages([dayOf('2026-12-04',[item('stay',null,null,{kind:'stay'}),item('short',h(9),h(9,10)),item('long',h(14),h(16))])])[0].columns[0];
  assert.deepEqual(J(col.allDay.map(i=>i.key)),['stay']);
  assert.deepEqual(J(col.blocks.map(b=>[b.item.key,b.start,b.end])),[['short',540,570],['long',840,960]]);
  // a short line does not hide the one that starts inside its drawn height
  const two=grid.gridPages([dayOf('2026-12-04',[item('a',h(9),h(9,10)),item('b',h(9,20),h(10))])])[0].columns[0].blocks;
  assert.deepEqual(J(two.map(b=>[b.lane,b.lanes])),[[0,2],[1,2]]);
  // nothing is drawn past midnight
  const late=grid.gridPages([dayOf('2026-12-04',[item('late',h(23,50),1440)])])[0].columns[0].blocks[0];assert.equal(late.end,1440);
});

const stop=(id,name,nights,tz='Asia/Kolkata')=>({id,name,nights,timezone:tz});
const act=(id,stopId,day,start,minutes,extra={})=>({id,stopId,day,title:id,start,minutes,fixed:false,completed:false,booked:false,...extra});
test('on a real trip a flight across time zones is as long as it really takes, and its arrival continues on the next day',()=>{
  const t={title:'T',mode:'exact',start:'2026-12-04',origin:'Delhi',returnToOrigin:true,stops:[stop('s1','Jaipur',2),stop('s2','Paris',1,'Europe/Paris')],activities:[act('Fort','s1',1,'10:00',90),act('Tour','s1',1,'10:30',60)]};
  const key=planning.routeLegs(t)[1].key;
  const days=(prefs)=>agenda.agendaDays({...t,travelPreferences:{[key]:{mode:'Flight',hours:'',overnight:0,rate:'',basis:'person',departure:'',arrival:'',reference:'',booked:false,...prefs}}});
  // 09:00 Kolkata to 12:00 Paris is 7.5 hours in the air (03:30Z to 11:00Z), not the 3 hours the two clocks suggest
  const day=days({departure:'09:00',arrival:'12:00'}).find(d=>d.date==='2026-12-06');
  const f=day.items.find(i=>i.kind==='journey');assert.deepEqual([f.startMin,f.endMin],[540,990]);
  // overnight: 22:00 Kolkata to 06:00 Paris is 16:30Z to 05:00Z = 12.5 hours; the first day shows up to midnight, the next from midnight to the arrival
  const night=days({departure:'22:00',arrival:'06:00'});
  const out=night.find(d=>d.date==='2026-12-06').items.find(i=>i.kind==='journey'),back=night.find(d=>d.date==='2026-12-07').items.find(i=>i.role==='arrival');
  assert.deepEqual([out.startMin,out.endMin],[1320,1440]);assert.deepEqual([back.startMin,back.endMin],[0,360]);
  // the two overlapping activities on the first day are side by side; the stay lines are in the band
  const page=grid.gridPages(days({}))[0];const first=page.columns[0];
  assert.deepEqual(J(first.blocks.map(b=>[b.item.title,b.lane,b.lanes])),[['Fort',0,2],['Tour',1,2]]);
  assert.ok(first.allDay.every(i=>i.kind==='stay')||first.allDay.length===0);
});

test('changing the page size keeps the first day on screen on screen',()=>{
  // days 0-based: page 1 of 5 starts at day 5; with pages of 3 that day is on page 1 (days 3-5), not page 2
  assert.equal(grid.pageAfterResize(1,5,3),1);
  assert.equal(grid.pageAfterResize(2,5,3),3);   // starts at day 10, which is on page 3 (days 9-11)
  assert.equal(grid.pageAfterResize(1,3,5),0);   // starts at day 3, which is on page 0 (days 0-4)
  assert.equal(grid.pageAfterResize(3,3,5),1);   // starts at day 9, page 1 (days 5-9)
  assert.equal(grid.pageAfterResize(0,5,3),0);
  assert.equal(grid.pageAfterResize(4,5,5),4);
  for(const bad of [[NaN,5,3],[1,0,3],[1,5,0],[-1,5,3],[1,NaN,3]])assert.equal(grid.pageAfterResize(...bad),0,String(bad));
  // for every starting point the new page really contains the old first day
  for(const [a,b] of [[5,3],[3,5]])for(let i=0;i<8;i++){const first=i*a,page=grid.pageAfterResize(i,a,b);assert.ok(page*b<=first&&first<(page+1)*b,`${a}->${b} page ${i}`);}
  assert.deepEqual(J(grid.GRID_DAY_CHOICES),[3,5]);
});

test("the grid's hours start from the traveler's own day, and still stretch for anything outside it",()=>{
  const none=grid.gridPages([dayOf('2026-12-04',[])],5,{from:10,to:23})[0];assert.deepEqual([none.from,none.to],[10,23]);
  const inside=grid.gridPages([dayOf('2026-12-04',[item('a',h(11),h(12))])],5,{from:10,to:23})[0];assert.deepEqual([inside.from,inside.to],[10,23]);
  const early=grid.gridPages([dayOf('2026-12-04',[item('a',h(7),h(8))])],5,{from:10,to:23})[0];assert.equal(early.from,7);
  const late=grid.gridPages([dayOf('2026-12-04',[item('a',h(23),1440)])],5,{from:10,to:23})[0];assert.equal(late.to,24);
  // omitted: the working day as before
  const omitted=grid.gridPages([dayOf('2026-12-04',[])])[0];assert.deepEqual([omitted.from,omitted.to],[8,20]);
  assert.deepEqual(J(grid.DEFAULT_GRID_HOURS),{from:8,to:20});
});
