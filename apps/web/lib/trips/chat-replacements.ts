import { accountRequest } from "./account-adapter";
import { isActivityPlace, type ActivityPlace } from "./activity-search";
import { isWeatherView, type WeatherView } from "./weather";
export type ReplacementOptions = {
  base_etag:string;
  target:{activity_id:string;label:string;start:string;duration_minutes:number};
  category:"museum"|"gallery";
  forecast:WeatherView;
  options:{place:ActivityPlace;distance_meters:number;distance_basis:"activity_location"|"destination_centre"}[];
  eligible_count:number;
  notice:string|null;
};
export function isReplacementOptions(value:unknown,etag:string,activityId:string,date:string,category:string):value is ReplacementOptions {
  if(!value||typeof value!=="object")return false;
  const v=value as ReplacementOptions,t=v.target;
  return v.base_etag===etag&&v.category===category&&!!t&&t.activity_id===activityId&&typeof t.label==="string"&&!!t.label.trim()&&/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(t.start)&&Number.isInteger(t.duration_minutes)&&t.duration_minutes>0&&isWeatherView(v.forecast,date)&&Array.isArray(v.options)&&v.options.length<=3&&Number.isInteger(v.eligible_count)&&v.eligible_count>=v.options.length&&(v.notice===null||typeof v.notice==="string")&&v.options.every(o=>!!o&&typeof o==="object"&&isActivityPlace(o.place)&&o.place.category===category&&Number.isInteger(o.distance_meters)&&o.distance_meters>=0&&["activity_location","destination_centre"].includes(o.distance_basis))&&(v.forecast.status==="forecast"||v.options.length===0);
}
export const chatReplacementAdapter={async search(account:{id:string;versionEtag:string},turnId:string,activityId:string,date:string,category:"museum"|"gallery",signal:AbortSignal):Promise<ReplacementOptions>{
  const result=(await accountRequest<unknown>(`/trips/${account.id}/messages/${turnId}/replacement-options`,{method:"POST",headers:{"If-Match":account.versionEtag},signal:AbortSignal.any([signal,AbortSignal.timeout(20000)]),body:JSON.stringify({visit_date:date,category})})).data;
  if(!isReplacementOptions(result,account.versionEtag,activityId,date,category))throw new Error("Replacement research returned unexpected data. Your trip is unchanged; try again later.");
  return result;
}};
