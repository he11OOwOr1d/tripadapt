import type { Trip } from "./adapter";
import { provisionalDate, routeSchedule } from "./itinerary";
import { routeLegs } from "./planning";
import { staysOf, unclaimedSpan } from "./lodging";

/** The offset of a time zone from UTC, in minutes, at an instant. */
function offsetMinutes(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(instant);
  const n = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return Math.round((Date.UTC(n("year"), n("month") - 1, n("day"), n("hour"), n("minute"), n("second")) - instant.getTime()) / 60000);
}

/** The UTC instant of a wall-clock time in a zone. */
export function zonedToUtc(date: string, time: string, timeZone: string): Date {
  const [y, m, d] = date.split("-").map(Number), [h, min] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, h, min);
  let t = guess - offsetMinutes(new Date(guess), timeZone) * 60000;
  const again = offsetMinutes(new Date(t), timeZone);
  if (again !== offsetMinutes(new Date(guess), timeZone)) t = guess - again * 60000;
  return new Date(t);
}

/** The wall-clock date (YYYY-MM-DD) and time (HH:MM) of an instant in a zone. */
export function localParts(instant: Date, timeZone: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(instant);
  const g = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return { date: `${g("year")}-${g("month")}-${g("day")}`, time: `${g("hour")}:${g("minute")}` };
}

/** A date (YYYY-MM-DD) moved by whole days. */
export const addDays = (iso: string, n: number) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

/** One thing on the traveler's plan, placed on a date in the zone where it happens. Never a booking. */
export type TripEvent = {
  /** Stable across edits and exports: from the activity id, the stop and first night of a stay, or the two stops of a journey. */
  id: string;
  kind: "activity" | "stay" | "journey";
  title: string;
  /** A stay: whole days from check-in to check-out. `end.date` is the check-out day, so a stay of 2 nights ends two days after it starts. */
  allDay: boolean;
  /** A journey with only a departure or only an arrival: a short marker at that moment, not a span. */
  marker: boolean;
  /** The traveler marked it as not happening. Left out unless asked for. */
  skipped: boolean;
  /** Local wall-clock date and time in `zone`. All-day events have no time. */
  start: { date: string; time: string | null; zone: string };
  /** Local wall-clock date and time in `zone`; a journey ends in the zone of the place it arrives at. */
  end: { date: string; time: string | null; zone: string };
  /** The same moments as instants. Null for all-day events. */
  startUtc: Date | null;
  endUtc: Date | null;
  /** The place line, or null when there is none (a journey). */
  location: string | null;
  /** What the traveler recorded, as plain sentences without the closing full stops (destination, check-in and out, reference, booked or not). */
  details: string[];
  /** A real map position, or null. */
  position: { latitude: number; longitude: number } | null;
  /** For a stay: its name (may be empty), the check-in and check-out times, the confirmation note and whether the traveler marked it booked, as recorded. Null for everything else. */
  stay: { name: string; checkIn: string | null; checkOut: string | null; reference: string | null; booked: boolean } | null;
  /** The destination the event belongs to; for a journey, the one it arrives at. */
  stopId: string;
  activityId: string | null;
  legKey: string | null;
};

export type TripEventOptions = {
  /** Include activities the traveler marked as skipped, flagged `skipped`. Left out by default. */
  includeSkipped?: boolean;
};

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const position = (lat: unknown, lon: unknown) =>
  typeof lat === "number" && typeof lon === "number" && Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? { latitude: lat, longitude: lon } : null;

/**
 * The plan as dated events: activities, stays from check-in to check-out, and journeys between two destinations
 * that have a recorded departure or arrival. Empty without exact trip dates. An event with a malformed time or a
 * date outside the plan is left out rather than breaking the rest.
 *
 * Order: each destination's activities then its stays, in route order, then the journeys; callers sort for display.
 * A destination whose time zone is not a real zone makes this throw (as the calendar file always did), so callers wrap it.
 */
