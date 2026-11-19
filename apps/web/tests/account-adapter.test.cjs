const {test}=require('node:test');
const assert=require('node:assert/strict');
const ts=require('typescript');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const {webcrypto,randomUUID}=require('node:crypto');

function harness(){
 const storage=new Map(), calls=[];
 let authenticated=true, status=200, posted, input, failureCode, failureContext, lifecycle="planning", sessionWait;
 const id=randomUUID(), version=randomUUID();
 const context={exports:{},process:{env:{NEXT_PUBLIC_API_BASE_URL:'http://test/api/v1'}},crypto:webcrypto,TextEncoder,sessionStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},fetch:async(url,options)=>{
  calls.push({url,options});
  if(status!==200)return {status,ok:false,json:async()=>({code:failureCode,day_check:failureContext})};
  let data;
  if(options.method==='POST' && url.endsWith('/trips')) {posted=JSON.parse(options.body);input=posted.plan;data={id,title:posted.title,draft_version_id:version};}
  else if(/^http:\/\/test\/api\/v1\/trips(?:\?|$)/.test(url))data=posted?[{id,title:posted.title,draft_version_id:version,lock_version:0}]:[];
  else if(options.method==='PATCH' && !url.includes('/versions/')) {const body=JSON.parse(options.body);if(body.lifecycle)lifecycle=body.lifecycle;data={id,title:posted.title,draft_version_id:version,lock_version:1,lifecycle,current_version_id:'accepted-snapshot'};}
  else if(url.endsWith('/stops'))data=input.stops.map(s=>({logical_item_id:s.client_id,name:s.name,timezone:s.timezone,desired_nights:s.desired_nights,place_reference:s.place_reference_id?posted.location:null}));
  else if(url.includes('/versions/'))data={...input,place_details:posted.place_details};
  else data={id,title:posted.title,draft_version_id:version,lock_version:0,lifecycle};
  return {ok:true,status:200,json:async()=>({data,page:{next_cursor:null,has_more:false}}),headers:{get:k=>k==='etag'?(url.includes('/versions/')?`"draft:${version}:0"`:`"trip:${id}:0"`):null}};
 }};
 const cache={};
 function load(file){if(cache[file])return cache[file];const module={exports:{}};const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const requireMock=name=>name.endsWith('/auth/client')?{authClient:()=>({auth:{getSession:async()=>{if(sessionWait)await sessionWait;return {data:{session:authenticated?{access_token:'test-token'}:null},error:null};}}})}:name.endsWith('/auth/config')?{authConfigured:true}:load(path.resolve(path.dirname(file),name+'.ts'));
  vm.runInNewContext(code,{...context,exports:module.exports,require:requireMock});cache[file]=module.exports;return module.exports;}
 const account=load(path.resolve(__dirname,'../lib/trips/account-adapter.ts'));
 return {adapter:account.accountTripAdapter,request:account.accountRequest,delaySession:p=>sessionWait=p,empty:load(path.resolve(__dirname,'../lib/trips/adapter.ts')).emptyTrip,calls,storage,posted:()=>posted,setLifecycle:value=>lifecycle=value,setLocation:value=>posted.location=value,setPlaces:value=>posted.place_details=value,deny:()=>authenticated=false,fail:(s,code,context)=>{status=s;failureCode=code;failureContext=context}};
}

test('an aborted request never starts a late write after delayed session lookup',async()=>{
 const h=harness(),controller=new AbortController();let release;
 h.delaySession(new Promise(resolve=>{release=resolve;}));
 const pending=h.request('/trips/test/draft/submit',{method:'POST',signal:controller.signal});
 controller.abort();release();
 await assert.rejects(pending,error=>error.name==='AbortError');
 assert.equal(h.calls.length,0);
});

