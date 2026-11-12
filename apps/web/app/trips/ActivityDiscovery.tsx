"use client";
import { useEffect, useRef, useState } from "react";
import type { Activity, Stop } from "../../lib/trips/adapter";
import { activitySearchAdapter, type ActivityPlace, type ActivitySearch } from "../../lib/trips/activity-search";
import PlaceLookup from "./PlaceLookup";
import type { PlaceResult } from "../../lib/trips/place-search";
import PlaceAttribution from "./PlaceAttribution";

const categories: [ActivityPlace["category"], string][] = [["museum", "Museums"], ["gallery", "Galleries"], ["attraction", "Attractions"], ["park", "Parks"], ["viewpoint", "Viewpoints"]];
export default function ActivityDiscovery({ stop, day, onChoose, onLocate }: { stop: Stop; day: number; onChoose: (activity: Activity) => void; onLocate: (place: PlaceResult) => void }) {
  const [locationText, setLocationText] = useState(stop.name);
  const [locationChoice, setLocationChoice] = useState<PlaceResult>();
  const [category, setCategory] = useState<ActivityPlace["category"]>("museum");
  const [page, setPage] = useState<ActivitySearch | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  const abort = useRef<AbortController | null>(null);
  const request = useRef(0);
  useEffect(() => () => { request.current++; abort.current?.abort(); }, []);
  function clear() { request.current++; abort.current?.abort(); setPage(null); setFailure(""); setBusy(false); }
  async function search() {
    if (busy || !stop.location) return;
    const controller = new AbortController();
    abort.current?.abort(); abort.current = controller;
    const id = ++request.current;
    setBusy(true); setFailure(""); setPage(null);
    try {
      const result = await activitySearchAdapter.search(stop.location.reference_id, category, controller.signal);
      if (id === request.current) setPage(result);
    } catch (error) {
      if (id === request.current && !controller.signal.aborted) setFailure(error instanceof Error ? error.message : "Search could not finish. Add an activity yourself or try later.");
    } finally { if (id === request.current) setBusy(false); }
  }
  return <details className="activity-discovery">
    <summary><span>Explore nearby places</span><small>A little research for {stop.name}</small></summary>
    {!stop.location ? <div className="activity-discovery-body"><p>Choose a map location for this destination to search nearby. Your manually entered route stays as it is.</p><p id="place-help">Search for your destination, then choose the matching location.</p><PlaceLookup value={locationText} error={false} onChange={value => { setLocationText(value); setLocationChoice(undefined); }} onSelect={choice => { setLocationText(choice.label); setLocationChoice(choice); }} />{locationChoice && <><p>Use {locationChoice.label}, {locationChoice.timezone}. Existing activities keep their local clock times; review them if the timezone changes.</p><button onClick={() => onLocate(locationChoice)}>Use this location for {stop.name}</button></>}</div> : <div className="activity-discovery-body">
      <p>Find places within 5 km of the selected destination centre. This is a partial map-data search, not a list of everything worth visiting.</p>
      <div className="activity-search-controls"><label>What pulls you?<select value={category} onChange={e => { clear(); setCategory(e.target.value as ActivityPlace["category"]); }}>{categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><button onClick={() => void search()} disabled={busy}>{busy ? "Searching nearby…" : "Search nearby places"}</button></div>
      {busy && <p role="status">Looking up mapped places around {stop.name}…</p>}
      {failure && <p role="alert">{failure}</p>}
      {page && <>{page.notice && <p role="status">{page.notice}</p>}<p role="status">{page.results.length ? `${page.results.length} places found. Choose one to set its day and time.` : "No matching places returned in this area. Try another category, or add an activity yourself. This does not mean there is nothing nearby."}</p><small>{page.cached ? "Cached search" : "Live lookup"} · fetched {new Date(page.retrieved_at).toLocaleString()}. No opening-hours or availability check.</small>
        <ul className="activity-discovery-results">{page.results.map(place => <li key={place.id}><div><h3>{place.name}</h3><span>{categories.find(([id]) => id === place.category)?.[1]} · mapped place</span></div><PlaceAttribution place={place} /><button onClick={() => onChoose({ id: crypto.randomUUID(), stopId: stop.id, day, title: place.name, kind: "custom", start: "10:00", minutes: 60, fixed: false, completed: false, booked: false, place })}>Set a time for this place</button></li>)}</ul>
        <p className="activity-discovery-credit">Data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors · ODbL</a>, via {page.source?.includes("Geoapify") ? <a href="https://www.geoapify.com/" target="_blank" rel="noreferrer">Geoapify</a> : "Overpass"}. Choosing a place makes no reservation.</p>
      </>}
    </div>}
  </details>;
}
