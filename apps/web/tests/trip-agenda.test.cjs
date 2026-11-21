const {test}=require('node:test');const assert=require('node:assert/strict');const ts=require('typescript');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
function load(file,deps={}){const out={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.resolve(__dirname,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:out,require:n=>deps[n.replace(/^\.\//,'')]??{},Object,Array,String,Number,Math,JSON,Date,Intl,TextEncoder,Set,Map,URL},{});return out;}
const planning=load('../lib/trips/planning.ts');
const itinerary=load('../lib/trips/itinerary.ts',{planning});
const dayMap=load('../lib/trips/day-map.ts',{lodging:{lodgingPoint:()=>null}});
const lodging=load('../lib/trips/lodging.ts',{'day-map':dayMap});
const events=load('../lib/trips/trip-events.ts',{itinerary,planning,lodging});
const ag=load('../lib/trips/trip-agenda.ts',{itinerary,'trip-events':events});
const J=v=>JSON.parse(JSON.stringify(v));
const stop=(id,name,nights,tz='Asia/Kolkata')=>({id,name,nights,timezone:tz});
const act=(id,stopId,day,start,minutes,extra={})=>({id,stopId,day,title:id,start,minutes,fixed:false,completed:false,booked:false,...extra});
const trip=(o={})=>({title:'My trip',mode:'exact',start:'2026-12-04',origin:'Delhi',returnToOrigin:true,stops:[stop('s1','Jaipur',2),stop('s2','Agra',1)],activities:[],...o});
const day=(days,date)=>J(days.find(d=>d.date===date));
const titles=(d)=>d.items.map(i=>i.title);

test('there is no agenda without exact dates, and an empty route has no days',()=>{
  assert.equal(ag.agendaDays(trip({mode:'window'})),null);
  assert.equal(ag.agendaDays(trip({start:''})),null);
  assert.deepEqual(J(ag.agendaDays(trip({stops:[]}))),[]);
});
test('every day of the trip is listed, empty or not, with where the traveler is and which day opens',()=>{
  const days=J(ag.agendaDays(trip()));
  assert.deepEqual(days.map(d=>[d.date,d.tripDay,d.place,d.label]),[
    ['2026-12-04',1,'Jaipur','Fri, Dec 4'],['2026-12-05',2,'Jaipur','Sat, Dec 5'],['2026-12-06',3,'Jaipur → Agra','Sun, Dec 6'],['2026-12-07',4,'Agra','Mon, Dec 7']]);
  assert.deepEqual(days[0].open,{stopId:'s1',stopName:'Jaipur',day:1});
  assert.deepEqual(days[1].open,{stopId:'s1',stopName:'Jaipur',day:2});
  // on a travel day both destinations cover the date; the one the traveler arrives at opens
  assert.deepEqual(days[2].open,{stopId:'s2',stopName:'Agra',day:1});
  assert.deepEqual(days[3].open,{stopId:'s2',stopName:'Agra',day:2});
  for(const d of days)assert.deepEqual(d.items,[]);
});
test('activities sit on their date in time order and open their own destination and day',()=>{
  const days=ag.agendaDays(trip({activities:[
    act('Late','s1',1,'15:00',60),act('Early','s1',1,'09:00',45,{title:'Early walk'}),
    act('Fort','s1',1,'11:00',90,{title:'Amber Fort',place:{name:'Amber Fort Palace',latitude:26.98,longitude:75.85}}),
    act('Agra visit','s2',1,'10:00',60,{title:'Taj Mahal'})]}));
  const d4=day(days,'2026-12-04');
  assert.deepEqual(titles(d4),['Early walk','Amber Fort','Late']);
  assert.deepEqual(d4.items.map(i=>i.when),['09:00–09:45','11:00–12:30','15:00–16:00']);
  assert.equal(d4.items[1].note,'Amber Fort Palace');assert.equal(d4.items[0].note,'');
  assert.deepEqual(d4.items[0].open,{stopId:'s1',stopName:'Jaipur',day:1});
  const d6=day(days,'2026-12-06');
  assert.deepEqual(titles(d6),['Taj Mahal']);assert.deepEqual(d6.items[0].open,{stopId:'s2',stopName:'Agra',day:1});
  assert.deepEqual(d6.items[0].role,'event');
});
test('a stay shows on every day it covers as check-in, staying and check-out, placed by the times recorded',()=>{
  const prefs={s1:{style:'',rate:'',basis:'room',lodging:{name:'Haveli',booked:true,reference:'Conf 88',check_in:'14:00',check_out:'11:00'}}};
  const days=ag.agendaDays(trip({stayPreferences:prefs,activities:[act('Taj','s2',1,'09:00',60),act('Shop','s1',1,'16:00',30),act('Walk','s1',1,'10:00',30)]}));
  const d4=day(days,'2026-12-04'),d5=day(days,'2026-12-05'),d6=day(days,'2026-12-06');
  assert.deepEqual(d4.items.map(i=>[i.title,i.role,i.when]),[['Walk','event','10:00–10:30'],['Check in: Haveli','check-in','from 14:00'],['Shop','event','16:00–16:30']]);
  assert.equal(d4.items[1].note,'Your reference: Conf 88. You marked this as booked');
  assert.deepEqual(d5.items.map(i=>[i.title,i.role,i.when]),[['Staying at Haveli','staying','']]);
  assert.deepEqual(d6.items.map(i=>[i.title,i.role,i.when]),[['Taj','event','09:00–10:00'],['Check out: Haveli','check-out','by 11:00']]);
  // each stay line opens the day it is on, in the destination it belongs to
  assert.deepEqual(d5.items[0].open,{stopId:'s1',stopName:'Jaipur',day:2});assert.deepEqual(d6.items[1].open,{stopId:'s1',stopName:'Jaipur',day:3});
  // with no times recorded: check-out first thing, check-in last
  const bare=ag.agendaDays(trip({stayPreferences:{s1:{style:'',rate:'',basis:'room',lodging:{name:''}}},activities:[act('Walk','s1',1,'10:00',30),act('Out','s1',2,'10:00',30)]}));
  assert.deepEqual(day(bare,'2026-12-04').items.map(i=>[i.title,i.when]),[['Walk','10:00–10:30'],['Check in: where you are staying','']]);
  assert.equal(day(bare,'2026-12-04').items[1].note,'Not marked as booked');
  assert.deepEqual(titles(day(bare,'2026-12-06')),['Check out: where you are staying']);
});
test('on the day the stay changes, the old stay checks out before the new one checks in',()=>{
  const prefs={s1:{style:'',rate:'',basis:'room',lodging:{name:'Hostel A',first_night:1,last_night:1},extra_lodgings:[{name:'Hotel B',first_night:2,last_night:2}]}};
  const days=ag.agendaDays(trip({stayPreferences:prefs,activities:[act('Walk','s1',2,'10:00',30)]}));
  assert.deepEqual(titles(day(days,'2026-12-05')),['Check out: Hostel A','Walk','Check in: Hotel B']);
  assert.deepEqual(titles(day(days,'2026-12-04')),['Check in: Hostel A']);
  assert.deepEqual(titles(day(days,'2026-12-06')),['Check out: Hotel B']);
});
const pair=()=>trip({stops:[stop('s1','Jaipur',2),stop('s2','Paris',1,'Europe/Paris')]});
const withLeg=(p)=>{const t=pair();const key=planning.routeLegs(t)[1].key;return {...t,travelPreferences:{[key]:{mode:'Flight',hours:'',overnight:0,rate:'',basis:'person',departure:'',arrival:'',reference:'',booked:false,...p}}};};
test('a journey names the zone at each end and, when it lands the next day, appears again on the arrival day',()=>{
  const same=ag.agendaDays(withLeg({departure:'09:00',arrival:'12:00',reference:'PNR 7',booked:true}));
  const d6=day(same,'2026-12-06');
  assert.deepEqual(d6.items.map(i=>[i.title,i.when,i.note]),[['Jaipur to Paris (Flight)','departs 09:00 (Asia/Kolkata) · arrives 12:00 (Europe/Paris)','Your reference: PNR 7. You marked this as booked']]);
  assert.deepEqual(d6.items[0].open,{stopId:'s2',stopName:'Paris',day:1});
  const night=ag.agendaDays(withLeg({departure:'22:00',arrival:'06:00'}));
  assert.deepEqual(day(night,'2026-12-06').items.map(i=>[i.title,i.when,i.role]),[['Jaipur to Paris (Flight)','departs 22:00 (Asia/Kolkata) · arrives 06:00 the next day (Europe/Paris)','event']]);
  assert.deepEqual(day(night,'2026-12-07').items.map(i=>[i.title,i.when,i.role]),[['Arrival: Jaipur to Paris (Flight)','arrives 06:00 (Europe/Paris)','arrival']]);
  assert.equal(day(night,'2026-12-07').items[0].eventId,'journey-s1-s2');
});
test('a journey between places in the same time zone does not repeat the zone',()=>{
  const t=trip({stops:[stop('s1','Jaipur',2),stop('s2','Agra',1)]});const key=planning.routeLegs(t)[1].key;
  const days=ag.agendaDays({...t,travelPreferences:{[key]:{mode:'Bus',hours:'',overnight:0,rate:'',basis:'person',departure:'09:00',arrival:'15:30'}}});
  assert.deepEqual(day(days,'2026-12-06').items.map(i=>[i.title,i.when]),[['Jaipur to Agra (Bus)','departs 09:00 · arrives 15:30']]);
  const night=ag.agendaDays({...t,travelPreferences:{[key]:{mode:'Bus',hours:'',overnight:0,rate:'',basis:'person',departure:'22:00',arrival:'06:00'}}});
  assert.deepEqual(day(night,'2026-12-06').items.map(i=>i.when),['departs 22:00 · arrives 06:00 the next day']);
});
test('a journey with one recorded time is a single marker line',()=>{
  const dep=ag.agendaDays(withLeg({departure:'09:00'}));
  assert.deepEqual(day(dep,'2026-12-06').items.map(i=>[i.title,i.when]),[['Departs: Jaipur to Paris (Flight)','09:00 (Asia/Kolkata)']]);
  const arr=ag.agendaDays(withLeg({arrival:'12:00'}));
  assert.deepEqual(day(arr,'2026-12-06').items.map(i=>[i.title,i.when]),[['Arrives: Jaipur to Paris (Flight)','12:00 (Europe/Paris)']]);
});
test('an activity that runs past midnight stays on its own day and says so',()=>{
  const days=ag.agendaDays(trip({activities:[act('Party','s1',1,'23:00',120)]}));
  assert.deepEqual(day(days,'2026-12-04').items.map(i=>i.when),['23:00–01:00 (next day)']);
  assert.deepEqual(day(days,'2026-12-05').items,[]);
});
test('skipped activities are shown and marked, and a date outside the trip is kept rather than dropped',()=>{
  const days=ag.agendaDays(trip({activities:[act('Gone','s1',1,'10:00',30,{skipped:true}),act('Far','s1',9,'10:00',30)]}));
  assert.deepEqual(day(days,'2026-12-04').items.map(i=>[i.title,i.skipped]),[['Gone',true]]);
  const far=day(days,'2026-12-12');
  assert.equal(far.place,'Outside your trip days');assert.equal(far.tripDay,null);assert.equal(far.open,null);
  assert.deepEqual(far.items.map(i=>[i.title,i.open]),[['Far',null]]);
  assert.equal(J(days).at(-1).date,'2026-12-12');
});
test('the agenda never changes the plan, and a time zone that does not exist throws so callers can wrap it',()=>{
  const t=withLeg({departure:'09:00',arrival:'12:00'});t.activities=[act('a','s1',1,'10:00',60)];t.stayPreferences={s1:{style:'',rate:'',basis:'room',lodging:{name:'H'}}};
  const before=JSON.stringify(t);ag.agendaDays(t);assert.equal(JSON.stringify(t),before);
  assert.throws(()=>ag.agendaDays(trip({stops:[stop('s1','Nowhere',2,'Mars/Olympus')],activities:[act('a','s1',1,'10:00',60)]})),RangeError);
});
test('dates stay in order across a month and a year boundary',()=>{
  const days=J(ag.agendaDays(trip({start:'2026-12-30',stops:[stop('s1','Jaipur',3)]})));
  assert.deepEqual(days.map(d=>d.date),['2026-12-30','2026-12-31','2027-01-01','2027-01-02']);
  assert.deepEqual(days.map(d=>d.tripDay),[1,2,3,4]);
});