test('account create maps active pace, long route, costs and activities without losing the user draft',async()=>{
 const h=harness(), stop=randomUUID(), activity=randomUUID();
 const trip={...h.empty,title:'An actual personal draft',pace:'busy',origin:'Delhi',days:45,returnToOrigin:false,finish:'Mumbai',stops:[{id:stop,name:'Jaipur',timezone:'Asia/Kolkata',nights:8}],stayPreferences:{[stop]:{style:'small',rate:'4200.50',basis:'room'}},travelPreferences:{leg:{mode:'rail',hours:'5.5',overnight:0,rate:'200',basis:'person'}},activities:[{kind:'rest',id:activity,stopId:stop,title:'Morning',day:3,start:'09:00',minutes:60,fixed:true,completed:false,booked:false}]};
 const before=JSON.stringify(trip);
 const saved=await h.adapter.create(trip);
 assert.equal(h.posted().plan.preferences.pace,'fast');
 assert.equal(h.posted().plan.origin.label,'Delhi');
 assert.equal(h.posted().plan.desired_days,45);
 // Reload normalizes absent cost records to an explicit empty list.
 assert.deepEqual(JSON.parse(JSON.stringify(saved.trip)),{...JSON.parse(before),costRecords:[],costsConfirmed:false});
 assert.match(h.calls[0].options.headers['Idempotency-Key'],/^[0-9a-f-]{36}$/);
 assert.equal(h.storage.size,0);
 assert.equal(JSON.stringify(trip),before);
});

test('unauthenticated save stops before API access',async()=>{
 const h=harness();h.deny();
 await assert.rejects(h.adapter.create({...h.empty}),e=>e.constructor.name==='SignInRequired');
 assert.equal(h.calls.length,0);
});

test('uncertain create retry retains the same idempotency key',async()=>{
 const h=harness();h.fail(503);
 for(let i=0;i<2;i++)await assert.rejects(h.adapter.create({...h.empty}),/temporarily unavailable/);
 assert.equal(h.calls[0].options.headers['Idempotency-Key'],h.calls[1].options.headers['Idempotency-Key']);
 const stored=JSON.parse(h.storage.get('elsewhere.create-retry'));
 assert.deepEqual(Object.keys(stored).sort(),['hash','key']);
});


test('missing server auth configuration is distinguished from an expired session',async()=>{
 const h=harness();h.fail(503,'AUTH_NOT_CONFIGURED');
 await assert.rejects(h.adapter.list(),error=>error.constructor.name==='AccountError' && error.message.includes('server sign-in configuration is missing'));
});

test('saved-trips list loads empty state and then the newly created account trip',async()=>{
 const h=harness();
 assert.equal((await h.adapter.list()).rows.length,0);
 const saved=await h.adapter.create({...h.empty,title:'My saved route'});
 const page=await h.adapter.list();
 assert.equal(page.rows.length,1);
 assert.equal(page.rows[0].id,saved.id);
 assert.equal(page.rows[0].title,'My saved route');
 assert.equal(page.nextCursor,null);
});


test('selected location writes only its server reference and is restored from the authoritative read',async()=>{
 const h=harness(), stop=randomUUID(), reference=randomUUID();
 const location={reference_id:reference,id:1857910,name:'Kyoto',label:'Kyoto, Japan',region:'Kyoto',country:'Japan',timezone:'Asia/Tokyo',latitude:35.02,longitude:135.75,source:'Open-Meteo / GeoNames',retrieved_at:'2026-11-11T00:00:00Z'};
 // The write sends only a reference; a later read supplies the server snapshot.
 const saved=await h.adapter.create({...h.empty,stops:[{id:stop,name:location.label,timezone:location.timezone,nights:3,location}]});
 assert.equal(h.posted().plan.stops[0].place_reference_id,reference);
 assert.equal('latitude' in h.posted().plan.stops[0],false);
 h.setLocation(location);
 const reopened=await h.adapter.load(saved.id);
 assert.equal(reopened.trip.stops[0].location.reference_id,reference);
 assert.equal(reopened.trip.stops[0].location.latitude,35.02);
});


