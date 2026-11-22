const {test}=require('node:test');const assert=require('node:assert/strict');const ts=require('typescript');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
function load(file,deps={}){const out={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.resolve(__dirname,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:out,require:n=>deps[n.replace(/^\.\//,'')]??{},Object,Array,String,Number,Math,JSON,Date,Set,Map,crypto:require('node:crypto').webcrypto},{});return out;}
const planning=load('../lib/trips/planning.ts');
const itinerary=load('../lib/trips/itinerary.ts',{planning});
const transfers=load('../lib/trips/transfers.ts',{planning});
const day=load('../lib/trips/traveler-day.ts');
const search=load('../lib/trips/activity-search.ts');
const S=load('../lib/trips/shortlist.ts',{itinerary,transfers,'traveler-day':day,'activity-search':search});
const J=v=>JSON.parse(JSON.stringify(v));
const stop=(id,name,nights)=>({id,name,nights,timezone:'Asia/Kolkata'});
const act=(id,stopId,d,start,minutes,extra={})=>({id,stopId,day:d,title:id,start,minutes,fixed:false,completed:false,booked:false,...extra});
const place=(n,extra={})=>({id:`p-${n}`,destination_reference_id:'d1',external_id:`geoapify/${n}`,name:n,category:'museum',latitude:26.9,longitude:75.8,source:'Geoapify',retrieved_at:'2026-11-22T10:00:00Z',...extra});
const wish=(label,extra={})=>({id:`w-${label}`,label,note:'',must:false,minutes:null,place:null,...extra});
const trip=(o={})=>({title:'T',mode:'exact',start:'2026-12-04',origin:'Delhi',returnToOrigin:true,stops:[stop('s1','Jaipur',1)],activities:[],...o});

test('an entry is valid only with what the API accepts, so a draft it would refuse is never saved',()=>{
  assert.equal(S.isWish(wish('Chai stall')),true);
  assert.equal(S.isWish(wish('Hall',{place:place('Hall'),minutes:90,must:true})),true);
  for(const bad of [wish(''),wish('  '),wish('x'.repeat(121)),wish('a\u0007b'),wish('n',{note:'x'.repeat(301)}),wish('n',{minutes:4}),wish('n',{minutes:721}),wish('n',{minutes:1.5}),wish('n',{must:'yes'}),
    {...wish('n'),rating:5},wish('n',{place:place('x',{category:'lodging'})}),wish('n',{place:{id:'p'}}),null,'text',{label:'no id'}])assert.equal(S.isWish(bad),false,JSON.stringify(bad));
});
test('a whole value is valid when absent, or when each list is tidy; limits match the API',()=>{
  assert.equal(S.validShortlists(undefined),true);assert.equal(S.validShortlists({}),true);
  const many=Array.from({length:30},(_,i)=>wish('P'+i));
  assert.equal(S.validShortlists({s1:many}),true);assert.equal(S.validShortlists({s1:[...many,wish('one more')]}),false);
  assert.equal(S.validShortlists({s1:[wish('A'),wish('A')]}),false,'repeated id');
  assert.equal(S.validShortlists({s1:[wish('A',{place:place('x')}),wish('B',{place:place('x')})]}),false,'same place twice');
  assert.equal(S.validShortlists({s1:[wish('A',{place:place('x')})],s2:[wish('B',{place:place('x')})]}),true,'same place on two destinations');
  for(const bad of [null,[],'x',{s1:'x'},{s1:[{}]}])assert.equal(S.validShortlists(bad),false);
});
test('adding, changing and removing keep the other lists as they were, and say why they refuse',()=>{
  const a=S.wishFromName('  Chai stall ',30,true).wish;assert.equal(a.label,'Chai stall');assert.equal(a.minutes,30);assert.equal(a.must,true);
  let r=S.addWish(undefined,'s1',a);assert.equal(r.shortlists.s1.length,1);
  assert.match(S.addWish(r.shortlists,'s1',{...a,id:'other',label:'CHAI STALL'}).error,/already/i,'same name in another case');
  const p=S.wishFromPlace(place('Hall'));assert.equal(p.label,'Hall');assert.equal(p.minutes,null);assert.equal(p.must,false);
  r=S.addWish(r.shortlists,'s1',p);assert.equal(r.shortlists.s1.length,2);
  assert.match(S.addWish(r.shortlists,'s1',{...S.wishFromPlace(place('Hall')),label:'Renamed'}).error,/already on the shortlist/);
  assert.equal(S.wishFromPlace(place('Inn',{category:'lodging'})),null);
  const other=S.addWish(r.shortlists,'s2',wish('Elsewhere')).shortlists;
  const changed=S.changeWish(other,'s1',a.id,{must:false,minutes:null});
  assert.equal(changed.s1[0].must,false);assert.equal(changed.s1[0].minutes,null);assert.equal(J(changed.s2).length,1);assert.equal(other.s1[0].must,true,'the old value is not mutated');
  const removed=S.removeWish(other,'s1',a.id);assert.equal(removed.s1.length,1);
  assert.equal(S.removeWish({s1:[a]},'s1',a.id),undefined,'the last removal leaves no empty record');
  const full=Array.from({length:30},(_,i)=>wish('P'+i));assert.match(S.addWish({s1:full},'s1',wish('Extra')).error,/up to 30/);
});
test('bad names and lengths are refused in plain words',()=>{
  assert.match(S.wishFromName('   ').error,/name/i);assert.match(S.wishFromName('x'.repeat(121)).error,/120/);assert.match(S.wishFromName('a\u0001').error,/plain text/i);
  for(const m of [4,721,1.5,NaN])assert.match(S.wishFromName('ok',m).error,/minutes/);
  assert.equal(S.wishFromName('ok',null).wish.minutes,null);assert.equal(S.wishFromName('ok',5).wish.minutes,5);
});
test('a destination that leaves the plan takes its list with it',()=>{
  const lists={s1:[wish('A')],gone:[wish('B')],empty:[]};
  assert.deepEqual(J(S.prune(lists,[{id:'s1'},{id:'empty'}])),{s1:J(lists.s1)});
  assert.equal(S.prune({gone:[wish('B')]},[{id:'s1'}]),undefined);assert.equal(S.prune(undefined,[]),undefined);
});
test('a wish is scheduled when an activity stands for it: the same saved place, or else the same name',()=>{
  const hall=wish('Hall',{place:place('Hall')});
  assert.equal(S.matches(hall,act('x','s1',1,'10:00',60,{place:place('Hall'),title:'Anything'})),true);
  assert.equal(S.matches(hall,act('Hall','s1',1,'10:00',60)),true,'a hand-made activity with the same name counts');
  assert.equal(S.matches(hall,act('y','s1',1,'10:00',60,{place:place('Other'),title:'Hall'})),false);
  assert.equal(S.matches(wish('Chai stall'),act(' chai STALL ','s1',1,'10:00',60)),true);
  assert.equal(S.matches(wish('Chai stall'),act('Tea','s1',1,'10:00',60)),false);
});
test('what is scheduled, skipped and open is told apart, with its day and time',()=>{
  const t=trip({shortlists:{s1:[wish('Hall',{place:place('Hall'),minutes:90,must:true}),wish('Fort',{must:true}),wish('Stall',{must:true})]},
    activities:[act('x','s1',2,'11:00',60,{place:place('Hall'),title:'Hall'}),act('Fort','s1',1,'09:00',60,{skipped:true})]});
  const r=S.wishReport(t,t.stops[0]);
  assert.deepEqual(J(r.map(s=>s.status)),['scheduled','skipped','open']);
  assert.equal(r[0].day,2);assert.equal(r[0].start,'11:00');assert.match(r[1].reason,/skipped it on day 1/);
  assert.equal(S.wishReport(trip(),trip().stops[0]).length,0);
});
test('an open one says where it would fit, and that an hour was assumed when no length was given',()=>{
  const t=trip({shortlists:{s1:[wish('Stall',{must:true}),wish('Hall',{must:true,minutes:90})]},activities:[act('a','s1',1,'08:00',240),act('b','s1',2,'09:00',60)]});
  const [stall,hall]=S.wishReport(t,t.stops[0]);
  assert.equal(stall.status,'open');assert.deepEqual(J(stall.fit),{day:1,start:720,end:1320});
  assert.match(stall.reason,/fits on day 1 from 12:00 and on 1 other day/);assert.match(stall.reason,/an hour is assumed/);
  assert.equal(stall.assumed,true);assert.equal(stall.need,60);
  assert.equal(hall.assumed,false);assert.doesNotMatch(hall.reason,/assumed/);
});
test('when nothing fits, the reason names the longest open stretch and what to do',()=>{
  const t=trip({shortlists:{s1:[wish('Long walk',{must:true,minutes:300})]},activities:[act('a','s1',1,'08:00',600),act('b','s1',2,'08:00',600)]});
  const [w]=S.wishReport(t,t.stops[0]);
  assert.equal(w.status,'open');assert.equal(w.fit,undefined);
  assert.match(w.reason,/No day in Jaipur has 5 hours open/);assert.match(w.reason,/longest open stretch is 4 hours on day 1/);assert.match(w.reason,/add a night/);
  const full=trip({shortlists:{s1:[wish('X',{must:true,minutes:30})]},activities:[act('a','s1',1,'08:00',840),act('b','s1',2,'08:00',840)]});
  assert.match(S.wishReport(full,full.stops[0])[0].reason,/Every day in Jaipur is full/);
});
test('the traveler\'s own hours and the journeys they recorded decide how much time is open',()=>{
  const base={shortlists:{s1:[wish('Museum',{must:true,minutes:180})]},activities:[]};
  assert.equal(S.wishReport(trip(base),trip().stops[0])[0].fit.start,480,'the default day starts at 08:00');
  const late=trip({...base,dayStart:'10:00',dayEnd:'13:00'.replace('13','14')});
  assert.equal(S.wishReport(late,late.stops[0])[0].fit.start,600);
  const short=trip({...base,dayStart:'10:00',dayEnd:'14:00'});assert.equal(S.wishReport(short,short.stops[0])[0].status,'open');
  const tight=trip({shortlists:{s1:[wish('Museum',{must:true,minutes:180})]},dayStart:'10:00',dayEnd:'14:00',activities:[act('a','s1',1,'10:00',90),act('b','s1',2,'10:00',90)]});
  assert.match(S.wishReport(tight,tight.stops[0])[0].reason,/No day in Jaipur has 3 hours open.*2 h 30 min on day 1/,'2.5 hours are left each day');
  // a recorded arrival at 18:00 leaves 18:00 to 22:00 of the only day: enough for three hours, not for five
  const arrive=m=>{const t=trip({shortlists:{s1:[wish('Museum',{must:true,minutes:m})]},stops:[stop('s1','Jaipur',0)],activities:[]});t.travelPreferences={[planning.routeLegs(t)[0].key]:{mode:'rail',rate:'',hours:'',overnight:0,basis:'person',arrival:'18:00'}};return S.wishReport(t,t.stops[0])[0];};
  assert.deepEqual(J(arrive(180).fit),{day:1,start:1080,end:1320});
  const five=arrive(300);assert.equal(five.status,'open');assert.equal(five.fit,undefined);assert.match(five.reason,/longest open stretch is 4 hours on day 1/);
});
test('only must-visit items appear in the unscheduled list, across every destination',()=>{
  const t=trip({stops:[stop('s1','Jaipur',1),stop('s2','Agra',1)],
    shortlists:{s1:[wish('Hall',{must:true}),wish('Nice to have'),wish('Fort',{must:true})],s2:[wish('Taj',{must:true,minutes:60})]},
    activities:[act('Fort','s1',1,'10:00',60)]});
  const list=S.unscheduledMustVisits(t);
  assert.deepEqual(J(list.map(u=>[u.stop.name,u.state.wish.label])),[['Jaipur','Hall'],['Agra','Taj']]);
  assert.equal(S.unscheduledMustVisits(trip()).length,0);
});
test('opening it in the editor lands on its first fitting day and carries the saved place',()=>{
  const t=trip({shortlists:{s1:[wish('Hall',{place:place('Hall'),minutes:75,must:true})]},activities:[act('a','s1',1,'08:00',600)]});
  const state=S.wishReport(t,t.stops[0])[0];const a=S.activityForWish(state,'s1',1);
  assert.equal(a.day,1);assert.equal(a.start,'18:00');assert.equal(a.minutes,75);assert.equal(a.title,'Hall');assert.equal(a.place.id,'p-Hall');assert.equal(a.stopId,'s1');
  const none=S.activityForWish({...state,fit:undefined},'s1',2);assert.equal(none.day,2);assert.equal(none.start,'10:00');
  assert.equal('place' in S.activityForWish(S.wishReport(trip({shortlists:{s1:[wish('Stall')]}}),trip().stops[0])[0],'s1',1),false);
});
test('what is sent to the API has only the fields it knows, only for destinations still in the plan, and null for unknowns',()=>{
  const dirty={s1:[wish('Hall',{place:{...place('Hall'),surprise:'x',extra:1},must:true,minutes:45}),wish('Stall')],gone:[wish('Old')]};
  const api=J(S.shortlistsToApi(dirty,[{id:'s1'}]));
  assert.deepEqual(Object.keys(api),['s1']);
  assert.deepEqual(api.s1[1],{id:'w-Stall',label:'Stall',note:'',must:false,minutes:null,place:null});
  assert.deepEqual(Object.keys(api.s1[0].place).sort(),['category','destination_reference_id','external_id','id','latitude','longitude','name','retrieved_at','source']);
  assert.deepEqual(J(S.shortlistsToApi(undefined,[])),{});
});
test('durations read naturally',()=>{
  for(const [m,t] of [[30,'30 min'],[60,'1 hour'],[90,'1 h 30 min'],[120,'2 hours'],[5,'5 min']])assert.equal(S.durationText(m),t);
});
test('a stretch exactly as long as the visit is enough, and one minute short is not',()=>{
  const at=(busy)=>{const t=trip({shortlists:{s1:[wish('Museum',{must:true,minutes:180})]},dayStart:'10:00',dayEnd:'14:00',stops:[stop('s1','Jaipur',0)],activities:[act('a','s1',1,'10:00',busy)]});return S.wishReport(t,t.stops[0])[0];};
  assert.deepEqual(J(at(60).fit),{day:1,start:660,end:840},'11:00 to 14:00 is exactly three hours');
  assert.equal(at(61).fit,undefined);assert.match(at(61).reason,/No day in Jaipur has 3 hours open/);
});
