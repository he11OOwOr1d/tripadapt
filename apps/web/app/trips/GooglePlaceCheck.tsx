"use client";
import { useEffect, useRef, useState } from "react";
import { googlePlacesAdapter, googleMapLink, googlePrice, type GoogleCheck, type GoogleMatch } from "../../lib/trips/google-places";

const labels: Record<string,string>={date_needed:"A visit date is needed",outside_coverage:"Check nearer your visit",reported_closed:"Reported closed",hours_unknown:"Hours unavailable",fits_reported_hours:"Fits reported hours",outside_reported_hours:"Choose another time"};
export default function GooglePlaceCheck({ sourceId, googleId, onSelect, visitDate, start, minutes, timezone, onResult, temporarySelection = false }: {sourceId:string;googleId?:string;onSelect:(id:string|undefined)=>void;visitDate:string|null;start:string;minutes:number;timezone:string;onResult?:(check:GoogleCheck|null)=>void;temporarySelection?:boolean}) {
  const [date,setDate]=useState(visitDate ?? "");
  const [matches,setMatches]=useState<GoogleMatch[]|null>(null);
  const [check,setCheck]=useState<GoogleCheck|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const dateInput=useRef<HTMLInputElement>(null);
  const controller=useRef<AbortController|null>(null);
  const request=useRef(0);
  function reset() {request.current++;controller.current?.abort();setCheck(null);setMatches(null);setBusy(false);setError("");}
  useEffect(()=>{setDate(visitDate ?? "");reset();},[visitDate]);
  useEffect(()=>{reset();},[start,minutes,sourceId]);
  useEffect(()=>()=>{request.current++;controller.current?.abort();},[]);
  async function run(selected?:string) {
    const chosenDate=dateInput.current?.value ?? date;
    setDate(chosenDate);
    controller.current?.abort();const abort=new AbortController();controller.current=abort;const id=++request.current;
    setBusy(true);setError("");setCheck(null);onResult?.(null);
    try {
      if (selected) {
        const result=await googlePlacesAdapter.check(sourceId,selected,chosenDate,start,minutes,abort.signal);
        if(id===request.current){setCheck(result);setMatches(null);onSelect(selected);onResult?.(result);}
      } else {
        const result=await googlePlacesAdapter.matches(sourceId,abort.signal);
        if(id===request.current)setMatches(result);
      }
    } catch(failure) {
      if(id===request.current && !abort.signal.aborted)setError(failure instanceof Error && failure.name!=="TimeoutError" ? failure.message : "Google Maps could not respond in time. Your activity is kept; try again later.");
    } finally {if(id===request.current)setBusy(false);}
  }
  return <details className="google-place-check"><summary>Check with Google Maps</summary><div className="google-check-body">
    <p>Compare a planned visit with reported opening hours. Travel time and ticket availability need separate checks.</p>
    {!temporarySelection && <label>Visit date for this check<input ref={dateInput} type="date" readOnly={!!visitDate} value={date} onInput={e=>{reset();setDate(e.currentTarget.value);}} onChange={e=>{reset();setDate(e.target.value);}} /></label>}
    <small>{temporarySelection ? `Checking ${visitDate}. Your trip dates stay unchanged.` : visitDate ? "From your current trip dates." : "This check won’t set your trip dates."}</small>
    <small>Using {start}, {minutes} minutes · {timezone}</small>
    <button type="button" disabled={busy} onClick={()=>void run(googleId)}>{busy?"Checking Google Maps…":googleId?"Refresh Google details":"Find the matching place"}</button>
    {googleId && <button type="button" disabled={busy} onClick={()=>{onResult?.(null);reset();onSelect(undefined);}}>Choose a different Google place</button>}
    {busy && <p role="status">Retrieving current place information…</p>}
    {error && <p role="alert">{error}</p>}
    {matches && <div><p className="google-maps-attribution">Google Maps</p><p role="status">{matches.length?"Confirm which place you mean.":"No nearby match was returned. Your existing activity is kept."}</p><ul className="google-matches">{matches.map(place=><li key={place.id}><strong>{place.name}</strong><span>{place.address}</span><a href={googleMapLink(place.id)} target="_blank" rel="noreferrer">View on Google Maps</a><button type="button" disabled={busy} onClick={()=>void run(place.id)}>Check this place</button></li>)}</ul></div>}
    {check && !temporarySelection && <section className="google-reported-details" aria-label="Reported Google Maps details"><p className="google-maps-attribution">Google Maps</p><h3>{check.place.name}</h3><p>{check.place.address}</p><p role="status"><strong>{labels[check.status] ?? "Check unavailable"}</strong><br />{check.explanation}</p><p>Reported price: {googlePrice(check)}<br /><small>This is not a confirmed admission fee or ticket quote.</small></p>{!!check.hours.length && <details><summary>{check.hours_basis==="current"?"Reported current hours":"Regular hours · indicative only"}</summary><ul>{check.hours.map((line,index)=><li key={index}>{line}</li>)}</ul></details>}<small>Retrieved {new Date(check.retrieved_at).toLocaleString()}. Details stay in this view. {temporarySelection ? "This selection stays in the day review. Use the activity editor to save a Google listing." : "Saving the activity keeps only the selected Google Place ID."}</small>{check.attributions.map((name,index)=><small key={index}>{name}</small>)}<a href={googleMapLink(check.place.id)} target="_blank" rel="noreferrer">Check the original listing</a></section>}
  </div></details>;
}
