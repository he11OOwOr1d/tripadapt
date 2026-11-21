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
export const escapeText = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r\n|\r|\n/g, "\\n");

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

export type CalendarOptions = {
  /** Minutes before each timed event to remind the traveler. Stays are all-day events and never get one. Off when absent. */
  reminderMinutes?: number | null;
  /** A link back to this plan, written on every event. Only an http or https address is used. */
  planUrl?: string;
};
/** Reminder choices offered in the page, in minutes. */
export const REMINDER_CHOICES = [15, 60, 1440] as const;

/** A reminder length in whole minutes that a calendar will accept (up to a week), else none. */
function reminderOf(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 10080 ? value : null;
}
/** An RFC 5545 duration for a reminder `n` minutes before the start. */
export function alarmTrigger(n: number): string {
  return n % 1440 === 0 ? `-P${n / 1440}D` : n % 60 === 0 ? `-PT${n / 60}H` : `-PT${n}M`;
}
/** Only a well-formed http or https address is written, in its normalised form. An address with a space or any control character (a line break would start a new property) is refused, not repaired. */
function safeUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value || /[\s\u0000-\u001f\u007f]/.test(value)) return null;
  try { const u = new URL(value); return u.protocol === "https:" || u.protocol === "http:" ? u.href : null; } catch { return null; }
}
/** A GEO line for a real map position, else nothing. */
function geoLine(lat: unknown, lon: unknown): string | null {
  return typeof lat === "number" && typeof lon === "number" && Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? `GEO:${+lat.toFixed(6)};${+lon.toFixed(6)}` : null;
}

/**
 * A calendar of the plan for a trip with exact dates, or null without them. Activities (skipped ones left out),
 * stays as all-day events from check-in to check-out, and journeys between two destinations that have a recorded
 * departure and arrival. Everything is the traveler's own plan, not a confirmed booking.
 *
 * Events keep the same ids from one export to the next and carry LAST-MODIFIED and a SEQUENCE that rises with the export
 * time, so importing a newer file into the same calendar should update them rather than add copies (apps differ).
 */
