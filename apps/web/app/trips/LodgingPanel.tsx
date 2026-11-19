"use client";
import { useEffect, useRef, useState } from "react";
import type { CostRecord, Stop } from "../../lib/trips/adapter";
import { activitySearchAdapter, type ActivityPlace, type ActivitySearch } from "../../lib/trips/activity-search";
import { LODGING_ADDRESS_MAX, LODGING_NAME_MAX, isLodging, lodgingFromPlace, lodgingSummary, stayCostLines, bookedNightsNote, type Lodging } from "../../lib/trips/lodging";
import PlaceAttribution from "./PlaceAttribution";

type Draft = { name: string; address: string; check_in: string; check_out: string; booked: boolean; booked_nights: string; place?: ActivityPlace };

const fromLodging = (l?: Lodging | null): Draft => ({ name: l?.name ?? "", address: l?.address ?? "", check_in: l?.check_in ?? "", check_out: l?.check_out ?? "", booked: l?.booked === true, booked_nights: l?.booked_nights ? String(l.booked_nights) : "" });

/** Where the traveler sleeps in this destination. Their record, never a booking or a price. */
export default function LodgingPanel({ stop, lodging, onSave, disabled = false, costs, currency = "", dates }: {
  stop: Stop; lodging?: Lodging | null; disabled?: boolean; onSave: (lodging: Lodging | null) => void; costs?: CostRecord[]; currency?: string; dates?: { checkIn: string | null; checkOut: string | null };
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => fromLodging(lodging));
  const [page, setPage] = useState<ActivitySearch | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const abort = useRef<AbortController | null>(null);
  const request = useRef(0);
  const heading = useRef<HTMLButtonElement>(null);
  const nameField = useRef<HTMLInputElement>(null);
  // Opening the form removes the button that had focus, so move focus to the first field.
  useEffect(() => { if (open) nameField.current?.focus(); }, [open]);
  useEffect(() => () => { request.current++; abort.current?.abort(); }, []);

  function begin() { setDraft(fromLodging(lodging)); setPage(null); setError(""); setNotice(""); setOpen(true); }
  function close() { request.current++; abort.current?.abort(); setBusy(false); setOpen(false); setPage(null); setError(""); requestAnimationFrame(() => heading.current?.focus()); }

  async function search() {
    if (busy || !stop.location) return;
    const controller = new AbortController(); abort.current?.abort(); abort.current = controller;
    const current = ++request.current;
    setBusy(true); setPage(null); setError("");
    try {
      const result = await activitySearchAdapter.search(stop.location.reference_id, "lodging", controller.signal);
      if (current === request.current) setPage(result);
    } catch (failure) {
      if (current === request.current && !controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Could not search. Your stay is unchanged.");
    } finally { if (current === request.current) setBusy(false); }
  }
  function choose(place: ActivityPlace) {
    setDraft((d) => ({ ...d, name: place.name.slice(0, LODGING_NAME_MAX), place }));
    setPage(null);
    setNotice(`${place.name} chosen. Save to keep it.`);
    // The results list, with the button that had focus, is gone; continue at the name field.
    requestAnimationFrame(() => nameField.current?.focus());
  }
  function save() {
    const name = draft.name.trim();
    const base: Lodging = draft.place
      ? lodgingFromPlace(draft.place, { ...lodging, address: draft.address.trim(), booked: draft.booked, check_in: draft.check_in, check_out: draft.check_out })
      : // Editing a searched stay's text keeps its location only while the name is unchanged.
        { ...(lodging && lodging.name === name ? { latitude: lodging.latitude, longitude: lodging.longitude, external_id: lodging.external_id, source: lodging.source, place_id: lodging.place_id } : {}), name, address: draft.address.trim(), booked: draft.booked, check_in: draft.check_in, check_out: draft.check_out };
    const nightsText = draft.booked_nights.trim();
    if (draft.booked && nightsText !== "" && !(/^\d{1,3}$/.test(nightsText) && Number(nightsText) >= 1 && Number(nightsText) <= 365)) { setError("Enter the nights you booked as a whole number from 1 to 365, or leave it blank."); return; }
    const { booked_nights: _drop, ...rest } = base;
    void _drop;
    const next: Lodging = { ...rest, name, address: draft.address.trim(), booked: draft.booked, check_in: draft.check_in, check_out: draft.check_out, ...(draft.booked && nightsText !== "" ? { booked_nights: Number(nightsText) } : {}) };
    if (!isLodging(next)) { setError("Enter a name up to 120 characters, with plain text only."); return; }
    onSave(next);
    setNotice(`Saved ${name}. This is your own record: no booking was made or checked.`);
    close();
  }
  const filledName = draft.name.trim().length > 0;
  const costLines = stayCostLines(costs, stop.id, currency);
  const bookedNote = bookedNightsNote(lodging, stop.nights);
  if (stop.nights === 0) return null;
  return <section className="lodging-panel" aria-label={`Where you're staying in ${stop.name}`}>
    <div className="lodging-head">
      <h3>Where you’re staying</h3>
      {!open && <button ref={heading} type="button" disabled={disabled} onClick={begin}>{lodging ? "Edit stay" : "Add where you’re staying"}</button>}
    </div>
    {!open && <>
      <p>{lodgingSummary(lodging)}</p>
      {lodging?.address && <small>{lodging.address}</small>}
      {lodging && dates?.checkIn && dates.checkOut && <small>From your trip dates: check-in {dates.checkIn}{lodging.check_in ? ` from ${lodging.check_in}` : ""}, check-out {dates.checkOut}{lodging.check_out ? ` by ${lodging.check_out}` : ""}. Dates follow the trip; confirm them with your booking.</small>}
      {bookedNote && <p role="status" className="lodging-warning">{bookedNote}</p>}
      {lodging && lodging.latitude == null && <small>No map location yet, so it is not on the map. Edit and use “Find stays nearby” to add one.</small>}
      {lodging?.source && <small>Location: {lodging.source}. Prices, availability and booking status are not checked.</small>}
      {costLines.length > 0 && <div className="lodging-costs"><small>Costs you linked to this stay (totals are in your trip costs):</small><ul>{costLines.map((line, i) => <li key={i}>{line}</li>)}</ul></div>}
      {notice && <p role="status">{notice}</p>}
      {!lodging && <small>A stay you record here shows on the map and in your plan. Nothing is booked or priced.</small>}
    </>}
    {open && <form className="lodging-form" onSubmit={(e) => { e.preventDefault(); save(); }}>
      <label>Name of the place<input ref={nameField} value={draft.name} maxLength={LODGING_NAME_MAX} onChange={(e) => setDraft({ ...draft, name: e.target.value, place: draft.place && draft.place.name === e.target.value ? draft.place : undefined })} required /></label>
      <label>Address or note (optional)<input value={draft.address} maxLength={LODGING_ADDRESS_MAX} onChange={(e) => setDraft({ ...draft, address: e.target.value })} /></label>
      <div className="lodging-times">
        <label>Check-in<input type="time" value={draft.check_in} onChange={(e) => setDraft({ ...draft, check_in: e.target.value })} /></label>
        <label>Check-out<input type="time" value={draft.check_out} onChange={(e) => setDraft({ ...draft, check_out: e.target.value })} /></label>
      </div>
      <label className="lodging-booked"><input type="checkbox" checked={draft.booked} onChange={(e) => setDraft({ ...draft, booked: e.target.checked })} /> I have booked this myself</label>
      {draft.booked && <label>Nights you booked (optional)<input inputMode="numeric" value={draft.booked_nights} onChange={(e) => setDraft({ ...draft, booked_nights: e.target.value })} /></label>}
      <small>This only records what you tell us. The app cannot confirm a booking. If you enter the nights you booked, you are told when your plan no longer matches.</small>
      {stop.location ? <div className="lodging-search">
        <button type="button" disabled={busy} onClick={() => void search()}>{busy ? "Searching stays…" : "Find stays nearby"}</button>
        <small>Partial search within 5 km of the destination centre. It is not a list of every hotel and has no prices or availability.</small>
      </div> : <small>Link this destination to a map location through Explore nearby places to search for stays. You can still type a name.</small>}
      {error && <p role="alert">{error}</p>}
      {busy && <p role="status">Looking for mapped stays. Your saved stay is unchanged.</p>}
      {page && <>
        <p role="status">{page.results.length ? `${page.results.length} mapped stays returned.` : "No stays returned. Type a name instead."}</p>
        <ul className="lodging-results">{page.results.map((place) => <li key={place.id}><strong>{place.name}</strong><PlaceAttribution place={place} /><button type="button" disabled={place.destination_reference_id !== stop.location?.reference_id} onClick={() => choose(place)}>Use {place.name}</button></li>)}</ul>
      </>}
      {notice && <p role="status">{notice}</p>}
      <div className="lodging-actions">
        <button type="submit" disabled={!filledName}>Save stay</button>
        <button type="button" onClick={close}>Cancel</button>
        {lodging && <button type="button" onClick={() => { onSave(null); setNotice("Stay removed from this plan."); close(); }}>Remove stay</button>}
      </div>
    </form>}
  </section>;
}
