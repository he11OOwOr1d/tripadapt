"use client";
import { useEffect, useRef, useState } from "react";
import { activitySearchAdapter, type ActivityPlace, type ActivitySearch } from "../../lib/trips/activity-search";
import PlaceAttribution from "./PlaceAttribution";

export default function WeatherAlternatives({ reference, onChoose, selected, disabled, initialCategory }: {
  initialCategory?:"museum"|"gallery";
  reference: string;
  selected?: ActivityPlace;
  disabled: boolean;
  onChoose: (place: ActivityPlace | undefined) => void;
}) {
  const [category, setCategory] = useState<"museum" | "gallery">(initialCategory??"museum");
  const [page, setPage] = useState<ActivitySearch | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null), active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; controller.current?.abort(); }; }, []);
  async function search() {
    if (busy) return;
    const abort = new AbortController(); controller.current = abort;
    setBusy(true); setError(""); setPage(null); onChoose(undefined);
    try {
      const result = await activitySearchAdapter.search(reference, category, abort.signal);
      if (active.current) setPage(result);
    } catch (failure) {
      if (active.current && !abort.signal.aborted) setError(failure instanceof Error ? failure.message : "Places could not be retrieved. Your trip is unchanged.");
    } finally { if (active.current) setBusy(false); }
  }
  return <section className="weather-alternatives" aria-label="Replacement place choices">
    <p>Look for a museum or gallery in this destination. A map category doesn’t confirm indoor shelter, admission or suitability.</p>
    <label>Places to explore<select disabled={disabled || busy} value={category} onChange={e => { setCategory(e.target.value as "museum" | "gallery"); setPage(null); onChoose(undefined); setError(""); }}><option value="museum">Museums</option><option value="gallery">Galleries</option></select></label>
    <button type="button" disabled={disabled || busy} onClick={() => void search()}>{busy ? "Finding alternatives…" : "Find replacement places"}</button>
    {busy && <p role="status">Retrieving map records. Your activity stays in place.</p>}
    {error && <p role="alert">{error}</p>}
    {page && <><p>{page.notice || "Partial map coverage. Check whether the place meets your needs before choosing."}</p>
      {!page.results.length ? <p>No places found in this category. Try the other category, leave the time open or keep your original activity.</p> : <ul>{page.results.map(place => <li key={place.id}>
        <strong>{place.name}</strong><PlaceAttribution place={place}/>
        <button type="button" disabled={disabled} aria-label={`Choose ${place.name}`} aria-pressed={selected?.id === place.id} onClick={() => onChoose(place)}>{selected?.id === place.id ? "Selected" : "Choose this place"}</button>
      </li>)}</ul>}</>}
  </section>;
}
