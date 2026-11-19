"use client";
import { useEffect, useRef, useState } from "react";
import type { Activity } from "../../lib/trips/adapter";
import type { Lodging } from "../../lib/trips/lodging";
import { stayJourneyAdapter, stayReturnAdapter, type StayJourneyCheck, type StayReturnCheck } from "../../lib/trips/journeys";
import { firstVisit, lastVisit, stayJourneyHeadline, stayLegReady, stayReturnHeadline, stayTimingNote, visitEnd } from "../../lib/trips/stay-journey";

type Leg = "out" | "back";

/** Transient route estimates between the recorded stay and the day's first and last visits. Nothing is saved or changed. */
export default function StayJourney({ lodging, activities, firstDay = false, lastDay = false }: { lodging?: Lodging | null; activities: Activity[]; firstDay?: boolean; lastDay?: boolean }) {
  const first = firstVisit(activities), last = lastVisit(activities);
  const [mode, setMode] = useState<"WALK" | "DRIVE">("WALK");
  const [buffer, setBuffer] = useState("10");
  const [out, setOut] = useState<StayJourneyCheck | null>(null);
  const [back, setBack] = useState<StayReturnCheck | null>(null);
  const [busy, setBusy] = useState<Leg | null>(null);
  const [error, setError] = useState("");
  const abort = useRef<AbortController | null>(null);
  const request = useRef(0);
  useEffect(() => () => { request.current++; abort.current?.abort(); }, []);
  function reset() { request.current++; abort.current?.abort(); setOut(null); setBack(null); setBusy(null); setError(""); }
  if (!lodging || !first || !last) return null;
  const hasStay = lodging.latitude != null && lodging.longitude != null;
  const outReady = stayLegReady(lodging, first), backReady = stayLegReady(lodging, last);
  const endTime = visitEnd(last);
  const outNote = stayTimingNote(lodging, "out", first, firstDay, lastDay), backNote = stayTimingNote(lodging, "back", last, firstDay, lastDay);
  const validBuffer = /^\d+$/.test(buffer) && Number(buffer) <= 120;

  async function run<T>(leg: Leg, call: (signal: AbortSignal) => Promise<T>, done: (value: T) => void) {
    request.current++; abort.current?.abort(); setError(""); if (leg === "out") setOut(null); else setBack(null);
    const current = ++request.current, controller = new AbortController(); abort.current = controller;
    setBusy(leg);
    try {
      const value = await call(controller.signal);
      if (current === request.current) done(value);
    } catch (failure) {
      if (current === request.current && !controller.signal.aborted) setError(failure instanceof Error && failure.name !== "TimeoutError" ? failure.message : "The check timed out. Your plan is unchanged; try again later.");
    } finally { if (current === request.current) setBusy(null); }
  }
  const checkOut = () => { if (!outReady || !validBuffer || !first.place || lodging.latitude == null || lodging.longitude == null) return; const { latitude, longitude } = lodging; const place = first.place.id; void run("out", (signal) => stayJourneyAdapter.check({ latitude, longitude, destination_place_id: place, mode, destination_start: first.start, buffer_minutes: Number(buffer) }, signal), setOut); };
  const checkBack = () => { if (!backReady || !endTime || !last.place || lodging.latitude == null || lodging.longitude == null) return; const { latitude, longitude } = lodging; const place = last.place.id; void run("back", (signal) => stayReturnAdapter.check({ latitude, longitude, origin_place_id: place, mode, origin_end: endTime }, signal), setBack); };
  const credit = <p className="provider-attribution">Route data: Powered by Geoapify · © OpenStreetMap contributors</p>;
  const fineprint = (at: string) => <small>Checked {new Date(at).toLocaleString()}. Estimate only; no live traffic, parking, tickets or accessibility check. Walking routes may miss sidewalks or pedestrian paths. To compute it, the map point of your stay and of the visit is sent to the route provider, Geoapify.</small>;

  return <details className="stay-journey">
    <summary>Getting between your stay and your visits</summary>
    <div className="stay-journey-body">
      {!hasStay ? <p>Your stay needs a map location. Edit it and use “Find stays nearby”.</p> : <>
        <div className="journey-controls">
          <label>How you’ll go<select value={mode} onChange={(e) => { reset(); setMode(e.target.value as "WALK" | "DRIVE"); }}><option value="WALK">Walk</option><option value="DRIVE">Drive · without live traffic</option></select></label>
          <label>Arrival buffer for the first visit (minutes)<input type="number" min={0} max={120} value={buffer} onChange={(e) => { reset(); setBuffer(e.target.value); }} /></label>
        </div>
        {!validBuffer && <p role="alert">Choose an arrival buffer from 0 to 120 minutes.</p>}
        <h4>To {first.title}</h4>
        {outNote && <p role="note">{outNote}</p>}
        {!outReady ? <p>{first.title} needs a mapped place. We won’t guess locations from names.</p> : <button type="button" disabled={busy !== null || !validBuffer} onClick={checkOut}>{busy === "out" ? "Checking the journey…" : "Check from my stay"}</button>}
        {out && <section className="journey-result" aria-label="Journey from your stay">{credit}<h4>{stayJourneyHeadline(out, first.title, first.start)}</h4><p role="status">{out.travel_minutes} min {out.mode === "WALK" ? "walking" : "driving"} + {out.buffer_minutes} min arrival buffer · {(out.distance_meters / 1000).toFixed(1)} km</p>{out.warnings.map((w, i) => <p key={i}>{w}</p>)}{fineprint(out.retrieved_at)}</section>}
        <h4>Back from {last.title}</h4>
        {backNote && <p role="note">{backNote}</p>}
        {!backReady ? <p>{last.title} needs a mapped place. We won’t guess locations from names.</p> : !endTime ? <p>{last.title} runs past midnight. Split it into day blocks to check the way back.</p> : <button type="button" disabled={busy !== null} onClick={checkBack}>{busy === "back" ? "Checking the journey…" : "Check the way back"}</button>}
        {back && endTime && <section className="journey-result" aria-label="Journey back to your stay">{credit}<h4>{stayReturnHeadline(back, last.title, endTime)}</h4><p role="status">{back.travel_minutes} min {back.mode === "WALK" ? "walking" : "driving"} · {(back.distance_meters / 1000).toFixed(1)} km</p>{back.warnings.map((w, i) => <p key={i}>{w}</p>)}{fineprint(back.retrieved_at)}</section>}
        {busy && <p role="status">Looking up a route estimate. Your plan stays unchanged.</p>}
        {error && <p role="alert">{error}</p>}
      </>}
    </div>
  </details>;
}
