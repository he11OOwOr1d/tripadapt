const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const place = {id:'a-reference',destination_reference_id:'a-destination',external_id:'way/12',name:'Museum',category:'museum',latitude:35,longitude:135,source:'OpenStreetMap contributors via Overpass',retrieved_at:'2026-11-11T00:00:00Z'};
function harness(fetch, configured=true) {
 const exports={};
 const code=ts.transpileModule(fs.readFileSync(path.resolve(__dirname,'../lib/trips/activity-search.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,{exports,fetch,AbortSignal,Error,encodeURIComponent,process:{env:configured?{NEXT_PUBLIC_API_BASE_URL:'http://localhost:8000/api/v1/'}:{}}});
 return exports;
}
test('activity research sends only the selected location reference and category, without credentials',async()=>{
 let request;
 const {activitySearchAdapter}=harness(async(url,options)=>{request={url,options};return {ok:true,json:async()=>({data:{results:[place]}})};});
 const result=await activitySearchAdapter.search('selected/ref','museum',new AbortController().signal);
 assert.equal(request.url,'http://localhost:8000/api/v1/places/search?destination_reference_id=selected%2Fref&category=museum');
 assert.equal(request.options.credentials,'omit');assert.equal(request.options.cache,'no-store');assert.equal(result.results[0].external_id,'way/12');
});
test('unconfigured and unavailable research preserves manual planning',async()=>{
 await assert.rejects(harness(async()=>{throw new Error('must not fetch');},false).activitySearchAdapter.search('x','museum',new AbortController().signal),/add an activity yourself/);
 await assert.rejects(harness(async()=>({ok:false,status:503})).activitySearchAdapter.search('x','museum',new AbortController().signal),/itinerary is kept/);
 await assert.rejects(harness(async()=>({ok:false,status:429})).activitySearchAdapter.search('x','museum',new AbortController().signal),/Wait a minute/);
});
test('unexpected provider URLs, coordinates and categories cannot become source links',()=>{
 const {isActivityPlace}=harness(()=>{});
 assert.equal(isActivityPlace(place),true);
 assert.equal(isActivityPlace({...place,external_id:"geoapify/51abc123",source:"Geoapify / OpenStreetMap contributors"}),true);
 for(const change of [{external_id:'javascript:alert(1)'},{latitude:NaN},{longitude:181},{category:'anything'},{retrieved_at:'bad'}]) assert.equal(isActivityPlace({...place,...change}),false);
});
test('bad payload and cancelled requests cannot produce invented results',async()=>{
 await assert.rejects(harness(async()=>({ok:true,json:async()=>({data:{results:[{...place,latitude:NaN}]}})})).activitySearchAdapter.search('x','museum',new AbortController().signal),/unusable data/);
 const controller=new AbortController();controller.abort();const error=new Error('cancelled');
 await assert.rejects(harness(async()=>{throw error;}).activitySearchAdapter.search('x','museum',controller.signal),e=>e===error);
});
