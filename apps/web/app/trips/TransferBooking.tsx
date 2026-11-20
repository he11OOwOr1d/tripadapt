"use client";
import { useEffect, useRef, useState } from "react";
import { BUFFER_MAX, REFERENCE_MAX, bookingSummary, finishBooking, hasBooking, type TransferBooking as Booking } from "../../lib/trips/transfers";
import type { Trip } from "../../lib/trips/adapter";

type Pref = NonNullable<Trip["travelPreferences"]>[string];
type Draft = Omit<Booking, "arrival_buffer" | "departure_buffer"> & { arrival_buffer: string; departure_buffer: string };
const draftOf = (p?: Pref): Draft => ({ departure: p?.departure ?? "", arrival: p?.arrival ?? "", reference: p?.reference ?? "", booked: p?.booked === true, locked: p?.locked === true, arrival_buffer: p?.arrival_buffer ? String(p.arrival_buffer) : "", departure_buffer: p?.departure_buffer ? String(p.departure_buffer) : "" });
/** Blank means no buffer; anything else must be a whole number of minutes. */
const minutes = (text: string) => (text.trim() === "" ? 0 : /^\d{1,3}$/.test(text.trim()) ? Number(text.trim()) : NaN);

/** Details of a journey the traveler booked elsewhere, as they enter them. Recorded, never verified or booked here. */
export default function TransferBooking({ from, to, pref, onSave, disabled = false }: { from: string; to: string; pref?: Pref; onSave: (booking: Booking) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => draftOf(pref));
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
    const result = finishBooking({ ...draft, arrival_buffer: minutes(draft.arrival_buffer), departure_buffer: minutes(draft.departure_buffer) });
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
      <label>Minutes to settle in after arriving (optional, 0 to {BUFFER_MAX})<input inputMode="numeric" value={draft.arrival_buffer} onChange={(e) => setDraft({ ...draft, arrival_buffer: e.target.value })} /></label>
      <label>Minutes to be there before departing (optional, 0 to {BUFFER_MAX})<input inputMode="numeric" value={draft.departure_buffer} onChange={(e) => setDraft({ ...draft, departure_buffer: e.target.value })} /></label>
      <label>Reference or note (optional)<input value={draft.reference} maxLength={REFERENCE_MAX} onChange={(e) => setDraft({ ...draft, reference: e.target.value })} /></label>
      <label className="transfer-booked"><input type="checkbox" checked={draft.booked} onChange={(e) => setDraft({ ...draft, booked: e.target.checked })} /> I have booked this myself</label>
      <label className="transfer-booked"><input type="checkbox" checked={draft.locked} onChange={(e) => setDraft({ ...draft, locked: e.target.checked })} /> Keep this journey fixed</label>
      <small>A fixed journey keeps its day: “Change nights between stays” will not move it until you untick this. It is not a booking.</small>
      <small>This only records what you tell us. The app cannot confirm a ticket or a time. Activities that start before your arrival, or run past your departure, are flagged. The buffers are your own assumptions; none is added unless you enter one.</small>
      {error && <p role="alert">{error}</p>}
      <div className="transfer-booking-actions">
        <button type="submit">Save</button>
        <button type="button" onClick={close}>Cancel</button>
        {hasBooking(pref) && <button type="button" onClick={() => { onSave({ departure: "", arrival: "", reference: "", booked: false, locked: false, arrival_buffer: 0, departure_buffer: 0 }); setNotice("Booking details removed."); close(); }}>Remove my details</button>}
      </div>
    </form>}
  </div>;
}
