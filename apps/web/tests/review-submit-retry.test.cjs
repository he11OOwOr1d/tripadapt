const {test}=require('node:test'),assert=require('node:assert/strict'),ts=require('typescript'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const out={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.resolve(__dirname,'../lib/trips/review-submit-retry.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:out});
const first='00000000-0000-4000-8000-000000000001', second='00000000-0000-4000-8000-000000000002';
function store(){const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};}
test('a saved review with a lost response is recovered after reopening without a second review',async()=>{
 const storage=store(),receipts=new Map(),calls=[];let loseResponse=true;
 const adapter={};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.resolve(__dirname,'../lib/trips/proposals.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:adapter,AbortSignal,require:()=>({accountRequest:async(url,options)=>{
  const key=options.headers['Idempotency-Key'];calls.push(key);
  if(!receipts.has(key))receipts.set(key,{id:'saved-review',status:'pending'});
  if(loseResponse){loseResponse=false;throw new TypeError('response lost after save');}
  return {data:receipts.get(key)};
 }})});
 const original=out.reviewSubmitKey(storage,'trip','draft:1',first,1000);
 await assert.rejects(adapter.proposalAdapter.submit('trip','draft:1',original),/response lost/);
 const reopened=out.reviewSubmitKey(storage,'trip','draft:1',second,2000);
 const review=await adapter.proposalAdapter.submit('trip','draft:1',reopened);
 assert.equal(review.id,'saved-review');assert.equal(review.status,'pending');
 assert.equal(receipts.size,1);assert.deepEqual(calls,[first,first]);
 out.clearReviewSubmitKey(storage,'trip','draft:1',reopened);
 assert.equal(storage.getItem(out.reviewSubmitRetryKey),null);
});
test('an interrupted review reuses its key only for the same trip and saved draft',()=>{
 const s=store();assert.equal(out.reviewSubmitKey(s,'trip','draft:1',first,1000),first);
 assert.equal(out.reviewSubmitKey(s,'trip','draft:1',second,2000),first);
 assert.equal(out.reviewSubmitKey(s,'other','draft:1',second,2000),second);
 assert.equal(out.reviewSubmitKey(s,'other','draft:2',first,3000),first);
 assert.equal(out.reviewSubmitKey(s,'other','draft:2',second,3000+86400000),second);
});
test('a received response clears only the matching request, and broken storage remains optional',()=>{
 const s=store();out.reviewSubmitKey(s,'trip','draft:1',first,1000);
 out.clearReviewSubmitKey(s,'trip','draft:1',second);assert.ok(s.getItem(out.reviewSubmitRetryKey));
 out.clearReviewSubmitKey(s,'trip','draft:1',first);assert.equal(s.getItem(out.reviewSubmitRetryKey),null);
 s.setItem(out.reviewSubmitRetryKey,'{broken');assert.equal(out.reviewSubmitKey(s,'trip','draft:1',second,2000),second);
 const unavailable={getItem(){throw Error()},setItem(){throw Error()},removeItem(){throw Error()}};
 assert.equal(out.reviewSubmitKey(unavailable,'trip','draft:1',first,1000),first);assert.doesNotThrow(()=>out.clearReviewSubmitKey(unavailable,'trip','draft:1',first));
});
