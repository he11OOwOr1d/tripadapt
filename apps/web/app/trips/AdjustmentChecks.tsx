"use client";
import { useEffect, useRef, useState } from "react";
import type { Activity } from "../../lib/trips/adapter";
import { googleMapLink, type GoogleCheck } from "../../lib/trips/google-places";
import { journeyAdapter, type JourneyCheck } from "../../lib/trips/journeys";
import { adjustmentVerdict } from "../../lib/trips/adjustment-checks";
import GooglePlaceCheck from "./GooglePlaceCheck";

export default function AdjustmentChecks({ activity, next, visitDate, initialDate, timezone, googleId, mode, buffer }: {activity:Activity;next?:Activity;visitDate:string|null;initialDate?:string;timezone:string;googleId?:string;mode:"WALK"|"DRIVE";buffer:number}) {
  const [date,setDate]=useState(visitDate ?? initialDate ?? "");
  const [listing,setListing]=useState(googleId ?? activity.googlePlaceId);
  const [hours,setHours]=useState<GoogleCheck|null>(null);
  const [onward,setOnward]=useState<JourneyCheck|null>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState("");
  const controller=useRef<AbortController|null>(null),generation=useRef(0);
  useEffect(()=>()=>{generation.current++;controller.current?.abort();},[]);
  async function checkOnward() {
    if(!activity.place || !next?.place)return;
    controller.current?.abort();const abort=new AbortController();controller.current=abort;const id=++generation.current;
    setOnward(null);setError("");setBusy(true);
    try {const result=await journeyAdapter.check({origin_place_id:activity.place.id,destination_place_id:next.place.id,mode,origin_start:activity.start,origin_minutes:activity.minutes,destination_start:next.start,buffer_minutes:buffer},abort.signal);if(id===generation.current)setOnward(result);}
    catch(failure){if(id===generation.current&&!abort.signal.aborted)setError(failure instanceof Error&&failure.name!=="TimeoutError"?failure.message:"The onward check timed out. Nothing has changed; try later.");}
    finally{if(id===generation.current)setBusy(false);}
  }
  return <details className="adjustment-checks"><summary>Check this suggested time first</summary><div className="day-feasibility">
    <h4 role="status">{adjustmentVerdict(hours,onward,!!next)}</h4>
    <p>Checking {activity.title} at {activity.start} for {activity.minutes} minutes. Your saved time stays unchanged.</p>
    <label>Visit date for this suggestion<input type="date" readOnly={!!visitDate} value={date} onInput={e=>{setHours(null);setDate(e.currentTarget.value);}} onChange={e=>{setHours(null);setDate(e.target.value);}} /></label>
    <small>{visitDate?"From your provisional trip date.":"For this preview only; your trip dates stay flexible."}</small>
    {!date ? <p>Choose a date to compare the full proposed visit with reported hours.</p> : activity.place ? <GooglePlaceCheck key={date} sourceId={activity.place.id} googleId={listing} onSelect={setListing} visitDate={date} start={activity.start} minutes={activity.minutes} timezone={timezone} onResult={setHours} temporarySelection /> : <p>A mapped venue is needed to check hours.</p>}
    {hours && <section aria-label="Suggested visit hours"><p className="google-maps-attribution">Google Maps</p><strong>{hours.place.name}</strong><p>{hours.explanation}</p><small>Checked {new Date(hours.retrieved_at).toLocaleString()} for {date}, {activity.start}.</small><a href={googleMapLink(hours.place.id)} target="_blank" rel="noreferrer">Original listing</a>{hours.attributions.map((name,i)=><small key={i}>{name}</small>)}</section>}
    {!next ? <p>No later activity on this day. Travel back to your accommodation is not included.</p> : <section aria-label="Suggested onward journey"><p><strong>Then get to {next.title}</strong><br />Keep its {next.start} start. {mode==="WALK"?"Walk":"Drive without live traffic"} + {buffer} min arrival buffer.</p>{!activity.place || !next.place ? <p>The next journey is unknown because a mapped location is missing.</p> : <button type="button" disabled={busy} onClick={()=>void checkOnward()}>{busy?"Checking onward journey…":"Check onward journey"}</button>}{error&&<p role="alert">{error}</p>}{onward&&<div><p className="google-maps-attribution">Google Maps</p><p role="status">{onward.spare_minutes<0?`${Math.ceil(-onward.spare_minutes)} more minutes needed`:`${Math.floor(onward.spare_minutes)} minutes to spare`}. {onward.travel_minutes} min travel + {onward.buffer_minutes} min buffer; {onward.gap_minutes} min available.</p>{onward.warnings.map((warning,i)=><p key={i}>{warning}</p>)}<small>Checked {new Date(onward.retrieved_at).toLocaleString()}. Estimate only; no live traffic, parking or accessibility check. Walking routes may miss sidewalks or pedestrian paths.</small></div>}</section>}
    <small>These are temporary checks of the suggestion, separate from the current-day results. Existing road warnings still apply. Opening the editor doesn’t apply a change; Save does. Recheck after any further edit. Tickets, access and availability remain unconfirmed.</small>
  </div></details>;
}
