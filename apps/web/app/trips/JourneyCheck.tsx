"use client";
import { useEffect, useRef, useState } from "react";
import { clock, clockMinutes } from "../../lib/trips/itinerary";
import type { Activity } from "../../lib/trips/adapter";
import TimeChangeReview, { type TimeChangeAccount } from "./TimeChangeReview";
import AdjustmentChecks from "./AdjustmentChecks";
import DayOpeningHours from "./DayOpeningHours";
import { dayHours } from "../../lib/trips/day-hours";
import type { GoogleCheck } from "../../lib/trips/google-places";
import { timingAdjustment } from "../../lib/trips/timing-adjustment";
import { dayFeasibility } from "../../lib/trips/day-feasibility";
import { journeyAdapter, type JourneyCheck as Result } from "../../lib/trips/journeys";

export default function JourneyCheck({ activities, onEdit, visitDate, timezone, timeChangeReview }: {timeChangeReview?:TimeChangeAccount; activities: Activity[]; visitDate: string | null; timezone: string; onEdit: (activity: Activity) => void }) {
  const [hoursDate, setHoursDate] = useState(visitDate ?? "");
  const [hours, setHours] = useState<Record<string, GoogleCheck>>({});
  const hoursReview = dayHours(activities, hours);
  function recordHours(id: string, value: GoogleCheck | null) { setHours(previous => { if (!value && !previous[id]) return previous; const next = { ...previous }; if(value) next[id] = value; else delete next[id]; return next; }); }
  const [pair, setPair] = useState("0");
  const [mode, setMode] = useState<"WALK" | "DRIVE">("WALK");
  const [buffer, setBuffer] = useState("10");
  const [results, setResults] = useState<Record<string, Result>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  const request = useRef(0);
  useEffect(() => () => { request.current++; controller.current?.abort(); }, []);
  function reset(clear = true) { request.current++; controller.current?.abort(); if (clear) setResults({}); setBusy(false); setError(""); }
  const review = dayFeasibility(activities, results, mode, Number(buffer));
  const { pairs } = review;
  const selected = pairs[Number(pair)];
  const result = selected?.result;
  const adjustment = selected && result && result.spare_minutes < 0 ? timingAdjustment(activities, selected.from, selected.to, result) : null;
  const mapped = !!selected?.from.place && !!selected?.to.place;
  const validBuffer = /^\d+$/.test(buffer) && Number(buffer) <= 120;
  async function check() {
    if (!selected?.from.place || !selected.to.place || !validBuffer) return;
    reset(false); const id = ++request.current;
    const key = selected.key;
    setResults(previous => { const next = { ...previous }; delete next[key]; return next; });
    const abort = new AbortController(); controller.current = abort; setBusy(true);
    try {
      const value = await journeyAdapter.check({ origin_place_id: selected.from.place.id, destination_place_id: selected.to.place.id, mode, origin_start: selected.from.start, origin_minutes: selected.from.minutes, destination_start: selected.to.start, buffer_minutes: Number(buffer) }, abort.signal);
      if (id === request.current) setResults(previous => ({ ...previous, [key]: value }));
    } catch (failure) {
      if (id === request.current && !abort.signal.aborted) setError(failure instanceof Error && failure.name !== "TimeoutError" ? failure.message : "The journey check timed out. Your schedule is unchanged; try again later.");
    } finally { if (id === request.current) setBusy(false); }
  }
  return <details className="journey-check"><summary>Check this day’s timing</summary><div className="journey-check-body">
    <header className="day-feasibility-summary"><h2>{review.conflicts.length || review.overnight.length || review.shortfalls || hoursReview.conflicts ? "Some timings need attention" : review.missing || review.unchecked || hoursReview.unknown ? "A few checks still open" : !activities.length ? "A day still open" : !pairs.length && !hoursReview.items.length ? "No journeys or venue visits to compare" : review.warnings ? "Access warnings to review" : "Checked timings fit the available evidence"}</h2><p>Journeys: {review.checked} of {pairs.length} checked.<br />Opening hours: {hoursReview.fits} of {hoursReview.items.length} visits fit reported hours.</p><small>Tickets, accessibility, live traffic, weather and intercity transfers remain separate checks.</small></header>
    <h3>Time to get there</h3>
    <section className="day-feasibility" aria-label="Day timing review">
      <h3>{review.title}</h3>
      <p role="status">{pairs.length ? `${review.checked} of ${pairs.length} journeys checked${review.missing ? `; ${review.missing} need mapped locations` : ""}.` : "Your activities stay as you planned them."}</p>
      {!!review.conflicts.length && <ul className="day-timing-issues">{review.conflicts.map(issue => <li key={`${issue.from.id}:${issue.to.id}`}><strong>{issue.from.title} overlaps {issue.to.title}</strong><span>{issue.minutes} minutes together. Choose which timing to adjust.</span><button type="button" onClick={() => onEdit(issue.to)}>Edit {issue.to.title}</button></li>)}</ul>}
      {!!review.overnight.length && <ul className="day-timing-issues">{review.overnight.map(item => <li key={item.id}><span>{item.title} ends after midnight. Split it into day blocks.</span><button type="button" onClick={() => onEdit(item)}>Edit {item.title}</button></li>)}</ul>}
      {!!pairs.length && <ol className="day-journey-review">{pairs.map((item, index) => <li key={item.key} data-state={item.state} aria-current={String(index) === pair ? "step" : undefined}><div><strong>{item.from.title} → {item.to.title}</strong><span>{item.state === "missing_location" ? "Locations needed · journey unknown" : item.state === "unchecked" ? "Journey not checked" : item.state === "shortfall" ? `${Math.ceil(-item.result!.spare_minutes)} min short · Google Maps estimate` : item.state === "warning" ? "Fits estimate · route warning" : "Fits Google Maps estimate"}</span></div><button type="button" aria-label={`Review journey from ${item.from.title} to ${item.to.title}`} onClick={() => { reset(false); setPair(String(index)); }}>{item.state === "missing_location" ? "See why" : item.result ? "Review" : "Choose"}</button></li>)}</ol>}
      <small>Journey estimates don’t confirm venue access, opening hours or tickets.</small>
    </section>
    {!pairs.length ? <p>Add two activities to this day to compare their timing. Choose mapped places through Explore nearby places.</p> : <>
      <p><strong>Selected journey</strong><br />{selected?.from.title} → {selected?.to.title}</p>
      {selected && <p className="journey-window">Leave {selected.from.title} after {clock(clockMinutes(selected.from.start) + selected.from.minutes)}.<br />Be at {selected.to.title} by {selected.to.start}.</p>}
      {!mapped && <p>Both activities need a mapped place. Edit them or add places through Explore nearby places. We won’t guess locations from their names.</p>}
      <div className="journey-controls"><label>How you’ll go<select value={mode} onChange={e => { reset(); setMode(e.target.value as "WALK" | "DRIVE"); }}><option value="WALK">Walk</option><option value="DRIVE">Drive · without live traffic</option></select></label><label>Arrival buffer (minutes)<input type="number" min={0} max={120} value={buffer} onChange={e => { reset(); setBuffer(e.target.value); }} /></label></div>
      {!validBuffer && <p role="alert">Choose an arrival buffer from 0 to 120 minutes.</p>}
      <button type="button" disabled={busy || !mapped || !validBuffer} onClick={() => void check()}>{busy ? "Checking the journey…" : "Check journey with Google Maps"}</button>
      {busy && <p role="status">Looking up a route estimate. Your schedule stays unchanged.</p>}
      {error && <p role="alert">{error}</p>}
      {result && <section className="journey-result" aria-label="Google Maps journey estimate"><p className="google-maps-attribution">Google Maps</p><h3>{result.status === "shortfall" ? `${Math.ceil(-result.spare_minutes)} more ${Math.ceil(-result.spare_minutes) === 1 ? "minute" : "minutes"} needed` : `${Math.floor(result.spare_minutes)} ${Math.floor(result.spare_minutes) === 1 ? "minute" : "minutes"} to spare`}</h3><p role="status">{result.travel_minutes} min {result.mode === "WALK" ? "walking" : "driving"} + {result.buffer_minutes} min arrival buffer<br />{result.gap_minutes >= 0 ? `${result.gap_minutes} min between activities` : `Activities overlap by ${-result.gap_minutes} min`} · {(result.distance_meters / 1000).toFixed(1)} km</p><p>{result.status === "shortfall" ? "Try another mode, move the next activity later, or shorten the earlier one. Edit your plan when you’re ready." : "This pair fits the estimate. It doesn’t confirm the rest of your day."}</p>{result.warnings.map((warning, i) => <p key={i}>{warning}</p>)}<small>Checked {new Date(result.retrieved_at).toLocaleString()}. Estimate only; no live traffic, departure-date prediction, parking, tickets or accessibility check. Walking routes may miss sidewalks or pedestrian paths. Follow local signs and conditions.</small></section>}
    </>}
    {!!selected && !mapped && <button type="button" onClick={() => onEdit(!selected.from.place ? selected.from : selected.to)}>Edit the activity without a location</button>}
    {adjustment && selected && <section className="timing-adjustment" aria-label="Suggested timing adjustment"><h3>A little more room to arrive</h3>{adjustment.available === true ? <><p><strong>{selected.to.title}</strong><br />{adjustment.before} → {adjustment.after} start · ends {adjustment.end}</p><p>Start {adjustment.shift} minutes later, using this journey estimate and your arrival buffer. Duration and every other activity stay the same.</p><p>Opening hours at this new time and the following journey need fresh checks. Road-access warnings still apply. This is not a reservation change.</p><AdjustmentChecks key={`${selected.to.id}:${adjustment.after}:${mode}:${buffer}:${hoursDate}:${hours[selected.to.id]?.place.id ?? selected.to.googlePlaceId ?? "unmatched"}`} activity={adjustment.activity} next={review.ordered[review.ordered.findIndex(a=>a.id===selected.to.id)+1]} visitDate={visitDate} initialDate={hoursDate} timezone={timezone} googleId={hours[selected.to.id]?.place.id} mode={mode} buffer={Number(buffer)} />{timeChangeReview && <TimeChangeReview key={`${adjustment.activity.id}:${adjustment.after}:${timeChangeReview.account.versionEtag}`} activity={adjustment.activity} review={timeChangeReview} />}<button type="button" onClick={() => onEdit(adjustment.activity)}>Review time change in editor</button><small>Your plan stays unchanged until you save in the editor. Cancel keeps the current time.</small></> : <p role="status">{adjustment.reason}</p>}<button type="button" onClick={() => onEdit(selected.to)}>Review current activity</button></section>}
    <div className="day-hours-section"><label>Visit date for opening-hours checks<input type="date" readOnly={!!visitDate} value={hoursDate} onInput={e=>{setHours({});setHoursDate(e.currentTarget.value);}} onChange={e=>{setHours({});setHoursDate(e.currentTarget.value);}} /></label><small>{visitDate ? "From your provisional trip dates; confirm arrival dates separately." : "For checking only. This won’t set your trip dates."}</small><DayOpeningHours activities={activities} date={hoursDate} timezone={timezone} results={hours} onResult={recordHours} onEdit={onEdit} /></div>
    <small>Checks stay in this view and aren’t saved or sent to the AI. No bookings or automatic time changes.</small>
  </div></details>;
}