test('discovered activities send an opaque place ID and rehydrate server attribution',async()=>{
 const h=harness(), stop=randomUUID(), reference=randomUUID();
 const place={id:reference,destination_reference_id:randomUUID(),external_id:'node/12',name:'Mapped museum',category:'museum',latitude:35,longitude:135,source:'OpenStreetMap contributors via Overpass',retrieved_at:'2026-11-11T00:00:00Z'};
 const saved=await h.adapter.create({...h.empty,stops:[{id:stop,name:'Kyoto',timezone:'Asia/Tokyo',nights:3}],activities:[{id:randomUUID(),stopId:stop,title:place.name,day:1,start:'10:00',minutes:60,fixed:false,booked:false,completed:false,place}]});
 assert.equal(h.posted().plan.activities[0].place_id,reference);
 assert.equal('source' in h.posted().plan.activities[0],false);
 h.setPlaces({[reference]:place});
 const loaded=await h.adapter.load(saved.id);
 assert.equal(loaded.trip.activities[0].place.external_id,'node/12');
 assert.equal(loaded.trip.activities[0].place.source,place.source);
 assert.equal('google_place_id' in h.posted().plan.activities[0],false);
});


test('structured day-check context travels with the safe account error',async()=>{
 const h=harness(),activity_id=randomUUID();h.fail(409,'LIVE_CHECK_HOURS_NOT_CONFIRMED',{kind:'visit',reason:'outside_hours',activity_id,from_activity_id:null,provider_payload:'must not leak'});
 await assert.rejects(h.adapter.list(),error=>error.constructor.name==='AccountError'&&error.dayCheck.activity_id===activity_id&&error.dayCheck.reason==='outside_hours'&&!JSON.stringify(error.dayCheck).includes('must not leak'));
 h.fail(503,'PLACE_HOURS_UNAVAILABLE',{kind:'visit',reason:'injected',activity_id});
 await assert.rejects(h.adapter.list(),error=>error.dayCheck===undefined&&error.message.includes('temporarily unavailable'));
});

test('a personal activity label and explicit map identity survive account saving independently',async()=>{
 const h=harness(),stop=randomUUID(),reference=randomUUID(),id=randomUUID();
 const place={id:reference,destination_reference_id:randomUUID(),external_id:'node/15',name:'Actual museum listing',category:'museum',latitude:35,longitude:135,source:'OpenStreetMap contributors via Overpass',retrieved_at:'2026-11-13T00:00:00Z'};
 const activity={id,stopId:stop,title:'My quiet hour',day:13,start:'10:35',minutes:95,kind:'rest',fixed:true,booked:true,completed:true,place};
 const created=await h.adapter.create({...h.empty,stops:[{id:stop,name:'Kyoto',timezone:'Asia/Tokyo',nights:20}],activities:[activity]});
 assert.equal(h.posted().plan.activities[0].user_label,'My quiet hour');
 assert.equal(h.posted().plan.activities[0].place_id,reference);
 assert.equal('latitude' in h.posted().plan.activities[0],false);
 h.setPlaces({[reference]:place});
 const saved=await h.adapter.load(created.id);
 assert.equal(saved.trip.activities[0].title,activity.title);
 assert.equal(saved.trip.activities[0].place.name,place.name);
 assert.equal(saved.trip.activities[0].id,id);
 assert.equal(saved.trip.activities[0].minutes,95);
});

test('place research quota and outage messages preserve the trip without suggesting sample results',async()=>{
 const h=harness();h.fail(429,'ACTIVITY_PROVIDER_RATE_LIMITED');
 await assert.rejects(h.adapter.list(),error=>error.status===429&&error.message.includes('usage limit')&&error.message.includes('trip is unchanged'));
 h.fail(503,'ACTIVITY_PROVIDER_UNAVAILABLE');
 await assert.rejects(h.adapter.list(),error=>error.status===503&&error.message.includes('no sample places were substituted'));
});

 test('account reload and autosave retain server lifecycle outside editable trip settings',async()=>{
 const h=harness();
 const saved=await h.adapter.create({...h.empty,title:'Lifecycle check'});
 assert.equal(saved.lifecycle,'planning');
 h.setLifecycle('active');
 const loaded=await h.adapter.load(saved.id);
 assert.equal(loaded.lifecycle,'active');
 assert.equal(Object.hasOwn(loaded.trip,'lifecycle'),false);
 const after=await h.adapter.save(loaded.trip,loaded);
 assert.equal(after.lifecycle,'active');
 assert.equal(Object.hasOwn(h.posted().plan,'lifecycle'),false);
 });

