"use client";
import { useId, useRef, useState } from "react";
import type { Activity, Stop, Trip } from "../../lib/trips/adapter";
import {
  MAX_WISHES, activityForWish, addWish, changeWish, durationText, removeWish, wishFromName, wishReport,
  type WishState,
} from "../../lib/trips/shortlist";

const LENGTHS = [30, 45, 60, 90, 120, 150, 180, 240, 300, 360];
type Filter = "all" | "must" | "open";
const FILTERS: [Filter, string][] = [["all", "Everything"], ["must", "Must-visit"], ["open", "Not scheduled"]];

function LengthSelect({ id, value, onChange, disabled }: { id: string; value: number | null; onChange: (minutes: number | null) => void; disabled?: boolean }) {
  const options = value !== null && !LENGTHS.includes(value) ? [...LENGTHS, value].sort((a, b) => a - b) : LENGTHS;
  return (
    <select id={id} value={value ?? ""} disabled={disabled} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}>
      <option value="">Not sure yet</option>
      {options.map((m) => <option key={m} value={m}>{durationText(m)}</option>)}
    </select>
  );
}

function statusText(state: WishState): string {
  if (state.status === "scheduled") return `Scheduled · day ${state.day} at ${state.start}`;
  if (state.status === "skipped") return `Skipped · day ${state.day}`;
  return "Not scheduled";
}

/**
 * The traveler's shortlist for one destination (PRD FR-02): places saved from the nearby search or added by hand,
 * each marked must-visit or not. A must-visit item that has no day shows why, so nothing a traveler asked for quietly
 * disappears (PRD FR-06). It is their own list: nothing here is booked, checked or promised to fit.
 */
export default function ShortlistPanel({ trip, stop, day, disabled, onUpdate, onSchedule }: {
  trip: Trip; stop: Stop; day: number; disabled?: boolean;
  onUpdate: (patch: Partial<Trip>) => void; onSchedule: (activity: Activity) => void;
}) {
  const uid = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [name, setName] = useState("");
  const [minutes, setMinutes] = useState<number | null>(null);
  const [must, setMust] = useState(false);
  const [problem, setProblem] = useState("");
  const report = wishReport(trip, stop);
  const missing = report.filter((s) => s.wish.must && s.status !== "scheduled").length;
  const shown = report.filter((s) => filter === "all" || (filter === "must" ? s.wish.must : s.status !== "scheduled"));
  const lists = trip.shortlists;
  const set = (next: typeof lists) => onUpdate({ shortlists: next });

  function add(event: React.FormEvent) {
    event.preventDefault();
    const made = wishFromName(name, minutes, must);
    if ("error" in made) return setProblem(made.error);
    const added = addWish(lists, stop.id, made.wish);
    if ("error" in added) return setProblem(added.error);
    setProblem(""); setName(""); setMinutes(null); setMust(false);
    set(added.shortlists);
  }

  return (
    <section className="shortlist" aria-labelledby={`${uid}-h`}>
      <h3 id={`${uid}-h`} ref={heading} tabIndex={-1}>Your shortlist for {stop.name}</h3>
      <p className="shortlist-help">
        Places and things you want here, before they have a day. Save places from Explore nearby places, or add your own. Mark the ones you must not miss:
        if one has no day, it stays listed here with the reason. Nothing on this list is booked or checked.
      </p>
      {!!missing && (
        <p className="shortlist-missing" role="status">
          {missing === 1 ? "1 must-visit place is" : `${missing} must-visit places are`} not scheduled yet.
        </p>
      )}
      {report.length > 0 && (
        <div className="shortlist-filter" role="group" aria-label="Show on the shortlist">
          {FILTERS.map(([value, label]) => (
            <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>
          ))}
        </div>
      )}
      {report.length === 0 ? (
        <p className="shortlist-empty">Nothing here yet. Use “Save to shortlist” on a nearby place, or add something below.</p>
      ) : shown.length === 0 ? (
        <p className="shortlist-empty">Nothing matches this filter.</p>
      ) : (
        <ul className="shortlist-items">
          {shown.map((state) => {
            const { wish } = state;
            const rowId = `${uid}-${wish.id}`;
            return (
              <li key={wish.id} className={`shortlist-item shortlist-${state.status}`}>
                <div className="shortlist-head">
                  <strong>{wish.label}</strong>
                  <span className="shortlist-status">{statusText(state)}</span>
                </div>
                <small>
                  {wish.place ? `${wish.place.category} · saved from nearby search (${wish.place.source})` : "Added by you"}
                  {" · "}{wish.minutes === null ? "length not set" : `about ${durationText(wish.minutes)}`}
                </small>
                {state.status !== "scheduled" && state.reason && <p className="shortlist-reason">{state.reason}</p>}
                <div className="shortlist-controls">
                  <label className="shortlist-check">
                    <input type="checkbox" checked={wish.must} disabled={disabled} onChange={(e) => set(changeWish(lists, stop.id, wish.id, { must: e.target.checked }))} />
                    Must-visit
                  </label>
                  <label htmlFor={`${rowId}-len`}>
                    About how long
                  </label>
                  <LengthSelect id={`${rowId}-len`} value={wish.minutes} disabled={disabled} onChange={(m) => set(changeWish(lists, stop.id, wish.id, { minutes: m }))} />
                  {state.status !== "scheduled" && (
                    <button type="button" disabled={disabled} onClick={() => onSchedule(activityForWish(state, stop.id, day))}>
                      Set a time
                    </button>
                  )}
                  <button type="button" disabled={disabled} aria-label={`Remove ${wish.label} from the shortlist`} onClick={() => { set(removeWish(lists, stop.id, wish.id)); heading.current?.focus(); }}>
                    Remove
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <form className="shortlist-add" onSubmit={add} noValidate>
        <h4>Add something yourself</h4>
        <div className="shortlist-add-fields">
          <label htmlFor={`${uid}-name`}>Name</label>
          <input id={`${uid}-name`} value={name} maxLength={120} disabled={disabled} aria-describedby={problem ? `${uid}-err` : undefined} aria-invalid={!!problem} onChange={(e) => { setName(e.target.value); setProblem(""); }} placeholder="A viewpoint, a stall, a friend’s place…" />
          <label htmlFor={`${uid}-new-len`}>About how long</label>
          <LengthSelect id={`${uid}-new-len`} value={minutes} disabled={disabled} onChange={setMinutes} />
          <label className="shortlist-check"><input type="checkbox" checked={must} disabled={disabled} onChange={(e) => setMust(e.target.checked)} />Must-visit</label>
          <button type="submit" disabled={disabled || report.length >= MAX_WISHES}>Add to shortlist</button>
        </div>
        {problem && <p id={`${uid}-err`} role="alert" className="shortlist-problem">{problem}</p>}
        <small>Works without any search, for places the map data does not know. “Not sure yet” plans an hour and says so.</small>
      </form>
    </section>
  );
}
