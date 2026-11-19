"use client";
import { useEffect, useRef, useState } from "react";
import { intercityAdapter, type IntercityCheck } from "../../lib/trips/journeys";
import { hoursFromMinutes, intercityEndpoints, intercityHeadline, type JourneyPlace } from "../../lib/trips/intercity";

/** A transient driving estimate between two mapped destinations. It is not a timetable, a mode choice or a booking. */
export default function IntercityEstimate({ from, to, currentHours = "", onUse, disabled = false }: { from?: JourneyPlace; to?: JourneyPlace; currentHours?: string; onUse?: (hours: string) => void; disabled?: boolean }) {
  const ends = intercityEndpoints(from, to);
  const [result, setResult] = useState<IntercityCheck | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const abort = useRef<AbortController | null>(null);
  const request = useRef(0);
  useEffect(() => () => { request.current++; abort.current?.abort(); }, []);
  if (!ends || !from || !to) return null;
  async function run() {
    if (!ends || busy) return;
    request.current++; abort.current?.abort();
    const current = request.current, controller = new AbortController(); abort.current = controller;
    setBusy(true); setError(""); setResult(null);
    try {
      const value = await intercityAdapter.check(ends, controller.signal);
      if (current === request.current) setResult(value);
    } catch (failure) {
      if (current === request.current && !controller.signal.aborted) setError(failure instanceof Error && failure.name !== "TimeoutError" ? failure.message : "The estimate timed out. Your plan is unchanged; try again later.");
    } finally { if (current === request.current) setBusy(false); }
  }
  return <div className="intercity-estimate">
    <button type="button" disabled={busy} onClick={() => void run()}>{busy ? "Estimating the drive…" : `Estimate the drive from ${from.name} to ${to.name}`}</button>
    {error && <p role="alert">{error}</p>}
    {result && <div role="status"><p className="provider-attribution">Route data: Powered by Geoapify · © OpenStreetMap contributors</p><p><strong>{intercityHeadline(result)}</strong></p>{result.warnings.map((w, i) => <p key={i}>{w}</p>)}{onUse && (() => { const hours = hoursFromMinutes(result.travel_minutes); return hours === currentHours ? <p>Your own travel time already says {hours} hours.</p> : <button type="button" disabled={disabled} onClick={() => onUse(hours)}>{currentHours ? `Replace my ${currentHours} hours with ${hours} hours` : `Use ${hours} hours as my travel time`}</button>; })()}<small>Checked {new Date(result.retrieved_at).toLocaleString()}. A driving estimate between the two places, without live traffic. It is not a train, bus or flight schedule, and it changes nothing unless you choose to use it as your own travel time. To compute it, the map points of the two places are sent to the route provider, Geoapify.</small></div>}
  </div>;
}