test('explicit lifecycle patch sends only status with trip precondition and returns metadata',async()=>{
 const h=harness();const saved=await h.adapter.create({...h.empty,title:'Status change'});
 const updated=await h.adapter.transition(saved,'active');
 const request=h.calls.at(-1);
 assert.equal(request.options.method,'PATCH');
 assert.equal(request.options.headers['If-Match'],saved.tripEtag);
 assert.deepEqual(JSON.parse(request.options.body),{lifecycle:'active'});
 assert.equal(updated.lifecycle,'active');assert.equal(updated.currentVersionId,'accepted-snapshot');
 h.fail(412,'PRECONDITION_FAILED');
 await assert.rejects(h.adapter.transition(saved,'completed'),e=>e.status===412);
 h.fail(409,'TRIP_ACCEPTED_PLAN_REQUIRED');
 await assert.rejects(h.adapter.transition(saved,'active'),e=>e.message.includes('accept a plan'));
});
test('status refresh loads metadata and draft with a shared cancellation signal using only reads',async()=>{
 const h=harness(),saved=await h.adapter.create({...h.empty,title:'Read-only status refresh'});
 h.calls.length=0;const signal=new AbortController().signal;
 await h.adapter.load(saved.id,signal);
 assert.equal(h.calls.length,3);
 for(const call of h.calls){assert.equal(call.options.signal,signal);assert.equal(call.options.method,undefined);}
});
test('strict budgets survive account create, reload and an unrelated save without becoming targets',async()=>{
 const h=harness(),saved=await h.adapter.create({...h.empty,title:'Strict budget',budget:'15000',budgetMode:'strict'});
 assert.equal(h.posted().plan.budget.mode,'strict');assert.equal(saved.trip.budgetMode,'strict');
 const loaded=await h.adapter.load(saved.id);assert.equal(loaded.trip.budgetMode,'strict');
 await h.adapter.save({...loaded.trip,title:'Renamed trip'},loaded);
 const command=h.calls.filter(c=>c.url.endsWith('/draft/commands')).at(-1);
 assert.equal(JSON.parse(command.options.body).commands[0].changes.budget.mode,'strict');
 await h.adapter.save({...loaded.trip,budgetMode:'target'},loaded);
 const changed=h.calls.filter(c=>c.url.endsWith('/draft/commands')).at(-1);
 assert.equal(JSON.parse(changed.options.body).commands[0].changes.budget.mode,'target');
});
test('legacy drafts default to target while a zero strict amount remains an explicit budget',async()=>{
 const h=harness(),legacy={...h.empty,title:'Legacy budget',budget:'100'};delete legacy.budgetMode;
 const saved=await h.adapter.create(legacy);assert.equal(saved.trip.budgetMode,'target');
 await h.adapter.create({...h.empty,title:'Zero budget',budget:'0',budgetMode:'strict'});
 assert.equal(h.posted().plan.budget.amount,'0');assert.equal(h.posted().plan.budget.mode,'strict');
});
test('invalid local budget policies are rejected before account transmission',async()=>{
 const h=harness();await assert.rejects(h.adapter.create({...h.empty,budget:'100',budgetMode:'unexpected'}));assert.equal(h.calls.length,0);
});
test('linked, paid and unknown cost records survive create, reload and unrelated saves; invalid records are refused',async()=>{
 const h=harness(),records=[{id:randomUUID(),category:'food',label:'Dinners',unit:'per_person',quantity:4,amount:'12.50',status:'estimated',activity_id:null,stop_id:null},{id:randomUUID(),category:'activity',label:'Museum passes',unit:'per_group',quantity:1,amount:'40.00',status:'paid',activity_id:randomUUID(),stop_id:null},{id:randomUUID(),category:'transport',label:'Train',unit:'per_person',quantity:1,amount:'30.00',status:'paid',activity_id:null,stop_id:null,leg_key:'["origin:Delhi","x"]'},{id:randomUUID(),category:'miscellaneous',label:'Old tour',unit:'per_group',quantity:1,amount:'9.00',status:'paid',activity_id:null,stop_id:null,link_removed:true}];
 const saved=await h.adapter.create({...h.empty,title:'Costs',costRecords:records});
 assert.deepEqual(h.posted().plan.costs,records);assert.equal(h.posted().plan.preferences.costs_confirmed,false);assert.equal(h.posted().plan.preferences.cost_records,undefined);
 const loaded=await h.adapter.load(saved.id);assert.deepEqual(loaded.trip.costRecords,records);
 await h.adapter.save({...loaded.trip,title:'Renamed'},loaded);
 const commands=JSON.parse(h.calls.filter(c=>c.url.endsWith('/draft/commands')).at(-1).options.body).commands;
 // Settings never carry costs; one explicit command replaces them.
 assert.deepEqual(commands[0].changes.costs,[]);
 assert.deepEqual(commands.find(c=>c.type==='cost.replace_records').costs,records);
 for(const bad of [{status:'paid',amount:''},{amount:'-1'},{amount:'1.234'},{quantity:0},{label:'  '},{category:'adjustment'},{extra:true},{activity_id:randomUUID(),stop_id:randomUUID()},{link_removed:true},{activity_id:'not-a-uuid'},{leg_key:'k',stop_id:randomUUID()},{leg_key:''}])
  await assert.rejects(h.adapter.save({...loaded.trip,costRecords:[{...records[0],...bad}]},loaded),/numeric and preference/);
 await assert.rejects(h.adapter.save({...loaded.trip,costRecords:[records[0],records[0]]},loaded),/numeric and preference/);
});
test('the every-cost confirmation round-trips and is never inferred',async()=>{
 const h=harness(),saved=await h.adapter.create({...h.empty,title:'Confirmed',costsConfirmed:true});
 assert.equal(h.posted().plan.preferences.costs_confirmed,true);
 const loaded=await h.adapter.load(saved.id);assert.equal(loaded.trip.costsConfirmed,true);
 await h.adapter.save({...loaded.trip,costsConfirmed:undefined},loaded);
 assert.equal(JSON.parse(h.calls.filter(c=>c.url.endsWith('/draft/commands')).at(-1).options.body).commands[0].changes.preferences.costs_confirmed,false);
 await assert.rejects(h.adapter.save({...loaded.trip,costsConfirmed:'yes'},loaded),/numeric and preference/);
});
test('an unreachable signing-key provider is explained without implying saved trips or database data were lost',async()=>{
 const h=harness();h.fail(503,'AUTH_PROVIDER_UNAVAILABLE');
 await assert.rejects(h.adapter.list(),e=>e.code==='AUTH_PROVIDER_UNAVAILABLE'&&e.message.includes('Sign-in verification')&&e.message.includes('trip is still saved'));
});

 test('remaining-day failures explain distinct recovery actions without exposing server details',async()=>{
 const cases=[['REPLAN_TIME_STALE',/more than five minutes old/],['REPLAN_REVIEW_EXPIRED',/no longer fits the fresh timing/],['REPLAN_COMMITMENT_CONFLICT',/fixed or booked/],['REPLAN_ROUTE_UNAVAILABLE',/another travel mode/],['REPLAN_BASE_CHANGED',/Load the updated plan/],['REPLAN_SCHEDULE_DATE_MISMATCH',/different date/],['REPLAN_UNKNOWN',/could not finish/]];
 for(const [code,message] of cases){
  const h=harness();h.fail(409,code);
  await assert.rejects(h.request('/test'),error=>{assert.equal(error.code,code);assert.match(error.message,message);assert.match(error.message,/saved trip is unchanged/);return true;});
 }
});
