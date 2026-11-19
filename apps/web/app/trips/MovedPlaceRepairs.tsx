"use client";
import { useEffect, useRef } from "react";
import type { Trip } from "../../lib/trips/adapter";
import { movedPlaceTarget, type MovedPlaceRepair } from "../../lib/trips/moved-place-repair";
export default function MovedPlaceRepairs({trip,accountId,repair,busy,editing,onChoose,onDismiss}:{trip:Trip;accountId:string;repair:MovedPlaceRepair;busy:boolean;editing:boolean;onChoose:(id:string)=>void;onDismiss:()=>void}) {
 const panel=useRef<HTMLElement>(null),wasEditing=useRef(editing);
 useEffect(()=>{if(wasEditing.current&&!editing&&document.activeElement===document.body)panel.current?.focus({preventScroll:true});wasEditing.current=editing;},[editing]);
 return <section ref={panel} className="moved-place-repairs" tabIndex={-1} aria-label="Map locations after your stay change"><h2>A new stay needs a new place</h2><p>Your activities moved in the saved draft. Choose map locations at their new destinations before checking journeys. No reservation has changed.</p><ul>{repair.items.map(item=>{
 const a=trip.activities.find(x=>x.id===item.activityId),stop=trip.stops.find(s=>s.id===item.stopId),target=movedPlaceTarget(trip,accountId,repair,item.activityId);
 return <li key={item.activityId}><div><strong>{a?.title??"Activity no longer in this draft"}</strong><span>{stop?.name??"Destination changed"} · day {item.day}</span></div>{target?<button type="button" disabled={busy||editing} onClick={()=>onChoose(item.activityId)} aria-label={`Choose a map location for ${a?.title} in ${stop?.name}, day ${item.day}`}>Choose map location</button>:<span>{a?.stopId===item.stopId&&a.day===item.day&&a.place?`Linked: ${a.place.name}`:"This activity changed or is resolved. Review it in the planner."}</span>}</li>;
 })}</ul>{busy&&<p role="status">Finish saving or resolve the saving error above before linking another place.</p>}<button type="button" disabled={editing} onClick={onDismiss}>Dismiss location reminder</button></section>;
}