export function icsCalendar(trip: Trip, now: Date = new Date(), options: CalendarOptions = {}): CalendarResult | null {
  if (trip.mode !== "exact" || !/^\d{4}-\d{2}-\d{2}$/.test(trip.start)) return null;
  const schedule = routeSchedule(trip);
  const events: string[][] = [];
  const note = "From your Elsewhere plan. Times and places are your plan, not confirmed bookings.";
  const stampNow = stamp(now);
  // Minutes since 2020: rises with every export, so a newer file always outranks an older one for the same event id.
  const sequence = Math.max(0, Math.floor((now.getTime() - Date.UTC(2020, 0, 1)) / 60000));
  const reminder = reminderOf(options.reminderMinutes);
  const link = safeUrl(options.planUrl);
  const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
  const valid = (...d: Date[]) => d.every((x) => !Number.isNaN(x.valueOf()));
  // `alarmTitle` is given only for timed events: an all-day event has no start time to count back from.
  const add = (uid: string, lines: string[], alarmTitle?: string) => events.push(["BEGIN:VEVENT", `UID:${uid.replace(/[^A-Za-z0-9._-]/g, "-")}@elsewhere.local`, `DTSTAMP:${stampNow}`, `LAST-MODIFIED:${stampNow}`, `SEQUENCE:${sequence}`, ...lines, ...(link ? [`URL:${link}`] : []), ...(reminder !== null && alarmTitle !== undefined ? ["BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${escapeText(alarmTitle)}`, `TRIGGER:${alarmTrigger(reminder)}`, "END:VALARM"] : []), "END:VEVENT"]);

  for (const s of schedule) {
    const activities = trip.activities.filter((a) => a.stopId === s.stop.id && !a.skipped);
    for (const a of activities) {
      const date = provisionalDate(trip, s.arrivalDay + a.day - 1);
      if (!date || !TIME.test(a.start) || !Number.isFinite(a.minutes) || a.minutes <= 0) continue;
      const start = zonedToUtc(date, a.start, s.stop.timezone);
      const end = new Date(start.getTime() + a.minutes * 60000);
      if (!valid(start, end)) continue;
      const geo = geoLine(a.place?.latitude, a.place?.longitude);
      add(`activity-${a.id}`, [`DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`, `SUMMARY:${escapeText(a.title)}`, `LOCATION:${escapeText(a.place?.name ?? s.stop.name)}`, `DESCRIPTION:${escapeText(sentences([s.stop.name, note]))}`, ...(geo ? [geo] : [])], a.title);
    }
    const pref = trip.stayPreferences?.[s.stop.id];
    for (const stay of staysOf(pref)) {
      const span: [number, number] | null = stay.first_night != null && stay.last_night != null ? [stay.first_night, stay.last_night] : unclaimedSpan(pref, stay, s.stop.nights);
      if (!span || s.stop.nights < 1 || span[0] > s.stop.nights) continue;
      const inDate = provisionalDate(trip, s.arrivalDay + span[0] - 1), outDate = provisionalDate(trip, s.arrivalDay + Math.min(span[1], s.stop.nights));
      if (!inDate || !outDate) continue;
      const times = [stay.check_in && `check-in from ${stay.check_in}`, stay.check_out && `check-out by ${stay.check_out}`].filter(Boolean).join(", ");
      const geo = geoLine(stay.latitude, stay.longitude);
      add(`stay-${s.stop.id}-${span[0]}`, [`DTSTART;VALUE=DATE:${day(inDate)}`, `DTEND;VALUE=DATE:${day(outDate)}`, `SUMMARY:${escapeText(`Stay: ${stay.name || "where you are staying"}`)}`, `LOCATION:${escapeText(stay.address || s.stop.name)}`, `DESCRIPTION:${escapeText(sentences([times, stay.reference && `Your reference: ${stay.reference}`, stay.booked ? "You marked this as booked" : "Not marked as booked", note]))}`, ...(geo ? [geo] : [])]);
    }
  }

  const legs = routeLegs(trip);
  legs.forEach((leg, i) => {
    // Only journeys between two destinations: both ends' time zones are known.
    if (i < 1 || i >= schedule.length) return;
    const pref = trip.travelPreferences?.[leg.key];
    if (!pref || (!pref.departure && !pref.arrival)) return;
    if ((pref.departure && !TIME.test(pref.departure)) || (pref.arrival && !TIME.test(pref.arrival))) return;
    const from = schedule[i - 1], to = schedule[i];
    const departDate = provisionalDate(trip, to.arrivalDay - (pref.overnight ?? 0)), arriveDate = provisionalDate(trip, to.arrivalDay);
    if (!departDate || !arriveDate) return;
    const title = `${leg.from} to ${leg.to}${pref.mode ? ` (${pref.mode})` : ""}`;
    const details = sentences([pref.reference && `Your reference: ${pref.reference}`, pref.booked ? "You marked this as booked" : "Not marked as booked", note]);
    if (pref.departure && pref.arrival) {
      const start = zonedToUtc(departDate, pref.departure, from.stop.timezone);
      let end = zonedToUtc(arriveDate, pref.arrival, to.stop.timezone);
      if (end <= start) end = zonedToUtc(addDays(arriveDate, 1), pref.arrival, to.stop.timezone);
      if (!valid(start, end)) return;
      add(`journey-${from.stop.id}-${to.stop.id}`, [`DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`, `SUMMARY:${escapeText(title)}`, `DESCRIPTION:${escapeText(details)}`], title);
    } else {
      const point = pref.departure ?? pref.arrival ?? "00:00";
      const zone = pref.departure ? from.stop.timezone : to.stop.timezone;
      const start = zonedToUtc(pref.departure ? departDate : arriveDate, point, zone);
      if (!valid(start)) return;
      const label = `${pref.departure ? "Departs" : "Arrives"}: ${title}`;
      add(`journey-${from.stop.id}-${to.stop.id}`, [`DTSTART:${stamp(start)}`, `DTEND:${stamp(new Date(start.getTime() + 15 * 60000))}`, `SUMMARY:${escapeText(label)}`, `DESCRIPTION:${escapeText(details)}`], label);
    }
  });
  if (!events.length) return null;
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Elsewhere//Trip plan//EN", "CALSCALE:GREGORIAN", `X-WR-CALNAME:${escapeText(trip.title || "My trip")}`, ...events.flat(), "END:VCALENDAR"];
  return { text: lines.map(fold).join("\r\n") + "\r\n", events: events.length };
}
