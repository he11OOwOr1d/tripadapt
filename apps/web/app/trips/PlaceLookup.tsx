"use client";
import { useEffect, useRef, useState } from "react";
import { placeSearchAdapter, type PlaceResult, type PlaceSearch } from "../../lib/trips/place-search";

export default function PlaceLookup({ value, error, onChange, onSelect }: {
  value: string;
  error: boolean;
  onChange: (value: string) => void;
  onSelect: (place: PlaceResult) => void;
}) {
  const [page, setPage] = useState<PlaceSearch | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  const request = useRef(0);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => {
    request.current += 1;
    abort.current?.abort();
    setPage(null); setFailure(""); setBusy(false);
    return () => { request.current += 1; abort.current?.abort(); };
  }, [value]);
  async function search() {
    if (busy) return;
    const query = value.trim();
    if (query.length < 2) { setFailure("Enter at least two characters to search, or enter the place manually."); return; }
    if (query.length > 100) { setFailure("Use up to 100 characters when searching. Longer place names can be entered manually."); return; }
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    const id = ++request.current;
    setBusy(true); setFailure(""); setPage(null);
    try {
      const result = await placeSearchAdapter.search(query, controller.signal);
      if (id === request.current) setPage(result);
    } catch (problem) {
      if (id === request.current && !controller.signal.aborted) setFailure(problem instanceof Error ? problem.message : "Place search could not finish. Manual entry is available.");
    } finally { if (id === request.current) setBusy(false); }
  }
  return <div className="place-lookup">
    <label>Destination
      <input value={value} maxLength={300} aria-invalid={error} aria-describedby={error ? "place-error" : "place-help"} placeholder="e.g. Kyoto, Japan" onChange={e => onChange(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); void search(); } }} />
    </label>
    <button type="button" disabled={busy || value.trim().length < 2} onClick={() => void search()}>{busy ? "Searching places…" : "Search places"}</button>
    {busy && <p role="status">Looking up matching destinations…</p>}
    {failure && <p role="alert">{failure}</p>}
    {page && <div className="place-results">
      <p role="status">{page.results.length ? `${page.results.length} matches. Choose the place you mean.` : "No matching destinations. Try a city with its country, or enter it manually."}</p>
      <ul aria-label="Matching destinations">{page.results.map(place => <li key={place.id}><button type="button" onClick={() => { request.current += 1; abort.current?.abort(); setPage(null); setFailure(""); onSelect(place); }}><strong>{place.label}</strong><span>{place.timezone}</span></button></li>)}</ul>
      <small>Location data: <a href="https://open-meteo.com/en/docs/geocoding-api" target="_blank" rel="noreferrer">Open-Meteo</a> / <a href="https://www.geonames.org/" target="_blank" rel="noreferrer">GeoNames</a>. {page.cached ? "Cached lookup" : "Live lookup"}; fetched {new Date(page.retrieved_at).toLocaleString()}. Places are not availability or travel-time checks.</small>
    </div>}
  </div>;
}
