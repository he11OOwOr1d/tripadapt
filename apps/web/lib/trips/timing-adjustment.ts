import type { Activity } from "./adapter";
import type { JourneyCheck } from "./journeys";
const minute = (value:string) => {const [h,m]=value.split(":").map(Number);return h*60+m;};
const clock = (value:number) => `${String(Math.floor(value/60)).padStart(2,"0")}:${String(value%60).padStart(2,"0")}`;
export type TimingAdjustment = { available:false; reason:string } | {available:true; activity:Activity; before:string; after:string; end:string; shift:number};
/** A single-edge repair, never a cascade or an inferred opening-hours window. */
export function timingAdjustment(activities:Activity[], from:Activity, to:Activity, evidence:JourneyCheck):TimingAdjustment {
  const blocked=(reason:string):TimingAdjustment=>({available:false,reason});
  if(to.fixed || to.booked || to.completed)return blocked("This activity is fixed, booked or completed. Keep its timing and review your transport or the earlier activity instead.");
  if(from.stopId!==to.stopId || from.day!==to.day)return blocked("Choose two activities on the same day at this destination.");
  if(!from.place || !to.place || !Number.isFinite(evidence.travel_minutes) || evidence.travel_minutes<0 || !Number.isFinite(evidence.buffer_minutes) || evidence.buffer_minutes<0 || evidence.gap_minutes!==minute(to.start)-minute(from.start)-from.minutes)return blocked("Check this journey again before suggesting a time.");
  const start=Math.ceil(minute(from.start)+from.minutes+evidence.travel_minutes+evidence.buffer_minutes), end=start+to.minutes;
  if(!Number.isFinite(start) || start<=minute(to.start))return blocked("A later start isn’t needed for this journey estimate.");
  if(end>1440)return blocked("There isn’t enough room before midnight. Review another day or a shorter activity manually.");
  const ordered=[...activities].sort((a,b)=>a.start.localeCompare(b.start)||a.id.localeCompare(b.id));
  const next=ordered[ordered.findIndex(a=>a.id===to.id)+1];
  if(next && start>=minute(next.start))return blocked("That would change the activity order. Review the day manually rather than shifting later activities automatically.");
  const conflict=activities.find(a=>a.id!==to.id && a.stopId===to.stopId && a.day===to.day && minute(a.start)<end && minute(a.start)+a.minutes>start);
  if(conflict)return blocked(`The suggested time would overlap ${conflict.title}. Review the day manually; no other activities will be moved.`);
  return {available:true, activity:{...to,start:clock(start)}, before:to.start, after:clock(start), end:clock(end), shift:start-minute(to.start)};
}
