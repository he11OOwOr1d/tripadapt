const {test}=require('node:test');
const assert=require('node:assert/strict');
const ts=require('typescript');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const {webcrypto,randomUUID}=require('node:crypto');

function harness(){
 const storage=new Map(), calls=[];
 let authenticated=true, status=200, posted, input, failureCode;
 const id=randomUUID(), version=randomUUID();
 const context={exports:{},process:{env:{NEXT_PUBLIC_API_BASE_URL:'http://test/api/v1'}},crypto:webcrypto,TextEncoder,sessionStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},fetch:async(url,options)=>{
  calls.push({url,options});
  if(status!==200)return {status,ok:false,json:async()=>({code:failureCode})};
  let data;
  if(options.method==='POST' && url.endsWith('/trips')) {posted=JSON.parse(options.body);input=posted.plan;data={id,title:posted.title,draft_version_id:version};}
  else if(/^http:\/\/test\/api\/v1\/trips(?:\?|$)/.test(url))data=posted?[{id,title:posted.title,draft_version_id:version,lock_version:0}]:[];
  else if(url.endsWith('/stops'))data=input.stops.map(s=>({logical_item_id:s.client_id,name:s.name,timezone:s.timezone,desired_nights:s.desired_nights,place_reference:s.place_reference_id?posted.location:null}));
  else if(url.includes('/versions/'))data={...input,place_details:posted.place_details};
  else data={id,title:posted.title,draft_version_id:version,lock_version:0};
  return {ok:true,status:200,json:async()=>({data,page:{next_cursor:null,has_more:false}}),headers:{get:k=>k==='etag'?(url.includes('/versions/')?`"draft:${version}:0"`:`"trip:${id}:0"`):null}};
 }};
 const cache={};
 function load(file){if(cache[file])return cache[file];const module={exports:{}};const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const requireMock=name=>name.endsWith('/auth/client')?{authClient:()=>({auth:{getSession:async()=>({data:{session:authenticated?{access_token:'test-token'}:null},error:null})}})}:name.endsWith('/auth/config')?{authConfigured:true}:load(path.resolve(path.dirname(file),name+'.ts'));
  vm.runInNewContext(code,{...context,exports:module.exports,require:requireMock});cache[file]=module.exports;return module.exports;}
 return {adapter:load(path.resolve(__dirname,'../lib/trips/account-adapter.ts')).accountTripAdapter,empty:load(path.resolve(__dirname,'../lib/trips/adapter.ts')).emptyTrip,calls,storage,posted:()=>posted,setLocation:value=>posted.location=value,setPlaces:value=>posted.place_details=value,deny:()=>authenticated=false,fail:(s,code)=>{status=s;failureCode=code}};
}

test('account create maps active pace, long route, costs and activities without losing the user draft',async()=>{
 const h=harness(), stop=randomUUID(), activity=randomUUID();
 const trip={...h.empty,title:'An actual personal draft',pace:'busy',origin:'Delhi',days:45,returnToOrigin:false,finish:'Mumbai',stops:[{id:stop,name:'Jaipur',timezone:'Asia/Kolkata',nights:8}],stayPreferences:{[stop]:{style:'small',rate:'4200.50',basis:'room'}},travelPreferences:{leg:{mode:'rail',hours:'5.5',overnight:0,rate:'200',basis:'person'}},activities:[{kind:'rest',id:activity,stopId:stop,title:'Morning',day:3,start:'09:00',minutes:60,fixed:true,completed:false,booked:false}]};
 const before=JSON.stringify(trip);
 const saved=await h.adapter.create(trip);
 assert.equal(h.posted().plan.preferences.pace,'fast');
 assert.equal(h.posted().plan.origin.label,'Delhi');
 assert.equal(h.posted().plan.desired_days,45);
 assert.deepEqual(JSON.parse(JSON.stringify(saved.trip)),JSON.parse(before));
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
 const saved=await h.adapter.create({...h.empty,stops:[{id:stop,name:'Kyoto',timezone:'Asia/Tokyo',nights:3}],activities:[{id:randomUUID(),stopId:stop,title:place.name,googlePlaceId:'ChIJ_test',day:1,start:'10:00',minutes:60,fixed:false,booked:false,completed:false,place}]});
 assert.equal(h.posted().plan.activities[0].place_id,reference);
 assert.equal('source' in h.posted().plan.activities[0],false);
 h.setPlaces({[reference]:place});
 const loaded=await h.adapter.load(saved.id);
 assert.equal(loaded.trip.activities[0].place.external_id,'node/12');
 assert.equal(loaded.trip.activities[0].place.source,place.source);
 assert.equal(loaded.trip.activities[0].googlePlaceId,'ChIJ_test');
 assert.equal(h.posted().plan.activities[0].google_place_id,'ChIJ_test');
});
