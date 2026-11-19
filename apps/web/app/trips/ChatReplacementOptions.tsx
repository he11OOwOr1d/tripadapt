"use client";
import { useEffect, useRef, useState } from "react";
import type { ConversationTurn } from "../../lib/trips/conversation";
import { chatReplacementAdapter, type ReplacementOptions } from "../../lib/trips/chat-replacements";
import { proposalAdapter } from "../../lib/trips/proposals";
import { weatherCondition } from "../../lib/trips/weather";
import PlaceAttribution from "./PlaceAttribution";

export default function ChatReplacementOptions({account,turn,exactDates,disabled,onReview,onClose}:{
  account:{id:string;versionEtag:string};turn:ConversationTurn;exactDates:boolean;disabled:boolean;onReview:(id:string)=>void;onClose:()=>void;
}) {
  const action=turn.weather_handoff!;
  const [date,setDate]=useState(action.visit_date??""),[category,setCategory]=useState(action.category);
  const [result,setResult]=useState<ReplacementOptions|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const [selected,setSelected]=useState(""),[prepared,setPrepared]=useState<string>();
  const controller=useRef<AbortController|null>(null),active=useRef(true),retry=useRef<{body:string;key:string}|null>(null);
  const heading=useRef<HTMLHeadingElement>(null);
  useEffect(()=>{active.current=true;heading.current?.focus({preventScroll:true});heading.current?.scrollIntoView({block:"nearest",behavior:"instant"});return()=>{active.current=false;controller.current?.abort();};},[]);
  function reset(){setResult(null);setSelected("");setPrepared(undefined);setError("");retry.current=null;}
  async function search(){
    if(!date||disabled||busy)return;
    reset();setBusy(true);const abort=new AbortController();controller.current=abort;
    try{const page=await chatReplacementAdapter.search(account,turn.id,action.activity_id,date,category,abort.signal);if(active.current)setResult(page);}
    catch(failure){if(active.current&&!abort.signal.aborted)setError(failure instanceof Error&&failure.name!=="TimeoutError"?failure.message:"The lookup took too long. Try again; your trip is unchanged.");}
    finally{if(active.current)setBusy(false);}
  }
  async function preview(){
    if(disabled||busy)return;
    if(prepared){onReview(prepared);return;}
    if(!result||!selected||result.forecast.status!=="forecast"||!result.options.some(o=>o.place.id===selected))return;
    const input={activity_id:action.activity_id,visit_date:date,intent:"replace_place" as const,replacement_place_id:selected};
    const body=JSON.stringify(input);if(retry.current?.body!==body)retry.current={body,key:crypto.randomUUID()};
    setBusy(true);setError("");const abort=new AbortController();controller.current=abort;
    try{const proposal=await proposalAdapter.weatherChange(account.id,account.versionEtag,input,retry.current.key,abort.signal);if(active.current){setPrepared(proposal.id);onReview(proposal.id);}}
    catch(failure){if(active.current&&!abort.signal.aborted)setError(failure instanceof Error&&failure.name!=="TimeoutError"?failure.message:"Could not prepare this preview. Try again to recover it; your trip is unchanged.");}
    finally{if(active.current)setBusy(false);}
  }
  const forecast=result?.forecast,day=forecast?.day;
  return <section className="chat-replacement" aria-label="Replacement research">
    <header><h3 ref={heading} tabIndex={-1}>A different place, the same time</h3><button type="button" onClick={onClose} aria-label="Close replacement research">×</button></header>
    <p>Check a date, then choose a retrieved place. Your itinerary stays unchanged until review and acceptance.</p>
    <fieldset disabled={disabled||busy}><label>Date to check<input type="date" readOnly={exactDates} value={date} onInput={e=>{setDate(e.currentTarget.value);reset();}} onChange={e=>{setDate(e.target.value);reset();}}/></label><small>{exactDates?"From your saved schedule.":"Check-only date; your flexible trip dates stay unchanged."}</small>
      <label>Places to explore<select value={category} onChange={e=>{setCategory(e.target.value as "museum"|"gallery");reset();}}><option value="museum">Museums</option><option value="gallery">Galleries</option></select></label>
      <button type="button" disabled={!date} onClick={()=>void search()}>{result?"Refresh options":"Look up replacement options"}</button>
    </fieldset>
    {busy&&<p role="status">{selected?"Preparing your review…":"Checking the forecast and nearby map records…"} Your trip is unchanged.</p>}
    {error&&<p role="alert">{error}</p>}
    {forecast&&forecast.status!=="forecast"&&<p role="status">{forecast.status==="outside_forecast_window"?`No forecast covers ${date}. The current window is ${forecast.horizon_start} to ${forecast.horizon_end}. Your trip length is unchanged.`:"Usable weather was not returned for this date. Try another date or use the planner manually."}</p>}
    {result&&day&&<>
      <section className="chat-outlook" aria-label="Forecast for replacement options"><h4>{weatherCondition(day.weather_code)}</h4><p>{date} · {forecast!.timezone}. Precipitation: {day.precipitation_mm===null?"not reported":`${day.precipitation_mm} mm`}; chance: {day.precipitation_probability_percent===null?"not reported":`${day.precipitation_probability_percent}%`}.</p><small><a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a> daily forecast · {forecast!.cached?"cached, ":""}retrieved {new Date(forecast!.retrieved_at!).toLocaleString()}. Exact activity-time conditions and indoor access are unconfirmed.</small></section>
      <p>Replace <strong>{result.target.label}</strong>. Keep {result.target.start} for {result.target.duration_minutes} minutes.</p>
      {result.notice&&<p role="status">{result.notice}</p>}
      {!result.options.length?<p>No distinct recent places were found in this lookup. Try the other category or keep your original activity.</p>:<><small>Showing {result.options.length} of {result.eligible_count} eligible map records. Partial coverage; distinct-name shortlist ordered by straight-line distance. Admission, shelter and travel feasibility are unconfirmed.</small>
        <ul>{result.options.map(option=><li key={option.place.id}><strong>{option.place.name}</strong><p>{option.distance_meters} m from {option.distance_basis==="activity_location"?"the activity’s map point":"the destination centre"} in a straight line.</p><PlaceAttribution place={option.place}/><button type="button" disabled={disabled||busy} aria-label={`Select ${option.place.name}`} aria-pressed={selected===option.place.id} onClick={()=>{setSelected(option.place.id);setPrepared(undefined);retry.current=null;setError("");}}>{selected===option.place.id?"Selected":"Select this place"}</button></li>)}</ul>
        <button type="button" disabled={disabled||busy||!selected} onClick={()=>void preview()}>{prepared?"Open saved preview":"Preview selected replacement"}</button>{prepared&&<small>Your saved review is kept. Refresh options to start another preview after discarding it.</small>}</>}
    </>}
  </section>;
}
