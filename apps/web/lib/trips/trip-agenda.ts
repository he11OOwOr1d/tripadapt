import type { Trip } from "./adapter";
import { displayDate, provisionalDate, routeSchedule } from "./itinerary";
import { addDays, tripEvents, type TripEvent } from "./trip-events";

/** The day view a line opens: a destination and the day within it. */
export type AgendaOpen = { stopId: string; stopName: string; day: number };

export type AgendaItem = {
  key: string;
  eventId: string;
  kind: TripEvent["kind"];
  /** The event itself, or one day of a stay (check-in, staying, check-out), or the end of an overnight journey (arrival). */
  role: "event" | "check-in" | "staying" | "check-out" | "arrival";
  title: string;
  /** Local time text such as "09:00–10:00", or "" when the line has no time. */
  when: string;
  /** What the traveler recorded that helps on the day: a place name, a confirmation note, whether it is booked. */
  note: string;
  /** The traveler marked it as not happening. */
  skipped: boolean;
  /** Where clicking the line goes; null when the day has no destination to open. */
  open: AgendaOpen | null;
  /** Sort key within the day: a local time (HH:MM). */
  sort: string;
};

export type AgendaDay = {
  /** YYYY-MM-DD */
  date: string;
  /** For example "Fri, Dec 4". */
  label: string;
  /** The day of the trip, or null for a date outside the trip's own days. */
  tripDay: number | null;
  /** Where the traveler is: one destination, "Jaipur → Agra" on a travel day, or a note. */
  place: string;
  /** The day view to open for this date, or null. */
  open: AgendaOpen | null;
  items: AgendaItem[];
};

/**
 * The plan date by date, for a trip with exact dates (null otherwise). Every day of the trip is listed, including
 * empty ones, so gaps are visible. Times are local to the place they happen; a journey names the zone at each end.
 * A stay appears on every day it covers: check-in, staying, check-out. Nothing here is a booking.
 * Throws when a destination's time zone is not a real one, like the events it is built from, so callers wrap it.
 */
export function agendaDays(trip: Trip): AgendaDay[] | null {
  if (trip.mode !== "exact" || !/^\d{4}-\d{2}-\d{2}$/.test(trip.start)) return null;
  const schedule = routeSchedule(trip);
  const last = schedule.reduce((m, s) => Math.max(m, s.departureDay), 0);
  const days = new Map<string, AgendaDay>();
  const stopOn = (d: number) => schedule.filter((s) => s.arrivalDay <= d && d <= s.departureDay);
  const target = (d: number): AgendaOpen | null => {
    const here = stopOn(d), s = here[here.length - 1];
    return s ? { stopId: s.stop.id, stopName: s.stop.name, day: d - s.arrivalDay + 1 } : null;
  };
  for (let d = 1; d <= last; d++) {
    const date = provisionalDate(trip, d);
    if (!date) continue;
    const here = stopOn(d);
    days.set(date, { date, label: displayDate(date), tripDay: d, place: here.length ? here.map((s) => s.stop.name || "Unnamed place").join(" → ") : "On the way", open: target(d), items: [] });
  }
  const dayOf = (date: string) => {
    let day = days.get(date);
    if (!day) { day = { date, label: displayDate(date), tripDay: null, place: "Outside your trip days", open: null, items: [] }; days.set(date, day); }
    return day;
  };
  // A line opens the event's own destination and day, except a journey, which opens whatever the day itself opens.
  const openFor = (e: TripEvent, date: string): AgendaOpen | null => {
    const day = dayOf(date);
    const s = schedule.find((x) => x.stop.id === e.stopId);
    if (e.kind === "journey" || !s || day.tripDay === null) return day.open;
    const n = day.tripDay - s.arrivalDay + 1;
    return n >= 1 && n <= s.days ? { stopId: s.stop.id, stopName: s.stop.name, day: n } : day.open;
  };
  const stopName = (id: string) => schedule.find((s) => s.stop.id === id)?.stop.name ?? "";

  for (const e of tripEvents(trip, { includeSkipped: true })) {
    if (e.kind === "stay" && e.stay) {
      const name = e.stay.name || "where you are staying";
      for (let date = e.start.date; date <= e.end.date; date = addDays(date, 1)) {
        const role = date === e.start.date ? "check-in" : date === e.end.date ? "check-out" : "staying";
        const time = role === "check-in" ? e.stay.checkIn : role === "check-out" ? e.stay.checkOut : null;
        const note = role === "check-in" ? [e.stay.reference && `Your reference: ${e.stay.reference}`, e.stay.booked ? "You marked this as booked" : "Not marked as booked"].filter(Boolean).join(". ") : "";
        dayOf(date).items.push({
          key: `${e.id}:${date}`, eventId: e.id, kind: "stay", role,
          title: role === "check-in" ? `Check in: ${name}` : role === "check-out" ? `Check out: ${name}` : `Staying at ${name}`,
          when: time ? (role === "check-in" ? `from ${time}` : `by ${time}`) : "", note, skipped: false, open: openFor(e, date),
          // A check-out is a morning thing and a check-in an evening one when no time was recorded.
          sort: role === "check-out" ? (time ?? "00:00") : role === "check-in" ? (time ?? "23:59") : "00:00",
        });
      }
      continue;
    }
    const nextDay = e.end.date !== e.start.date;
    let when: string;
    if (e.kind === "journey") {
      // Name a zone only where it adds something: when the two ends differ, or for a single marker, which has no other end to compare.
      const differs = e.start.zone !== e.end.zone;
      when = e.marker ? `${e.start.time} (${e.start.zone})` : `departs ${e.start.time}${differs ? ` (${e.start.zone})` : ""} · arrives ${e.end.time}${nextDay ? " the next day" : ""}${differs ? ` (${e.end.zone})` : ""}`;
    } else {
      when = `${e.start.time}–${e.end.time}${nextDay ? " (next day)" : ""}`;
    }
    const place = e.kind === "activity" && e.location && e.location !== e.title && e.location !== stopName(e.stopId) ? e.location : "";
    dayOf(e.start.date).items.push({
      key: `${e.id}:${e.start.date}`, eventId: e.id, kind: e.kind, role: "event", title: e.title, when,
      note: e.kind === "journey" ? e.details.join(". ") : place, skipped: e.skipped, open: openFor(e, e.start.date), sort: e.start.time ?? "00:00",
    });
    // An overnight journey also shows on the day it arrives.
    if (e.kind === "journey" && !e.marker && nextDay) {
      dayOf(e.end.date).items.push({
        key: `${e.id}:${e.end.date}:arrival`, eventId: e.id, kind: "journey", role: "arrival", title: `Arrival: ${e.title}`,
        when: `arrives ${e.end.time} (${e.end.zone})`, note: "", skipped: false, open: openFor(e, e.end.date), sort: e.end.time ?? "00:00",
      });
    }
  }
  const sorted = [...days.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  for (const day of sorted) day.items.sort((a, b) => (a.sort < b.sort ? -1 : a.sort > b.sort ? 1 : a.title < b.title ? -1 : a.title > b.title ? 1 : 0));
  return sorted;
}
