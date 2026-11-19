"use client";
import { useEffect, useRef, useState } from "react";
import { googlePlacesAdapter, googleMapLink, type GoogleMatch } from "../../lib/trips/google-places";

export default function GoogleMatchSearch({ sourceId, onChoose, disabled = false, buttonLabel = "Choose matching listing", selectionLabel = "Use this listing", inputLabel = "Place name or address", clearOnChoose = true }: {
  sourceId: string; onChoose: (match: GoogleMatch) => void; disabled?: boolean;
  buttonLabel?: string; selectionLabel?: string; inputLabel?: string; clearOnChoose?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<GoogleMatch[] | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null), abort = useRef<AbortController | null>(null), request = useRef(0);
  useEffect(() => () => { request.current++; abort.current?.abort(); }, []);
  useEffect(() => { if (disabled) { request.current++; abort.current?.abort(); setBusy(false); } }, [disabled]);
  function change(value: string) {
    request.current++; abort.current?.abort(); setQuery(value); setMatches(null); setError(""); setBusy(false);
  }
  async function find() {
    if (busy || disabled) return;
    const text = (input.current?.value ?? query).trim();
    if (text && (text.length < 2 || text.length > 160 || /[\u0000-\u001f\u007f]/.test(text))) {
      setError("Use a single-line venue name or address from 2 to 160 characters."); return;
    }
    setQuery(text); setError(""); setMatches(null); setBusy(true);
    abort.current?.abort(); const controller = new AbortController(); abort.current = controller;
    const current = ++request.current;
    try {
      const results = await googlePlacesAdapter.matches(sourceId, controller.signal, text || undefined);
      if (current === request.current) setMatches(results);
    } catch (failure) {
      if (current === request.current && !controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Could not find a matching listing. Your selection is kept.");
    } finally { if (current === request.current) setBusy(false); }
  }
  return <div className="google-match-search">
    <details><summary>Try another name or address</summary><label>{inputLabel}<input ref={input} type="text" autoComplete="off" maxLength={160} value={query} disabled={disabled} onChange={e => change(e.target.value)} placeholder="Venue name or street address" onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); void find(); } }} /></label><small>This search is sent to Google Maps with the destination name. Choosing a result is always up to you.</small></details>
    <button type="button" disabled={disabled || busy} onClick={() => void find()}>{busy ? "Finding listings…" : query.trim() ? "Search this name or address" : buttonLabel}</button>
    {busy && <p role="status">Looking for nearby Google listings. Your activity is unchanged.</p>}
    {error && <p role="alert">{error}</p>}
    {matches && <><p className="google-maps-attribution">Google Maps</p><p role="status">{matches.length ? `${matches.length} nearby ${matches.length === 1 ? "listing" : "listings"}. Confirm the name, address and map location.` : "No nearby match found. Try another name or address. If the venue moved, update its map link in the activity editor."}</p><ul className="google-matches">{matches.map(match => <li key={match.id}><strong>{match.name}</strong><span>{match.address}</span>{typeof match.distance_meters === "number" && Number.isFinite(match.distance_meters) && match.distance_meters >= 0 && match.distance_meters <= 1000 && <small>About {match.distance_meters} m from the linked map point · straight line</small>}<a href={googleMapLink(match.id)} target="_blank" rel="noreferrer">View listing</a><button type="button" disabled={disabled || busy} onClick={() => { onChoose(match); if (clearOnChoose) setMatches(null); }}>{selectionLabel}</button></li>)}</ul></>}
    <small>Only matches within 1 km of the linked map location are offered. This does not confirm venue identity, opening hours or access.</small>
  </div>;
}
