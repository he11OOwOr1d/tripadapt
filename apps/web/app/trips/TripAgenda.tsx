"use client";
import { useEffect, useMemo, useState } from "react";
import type { Trip } from "../../lib/trips/adapter";
import { agendaDays, type AgendaItem } from "../../lib/trips/trip-agenda";
import TripGrid from "./TripGrid";
import { AGENDA_VIEW_KEY, readPref, writePref } from "../../lib/trips/view-prefs";

/** The plan date by date, read-only. A line opens that day in the day view; nothing here changes the plan. */
export default function TripAgenda({ trip, onOpen }: { trip: Trip; onOpen: (stopId: string, day: number) => void }) {
  const built = useMemo(() => {
    try { return { days: agendaDays(trip), failed: false }; } catch { return { days: null, failed: true }; }
  }, [trip]);
  // The grid needs room for five day columns, so it is offered on wide screens only; the list is always available.
  const [view, setView] = useState<"list" | "grid">("list");
  const [wide, setWide] = useState(false);
  // The remembered view is read after mount so the first render matches the server's.
  useEffect(() => { setView(readPref(AGENDA_VIEW_KEY, ["list", "grid"] as const, "list")); }, []);
  const choose = (next: "list" | "grid") => { setView(next); writePref(AGENDA_VIEW_KEY, next); };
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1200px)");
    const sync = () => setWide(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  if (built.failed) return <section className="trip-agenda" aria-labelledby="trip-agenda-title"><h2 id="trip-agenda-title">Date by date</h2><p role="status">The date-by-date view could not be built from this plan. Nothing was changed.</p></section>;
  if (!built.days) return <section className="trip-agenda" aria-labelledby="trip-agenda-title"><h2 id="trip-agenda-title">Date by date</h2><p>The date-by-date view needs exact trip dates. Choose exact dates in the trip form to see it.</p></section>;
  const line = (item: AgendaItem) => {
    const body = <>
      <span className="agenda-when">{item.when || (item.kind === "stay" ? "All day" : "")}</span>
      <span className="agenda-title">{item.title}{item.skipped && <span className="agenda-skipped"> · skipped</span>}</span>
      {item.note && <span className="agenda-note">{item.note}</span>}
      {item.open && <span className="sr-only">. Opens day {item.open.day} in {item.open.stopName}</span>}
    </>;
    const open = item.open;
    return <li key={item.key} className={`agenda-item kind-${item.kind} role-${item.role}${item.skipped ? " is-skipped" : ""}`}>
      {open ? <button type="button" onClick={() => onOpen(open.stopId, open.day)}>{body}</button> : <div>{body}</div>}
    </li>;
  };
  return <section className="trip-agenda" aria-labelledby="trip-agenda-title">
    <div className="agenda-head">
      <h2 id="trip-agenda-title">Date by date</h2>
      {wide && built.days.length > 0 && <div className="agenda-view" role="group" aria-label="Show the days as">
        <button type="button" aria-pressed={view === "list"} onClick={() => choose("list")}>List</button>
        <button type="button" aria-pressed={view === "grid"} onClick={() => choose("grid")}>Grid</button>
      </div>}
    </div>
    <p>Times are local to the place they happen. Choose a line to open that day. This is your own plan, not confirmed bookings.</p>
    {built.days.length === 0 ? <p>Add a destination to see your days here.</p> : wide && view === "grid" ? <TripGrid days={built.days} onOpen={onOpen} /> : <ol className="agenda-days">
      {built.days.map((day) => <li key={day.date} className="agenda-day">
        <h3><time dateTime={day.date}>{day.label}</time><span>{day.tripDay ? `Day ${day.tripDay} · ` : ""}{day.place}</span></h3>
        {day.items.length > 0 ? <ul className="agenda-items">{day.items.map(line)}</ul>
          : day.open ? <p className="agenda-empty">Nothing planned. <button type="button" onClick={() => onOpen(day.open!.stopId, day.open!.day)}>Plan this day<span className="sr-only"> ({day.label}, day {day.open.day} in {day.open.stopName})</span></button></p>
          : <p className="agenda-empty">Nothing planned.</p>}
      </li>)}
    </ol>}
  </section>;
}
