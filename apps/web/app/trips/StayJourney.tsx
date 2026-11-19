"use client";
import { useEffect, useRef, useState } from "react";
import type { Activity } from "../../lib/trips/adapter";
import type { Lodging } from "../../lib/trips/lodging";
import { stayJourneyAdapter, type StayJourneyCheck } from "../../lib/trips/journeys";
import { firstVisit, stayJourneyHeadline, stayLegReady } from "../../lib/trips/stay-journey";

/** One transient route estimate from the recorded stay to the day's first visit. Nothing is saved or changed. */
export default function StayJourney({ lodging, activities }: { lodging?: Lodging | null; activities: Activity[] }) {
  const visit = firstVisit(activities);
  const [mode, setMode] = useState<"WALK" | "DRIVE">("WALK");
  const [buffer, setBuffer] = useState("10");
  const [result, setResult] = useState<StayJourneyCheck | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const abort = useRef<AbortController | null>(null);
  const request = useRef(0);
  useEffect(() => () => { request.current++; abort.current?.abort(); }, []);
  function reset() { request.current++; abort.current?.abort(); setResult(null); setBusy(false); setError(""); }
  if (!lodging || !visit) return null;
  const ready = stayLegReady(lodging, visit);
  const validBuffer = /^\d+$/.test(buffer) && Number(buffer) <= 120;
  async function check() {
    if (!ready || !validBuffer || !visit?.place || lodging?.latitude == null || lodging.longitude == null) return;
    reset();
    const current = ++request.current, controller = new AbortController(); abort.current = controller;
    setBusy(true);
    try {
      const value = await stayJourneyAdapter.check({ latitude: lodging.latitude, longitude: lodging.longitude, destination_place_id: visit.place.id, mode, destination_start: visit.start, buffer_minutes: Number(buffer) }, controller.signal);
      if (current === request.current) setResult(value);
    } catch (failure) {
      if (current === request.current && !controller.signal.aborted) setError(failure instanceof Error && failure.name !== "TimeoutError" ? failure.message : "The check timed out. Your plan is unchanged; try again later.");
    } finally { if (current === request.current) setBusy(false); }
  }
  return <details className="stay-journey">
    <summary>Getting from your stay to {visit.title}</summary>
    <div className="stay-journey-body">
      {!ready ? <p>{lodging.latitude == null ? "Your stay needs a map location. Edit it and use “Find stays nearby”." : `${visit.title} needs a mapped place. We won’t guess locations from names.`}</p> : <>
        <div className="journey-controls">
          <label>How you’ll go<select value={mode} onChange={(e) => { reset(); setMode(e.target.value as "WALK" | "DRIVE"); }}><option value="WALK">Walk</option><option value="DRIVE">Drive · without live traffic</option></select></label>
          <label>Arrival buffer (minutes)<input type="number" min={0} max={120} value={buffer} onChange={(e) => { reset(); setBuffer(e.target.value); }} /></label>
        </div>
        {!validBuffer && <p role="alert">Choose an arrival buffer from 0 to 120 minutes.</p>}
        <button type="button" disabled={busy || !validBuffer} onClick={() => void check()}>{busy ? "Checking the journey…" : "Check from my stay"}</button>
        {busy && <p role="status">Looking up a route estimate. Your plan stays unchanged.</p>}
        {error && <p role="alert">{error}</p>}
        {result && <section className="journey-result" aria-label="Journey from your stay">
          <p className="provider-attribution">Route data: Powered by Geoapify · © OpenStreetMap contributors</p>
          <h4>{stayJourneyHeadline(result, visit.title, visit.start)}</h4>
          <p role="status">{result.travel_minutes} min {result.mode === "WALK" ? "walking" : "driving"} + {result.buffer_minutes} min arrival buffer · {(result.distance_meters / 1000).toFixed(1)} km</p>
          {result.warnings.map((w, i) => <p key={i}>{w}</p>)}
          <small>Checked {new Date(result.retrieved_at).toLocaleString()}. Estimate only; no live traffic, parking, tickets or accessibility check. Walking routes may miss sidewalks or pedestrian paths.</small>
        </section>}
      </>}
    </div>
  </details>;
}