export function tripEvents(trip: Trip, options: TripEventOptions = {}): TripEvent[] {
  if (trip.mode !== "exact" || !/^\d{4}-\d{2}-\d{2}$/.test(trip.start)) return [];
  const schedule = routeSchedule(trip);
  const events: TripEvent[] = [];
  const valid = (...d: Date[]) => d.every((x) => !Number.isNaN(x.valueOf()));

  for (const s of schedule) {
    for (const a of trip.activities.filter((x) => x.stopId === s.stop.id)) {
      if (a.skipped && !options.includeSkipped) continue;
      const date = provisionalDate(trip, s.arrivalDay + a.day - 1);
      if (!date || !TIME.test(a.start) || !Number.isFinite(a.minutes) || a.minutes <= 0) continue;
      const zone = s.stop.timezone;
      const startUtc = zonedToUtc(date, a.start, zone);
      const endUtc = new Date(startUtc.getTime() + a.minutes * 60000);
      if (!valid(startUtc, endUtc)) continue;
      const end = localParts(endUtc, zone);
      events.push({
        id: `activity-${a.id}`, kind: "activity", title: a.title, allDay: false, marker: false, skipped: !!a.skipped,
        start: { date, time: a.start, zone }, end: { date: end.date, time: end.time, zone }, startUtc, endUtc,
        location: a.place?.name ?? s.stop.name, details: [s.stop.name], position: position(a.place?.latitude, a.place?.longitude), stay: null,
        stopId: s.stop.id, activityId: a.id, legKey: null,
      });
    }
    const pref = trip.stayPreferences?.[s.stop.id];
    for (const stay of staysOf(pref)) {
      const span: [number, number] | null = stay.first_night != null && stay.last_night != null ? [stay.first_night, stay.last_night] : unclaimedSpan(pref, stay, s.stop.nights);
      if (!span || s.stop.nights < 1 || span[0] > s.stop.nights) continue;
      const inDate = provisionalDate(trip, s.arrivalDay + span[0] - 1), outDate = provisionalDate(trip, s.arrivalDay + Math.min(span[1], s.stop.nights));
      if (!inDate || !outDate) continue;
      const times = [stay.check_in && `check-in from ${stay.check_in}`, stay.check_out && `check-out by ${stay.check_out}`].filter(Boolean).join(", ");
      const zone = s.stop.timezone;
      events.push({
        id: `stay-${s.stop.id}-${span[0]}`, kind: "stay", title: `Stay: ${stay.name || "where you are staying"}`, allDay: true, marker: false, skipped: false,
        start: { date: inDate, time: null, zone }, end: { date: outDate, time: null, zone }, startUtc: null, endUtc: null,
        location: stay.address || s.stop.name,
        details: [times, stay.reference && `Your reference: ${stay.reference}`, stay.booked ? "You marked this as booked" : "Not marked as booked"].filter((x): x is string => !!x),
        position: position(stay.latitude, stay.longitude), stay: { name: stay.name, checkIn: stay.check_in || null, checkOut: stay.check_out || null, reference: stay.reference || null, booked: !!stay.booked }, stopId: s.stop.id, activityId: null, legKey: null,
      });
    }
  }

  routeLegs(trip).forEach((leg, i) => {
    // Only journeys between two destinations: both ends' time zones are known.
    if (i < 1 || i >= schedule.length) return;
    const pref = trip.travelPreferences?.[leg.key];
    if (!pref || (!pref.departure && !pref.arrival)) return;
    if ((pref.departure && !TIME.test(pref.departure)) || (pref.arrival && !TIME.test(pref.arrival))) return;
    const from = schedule[i - 1], to = schedule[i];
    const departDate = provisionalDate(trip, to.arrivalDay - (pref.overnight ?? 0)), arriveDate = provisionalDate(trip, to.arrivalDay);
    if (!departDate || !arriveDate) return;
    const title = `${leg.from} to ${leg.to}${pref.mode ? ` (${pref.mode})` : ""}`;
    const details = [pref.reference && `Your reference: ${pref.reference}`, pref.booked ? "You marked this as booked" : "Not marked as booked"].filter((x): x is string => !!x);
    const base = { id: `journey-${from.stop.id}-${to.stop.id}`, kind: "journey" as const, allDay: false, skipped: false, location: null, details, position: null, stay: null, stopId: to.stop.id, activityId: null, legKey: leg.key };
    if (pref.departure && pref.arrival) {
      const startUtc = zonedToUtc(departDate, pref.departure, from.stop.timezone);
      let endDate = arriveDate, endUtc = zonedToUtc(arriveDate, pref.arrival, to.stop.timezone);
      // An arrival that is not after the departure is the next day.
      if (endUtc <= startUtc) { endDate = addDays(arriveDate, 1); endUtc = zonedToUtc(endDate, pref.arrival, to.stop.timezone); }
      if (!valid(startUtc, endUtc)) return;
      events.push({ ...base, title, marker: false, start: { date: departDate, time: pref.departure, zone: from.stop.timezone }, end: { date: endDate, time: pref.arrival, zone: to.stop.timezone }, startUtc, endUtc });
    } else {
      // The app stores "not recorded" as an empty string, so this must test for empty, not for null.
      const point = pref.departure || pref.arrival;
      const zone = pref.departure ? from.stop.timezone : to.stop.timezone;
      const date = pref.departure ? departDate : arriveDate;
      const startUtc = zonedToUtc(date, point, zone);
      if (!valid(startUtc)) return;
      const endUtc = new Date(startUtc.getTime() + 15 * 60000);
      const end = localParts(endUtc, zone);
      events.push({ ...base, title: `${pref.departure ? "Departs" : "Arrives"}: ${title}`, marker: true, start: { date, time: point, zone }, end: { date: end.date, time: end.time, zone }, startUtc, endUtc });
    }
  });
  return events;
}
