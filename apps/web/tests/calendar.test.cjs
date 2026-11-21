const {test}=require('node:test');const assert=require('node:assert/strict');const ts=require('typescript');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
function load(file,deps={}){const out={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.resolve(__dirname,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:out,require:n=>deps[n.replace(/^\.\//,'')]??{},Object,Array,String,Number,Math,JSON,Date,Intl,TextEncoder,Set,Map,URL},{});return out;}
const planning=load('../lib/trips/planning.ts');
const itinerary=load('../lib/trips/itinerary.ts',{planning});
const dayMap=load('../lib/trips/day-map.ts',{lodging:{lodgingPoint:()=>null}});
const lodging=load('../lib/trips/lodging.ts',{'day-map':dayMap});
const c=load('../lib/trips/calendar.ts',{itinerary,planning,lodging});
const J=v=>JSON.parse(JSON.stringify(v));
const iso=d=>d.toISOString();
test('a wall-clock time becomes the right UTC instant, including across daylight saving',()=>{
  assert.equal(iso(c.zonedToUtc('2026-12-04','09:00','Asia/Kolkata')),'2026-12-04T03:30:00.000Z');
  assert.equal(iso(c.zonedToUtc('2026-12-04','09:00','America/New_York')),'2026-12-04T14:00:00.000Z');
  assert.equal(iso(c.zonedToUtc('2026-07-01','12:00','Europe/Paris')),'2026-07-01T10:00:00.000Z');
  assert.equal(iso(c.zonedToUtc('2026-03-08','01:30','America/New_York')),'2026-03-08T06:30:00.000Z');
  assert.equal(iso(c.zonedToUtc('2026-03-08','03:30','America/New_York')),'2026-03-08T07:30:00.000Z');
  assert.equal(iso(c.zonedToUtc('2026-12-04','00:00','UTC')),'2026-12-04T00:00:00.000Z');
});
test('text is escaped and long lines fold at 75 octets without splitting a character',()=>{
  assert.equal(c.escapeText('a,b;c\\d\ne'),'a\\,b\\;c\\\\d\\ne');
  const long='SUMMARY:'+'Café ☃ '.repeat(30);
  const folded=c.fold(long);
  for(const line of folded.split('\r\n'))assert.ok(new TextEncoder().encode(line).length<=75,line);
  assert.equal(folded.split('\r\n').map((l,i)=>i?l.slice(1):l).join(''),long);
  assert.equal(c.fold('short'),'short');
});
const stop=(id,name,nights,tz='Asia/Kolkata')=>({id,name,nights,timezone:tz});
const act=(id,stopId,day,start,minutes,extra={})=>({id,stopId,day,title:id,start,minutes,fixed:false,completed:false,booked:false,...extra});
const trip=(o={})=>({title:'My trip',mode:'exact',start:'2026-12-04',origin:'Delhi',returnToOrigin:true,stops:[stop('s1','Jaipur',2),stop('s2','Agra',1)],activities:[],...o});
const now=new Date('2026-11-20T00:00:00Z');
const unfold=t=>t.replace(/\r\n /g,'');
test('without exact dates, or with nothing to show, there is no calendar',()=>{
  assert.equal(c.icsCalendar(trip({mode:'window'}),now),null);
  assert.equal(c.icsCalendar(trip({start:''}),now),null);
  assert.equal(c.icsCalendar(trip(),now),null);
});
test('activities become timed events on the right date in UTC, and skipped ones are left out',()=>{
  const r=c.icsCalendar(trip({activities:[act('Fort','s1',1,'10:00',60,{place:{name:'Amber Fort'}}),act('Skipped','s1',1,'12:00',30,{skipped:true}),act('Market, old; town','s1',2,'09:00',90)]}),now);
  const t=unfold(r.text);assert.equal(r.events,2);
  assert.match(t,/BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-\/\/Elsewhere\/\/Trip plan\/\/EN/);
  assert.match(t,/DTSTART:20261204T043000Z\r\nDTEND:20261204T053000Z\r\nSUMMARY:Fort\r\nLOCATION:Amber Fort/);
  assert.match(t,/DTSTART:20261205T033000Z\r\nDTEND:20261205T050000Z\r\nSUMMARY:Market\\, old\\; town\r\nLOCATION:Jaipur/);
  assert.doesNotMatch(t,/Skipped/);assert.match(t,/UID:activity-Fort@elsewhere.local/);assert.match(t,/DTSTAMP:20261120T000000Z/);
  assert.match(t,/END:VCALENDAR\r\n$/);
});
test('stays are all-day events from check-in to check-out, one per stay, with the traveler’s own notes',()=>{
  const prefs={s1:{style:'',rate:'',basis:'room',lodging:{name:'Main Haveli',booked:true,reference:'Conf 88',first_night:1,last_night:1,check_in:'14:00'},extra_lodgings:[{name:'Hostel',first_night:2,last_night:2}]}};
  const t=unfold(c.icsCalendar(trip({stayPreferences:prefs}),now).text);
  assert.match(t,/DTSTART;VALUE=DATE:20261204\r\nDTEND;VALUE=DATE:20261205\r\nSUMMARY:Stay: Main Haveli/);
  assert.match(t,/DESCRIPTION:check-in from 14:00\. Your reference: Conf 88\. You marked this as booked\. From your Elsewhere plan\. Times and places are your plan\\, not confirmed bookings\./);
  assert.match(t,/DTSTART;VALUE=DATE:20261205\r\nDTEND;VALUE=DATE:20261206\r\nSUMMARY:Stay: Hostel/);
  const single=unfold(c.icsCalendar(trip({stayPreferences:{s1:{style:'',rate:'',basis:'room',lodging:{name:'Haveli'}}}}),now).text);
  assert.match(single,/DTSTART;VALUE=DATE:20261204\r\nDTEND;VALUE=DATE:20261206\r\nSUMMARY:Stay: Haveli/);
});
test('a journey between two destinations needs a recorded time and uses each end’s own zone',()=>{
  const base=trip({stops:[stop('s1','Jaipur',2),stop('s2','Paris',1,'Europe/Paris')]});
  const key=planning.routeLegs(base)[1].key;
  const withTimes=(p)=>trip({stops:base.stops,travelPreferences:{[key]:{mode:'Flight',hours:'',overnight:0,rate:'',basis:'person',reference:'PNR 7',booked:true,...p}}});
  const both=unfold(c.icsCalendar(withTimes({departure:'09:00',arrival:'12:00'}),now).text);
  assert.match(both,/DTSTART:20261206T033000Z\r\nDTEND:20261206T110000Z\r\nSUMMARY:Jaipur to Paris \(Flight\)/);
  assert.match(both,/Your reference: PNR 7\. You marked this as booked\. From your Elsewhere plan/);
  assert.doesNotMatch(both,/\.\. /);
  const overnight=unfold(c.icsCalendar(withTimes({departure:'22:00',arrival:'06:00'}),now).text);
  assert.match(overnight,/DTSTART:20261206T163000Z\r\nDTEND:20261207T050000Z/);
  const one=unfold(c.icsCalendar(withTimes({departure:'09:00'}),now).text);
  assert.match(one,/DTSTART:20261206T033000Z\r\nDTEND:20261206T034500Z\r\nSUMMARY:Departs: Jaipur to Paris/);
  assert.equal(c.icsCalendar(withTimes({}),now),null);
  // the start and finish journeys have no known zone for one end, so they are not written
  const first=planning.routeLegs(base)[0].key;
  assert.equal(c.icsCalendar(trip({stops:base.stops,travelPreferences:{[first]:{mode:'Air',hours:'',overnight:0,rate:'',basis:'person',departure:'08:00',arrival:'10:00'}}}),now),null);
});
test('malformed times skip that event instead of breaking the file, and a lone carriage return is escaped',()=>{
  const r=c.icsCalendar(trip({activities:[act('Good','s1',1,'10:00',60),act('NoTime','s1',1,'',60),act('Odd','s1',1,'TBD',60),act('Zero','s1',1,'11:00',0),act('Nan','s1',1,'11:00',NaN),act('Old\rMac','s1',2,'09:00',30)]}),now);
  const t=unfold(r.text);
  assert.equal(r.events,2);assert.match(t,/SUMMARY:Good/);assert.doesNotMatch(t,/NoTime|Odd|Zero|Nan/);
  assert.match(t,/SUMMARY:Old\\nMac/);assert.ok(!/\r(?!\n)/.test(r.text));
  const base=trip({stops:[stop('s1','Jaipur',2),stop('s2','Agra',1)]});
  const key=planning.routeLegs(base)[1].key;
  const bad=(p)=>trip({stops:base.stops,travelPreferences:{[key]:{mode:'',hours:'',overnight:0,rate:'',basis:'person',...p}}});
  assert.equal(c.icsCalendar(bad({departure:'9:0',arrival:'12:00'}),now),null);
  assert.equal(c.icsCalendar(bad({departure:'25:00'}),now),null);
});
test('a journey keeps the same id when stops are added elsewhere, and an unnamed stay still has a title',()=>{
  const a=trip({stops:[stop('s1','Jaipur',2),stop('s2','Agra',1)]});
  const key=(t)=>planning.routeLegs(t).find(l=>l.key.includes('s1')&&l.key.includes('s2')).key;
  const with3=trip({stops:[stop('s0','Delhi',1),stop('s1','Jaipur',2),stop('s2','Agra',1)]});
  const mk=(t)=>trip({stops:t.stops,travelPreferences:{[key(t)]:{mode:'',hours:'',overnight:0,rate:'',basis:'person',departure:'09:00',arrival:'10:00'}}});
  const idOf=(t)=>unfold(c.icsCalendar(mk(t),now).text).match(/UID:(journey-[^@]+)@/)[1];
  assert.equal(idOf(a),'journey-s1-s2');assert.equal(idOf(with3),'journey-s1-s2');
  const noName=unfold(c.icsCalendar(trip({stayPreferences:{s1:{style:'',rate:'',basis:'room',lodging:{name:'',address:'Old Town'}}}}),now).text);
  assert.match(noName,/SUMMARY:Stay: where you are staying/);
  const beyond=c.icsCalendar(trip({stayPreferences:{s1:{style:'',rate:'',basis:'room',lodging:{name:'Far',first_night:5,last_night:6}}}}),now);
  assert.equal(beyond,null);
});

test('converting a wall-clock time to UTC and back lands on the same wall-clock time, in many zones on every day of 2026',()=>{
  const zones=['Asia/Kolkata','Asia/Kathmandu','America/New_York','Europe/London','Europe/Paris','Australia/Sydney','Pacific/Auckland','America/Sao_Paulo','Africa/Cairo','Asia/Tokyo'];
  const wall=(d,tz)=>{const p=new Intl.DateTimeFormat('en-CA',{timeZone:tz,hourCycle:'h23',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).formatToParts(d);const g=t=>p.find(x=>x.type===t).value;return `${g('year')}-${g('month')}-${g('day')} ${g('hour')}:${g('minute')}`;};
  let checked=0;const gaps=[];
  for(const tz of zones)for(let n=0;n<365;n++){
    const date=new Date(Date.UTC(2026,0,1+n)).toISOString().slice(0,10);
    for(const time of ['00:30','12:00','23:45']){
      const got=wall(c.zonedToUtc(date,time,tz),tz),want=`${date} ${time}`;
      if(got!==want)gaps.push(`${tz} ${want} -> ${got}`);
      checked++;
    }
  }
  assert.equal(checked,zones.length*365*3);
  // The only acceptable misses are local times that do not exist (the clock skipped them); they land later, within the hour.
  const asMs=s=>{const [d,h]=s.split(' ');return Date.parse(`${d}T${h}:00Z`);};
  for(const g of gaps){const [from,got]=g.split(' -> ');const want=from.split(' ').slice(-2).join(' ');const diff=asMs(got)-asMs(want);assert.ok(diff>0&&diff<=3600000,g);}
  assert.ok(gaps.length<=zones.length*3,`too many nonexistent times: ${gaps.length}`);
});

test('every event carries LAST-MODIFIED and a sequence that rises with each export, under the same id',()=>{
  const t=trip({activities:[act('Fort','s1',1,'10:00',60)]});
  const a=unfold(c.icsCalendar(t,now).text),b=unfold(c.icsCalendar(t,new Date('2026-11-20T00:01:00Z')).text),later=unfold(c.icsCalendar(t,new Date('2027-01-01T00:00:00Z')).text);
  const minutes=(d)=>(Date.parse(d)-Date.parse('2020-01-01T00:00:00Z'))/60000;
  assert.match(a,new RegExp(`UID:activity-Fort@elsewhere.local\r\nDTSTAMP:20261120T000000Z\r\nLAST-MODIFIED:20261120T000000Z\r\nSEQUENCE:${minutes('2026-11-20T00:00:00Z')}\r\n`));
  const seq=(x)=>Number(x.match(/SEQUENCE:(\d+)/)[1]),uid=(x)=>x.match(/UID:[^\r]+/)[0];
  assert.equal(seq(b),seq(a)+1);assert.ok(seq(later)>seq(b));
  assert.equal(uid(a),uid(b));assert.equal(uid(a),uid(later));
  assert.ok(seq(a)<2147483647);
  // an export before 2020 (a wrong clock) never writes a negative sequence
  assert.match(unfold(c.icsCalendar(t,new Date('2019-05-01T00:00:00Z')).text),/SEQUENCE:0\r\n/);
});
test('reminders are off unless asked for, only on timed events, and only for sensible lengths',()=>{
  const prefs={s1:{style:'',rate:'',basis:'room',lodging:{name:'Haveli'}}};
  const base=trip({activities:[act('Fort','s1',1,'10:00',60,{title:'Amber Fort'})],stayPreferences:prefs});
  const alarms=(x)=>(x.match(/BEGIN:VALARM/g)||[]).length;
  assert.equal(alarms(c.icsCalendar(base,now).text),0);
  assert.equal(alarms(c.icsCalendar(base,now,{}).text),0);
  assert.equal(alarms(c.icsCalendar(base,now,{reminderMinutes:null}).text),0);
  const t15=unfold(c.icsCalendar(base,now,{reminderMinutes:15}).text);
  assert.equal(alarms(t15),1);
  assert.match(t15,/BEGIN:VALARM\r\nACTION:DISPLAY\r\nDESCRIPTION:Amber Fort\r\nTRIGGER:-PT15M\r\nEND:VALARM\r\nEND:VEVENT/);
  // the all-day stay has no start time to count back from
  const stay=t15.split('BEGIN:VEVENT').find(e=>/Stay: Haveli/.test(e));assert.doesNotMatch(stay,/VALARM/);
  assert.match(unfold(c.icsCalendar(base,now,{reminderMinutes:60}).text),/TRIGGER:-PT1H\r\n/);
  assert.match(unfold(c.icsCalendar(base,now,{reminderMinutes:1440}).text),/TRIGGER:-P1D\r\n/);
  assert.match(unfold(c.icsCalendar(base,now,{reminderMinutes:90}).text),/TRIGGER:-PT90M\r\n/);
  assert.match(unfold(c.icsCalendar(base,now,{reminderMinutes:10080}).text),/TRIGGER:-P7D\r\n/);
  for(const bad of [0,-5,1.5,NaN,Infinity,10081,'15','',undefined,{}])assert.equal(alarms(c.icsCalendar(base,now,{reminderMinutes:bad}).text),0,String(bad));
  assert.equal(c.alarmTrigger(15),'-PT15M');assert.equal(c.alarmTrigger(120),'-PT2H');assert.equal(c.alarmTrigger(2880),'-P2D');
  // a title with a comma or semicolon is escaped in the reminder text too
  assert.match(unfold(c.icsCalendar(trip({activities:[act('x','s1',1,'10:00',60,{title:'Tea, then; rest'})]}),now,{reminderMinutes:15}).text),/DESCRIPTION:Tea\\, then\\; rest\r\nTRIGGER/);
});
test('journeys get a reminder too, one per event',()=>{
  const base=trip({stops:[stop('s1','Jaipur',2),stop('s2','Paris',1,'Europe/Paris')]});
  const key=planning.routeLegs(base)[1].key;
  const mk=(p)=>trip({stops:base.stops,travelPreferences:{[key]:{mode:'Flight',hours:'',overnight:0,rate:'',basis:'person',...p}}});
  const both=unfold(c.icsCalendar(mk({departure:'09:00',arrival:'12:00'}),now,{reminderMinutes:60}).text);
  assert.match(both,/DESCRIPTION:Jaipur to Paris \(Flight\)\r\nTRIGGER:-PT1H\r\nEND:VALARM/);
  assert.equal((both.match(/BEGIN:VALARM/g)||[]).length,1);
  const one=unfold(c.icsCalendar(mk({arrival:'12:00'}),now,{reminderMinutes:60}).text);
  assert.match(one,/DESCRIPTION:Arrives: Jaipur to Paris \(Flight\)\r\nTRIGGER:-PT1H/);
});
test('map positions are written only when they are real coordinates',()=>{
  const place=(lat,lon)=>({name:'Spot',latitude:lat,longitude:lon});
  const geo=(p)=>{const t=unfold(c.icsCalendar(trip({activities:[act('a','s1',1,'10:00',60,{place:p})]}),now).text);return (t.match(/GEO:[^\r]+/)||[null])[0];};
  assert.equal(geo(place(26.9116927,75.8195024)),'GEO:26.911693;75.819502');
  assert.equal(geo(place(-33.8688,151.2093)),'GEO:-33.8688;151.2093');
  assert.equal(geo(place(0,0)),'GEO:0;0');
  for(const bad of [place(91,10),place(10,181),place(NaN,10),place(10,Infinity),{name:'No coords'},{name:'S',latitude:'26.9',longitude:'75.8'},undefined])assert.equal(geo(bad),null,JSON.stringify(bad));
  const stay=(l)=>unfold(c.icsCalendar(trip({stayPreferences:{s1:{style:'',rate:'',basis:'room',lodging:{name:'Haveli',...l}}}}),now).text);
  assert.match(stay({latitude:26.9212173,longitude:75.7893468}),/GEO:26.921217;75.789347/);
  assert.doesNotMatch(stay({}),/GEO:/);assert.doesNotMatch(stay({latitude:95,longitude:10}),/GEO:/);
});
test('a link back to the plan goes on every event, and only a plain http or https address is used',()=>{
  const prefs={s1:{style:'',rate:'',basis:'room',lodging:{name:'Haveli'}}};
  const t=trip({activities:[act('Fort','s1',1,'10:00',60)],stayPreferences:prefs});
  const link='https://elsewhere.example/trips/new?trip=11111111-2222-3333-4444-555555555555';
  const withLink=unfold(c.icsCalendar(t,now,{planUrl:link}).text);
  assert.equal((withLink.match(/URL:https:\/\/elsewhere\.example\/trips\/new\?trip=11111111-2222-3333-4444-555555555555\r\n/g)||[]).length,2);
  assert.equal((withLink.match(/BEGIN:VEVENT/g)||[]).length,2);
  for(const bad of ['javascript:alert(1)','data:text/plain,hi','file:///etc/passwd','ftp://x.test/a','not a url','','//x.test/a',undefined,42])assert.doesNotMatch(unfold(c.icsCalendar(t,now,{planUrl:bad}).text),/\r\nURL:/,String(bad));
  // a line break smuggled into the address is refused, so it cannot start another property or event
  for(const evil of ['https://x.test/a\r\nBEGIN:VEVENT\r\nSUMMARY:Injected','https://x.test/a\nSUMMARY:Injected','https://x.test/a\rX','https://x.test/a b','https://x.test/a\tb','https://x.test/\u0000'])assert.doesNotMatch(c.icsCalendar(t,now,{planUrl:evil}).text,/\r\nURL:|Injected/,JSON.stringify(evil));
  const sneaky=c.icsCalendar(t,now,{planUrl:'https://x.test/a\r\nBEGIN:VEVENT\r\nSUMMARY:Injected'});
  assert.equal(sneaky.text.split('\r\n').filter(l=>l==='BEGIN:VEVENT').length,2);
  assert.ok(!/\r(?!\n)/.test(sneaky.text));
  for(const line of sneaky.text.split('\r\n'))assert.ok(new TextEncoder().encode(line).length<=75,line);
});
test('the new properties do not disturb the existing layout of an event',()=>{
  const r=unfold(c.icsCalendar(trip({activities:[act('Fort','s1',1,'10:00',60,{place:{name:'Amber Fort',latitude:26.98,longitude:75.85}})]}),now,{reminderMinutes:15,planUrl:'https://e.example/p'}).text);
  const ev=r.split('BEGIN:VEVENT\r\n')[1].split('END:VEVENT')[0].split('\r\n').filter(Boolean).map(l=>l.split(/[:;]/)[0]);
  assert.deepEqual(ev,['UID','DTSTAMP','LAST-MODIFIED','SEQUENCE','DTSTART','DTEND','SUMMARY','LOCATION','DESCRIPTION','GEO','URL','BEGIN','ACTION','DESCRIPTION','TRIGGER','END']);
});
