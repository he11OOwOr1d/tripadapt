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

/** The UTC instant of a wall-clock time in a zone. Events are written in UTC so no calendar needs the zone's rules. */
export function zonedToUtc(date: string, time: string, timeZone: string): Date {
  const [y, m, d] = date.split("-").map(Number), [h, min] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, h, min);
  let t = guess - offsetMinutes(new Date(guess), timeZone) * 60000;
  const again = offsetMinutes(new Date(t), timeZone);
  if (again !== offsetMinutes(new Date(guess), timeZone)) t = guess - again * 60000;
  return new Date(t);
}

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const day = (iso: string) => iso.replace(/-/g, "");
/** RFC 5545 text escaping. */
export const escapeText = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Fold a content line at 75 octets, never inside a multi-byte character. */
export function fold(line: string): string {
  const encoder = new TextEncoder();
  const out: string[] = [];
  let current = "", size = 0, limit = 75;
  for (const ch of line) {
    const bytes = encoder.encode(ch).length;
    if (size + bytes > limit) { out.push(current); current = " "; size = 1; limit = 75; }
    current += ch; size += bytes;
  }
  out.push(current);
  return out.join("\r\n");
}

/** Join notes as sentences without doubling a full stop. */
const sentences = (parts: (string | false | undefined)[]) => parts.filter((x): x is string => !!x).map((x) => x.replace(/\.+$/, "")).join(". ") + ".";
const addDays = (iso: string, n: number) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

export type CalendarResult = { text: string; events: number };

/**
 * A calendar of the plan for a trip with exact dates, or null without them. Activities (skipped ones left out),
 * stays as all-day events from check-in to check-out, and journeys between two destinations that have a recorded
 * departure and arrival. Everything is the traveler's own plan, not a confirmed booking.
 */
export function icsCalendar(trip: Trip, now: Date = new Date()): CalendarResult | null {
  if (trip.mode !== "exact" || !/^\d{4}-\d{2}-\d{2}$/.test(trip.start)) return null;
  const schedule = routeSchedule(trip);
  const events: string[][] = [];
  const note = "From your Elsewhere plan. Times and places are your plan, not confirmed bookings.";
  const stampNow = stamp(now);
  const add = (uid: string, lines: string[]) => events.push(["BEGIN:VEVENT", `UID:${uid}@elsewhere.local`, `DTSTAMP:${stampNow}`, ...lines, "END:VEVENT"]);

  for (const s of schedule) {
    const activities = trip.activities.filter((a) => a.stopId === s.stop.id && !a.skipped);
    for (const a of activities) {
      const date = provisionalDate(trip, s.arrivalDay + a.day - 1);
      if (!date) continue;
      const start = zonedToUtc(date, a.start, s.stop.timezone);
      const end = new Date(start.getTime() + a.minutes * 60000);
      add(`activity-${a.id}`, [`DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`, `SUMMARY:${escapeText(a.title)}`, `LOCATION:${escapeText(a.place?.name ?? s.stop.name)}`, `DESCRIPTION:${escapeText(sentences([s.stop.name, note]))}`]);
    }
    const pref = trip.stayPreferences?.[s.stop.id];
    for (const stay of staysOf(pref)) {
      const span: [number, number] | null = stay.first_night != null && stay.last_night != null ? [stay.first_night, stay.last_night] : unclaimedSpan(pref, stay, s.stop.nights);
      if (!span || s.stop.nights < 1) continue;
      const inDate = provisionalDate(trip, s.arrivalDay + span[0] - 1), outDate = provisionalDate(trip, s.arrivalDay + Math.min(span[1], s.stop.nights));
      if (!inDate || !outDate) continue;
      const times = [stay.check_in && `check-in from ${stay.check_in}`, stay.check_out && `check-out by ${stay.check_out}`].filter(Boolean).join(", ");
      add(`stay-${s.stop.id}-${span[0]}`, [`DTSTART;VALUE=DATE:${day(inDate)}`, `DTEND;VALUE=DATE:${day(outDate)}`, `SUMMARY:${escapeText(`Stay: ${stay.name}`)}`, `LOCATION:${escapeText(stay.address || s.stop.name)}`, `DESCRIPTION:${escapeText(sentences([times, stay.reference && `Your reference: ${stay.reference}`, stay.booked ? "You marked this as booked" : "Not marked as booked", note]))}`]);
    }
  }

  const legs = routeLegs(trip);
  legs.forEach((leg, i) => {
    // Only journeys between two destinations: both ends' time zones are known.
    if (i < 1 || i >= schedule.length) return;
    const pref = trip.travelPreferences?.[leg.key];
    if (!pref || (!pref.departure && !pref.arrival)) return;
    const from = schedule[i - 1], to = schedule[i];
    const departDate = provisionalDate(trip, to.arrivalDay - (pref.overnight ?? 0)), arriveDate = provisionalDate(trip, to.arrivalDay);
    if (!departDate || !arriveDate) return;
    const title = `${leg.from} to ${leg.to}${pref.mode ? ` (${pref.mode})` : ""}`;
    const details = sentences([pref.reference && `Your reference: ${pref.reference}`, pref.booked ? "You marked this as booked" : "Not marked as booked", note]);
    if (pref.departure && pref.arrival) {
      const start = zonedToUtc(departDate, pref.departure, from.stop.timezone);
      let end = zonedToUtc(arriveDate, pref.arrival, to.stop.timezone);
      if (end <= start) end = zonedToUtc(addDays(arriveDate, 1), pref.arrival, to.stop.timezone);
      add(`journey-${i}`, [`DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`, `SUMMARY:${escapeText(title)}`, `DESCRIPTION:${escapeText(details)}`]);
    } else {
      const point = pref.departure ?? pref.arrival ?? "00:00";
      const zone = pref.departure ? from.stop.timezone : to.stop.timezone;
      const start = zonedToUtc(pref.departure ? departDate : arriveDate, point, zone);
      add(`journey-${i}`, [`DTSTART:${stamp(start)}`, `DTEND:${stamp(new Date(start.getTime() + 15 * 60000))}`, `SUMMARY:${escapeText(`${pref.departure ? "Departs" : "Arrives"}: ${title}`)}`, `DESCRIPTION:${escapeText(details)}`]);
    }
  });
  if (!events.length) return null;
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Elsewhere//Trip plan//EN", "CALSCALE:GREGORIAN", `X-WR-CALNAME:${escapeText(trip.title || "My trip")}`, ...events.flat(), "END:VCALENDAR"];
  return { text: lines.map(fold).join("\r\n") + "\r\n", events: events.length };
}
