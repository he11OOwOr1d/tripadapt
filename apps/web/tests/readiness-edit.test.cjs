const {test}=require('node:test'),assert=require('node:assert/strict'),ts=require('typescript'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const out={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.resolve(__dirname,'../lib/trips/readiness-edit.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:out,Date});
const now=Date.parse('2026-11-15T03:00:00Z');
function fixture(){const a={id:'activity',stopId:'stop',day:13,title:'A commitment',start:'00:05',minutes:30,completed:false,fixed:true,booked:true};const item={activity_id:a.id,label:a.title,start:a.start,duration_minutes:a.minutes,completed:false,fixed:true,booked:true,place_id:null};return {trip:{stops:[{id:'stop',nights:20}],activities:[a]},account:{id:'trip',versionEtag:'"draft:base:2"'},context:{basis:'draft',base_version_id:'base',base_etag:'"draft:base:2"',stop_id:'stop',local_day_offset:12,activities:[{...item}]},report:{basis:'draft',scope:'remaining_day',status:'needs_attention',base_version_id:'base',base_etag:'"draft:base:2"',stop_id:'stop',local_day_offset:12,expires_at:'2026-11-15T03:05:00Z',past_unresolved:[{...item}],in_progress:[]}};}
function target(f){return out.readinessEditTarget(f.trip,f.account,f.context,f.report,'activity','stop',13,now);}
test('opens the current draft record without changing completed/fixed/booked flags or imposing a seven-day limit',()=>{const f=fixture(),before=JSON.stringify(f),a=target(f);assert.ok(a);assert.equal(a.fixed,true);assert.equal(a.booked,true);assert.equal(a.completed,false);assert.notEqual(a,f.trip.activities[0]);assert.equal(JSON.stringify(f),before);});
test('accepted snapshots and expired or newer drafts cannot be copied into the editor',()=>{for(const mutate of [f=>f.context.basis='accepted',f=>f.report.basis='accepted',f=>f.account.versionEtag='"draft:base:3"',f=>f.report.base_version_id='other',f=>f.report.expires_at='2026-11-15T02:59:00Z']){const f=fixture();mutate(f);assert.equal(target(f),undefined);}});
test('cross-day, cross-stop and missing/removed activities are rejected',()=>{for(const mutate of [f=>f.report.local_day_offset=0,f=>f.context.stop_id='other',f=>f.trip.activities[0].day=1,f=>f.trip.activities=[],f=>f.context.activities=[]]){const f=fixture();mutate(f);assert.equal(target(f),undefined);}});
test('changed timing, labels, flags or locations require a fresh check',()=>{for(const change of [{start:'00:15'},{title:'New name'},{minutes:40},{completed:true},{fixed:false},{booked:false},{place:{id:'new-map'}}]){const f=fixture();Object.assign(f.trip.activities[0],change);assert.equal(target(f),undefined);}});
test('only unresolved earlier or in-progress items receive the status handoff',()=>{const f=fixture();f.report.in_progress=f.report.past_unresolved;f.report.past_unresolved=[];assert.ok(target(f));f.report.in_progress=[];assert.equal(target(f),undefined);});

function acceptedFixture(){
 const marker={tripId:'trip',stopId:'stop',day:13,activityId:'activity',edited:true,reviewEtag:'"draft:base:2"'};
 const account={id:'trip',versionEtag:'"draft:base:2"',currentVersionId:'candidate'};
 const proposal={status:'accepted',source:'user',candidate_version_id:'candidate',base_draft_id:'base',base_edit_sequence:2,generation:null};
 return {marker,account,proposal};
}
test('only exact accepted plain draft review advances the recovery reminder without changing its scope',()=>{
 const f=acceptedFixture(),before=JSON.stringify(f),result=out.acceptedRecoveryReturn(f.marker,f.account,f.proposal);
 assert.equal(result.acceptedVersionId,'candidate');assert.equal(result.day,13);assert.equal(result.stopId,'stop');
 assert.equal(out.recoveryIsAccepted(result,f.account),true);assert.equal(JSON.stringify(f),before);
});
test('pending, unrelated, generated or stale acceptance cannot claim recovery corrections were accepted',()=>{
 for(const mutate of [f=>f.marker.edited=false,f=>f.marker.tripId='other',f=>delete f.marker.reviewEtag,f=>f.proposal.status='pending',f=>f.proposal.source='agent',f=>f.proposal.generation={operation:'remaining_day'},f=>f.proposal.base_edit_sequence=1,f=>f.account.versionEtag='"draft:base:3"',f=>f.account.currentVersionId='other',f=>delete f.proposal.base_draft_id]){
  const f=acceptedFixture();mutate(f);assert.equal(out.acceptedRecoveryReturn(f.marker,f.account,f.proposal),null);
 }
});
test('later edits or a newer accepted plan invalidate the accepted-day reminder',()=>{
 const f=acceptedFixture(),result=out.acceptedRecoveryReturn(f.marker,f.account,f.proposal);
 assert.equal(out.recoveryIsAccepted(result,{...f.account,versionEtag:'"draft:base:3"'}),false);
 assert.equal(out.recoveryIsAccepted(result,{...f.account,currentVersionId:'new'}),false);
 assert.equal(out.recoveryIsAccepted(f.marker,f.account),false);
});

test('saved skipped outcomes and mismatched report outcomes cannot reopen unresolved recovery',()=>{
 for(const mutate of [f=>f.trip.activities[0].skipped=true,f=>f.context.activities[0].skipped=true,f=>f.report.past_unresolved[0].skipped=true]){const f=fixture();mutate(f);assert.equal(target(f),undefined);}
 const f=fixture();f.context.activities[0].skipped=false;f.report.past_unresolved[0].skipped=false;assert.ok(target(f),'older contexts without a skipped flag remain compatible with explicit false');
});
