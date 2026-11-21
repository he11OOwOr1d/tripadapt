const {test}=require('node:test');const assert=require('node:assert/strict');const ts=require('typescript');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
function load(file,deps={}){const out={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.resolve(__dirname,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:out,require:n=>deps[n.replace(/^\.\//,'')]??{},Object,Array,String,Number,Math,JSON,Date,Intl,TextEncoder,Set,Map,URL},{});return out;}
const planning=load('../lib/trips/planning.ts');
const itinerary=load('../lib/trips/itinerary.ts',{planning});
const dayMap=load('../lib/trips/day-map.ts',{lodging:{lodgingPoint:()=>null}});
const lodging=load('../lib/trips/lodging.ts',{'day-map':dayMap});
const ev=load('../lib/trips/trip-events.ts',{itinerary,planning,lodging});
const J=v=>JSON.parse(JSON.stringify(v));
const stop=(id,name,nights,tz='Asia/Kolkata')=>({id,name,nights,timezone:tz});
const act=(id,stopId,day,start,minutes,extra={})=>({id,stopId,day,title:id,start,minutes,fixed:false,completed:false,booked:false,...extra});
const trip=(o={})=>({title:'My trip',mode:'exact',start:'2026-12-04',origin:'Delhi',returnToOrigin:true,stops:[stop('s1','Jaipur',2),stop('s2','Agra',1)],activities:[],...o});
const iso=d=>d.toISOString();
const ids=(t,o)=>J(ev.tripEvents(t,o).map(e=>e.id));

test('there are no events without exact dates or without anything planned',()=>{
  assert.deepEqual(J(ev.tripEvents(trip())),[]);
  assert.deepEqual(J(ev.tripEvents(trip({mode:'window',activities:[act('a','s1',1,'10:00',60)]}))),[]);
  assert.deepEqual(J(ev.tripEvents(trip({start:'',activities:[act('a','s1',1,'10:00',60)]}))),[]);
});
test('an activity is placed on its local date and time, with the same moment as an instant',()=>{
  const [e]=ev.tripEvents(trip({activities:[act('Fort','s1',1,'10:00',90,{title:'Amber Fort',place:{name:'Amber',latitude:26.98,longitude:75.85}})]}));
  assert.equal(e.id,'activity-Fort');assert.equal(e.kind,'activity');assert.equal(e.title,'Amber Fort');
  assert.deepEqual(J(e.start),{date:'2026-12-04',time:'10:00',zone:'Asia/Kolkata'});
  assert.deepEqual(J(e.end),{date:'2026-12-04',time:'11:30',zone:'Asia/Kolkata'});
  assert.equal(iso(e.startUtc),'2026-12-04T04:30:00.000Z');assert.equal(iso(e.endUtc),'2026-12-04T06:00:00.000Z');
  assert.equal(e.allDay,false);assert.equal(e.marker,false);assert.equal(e.skipped,false);
  assert.equal(e.location,'Amber');assert.deepEqual(J(e.details),['Jaipur']);assert.deepEqual(J(e.position),{latitude:26.98,longitude:75.85});
  assert.equal(e.stopId,'s1');assert.equal(e.activityId,'Fort');assert.equal(e.legKey,null);
  const [plain]=ev.tripEvents(trip({activities:[act('x','s2',1,'09:00',30)]}));
  assert.equal(plain.location,'Agra');assert.equal(plain.position,null);assert.equal(plain.start.date,'2026-12-06');
});
test('an activity that runs past midnight ends on the next local date, in its own zone',()=>{
  const t=trip({stops:[stop('s1','Sydney',2,'Australia/Sydney')],activities:[act('Late','s1',1,'23:00',120)]});
  const [e]=ev.tripEvents(t);
  assert.deepEqual(J(e.start),{date:'2026-12-04',time:'23:00',zone:'Australia/Sydney'});
  assert.deepEqual(J(e.end),{date:'2026-12-05',time:'01:00',zone:'Australia/Sydney'});
  assert.equal(iso(e.startUtc),'2026-12-04T12:00:00.000Z');
});
test('skipped activities are left out unless asked for, and then flagged',()=>{
  const t=trip({activities:[act('Keep','s1',1,'10:00',60),act('Gone','s1',1,'12:00',30,{skipped:true})]});
  assert.deepEqual(ids(t),['activity-Keep']);
  const all=ev.tripEvents(t,{includeSkipped:true});
  assert.deepEqual(J(all.map(e=>[e.id,e.skipped])),[['activity-Keep',false],['activity-Gone',true]]);
});
test('a stay is an all-day event from check-in to check-out with no times and the traveler’s own details',()=>{
  const prefs={s1:{style:'',rate:'',basis:'room',lodging:{name:'Haveli',address:'Old Town',booked:true,reference:'Conf 88',check_in:'14:00',check_out:'11:00',latitude:26.92,longitude:75.78}}};
  const [e]=ev.tripEvents(trip({stayPreferences:prefs}));
  assert.equal(e.id,'stay-s1-1');assert.equal(e.kind,'stay');assert.equal(e.title,'Stay: Haveli');assert.equal(e.allDay,true);
  assert.deepEqual(J(e.start),{date:'2026-12-04',time:null,zone:'Asia/Kolkata'});assert.deepEqual(J(e.end),{date:'2026-12-06',time:null,zone:'Asia/Kolkata'});
  assert.equal(e.startUtc,null);assert.equal(e.endUtc,null);assert.equal(e.location,'Old Town');
  assert.deepEqual(J(e.details),['check-in from 14:00, check-out by 11:00','Your reference: Conf 88','You marked this as booked']);
  assert.deepEqual(J(e.position),{latitude:26.92,longitude:75.78});
  const [plain]=ev.tripEvents(trip({stayPreferences:{s1:{style:'',rate:'',basis:'room',lodging:{name:''}}}}));
  assert.equal(plain.title,'Stay: where you are staying');assert.equal(plain.location,'Jaipur');assert.deepEqual(J(plain.details),['Not marked as booked']);
  const [far]=[ev.tripEvents(trip({stayPreferences:{s1:{style:'',rate:'',basis:'room',lodging:{name:'Far',first_night:5,last_night:6}}}}))];
  assert.deepEqual(J(far),[]);
});
const pair=()=>trip({stops:[stop('s1','Jaipur',2),stop('s2','Paris',1,'Europe/Paris')]});
const withLeg=(p)=>{const t=pair();const key=planning.routeLegs(t)[1].key;return trip({stops:t.stops,travelPreferences:{[key]:{mode:'Flight',hours:'',overnight:0,rate:'',basis:'person',...p}}});};
test('a journey keeps each end’s own zone and the traveler’s recorded times',()=>{
  const [e]=ev.tripEvents(withLeg({departure:'09:00',arrival:'12:00',reference:'PNR 7',booked:true}));
  assert.equal(e.id,'journey-s1-s2');assert.equal(e.kind,'journey');assert.equal(e.title,'Jaipur to Paris (Flight)');assert.equal(e.marker,false);
  assert.deepEqual(J(e.start),{date:'2026-12-06',time:'09:00',zone:'Asia/Kolkata'});assert.deepEqual(J(e.end),{date:'2026-12-06',time:'12:00',zone:'Europe/Paris'});
  assert.equal(iso(e.startUtc),'2026-12-06T03:30:00.000Z');assert.equal(iso(e.endUtc),'2026-12-06T11:00:00.000Z');
  assert.equal(e.location,null);assert.equal(e.position,null);assert.deepEqual(J(e.details),['Your reference: PNR 7','You marked this as booked']);
  assert.equal(e.stopId,'s2');assert.equal(e.activityId,null);assert.equal(e.legKey,planning.routeLegs(pair())[1].key);
  // an arrival that is not after the departure is the next day
  const [night]=ev.tripEvents(withLeg({departure:'22:00',arrival:'06:00'}));
  assert.deepEqual(J(night.end),{date:'2026-12-07',time:'06:00',zone:'Europe/Paris'});assert.equal(iso(night.endUtc),'2026-12-07T05:00:00.000Z');
});
test('a journey with only a departure or only an arrival is a short marker, also when the other time is saved as an empty string',()=>{
  // The app saves "not recorded" as "", not as a missing field. An arrival-only journey used to crash the calendar file.
  for(const blank of ['',undefined]){
    const [arr]=ev.tripEvents(withLeg({departure:blank,arrival:'12:00'}));
    assert.equal(arr.title,'Arrives: Jaipur to Paris (Flight)');assert.equal(arr.marker,true);
    assert.deepEqual(J(arr.start),{date:'2026-12-06',time:'12:00',zone:'Europe/Paris'});assert.deepEqual(J(arr.end),{date:'2026-12-06',time:'12:15',zone:'Europe/Paris'});
    assert.equal(iso(arr.startUtc),'2026-12-06T11:00:00.000Z');
    const [dep]=ev.tripEvents(withLeg({departure:'09:00',arrival:blank}));
    assert.equal(dep.title,'Departs: Jaipur to Paris (Flight)');assert.equal(dep.marker,true);
    assert.deepEqual(J(dep.start),{date:'2026-12-06',time:'09:00',zone:'Asia/Kolkata'});assert.deepEqual(J(dep.end),{date:'2026-12-06',time:'09:15',zone:'Asia/Kolkata'});
  }
  const [late]=ev.tripEvents(withLeg({departure:'23:55',arrival:''}));
  assert.deepEqual(J(late.end),{date:'2026-12-07',time:'00:10',zone:'Asia/Kolkata'});
  assert.deepEqual(J(ev.tripEvents(withLeg({departure:'',arrival:''}))),[]);
  assert.deepEqual(J(ev.tripEvents(withLeg({}))),[]);
});
test('events with a malformed time are left out and the rest still come through',()=>{
  const t=trip({activities:[act('Good','s1',1,'10:00',60),act('NoTime','s1',1,'',60),act('Odd','s1',1,'TBD',60),act('Zero','s1',1,'11:00',0),act('Nan','s1',1,'11:00',NaN),act('Lost','ghost',1,'10:00',60)]});
  assert.deepEqual(ids(t),['activity-Good']);
  assert.deepEqual(J(ev.tripEvents(withLeg({departure:'9:0',arrival:'12:00'}))),[]);
  assert.deepEqual(J(ev.tripEvents(withLeg({departure:'25:00'}))),[]);
});
test('events come in route order: each destination’s activities then its stays, then the journeys',()=>{
  const base=withLeg({departure:'09:00',arrival:'12:00'});
  const full={...base,activities:[act('b','s2',1,'10:00',60),act('a','s1',1,'10:00',60)],stayPreferences:{s1:{style:'',rate:'',basis:'room',lodging:{name:'H1'}},s2:{style:'',rate:'',basis:'room',lodging:{name:'H2'}}}};
  // Paris has 1 night so it has a stay too; Jaipur comes first in the route
  assert.deepEqual(ids(full),['activity-a','stay-s1-1','activity-b','stay-s2-1','journey-s1-s2']);
});
test('building events never changes the plan',()=>{
  const t=withLeg({departure:'09:00',arrival:'12:00',reference:'x'});t.activities=[act('a','s1',1,'10:00',60,{place:{name:'P',latitude:1,longitude:2}})];t.stayPreferences={s1:{style:'',rate:'',basis:'room',lodging:{name:'H',first_night:1,last_night:2}}};
  const before=JSON.stringify(t);ev.tripEvents(t,{includeSkipped:true});assert.equal(JSON.stringify(t),before);
});
test('a map position is only kept when it is a real coordinate',()=>{
  const at=(lat,lon)=>ev.tripEvents(trip({activities:[act('a','s1',1,'10:00',60,{place:{name:'P',latitude:lat,longitude:lon}})]}))[0].position;
  assert.deepEqual(J(at(0,0)),{latitude:0,longitude:0});
  for(const [la,lo] of [[91,0],[0,181],[NaN,0],[0,Infinity],['1','2'],[null,null],[undefined,undefined]])assert.equal(at(la,lo),null,String([la,lo]));
});
test('local parts invert the zone conversion on every day of 2026 in many zones, and midnight reads 00:00',()=>{
  const zones=['Asia/Kolkata','Asia/Kathmandu','America/New_York','Europe/London','Europe/Paris','Australia/Sydney','Pacific/Auckland','America/Sao_Paulo','Africa/Cairo','Asia/Tokyo','UTC'];
  let checked=0;
  for(const tz of zones)for(let n=0;n<365;n++){
    const date=new Date(Date.UTC(2026,0,1+n)).toISOString().slice(0,10);
    for(const time of ['00:00','00:30','12:00','23:45']){
      const got=ev.localParts(ev.zonedToUtc(date,time,tz),tz);
      // a local time the clock skipped lands later within the hour; everything else must come back exactly
      if(got.date===date&&got.time===time){checked++;continue;}
      const asMs=(d,t)=>Date.parse(`${d}T${t}:00Z`);const diff=asMs(got.date,got.time)-asMs(date,time);
      assert.ok(diff>0&&diff<=3600000,`${tz} ${date} ${time} -> ${got.date} ${got.time}`);checked++;
    }
  }
  assert.equal(checked,zones.length*365*4);
  assert.deepEqual(J(ev.localParts(new Date('2026-12-04T18:30:00Z'),'Asia/Kolkata')),{date:'2026-12-05',time:'00:00'});
  assert.deepEqual(J(ev.localParts(new Date('2026-12-04T00:00:00Z'),'UTC')),{date:'2026-12-04',time:'00:00'});
});
test('a destination with a time zone that does not exist makes the events throw, so callers must wrap it',()=>{
  assert.throws(()=>ev.tripEvents(trip({stops:[stop('s1','Nowhere',2,'Mars/Olympus')],activities:[act('a','s1',1,'10:00',60)]})),RangeError);
});
