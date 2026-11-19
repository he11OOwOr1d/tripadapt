import type { Trip } from "./adapter";
import type { ConversationTurn } from "./conversation";

export type WeatherHandoff = {
  type: "weather_replacement";
  activity_id: string;
  stop_id: string;
  local_day_offset: number;
  category: "museum" | "gallery";
  visit_date: string | null;
  base_etag: string;
};
export type WeatherSeed = { activityId:string;stopId:string;day:number;category:"museum"|"gallery";visitDate:string|null;key:string };

/** An old chat message must never redirect edits into a newer draft or another day. */
export function weatherHandoffSeed(trip:Trip, account:{id:string;versionEtag:string}, turn:ConversationTurn, stopId:string, day:number):Omit<WeatherSeed,"key">|undefined {
  const action=turn.weather_handoff;
  if(!action || action.type!=="weather_replacement" || turn.kind!=="weather_handoff" || turn.weather_handoff_stale || turn.job.status!=="succeeded" || turn.job.proposal_id || turn.job.trip_id!==account.id || action.base_etag!==account.versionEtag || action.stop_id!==stopId || action.local_day_offset!==day-1 || !Number.isInteger(action.local_day_offset) || action.local_day_offset<0 || !["museum","gallery"].includes(action.category)) return;
  if(action.visit_date!==null && (typeof action.visit_date!=="string" || !/^\d{4}-\d{2}-\d{2}$/.test(action.visit_date) || !Number.isFinite(Date.parse(action.visit_date+"T12:00:00Z")) || new Date(action.visit_date+"T12:00:00Z").toISOString().slice(0,10)!==action.visit_date)) return;
  const stop=trip.stops.find(s=>s.id===stopId);
  const activity=trip.activities.find(a=>a.id===action.activity_id);
  if(!stop?.location || day<1 || day>stop.nights+1 || !activity || activity.stopId!==stopId || activity.day!==day || activity.fixed || activity.booked || activity.completed) return;
  return {activityId:activity.id,stopId,day,category:action.category,visitDate:action.visit_date};
}
