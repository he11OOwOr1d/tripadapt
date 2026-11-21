import type { Trip } from "./adapter";
import { tripEvents, zonedToUtc } from "./trip-events";

/** Kept here so the calendar file's callers and tests have one place to import from. */
export { zonedToUtc };

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
/** A GEO line for a map position, to six decimals. */
function geoLine(point: { latitude: number; longitude: number } | null): string | null {
  return point ? `GEO:${+point.latitude.toFixed(6)};${+point.longitude.toFixed(6)}` : null;
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
  const planned = tripEvents(trip);
  if (!planned.length) return null;
  const note = "From your Elsewhere plan. Times and places are your plan, not confirmed bookings.";
  const stampNow = stamp(now);
  // Minutes since 2020: rises with every export, so a newer file always outranks an older one for the same event id.
  const sequence = Math.max(0, Math.floor((now.getTime() - Date.UTC(2020, 0, 1)) / 60000));
  const reminder = reminderOf(options.reminderMinutes);
  const link = safeUrl(options.planUrl);
  const events = planned.map((e) => {
    const geo = geoLine(e.position);
    // An all-day event has no start time to count back from, so it gets no reminder.
    const timed = !e.allDay && e.startUtc !== null && e.endUtc !== null;
    return [
      "BEGIN:VEVENT", `UID:${e.id.replace(/[^A-Za-z0-9._-]/g, "-")}@elsewhere.local`, `DTSTAMP:${stampNow}`, `LAST-MODIFIED:${stampNow}`, `SEQUENCE:${sequence}`,
      ...(timed ? [`DTSTART:${stamp(e.startUtc as Date)}`, `DTEND:${stamp(e.endUtc as Date)}`] : [`DTSTART;VALUE=DATE:${day(e.start.date)}`, `DTEND;VALUE=DATE:${day(e.end.date)}`]),
      `SUMMARY:${escapeText(e.title)}`,
      ...(e.location !== null ? [`LOCATION:${escapeText(e.location)}`] : []),
      `DESCRIPTION:${escapeText(sentences([...e.details, note]))}`,
      ...(geo ? [geo] : []),
      ...(link ? [`URL:${link}`] : []),
      ...(reminder !== null && timed ? ["BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${escapeText(e.title)}`, `TRIGGER:${alarmTrigger(reminder)}`, "END:VALARM"] : []),
      "END:VEVENT",
    ];
  });
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Elsewhere//Trip plan//EN", "CALSCALE:GREGORIAN", `X-WR-CALNAME:${escapeText(trip.title || "My trip")}`, ...events.flat(), "END:VCALENDAR"];
  return { text: lines.map(fold).join("\r\n") + "\r\n", events: events.length };
}
