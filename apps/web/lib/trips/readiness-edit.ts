import type { Proposal } from "./proposals";
import type { RecoveryChoice } from "./activity-recovery";
import type { Activity, Trip } from "./adapter";
import type { ReadinessActivity, ReadinessContext, ReadinessReport } from "./replanning";
export type ReadinessEditHandler=(context:ReadinessContext,report:ReadinessReport,activityId:string,choice?:RecoveryChoice)=>boolean;
export type ReadinessReturn={tripId:string;stopId:string;day:number;activityId:string;edited?:boolean;boundEtag?:string;proposalId?:string;receiptUnavailable?:boolean;reviewEtag?:string;acceptedVersionId?:string;acceptedDraftEtag?:string};
/** Resolve only a current draft record; never copy status/timing from a snapshot. */
export function readinessEditTarget(trip:Trip,account:{id:string;versionEtag:string},context:ReadinessContext,report:ReadinessReport,activityId:string,stopId:string,day:number,now=Date.now()):Activity|undefined {
  if(context.basis!=="draft"||report.basis!=="draft"||context.base_etag!==account.versionEtag||report.base_etag!==account.versionEtag||context.base_version_id!==report.base_version_id||context.stop_id!==stopId||report.stop_id!==stopId||!Number.isInteger(day)||day<1||context.local_day_offset!==day-1||report.local_day_offset!==day-1||report.scope!=="remaining_day"||report.status!=="needs_attention"||!Number.isFinite(Date.parse(report.expires_at))||Date.parse(report.expires_at)<=now)return;
  const stop=trip.stops.find(s=>s.id===stopId);
  const activity=trip.activities.find(a=>a.id===activityId);
  const source=context.activities.find(a=>a.activity_id===activityId);
  const unresolved=[...report.past_unresolved,...report.in_progress].find(a=>a.activity_id===activityId);
  if(!stop||day>stop.nights+1||!activity||activity.stopId!==stopId||activity.day!==day||activity.completed||activity.skipped===true||!source||!unresolved)return;
  const matches=(a:ReadinessActivity)=>a.activity_id===activity.id&&a.label===activity.title&&a.start===activity.start&&a.duration_minutes===activity.minutes&&a.completed===activity.completed&&(a.skipped===true)===(activity.skipped===true)&&a.fixed===activity.fixed&&a.booked===activity.booked&&a.place_id===(activity.place?.id??null);
  if(!matches(source)||!matches(unresolved))return;
  return {...activity};
}

/** Only the exact plain draft review may advance the recovery reminder. */
export function acceptedRecoveryReturn(marker:ReadinessReturn|null, account:{id:string;versionEtag:string;currentVersionId?:string|null}, proposal?:Proposal):ReadinessReturn|null {
  if(!marker?.edited||marker.tripId!==account.id||!marker.reviewEtag||!proposal||proposal.status!=="accepted"||proposal.source!=="user"||proposal.generation||proposal.candidate_version_id!==account.currentVersionId||marker.reviewEtag!==account.versionEtag||marker.reviewEtag!==`"draft:${proposal.base_draft_id}:${proposal.base_edit_sequence}"`)return null;
  return {...marker,acceptedVersionId:proposal.candidate_version_id,acceptedDraftEtag:account.versionEtag};
}
export function recoveryIsAccepted(marker:ReadinessReturn,account:{currentVersionId?:string|null;versionEtag:string}):boolean {
  return !!marker.acceptedVersionId&&marker.acceptedVersionId===account.currentVersionId&&marker.acceptedDraftEtag===account.versionEtag;
}
