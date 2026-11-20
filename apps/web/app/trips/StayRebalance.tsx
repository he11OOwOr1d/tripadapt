"use client";
import { useEffect, useId, useRef, useState } from "react";
import { costMoney } from "../../lib/trips/cost-coverage";
import { RebalanceBlocked, rebalanceStays, type RebalanceActivity, type RebalanceRequest, type RebalanceSummary } from "../../lib/trips/stay-rebalance";

type Stop = { id: string; name: string; nights: number };

/** Confirmation after apply; names activities that now need a place chosen. */
export function appliedMessage(result: RebalanceSummary): string {
  const unmapped = result.moved.filter((m) => m.map_cleared);
  const places = unmapped.length
    ? ` Choose a new place for ${unmapped.map((m) => `${m.label} (${m.to_destination}, day ${m.to_day})`).join(", ")}: open the activity and set its location.`
    : "";
  return `Stay nights changed in your saved draft.${places} Review and accept the plan to update your accepted trip.`;
}

/**
 * Move nights between stays, or to/from the trip length, as a draft edit.
 * Previews first; activities on removed days need an explicit choice; protected
 * ones block. The accepted plan changes only through Review plan.
 */
export default function StayRebalance({ tripId, etag, currency, stops, onApplied }: { tripId: string; etag: string; currency: string; stops: Stop[]; onApplied: (message: string, result: RebalanceSummary) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [stopId, setStopId] = useState(stops[0]?.id ?? "");
  const [direction, setDirection] = useState<"add" | "remove">("add");
  const [nights, setNights] = useState(1);
  const [counterpart, setCounterpart] = useState<string>("trip_length");
  const [drop, setDrop] = useState<string[]>([]);
  // Per displaced activity: "" (undecided), "drop", or a remaining day offset.
  const [decisions, setDecisions] = useState<Record<string, string>>({});
  // Optional new start time per moved activity; absent keeps the original time.
  const [times, setTimes] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<RebalanceSummary | null>(null);
  const [blocked, setBlocked] = useState<RebalanceBlocked | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const id = useId();
  useEffect(() => () => abort.current?.abort(), []);
  useEffect(() => {
    if (preview || blocked) resultHeading.current?.focus();
  }, [preview, blocked]);

  const stop = stops.find((s) => s.id === stopId);
  const others = stops.filter((s) => s.id !== stopId);
  const delta = direction === "add" ? nights : -nights;
  const nightsAfter = (id: string) => {
    const s = stops.find((x) => x.id === id);
    if (!s) return 0;
    return s.nights + (id === stopId ? delta : id === counterpart ? -delta : 0);
  };
  const request: RebalanceRequest = {
    stop_id: stopId,
    delta_nights: delta,
    counterpart,
    drop_activity_ids: Object.entries(decisions).filter(([, v]) => v === "drop").map(([k]) => k),
    relocate: Object.entries(decisions).filter(([, v]) => v !== "" && v !== "drop").map(([k, v]) => {
      // Decision value: "<stop id>|<day offset>".
      const [stay, day] = v.split("|");
      const original = blocked?.activities.find((a) => a.activity_id === k)?.stop_id;
      return { activity_id: k, day_offset: Number(day), ...(stay !== original ? { stop_id: stay } : {}), ...(times[k] ? { local_start_time: times[k] } : {}) };
    }),
  };
  function reset(next?: Partial<{ drop: string[] }>) {
    abort.current?.abort();
    setPreview(null);
    setBlocked(null);
    setError("");
    setDrop(next?.drop ?? []);
    setDecisions({});
    setTimes({});
  }
  async function run(apply: boolean) {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setBusy(true);
    setError("");
    try {
      const result = await rebalanceStays(tripId, etag, request, apply, AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]));
      if (controller.signal.aborted) return;
      if (apply) {
        // Clear without aborting: this request's own controller must stay live
        // so the busy state is released below.
        setOpen(false);
        setPreview(null);
        setBlocked(null);
        setDrop([]);
        setDecisions({});
        setTimes({});
        await onApplied(appliedMessage(result),result);
      } else {
        setBlocked(null);
        setPreview(result);
      }
    } catch (e) {
      if (controller.signal.aborted) return;
      if (e instanceof RebalanceBlocked) {
        setPreview(null);
        setBlocked(e);
      } else setError(e instanceof Error && e.name !== "TimeoutError" ? e.message : "The change couldn’t be checked in time. Your trip is unchanged.");
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  if (stops.length === 0) return null;
  const choosable = (a: RebalanceActivity) => !a.protected && (blocked?.code === "REBALANCE_DISPLACED" || blocked?.code === "REBALANCE_OVERLAP");

  return (
    <details className="stay-rebalance" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>Change nights between stays</summary>
      <fieldset disabled={busy}>
        <label>
          Stay
          <select value={stopId} onChange={(e) => { setStopId(e.target.value); if (counterpart === e.target.value) setCounterpart("trip_length"); reset(); }}>
            {stops.map((s, i) => (
              <option key={s.id} value={s.id}>{`${i + 1}. ${s.name} · ${s.nights} nights`}</option>
            ))}
          </select>
        </label>
        <div className="stay-rebalance-row">
          <label>
            Change
            <select value={direction} onChange={(e) => { setDirection(e.target.value as "add" | "remove"); reset(); }}>
              <option value="add">Add</option>
              <option value="remove">Remove</option>
            </select>
          </label>
          <label>
            Nights
            <input type="number" min={1} max={30} value={nights} onChange={(e) => { setNights(Math.max(1, Math.min(30, Number(e.target.value) || 1))); reset(); }} />
          </label>
        </div>
        <label>
          {direction === "add" ? "Take the nights from" : "Give the nights to"}
          <select value={counterpart} aria-describedby={`${id}-note`} onChange={(e) => { setCounterpart(e.target.value); reset(); }}>
            <option value="trip_length">{direction === "add" ? "A longer trip" : "A shorter trip"}</option>
            {others.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>
        <p id={`${id}-note`} className="creation-note">
          {counterpart === "trip_length" ? "The trip’s length changes by the same number of nights." : "The total trip length stays the same."} Your route order and journeys don’t change.
        </p>
        <button type="button" onClick={() => void run(false)}>Preview change</button>
      </fieldset>
      {busy && <p role="status">Checking the change. Your trip is unchanged.</p>}
      {error && <p role="alert" className="editor-error">{error}</p>}
      {blocked && (
        <section aria-live="polite">
          <h3 ref={resultHeading} tabIndex={-1}>This needs your decision</h3>
          <p>{blocked.message}</p>
          {blocked.activities.length > 0 && (
            <fieldset className="stay-rebalance-drop">
              <legend>{choosable(blocked.activities[0]) ? "Choose what happens to each" : "Move these in the planner first"}</legend>
              {blocked.activities.map((a) => (
                <div key={a.activity_id} className="stay-rebalance-choice">
                  <span>{`${a.destination}, day ${a.day} · ${a.start} · ${a.label}${a.protected ? " · fixed, booked or completed" : ""}`}</span>
                  {(a as RebalanceActivity & { detail?: string }).detail && <small>{(a as RebalanceActivity & { detail?: string }).detail}</small>}
                  {choosable(a) && (
                    <select aria-label={`What happens to ${a.label}`} value={decisions[a.activity_id] ?? ""} onChange={(e) => setDecisions({ ...decisions, [a.activity_id]: e.target.value })}>
                      <option value="">Choose…</option>
                      <option value="drop">Drop it</option>
                      {stops.map((s) => (
                        <optgroup key={s.id} label={s.id === a.stop_id ? `${s.name} (this stay)` : `${s.name} · any map location is removed`}>
                          {Array.from({ length: Math.max(0, nightsAfter(s.id)) + 1 }, (_, day) => (
                            <option key={day} value={`${s.id}|${day}`}>{`Move to ${s.name}, day ${day + 1}`}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  )}
                  {choosable(a) && decisions[a.activity_id] && decisions[a.activity_id] !== "drop" && (
                    <label>
                      Start time on the new day
                      <input type="time" required value={times[a.activity_id] ?? a.start} onInput={(e) => { const value=e.currentTarget.value; setTimes(current=>({...current,[a.activity_id]:value})); }} onChange={(e) => { const value=e.currentTarget.value; setTimes(current=>({...current,[a.activity_id]:value})); }} />
                    </label>
                  )}
                </div>
              ))}
              {choosable(blocked.activities[0]) && (
                <>
                  {blocked.activities.some((a) => decisions[a.activity_id] && decisions[a.activity_id] !== "drop" && times[a.activity_id] === "") && <p role="status">Enter a start time for each activity you move.</p>}
                  <button type="button" disabled={busy || blocked.activities.some((a) => !decisions[a.activity_id] || (decisions[a.activity_id] !== "drop" && times[a.activity_id] === ""))} onClick={() => void run(false)}>
                    Preview with these choices
                  </button>
                </>
              )}
            </fieldset>
          )}
        </section>
      )}
      {preview && stop && (
        <section aria-live="polite">
          <h3 ref={resultHeading} tabIndex={-1}>Preview</h3>
          <ul>
            {preview.stays.filter((s) => s.nights_after !== s.nights_before).map((s) => (
              <li key={s.stop_id}>{s.name}: {s.nights_before} → {s.nights_after} nights</li>
            ))}
            {preview.trip_days_before !== preview.trip_days_after && (
              <li>Trip length: {preview.trip_days_before ?? "open"} → {preview.trip_days_after ?? "open"} days{preview.end_date_after ? `, ending ${preview.end_date_after}` : ""}</li>
            )}
            {preview.dropped.map((a) => (
              <li key={a.activity_id}>Dropped: {a.destination}, day {a.day} · {a.label}</li>
            ))}
            {preview.moved.map((a) => (
              <li key={a.activity_id}>Moved: {a.label}, {a.destination} day {a.day} {a.start} → {a.to_destination !== a.destination ? `${a.to_destination} ` : ""}day {a.to_day} {a.to_start}{a.map_cleared ? ` · map location removed; choose a place in ${a.to_destination} afterwards` : ""}</li>
            ))}
            <li>Your estimates: {costMoney(preview.estimated_before, currency)} → {costMoney(preview.estimated_after, currency)}</li>
            {preview.kept_payments.length > 0 && <li>Kept as recorded payments: {preview.kept_payments.join(", ")}</li>}
            {(preview.booked_stays ?? []).map((b, i) => (
              <li key={`booked:${b.stop_id}:${i}`} className="rebalance-booked"><strong>Check your booking.</strong> You marked your stay “{b.stay}” in {b.name} as booked{b.booked_nights ? ` for ${b.booked_nights} ${b.booked_nights === 1 ? "night" : "nights"}` : ""}, and this change moves its nights from {b.nights_before} to {b.nights_after}. Your booking is not changed or checked by this; contact the stay or update it yourself.</li>
            ))}
          </ul>
          <p>{preview.notice}</p>
          <button type="button" className="day-primary" disabled={busy} onClick={() => void run(true)}>Apply to my draft</button>
          <button type="button" disabled={busy} onClick={() => reset()}>Cancel</button>
        </section>
      )}
    </details>
  );
}
