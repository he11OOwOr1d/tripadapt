"use client";
import { useEffect, useRef, useState } from "react";
import type { Activity, Stop } from "../../lib/trips/adapter";
import { activitySearchAdapter, type ActivityPlace, type ActivitySearch } from "../../lib/trips/activity-search";
import PlaceAttribution from "./PlaceAttribution";

const categories: [ActivityPlace["category"], string][] = [["museum", "Museums"], ["gallery", "Galleries"], ["attraction", "Attractions"], ["park", "Parks"], ["viewpoint", "Viewpoints"]];

export default function ActivityLocationPicker({ activity, stop, onChoose, onRemove, startOpen = false }: {
  activity: Activity; stop: Stop | undefined; startOpen?: boolean;
  onChoose: (place: ActivityPlace) => void; onRemove: () => void;
}) {
  const [category, setCategory] = useState<ActivityPlace["category"]>("museum");
  const [page, setPage] = useState<ActivitySearch | null>(null);
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const disclosure = useRef<HTMLDetailsElement>(null);
  const abort = useRef<AbortController | null>(null);
  const request = useRef(0);
  useEffect(() => { if (startOpen && disclosure.current) disclosure.current.open = true; }, [startOpen]);
  useEffect(() => () => { request.current++; abort.current?.abort(); }, []);

  function clearSearch() {
    request.current++; abort.current?.abort(); setBusy(false); setPage(null); setError(""); setFilter("");
  }
  async function search() {
    if (busy || !stop?.location) return;
    const controller = new AbortController(); abort.current?.abort(); abort.current = controller;
    const current = ++request.current;
    setBusy(true); setPage(null); setError(""); setNotice(""); setFilter("");
    try {
      const result = await activitySearchAdapter.search(stop.location.reference_id, category, controller.signal);
      if (current === request.current) setPage(result);
    } catch (failure) {
      if (current === request.current && !controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Could not search. Your activity is unchanged.");
    } finally { if (current === request.current) setBusy(false); }
  }
  const results = page?.results.filter(p => p.name.toLocaleLowerCase().includes(filter.trim().toLocaleLowerCase())) ?? [];
  return <section className="activity-location" aria-label="Activity map location">
    <h3>Where will you be?</h3>
    {activity.place ? <div className="activity-location-selected"><span>Linked map location</span><strong>{activity.place.name}</strong><PlaceAttribution place={activity.place} /><button type="button" onClick={() => { onRemove(); setNotice("Map link removed from this edit. Save changes to keep it, or cancel to restore it."); }}>Remove map link</button></div> : <p>No map location linked. You can keep planning manually.</p>}
    <details ref={disclosure} className="activity-location-search">
      <summary>{activity.place ? "Change map location" : "Link a map location"}</summary>
      <p>Choose a mapped place near {stop?.name ?? "this destination"}. Your title, time, duration and protected flags stay as you set them. Nothing is saved until you save this activity.</p>
      {!stop?.location ? <p>Choose a destination map location through Explore nearby places in the day planner first. This edit is still available to save or cancel.</p> : <>
        <div className="activity-search-controls"><label>Place category<select value={category} onChange={e => { clearSearch(); setCategory(e.target.value as ActivityPlace["category"]); }}>{categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><button type="button" disabled={busy} onClick={() => void search()}>{busy ? "Searching places…" : "Find map locations"}</button></div>
        <small>Partial category search within 5 km of the destination centre. This is not a search of every address, restaurant or hotel.</small>
        {busy && <p role="status">Looking for mapped places. Your activity is unchanged.</p>}
        {error && <p role="alert">{error}</p>}
        {page && <>
          {page.notice && <p role="status">{page.notice}</p>}
          <p role="status">{page.results.length ? `${page.results.length} mapped places returned.` : "No places returned. Try another category or keep this activity without a map link."}</p>
          <small>{page.cached ? "Cached search" : "Live lookup"} · fetched {new Date(page.retrieved_at).toLocaleString()}. Hours and availability have not been checked.</small>
          {page.results.length > 0 && <label>Filter these results<input type="search" value={filter} onChange={e => setFilter(e.target.value)} placeholder="A name in the returned list" /></label>}
          {page.results.length > 0 && !results.length && <p>No returned names match this filter. Clear it or try another category.</p>}
          <ul className="activity-location-results">{results.map(place => <li key={place.id}><strong>{place.name}</strong><PlaceAttribution place={place} /><button type="button" disabled={place.destination_reference_id !== stop.location?.reference_id} onClick={() => {
            onChoose(place); clearSearch(); if (disclosure.current) { disclosure.current.open = false; disclosure.current.querySelector("summary")?.focus(); } setNotice(`Linked ${place.name} in this edit. Save changes to keep it, or cancel to restore the previous activity.`);
          }}>Link {place.name}</button></li>)}</ul>
        </>}
      </>}
    </details>
    {notice && <p role="status">{notice}</p>}
    <small>Linking a place makes no reservation and does not confirm hours, travel time or availability.</small>
  </section>;
}
