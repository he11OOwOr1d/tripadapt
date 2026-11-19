"use client";
import { useEffect, useRef, useState } from "react";
import { HOURS_ATTRIBUTION, placeHoursAdapter, type HoursCheck } from "../../lib/trips/place-hours";

const labels: Record<string,string>={date_needed:"A visit date is needed",outside_coverage:"Choose a current date",hours_unknown:"Hours unavailable",fits_reported_hours:"Fits the regular hours",outside_reported_hours:"Choose another time"};
export default function PlaceHoursCheck({ sourceId, visitDate, start, minutes, timezone, onResult, temporarySelection = false }: {sourceId:string;visitDate:string|null;start:string;minutes:number;timezone:string;onResult?:(check:HoursCheck|null)=>void;temporarySelection?:boolean}) {
  const [date,setDate]=useState(visitDate ?? "");
  const [check,setCheck]=useState<HoursCheck|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const dateInput=useRef<HTMLInputElement>(null);
  const controller=useRef<AbortController|null>(null);
  const request=useRef(0);
  function reset() {request.current++;controller.current?.abort();setCheck(null);setBusy(false);setError("");}
  useEffect(()=>{setDate(visitDate ?? "");reset();},[visitDate]);
  useEffect(()=>{reset();},[start,minutes,sourceId]);
  useEffect(()=>()=>{request.current++;controller.current?.abort();},[]);
  async function run() {
    const chosenDate=dateInput.current?.value ?? date;
    setDate(chosenDate);
    controller.current?.abort();const abort=new AbortController();controller.current=abort;const id=++request.current;
    setBusy(true);setError("");setCheck(null);onResult?.(null);
    try {
      const result=await placeHoursAdapter.check(sourceId,chosenDate,start,minutes,abort.signal);
      if(id===request.current){setCheck(result);onResult?.(result);}
    } catch(failure) {
      if(id===request.current && !abort.signal.aborted)setError(failure instanceof Error && failure.name!=="TimeoutError" ? failure.message : "The place-data service could not respond in time. Your activity is kept; try again later.");
    } finally {if(id===request.current)setBusy(false);}
  }
  return <details className="place-hours-check"><summary>Check opening hours</summary><div className="check-body">
    <p>Compare a planned visit with the regular opening hours listed for this place. Travel time and ticket availability need separate checks.</p>
    {!temporarySelection && <label>Visit date for this check<input ref={dateInput} type="date" readOnly={!!visitDate} value={date} onInput={e=>{reset();setDate(e.currentTarget.value);}} onChange={e=>{reset();setDate(e.target.value);}} /></label>}
    <small>{temporarySelection ? `Checking ${visitDate}. Your trip dates stay unchanged.` : visitDate ? "From your current trip dates." : "This check won’t set your trip dates."}</small>
    <small>Using {start}, {minutes} minutes · {timezone}</small>
    <button type="button" disabled={busy} onClick={()=>void run()}>{busy?"Checking hours…":check?"Check again":"Check opening hours"}</button>
    {busy && <p role="status">Retrieving the place’s listed hours…</p>}
    {error && <p role="alert">{error}</p>}
    {check && !temporarySelection && <section className="reported-details" aria-label="Opening-hours result"><p className="provider-attribution">{HOURS_ATTRIBUTION}</p><h3>{check.place_name}</h3><p role="status"><strong>{labels[check.status] ?? "Check unavailable"}</strong><br />{check.explanation}</p>{!!check.hours.length && <details><summary>Regular hours as listed · unverified</summary><ul>{check.hours.map((line,index)=><li key={index}>{line}</li>)}</ul></details>}<small>Retrieved {new Date(check.retrieved_at).toLocaleString()}. Details stay in this view; nothing about this check is saved. Hours can be missing or out of date, and this does not confirm tickets or entry.</small></section>}
  </div></details>;
}
