"use client";
import { useEffect, useRef, useState } from "react";
import { REFERENCE_MAX, bookingSummary, finishBooking, hasBooking, type TransferBooking as Booking } from "../../lib/trips/transfers";
import type { Trip } from "../../lib/trips/adapter";

type Pref = NonNullable<Trip["travelPreferences"]>[string];
const draftOf = (p?: Pref): Booking => ({ departure: p?.departure ?? "", arrival: p?.arrival ?? "", reference: p?.reference ?? "", booked: p?.booked === true });

/** Details of a journey the traveler booked elsewhere, as they enter them. Recorded, never verified or booked here. */
export default function TransferBooking({ from, to, pref, onSave, disabled = false }: { from: string; to: string; pref?: Pref; onSave: (booking: Booking) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Booking>(() => draftOf(pref));
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const first = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  // Opening the form removes the button that had focus, so move focus to the first field.
  useEffect(() => { if (open) first.current?.focus(); }, [open]);
  const summary = bookingSummary(pref);
  function begin() { setDraft(draftOf(pref)); setError(""); setNotice(""); setOpen(true); }
  function close() { setOpen(false); setError(""); requestAnimationFrame(() => trigger.current?.focus()); }
  function save() {
    const result = finishBooking(draft);
    if ("error" in result) { setError(result.error); return; }
    onSave(result.booking);
    setNotice("Saved as you entered it. Nothing was booked or checked.");
    close();
  }
  return <div className="transfer-booking">
    {summary && !open && <p>{summary}</p>}
    {notice && !open && <p role="status">{notice}</p>}
    {!open && <button ref={trigger} type="button" disabled={disabled} onClick={begin}>{hasBooking(pref) ? `Edit my booking details for ${from} to ${to}` : `Add a journey I already booked, ${from} to ${to}`}</button>}
    {open && <form onSubmit={(e) => { e.preventDefault(); save(); }}>
      <label>Departs {from} at (local time, optional)<input ref={first} type="time" value={draft.departure} onChange={(e) => setDraft({ ...draft, departure: e.target.value })} /></label>
      <label>Arrives in {to} at (local time, optional)<input type="time" value={draft.arrival} onChange={(e) => setDraft({ ...draft, arrival: e.target.value })} /></label>
      <label>Reference or note (optional)<input value={draft.reference} maxLength={REFERENCE_MAX} onChange={(e) => setDraft({ ...draft, reference: e.target.value })} /></label>
      <label className="transfer-booked"><input type="checkbox" checked={draft.booked} onChange={(e) => setDraft({ ...draft, booked: e.target.checked })} /> I have booked this myself</label>
      <small>This only records what you tell us. The app cannot confirm a ticket or a time. Activities that start before your arrival, or run past your departure, are flagged; no boarding or check-in buffer is added.</small>
      {error && <p role="alert">{error}</p>}
      <div className="transfer-booking-actions">
        <button type="submit">Save</button>
        <button type="button" onClick={close}>Cancel</button>
        {hasBooking(pref) && <button type="button" onClick={() => { onSave({ departure: "", arrival: "", reference: "", booked: false }); setNotice("Booking details removed."); close(); }}>Remove my details</button>}
      </div>
    </form>}
  </div>;
}
