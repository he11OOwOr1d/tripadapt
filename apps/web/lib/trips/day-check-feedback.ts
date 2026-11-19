import type { Proposal } from "./proposals";

export type DayCheckDiagnostic = {
  kind: "visit" | "journey";
  reason: "location_missing" | "listing_mismatch" | "closed" | "outside_hours" | "hours_unknown" | "outside_coverage" | "shortfall" | "route_warning" | "provider_error";
  activity_id: string;
  from_activity_id: string | null;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function parseDayCheck(value: unknown): DayCheckDiagnostic | undefined {
  if (!value || typeof value !== "object") return;
  const d = value as Record<string, unknown>;
  if (typeof d.reason !== "string") return;
  if (typeof d.activity_id !== "string" || !uuid.test(d.activity_id)) return;
  const visitReasons = ["location_missing", "listing_mismatch", "closed", "outside_hours", "hours_unknown", "outside_coverage", "provider_error"];
  const journeyReasons = ["location_missing", "shortfall", "route_warning", "provider_error"];
  if (d.kind === "visit" && d.from_activity_id == null && visitReasons.includes(String(d.reason))) {
    return { kind: "visit", reason: d.reason as DayCheckDiagnostic["reason"], activity_id: d.activity_id, from_activity_id: null };
  }
  if (d.kind === "journey" && typeof d.from_activity_id === "string" && uuid.test(d.from_activity_id) && journeyReasons.includes(String(d.reason))) {
    return { kind: "journey", reason: d.reason as DayCheckDiagnostic["reason"], activity_id: d.activity_id, from_activity_id: d.from_activity_id };
  }
}

export function describeDayCheck(d: DayCheckDiagnostic | undefined, proposal: Proposal) {
  if (!d) return;
  let activity: Proposal["plan"]["activities"][number] | undefined;
  let from: Proposal["plan"]["activities"][number] | undefined;
  if (proposal.generation?.operation === "delay_day") {
    const coverage = delayCoverage(proposal);
    activity = coverage.visits.find(a => a.logical_id === d.activity_id);
    from = d.kind === "journey" ? coverage.day.find(a => a.logical_id === d.from_activity_id) : undefined;
    if (!activity || (d.kind === "journey" && (!from || coverage.day.indexOf(activity) !== coverage.day.indexOf(from) + 1))) return;
  } else if (proposal.generation?.operation === "remaining_day") {
    if(d.kind!=="visit")return;
    activity=remainingCoverage(proposal).visits.find(a=>a.logical_id===d.activity_id);
    if(!activity)return;
  } else if (["move_activity", "replace_activity"].includes(proposal.generation?.operation ?? "")) {
    const coverage = singleCoverage(proposal);
    if (d.kind === "visit") {
      activity = coverage.target?.logical_id === d.activity_id ? coverage.target : undefined;
    } else {
      const leg = coverage.legs.find(([origin,destination]) => origin.logical_id === d.from_activity_id && destination.logical_id === d.activity_id);
      if (leg) [from,activity] = leg;
    }
    if (!activity) return;
  } else return;
  const subject = from ? `${from.user_label} → ${activity.user_label}` : `${activity.user_label} at ${activity.local_start_time.slice(0, 5)}`;
  const messages = {
    location_missing: ["A map location is missing.", "Use Edit or move for this activity to link a map location, save your changes, then prepare a new review."],
    listing_mismatch: ["The selected Google listing does not match this visit’s location.", "Choose a different matching listing below, then retry acceptance."],
    closed: ["Google reports this place closed for the selected date.", "Choose another time or place in the day editor, then prepare a new review."],
    outside_hours: ["This proposed visit falls outside reported opening hours.", "Adjust the visit’s time or duration in the day editor, then prepare a new review."],
    hours_unknown: ["Opening hours could not be confirmed for this visit.", "Check directly with the venue. Keep this review pending or explicitly choose provisional acceptance."],
    outside_coverage: ["Reported hours do not cover the selected date.", "Check directly with the venue. Your saved trip dates have not changed."],
    shortfall: ["This journey and your arrival buffer do not fit the gap.", "Allow more time between these activities in the day editor, then prepare a new review."],
    route_warning: ["Google returned an access warning for this journey.", "Inspect this journey in the day’s timing checks before deciding whether to accept provisionally."],
    provider_error: ["The provider could not complete this check.", "Retry acceptance later. No changes were applied and no automatic fallback was used."],
  };
  const [explanation, nextStep] = messages[d.reason];
  return { subject, explanation, nextStep };
}

export function delayCoverage(proposal: Proposal) {
  const changed = new Set(proposal.generation?.changes?.map(c => c.activity_id));
  const visits = proposal.plan.activities.filter(a => changed.has(a.logical_id)).sort((a, b) => a.local_start_time.localeCompare(b.local_start_time) || a.logical_id.localeCompare(b.logical_id));
  const target = visits[0];
  const day = target ? proposal.plan.activities.filter(a => a.stop_logical_id === target.stop_logical_id && a.local_day_offset === target.local_day_offset).sort((a, b) => a.local_start_time.localeCompare(b.local_start_time) || a.logical_id.localeCompare(b.logical_id)) : [];
  const first = day.findIndex(a => a.logical_id === target?.logical_id);
  const missing = day.slice(Math.max(0, first - 1)).filter(a => !a.place_id);
  return { visits, day, missing, mapped: visits.length > 0 && visits.length <= 6 && missing.length === 0 };
}

export function singleCoverage(proposal: Proposal) {
  const id=proposal.generation?.request?.activity_id??proposal.generation?.command?.activity_id;
  const target=proposal.plan.activities.find(a=>a.logical_id===id);
  const day=target?proposal.plan.activities.filter(a=>a.stop_logical_id===target.stop_logical_id&&a.local_day_offset===target.local_day_offset).sort((a,b)=>a.local_start_time.localeCompare(b.local_start_time)||a.logical_id.localeCompare(b.logical_id)):[];
  const index=day.findIndex(a=>a.logical_id===id);
  const legs: [Proposal["plan"]["activities"][number],Proposal["plan"]["activities"][number]][]=[];
  if(target&&index>0)legs.push([day[index-1],target]);
  if(target&&index>=0&&index<day.length-1)legs.push([target,day[index+1]]);
  const affected=target?[target,...legs.flat()]:[];
  const missing=affected.filter((a,index)=>!a.place_id&&affected.findIndex(other=>other.logical_id===a.logical_id)===index);
  return {target,day,legs,missing,mapped:!!target?.place_id&&missing.length===0};
}

export function remainingCoverage(proposal:Proposal){const ids=new Set(proposal.generation?.changes?.map(c=>c.activity_id));const visits=proposal.plan.activities.filter(a=>ids.has(a.logical_id)&&!a.completed).sort((a,b)=>a.local_start_time.localeCompare(b.local_start_time)||a.logical_id.localeCompare(b.logical_id));const missing=visits.filter(a=>!a.place_id);return {visits,missing,mapped:visits.length>0&&visits.length<=6&&missing.length===0};}
