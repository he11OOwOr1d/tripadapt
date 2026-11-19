import type { Proposal } from "./proposals";
import type { Trip } from "./adapter";
import type { ReadinessReturn } from "./readiness-edit";
export const recoveryStorageKey = "elsewhere.recovery-navigation.v1";
type Account = {id:string;versionEtag:string;currentVersionId?:string|null;lifecycle?:string};
const lifetime = 24 * 60 * 60 * 1000;
const allowed = new Set(["schema","owner","savedAt","tripId","stopId","day","activityId","boundEtag","reviewEtag","acceptedVersionId","acceptedDraftEtag","currentVersionId","proposalId"]);
/** Persist navigation only; no report, place, clock or activity content. */
export function storeRecovery(marker:ReadinessReturn,owner:string,account:Account,now=Date.now()):string|null {
  if(!["planning","active"].includes(account.lifecycle??"")||!marker.edited||!owner||marker.tripId!==account.id||marker.boundEtag!==account.versionEtag)return null;
  return JSON.stringify({schema:1,owner,savedAt:now,tripId:marker.tripId,stopId:marker.stopId,day:marker.day,activityId:marker.activityId,boundEtag:marker.boundEtag,reviewEtag:marker.reviewEtag,acceptedVersionId:marker.acceptedVersionId,acceptedDraftEtag:marker.acceptedDraftEtag,proposalId:marker.proposalId,currentVersionId:account.currentVersionId??null});
}
function parseRecovery(raw:string|null,owner:string,trip:Trip,account:Account,now:number,allowReceipt=false):ReadinessReturn|null {
  if(!["planning","active"].includes(account.lifecycle??"")||!raw||raw.length>4096||!owner)return null;
  try {
    const p=JSON.parse(raw);
    if(!p||typeof p!=="object"||Array.isArray(p)||Object.keys(p).some(k=>!allowed.has(k))||p.schema!==1||p.owner!==owner||p.tripId!==account.id||p.boundEtag!==account.versionEtag||(!allowReceipt&&p.currentVersionId!==(account.currentVersionId??null))||!Number.isFinite(p.savedAt)||p.savedAt>now||now-p.savedAt>=lifetime||typeof p.activityId!=="string"||!p.activityId||typeof p.stopId!=="string"||!Number.isSafeInteger(p.day)||p.day<1)return null;
    const stop=trip.stops.find(s=>s.id===p.stopId);
    if(!stop||p.day>stop.nights+1)return null;
    if(p.proposalId!==undefined&&(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(p.proposalId)||p.reviewEtag!==account.versionEtag))return null;
    if(p.reviewEtag!==undefined&&p.reviewEtag!==account.versionEtag)return null;
    if(p.acceptedVersionId!==undefined&&(p.acceptedVersionId!==account.currentVersionId||p.acceptedDraftEtag!==account.versionEtag))return null;
    if(p.acceptedDraftEtag!==undefined&&!p.acceptedVersionId)return null;
    return {tripId:p.tripId,stopId:p.stopId,day:p.day,activityId:p.activityId,edited:true,boundEtag:p.boundEtag,reviewEtag:p.reviewEtag,proposalId:p.proposalId,acceptedVersionId:p.acceptedVersionId,acceptedDraftEtag:p.acceptedDraftEtag};
  } catch {return null;}
}

export function restoreRecovery(raw:string|null,owner:string,trip:Trip,account:Account,now=Date.now()):ReadinessReturn|null {
  return parseRecovery(raw,owner,trip,account,now);
}
/** Bind only the exact plain draft review shown to the traveler. */
export function bindRecoveryReview(marker:ReadinessReturn|null,account:Account,proposal:Proposal):ReadinessReturn|null {
  if(!marker?.edited||marker.tripId!==account.id||marker.boundEtag!==account.versionEtag||marker.reviewEtag!==account.versionEtag||proposal.source!=="user"||proposal.generation||proposal.status!=="pending"||proposal.stale||proposal.base_current_version_id!==(account.currentVersionId??null)||`"draft:${proposal.base_draft_id}:${proposal.base_edit_sequence}"`!==account.versionEtag)return null;
  return {...marker,proposalId:proposal.id,receiptUnavailable:undefined};
}
/** A single server read may reconcile an interrupted acceptance; never writes. */
export async function recoverRecovery(raw:string|null,owner:string,trip:Trip,account:Account,read:(id:string)=>Promise<Proposal>,now=Date.now(),refresh?:()=>Promise<{account:Account;trip:Trip}>):Promise<ReadinessReturn|null> {
  const strict=restoreRecovery(raw,owner,trip,account,now);
  const candidate=parseRecovery(raw,owner,trip,account,now,true);
  if(!candidate?.proposalId)return strict;
  let receipt:Proposal;
  try {receipt=await read(candidate.proposalId);}catch{return strict?{...strict,receiptUnavailable:true}:null;}
  if(receipt.id!==candidate.proposalId||receipt.source!=="user"||receipt.generation||`"draft:${receipt.base_draft_id}:${receipt.base_edit_sequence}"`!==account.versionEtag)return null;
  if(receipt.status==="accepted") {
    if(receipt.candidate_version_id!==account.currentVersionId) {
      if(!refresh)return null;
      try {
        const latest=await refresh();
        return recoverRecovery(raw,owner,latest.trip,latest.account,async()=>receipt,now);
      } catch {return null;}
    }
    return {...candidate,acceptedVersionId:receipt.candidate_version_id,acceptedDraftEtag:account.versionEtag,receiptUnavailable:undefined};
  }
  if(!strict||receipt.stale)return null;
  if(receipt.status==="discarded")return {...strict,proposalId:undefined,reviewEtag:undefined,receiptUnavailable:undefined};
  if(receipt.status!=="pending"||receipt.base_current_version_id!==(account.currentVersionId??null))return null;
  return {...strict,receiptUnavailable:undefined};
}

/** A successful discard clears only its matching navigation link. */
export function discardRecoveryReview(marker:ReadinessReturn|null,proposalId:string):ReadinessReturn|null {
  if(!marker||marker.proposalId!==proposalId)return marker;
  return {...marker,proposalId:undefined,reviewEtag:undefined,receiptUnavailable:undefined,acceptedVersionId:undefined,acceptedDraftEtag:undefined};
}
export function sameRecoveryAttempt(start:{owner:string|null;tripId:string;tripEtag:string;draftEtag:string;marker:ReadinessReturn},current:{owner:string|null;account:{id:string;tripEtag:string;versionEtag:string}|null;marker:ReadinessReturn|null;dirty:boolean;editing:boolean;saving:boolean}):boolean {
  return start.owner===current.owner&&!!start.owner&&current.account?.id===start.tripId&&current.account.tripEtag===start.tripEtag&&current.account.versionEtag===start.draftEtag&&current.marker===start.marker&&!current.dirty&&!current.editing&&!current.saving;
}
