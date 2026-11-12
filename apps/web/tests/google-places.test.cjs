const test=require('node:test');
const assert=require('node:assert/strict');
const ts=require('typescript');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
function harness(){
 const calls=[],exports={};
 const code=ts.transpileModule(fs.readFileSync(path.resolve(__dirname,'../lib/trips/google-places.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,{exports,AbortSignal,encodeURIComponent,require:()=>({accountRequest:async(url,options)=>{calls.push({url,options});return {data:[]};}})});
 return {...exports,calls};
}
test('Google checks use the authenticated backend and never a browser Google key',async()=>{
 const h=harness(),signal=new AbortController().signal;
 await h.googlePlacesAdapter.matches('source-ref',signal);
 await h.googlePlacesAdapter.check('source-ref','ChIJ_test','2026-11-11','14:00',60,signal);
 assert.equal(h.calls[0].url,'/google-places/matches');
 assert.equal(h.calls[1].url,'/google-places/check');
 const body=JSON.parse(h.calls[1].options.body);
 assert.deepEqual(body,{source_place_id:'source-ref',google_place_id:'ChIJ_test',visit_date:'2026-11-11',start:'14:00',duration_minutes:60});
 assert.equal('apiKey' in body,false);
 assert.equal('title' in body,false);
});
test('flexible dates stay null in checks instead of silently assuming today',async()=>{
 const h=harness();await h.googlePlacesAdapter.check('source','ChIJ_test','','14:00',60,new AbortController().signal);
 assert.equal(JSON.parse(h.calls[0].options.body).visit_date,null);
});
test('missing Google prices remain unknown and ranges are not admission quotes',()=>{
 const h=harness();
 assert.equal(h.googlePrice({price_level:null,price_range:null}),'Not provided');
 assert.equal(h.googlePrice({price_level:'PRICE_LEVEL_MODERATE',price_range:null}),'Moderate');
 assert.equal(h.googlePrice({price_level:null,price_range:{startPrice:{currencyCode:'INR',units:'100'},endPrice:{currencyCode:'INR',units:'250'}}}),'INR 100–250');
 assert.equal(h.googlePrice({price_level:null,price_range:{startPrice:{currencyCode:'INR',units:'NaN'},endPrice:{currencyCode:'INR',units:'250'}}}),'Not provided');
});
test('Google identifiers are safely encoded into a Google source link',()=>{
 assert.equal(harness().googleMapLink('ChIJ_test'),'https://www.google.com/maps/search/?api=1&query=Place&query_place_id=ChIJ_test');
 assert.match(harness().googleMapLink('id&x=y'),/id%26x%3Dy$/);
});
