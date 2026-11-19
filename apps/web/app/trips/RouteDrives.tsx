"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Trip } from "../../lib/trips/adapter";
import { intercityEndpoints, intercityHeadline } from "../../lib/trips/intercity";
import { intercityAdapter, type IntercityCheck } from "../../lib/trips/journeys";
import { driveSummary, driveSummaryLine, estimable, routeJourneys } from "../../lib/trips/route-drives";

/** Driving estimates for every mapped journey on the route, one explicit lookup per journey. Nothing is saved or changed. */
export default function RouteDrives({ trip }: { trip: Trip }) {
  const journeys = useMemo(() => routeJourneys(trip), [trip]);
  const signature = JSON.stringify(journeys.map((j) => [j.key, j.from.end, j.to.end]));
  const [results, setResults] = useState<Record<string, IntercityCheck>>({});
  const [failed, setFailed] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const run = useRef(0);
  // A changed route makes every earlier result stale.
  useEffect(() => { run.current++; abort.current?.abort(); setResults({}); setFailed({}); setBusy(false); }, [signature]);
  useEffect(() => () => { run.current++; abort.current?.abort(); }, []);
  const ready = journeys.filter(estimable);
  if (!journeys.length) return null;
  const summary = driveSummary(journeys, results);

  async function all() {
    if (busy) return;
    const current = ++run.current, controller = new AbortController();
    abort.current?.abort(); abort.current = controller;
    setBusy(true); setResults({}); setFailed({});
    for (const j of ready) {
      if (current !== run.current) return;
      const ends = intercityEndpoints(j.from, j.to);
      if (!ends) continue;
      try {
        const value = await intercityAdapter.check(ends, controller.signal);
        if (current === run.current) setResults((r) => ({ ...r, [j.key]: value }));
      } catch (failure) {
        if (controller.signal.aborted || current !== run.current) return;
        setFailed((f) => ({ ...f, [j.key]: failure instanceof Error && failure.name !== "TimeoutError" ? failure.message : "Timed out; try again later." }));
      }
    }
    if (current === run.current) setBusy(false);
  }

  return <section className="route-drives" aria-label="Road time across your route">
    <h2>Road time across your route</h2>
    <p>A driving estimate for each journey between mapped places, one lookup each, only when you ask. It is not a timetable, a mode suggestion or a booking, and it changes nothing in your plan.</p>
    <ol>{journeys.map((j) => <li key={j.key}>
      <strong>{j.from.name} → {j.to.name}</strong>
      <span>{results[j.key] ? intercityHeadline(results[j.key]) : failed[j.key] ? `Could not estimate: ${failed[j.key]}` : estimable(j) ? (busy ? "Looking up…" : "Not estimated yet") : "Needs a map location at both ends"}</span>
    </li>)}</ol>
    <button type="button" disabled={busy || !ready.length} onClick={() => void all()}>{busy ? "Estimating the drives…" : ready.length ? `Estimate ${ready.length === 1 ? "the mapped journey" : `all ${ready.length} mapped journeys`}` : "No journey has both ends on the map"}</button>
    {summary.checked > 0 && <p role="status"><strong>{driveSummaryLine(summary)}</strong></p>}
    {summary.checked > 0 && <><p className="provider-attribution">Route data: Powered by Geoapify · © OpenStreetMap contributors</p><small>Straight driving between place centres, without live traffic or breaks. Unmapped journeys are not counted. The map points of each pair of places are sent to the route provider, Geoapify, to compute these.</small></>}
  </section>;
}
