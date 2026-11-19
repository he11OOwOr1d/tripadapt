import type { Activity, Trip } from "./adapter";
import type { RebalanceSummary } from "./stay-rebalance";
export type MovedPlaceRepair={tripId:string;items:{activityId:string;stopId:string;day:number}[]};
export const movedPlaceStorageKey="elsewhere.moved-place-navigation.v1";
const lifetime=24*60*60*1000;
/** Keep only navigation identifiers in this tab, never a place or plan snapshot. */
export function storeMovedPlaceRepair(repair:MovedPlaceRepair,owner:string,now=Date.now()):string {
 return JSON.stringify({schema:1,owner,savedAt:now,tripId:repair.tripId,items:repair.items});
}
export function restoreMovedPlaceRepair(raw:string|null,owner:string,trip:Trip,tripId:string,now=Date.now()):MovedPlaceRepair|null {
 if(!raw||raw.length>16384||!owner)return null;
 try {
  const p=JSON.parse(raw);
  if(!p||typeof p!=="object"||Array.isArray(p)||Object.keys(p).some(k=>!["schema","owner","savedAt","tripId","items"].includes(k))||p.schema!==1||p.owner!==owner||p.tripId!==tripId||!Number.isFinite(p.savedAt)||p.savedAt>now||now-p.savedAt>=lifetime||!Array.isArray(p.items)||p.items.length===0||p.items.length>100)return null;
  const items:MovedPlaceRepair["items"]=[];
  for(const item of p.items){
   if(!item||typeof item!=="object"||Array.isArray(item)||Object.keys(item).some(k=>!["activityId","stopId","day"].includes(k))||typeof item.activityId!=="string"||!item.activityId||typeof item.stopId!=="string"||!item.stopId||!Number.isSafeInteger(item.day)||item.day<1||items.some(x=>x.activityId===item.activityId))return null;
   const activity=trip.activities.find(a=>a.id===item.activityId),stop=trip.stops.find(s=>s.id===item.stopId);
   if(activity&&stop&&activity.stopId===item.stopId&&activity.day===item.day&&item.day<=stop.nights+1&&!activity.completed&&!activity.skipped)items.push({activityId:item.activityId,stopId:item.stopId,day:item.day});
  }
  const repair={tripId,items};
  return items.some(item=>movedPlaceTarget(trip,tripId,repair,item.activityId))?repair:null;
 } catch{return null;}
}
export function movedPlaceRepair(tripId:string,result:RebalanceSummary):MovedPlaceRepair|null {
 if(!result.applied)return null;
 const items=result.moved.filter(m=>m.to_stop_id!==m.stop_id).map(m=>({activityId:m.activity_id,stopId:m.to_stop_id,day:m.to_day}));
 return items.length?{tripId,items}:null;
}
/** Keep earlier reminders when another stay change adds no new locations. */
export function mergeMovedPlaceRepairs(tripId:string,current:MovedPlaceRepair|null,next:MovedPlaceRepair|null):MovedPlaceRepair|null {
 const items=current?.tripId===tripId?[...current.items]:[];
 if(next?.tripId===tripId)for(const item of next.items){
  const index=items.findIndex(existing=>existing.activityId===item.activityId);
  if(index<0)items.push(item);else items[index]=item;
 }
 return items.length?{tripId,items}:null;
}
/** Follow only an applied move from the reminder's last known destination and day. */
export function advanceMovedPlaceRepairs(tripId:string,current:MovedPlaceRepair|null,result:RebalanceSummary):MovedPlaceRepair|null {
 if(!result.applied)return current?.tripId===tripId?current:null;
 const previous=current?.tripId===tripId?current.items:[];
 const items=previous.flatMap(item=>{
  if(result.dropped.some(a=>a.activity_id===item.activityId&&a.stop_id===item.stopId&&a.day===item.day))return [];
  const moved=result.moved.find(a=>a.activity_id===item.activityId&&a.stop_id===item.stopId&&a.day===item.day);
  return [moved?{activityId:item.activityId,stopId:moved.to_stop_id,day:moved.to_day}:item];
 });
 return mergeMovedPlaceRepairs(tripId,items.length?{tripId,items}:null,movedPlaceRepair(tripId,result));
}
/** Follow existing reminders after a successfully saved manual edit, using current records. */
export function reconcileMovedPlaceRepairs(trip:Trip,tripId:string,repair:MovedPlaceRepair|null):MovedPlaceRepair|null {
 if(!repair||repair.tripId!==tripId)return null;
 const items=repair.items.flatMap(item=>{
  const activity=trip.activities.find(a=>a.id===item.activityId);
  const stop=activity&&trip.stops.find(s=>s.id===activity.stopId);
  if(!activity||!stop||activity.day<1||activity.day>stop.nights+1||activity.completed||activity.skipped)return [];
  return [{activityId:activity.id,stopId:activity.stopId,day:activity.day}];
 });
 return items.length?{tripId,items}:null;
}
/** Navigation only: resolve current data, never restore an old map/snapshot. */
export function movedPlaceTarget(trip:Trip,accountId:string,repair:MovedPlaceRepair,activityId:string):Activity|undefined {
 if(repair.tripId!==accountId)return;
 const item=repair.items.find(x=>x.activityId===activityId),a=trip.activities.find(x=>x.id===activityId);
 if(!item||!a||a.stopId!==item.stopId||a.day!==item.day||a.completed||a.skipped||a.place)return;
 const stop=trip.stops.find(s=>s.id===a.stopId);
 if(!stop||a.day<1||a.day>stop.nights+1)return;
 return {...a};
}
