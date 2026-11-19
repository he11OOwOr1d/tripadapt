import type { Trip } from "./adapter";
import { routeLegs } from "./planning";

type Prefs = NonNullable<Trip["travelPreferences"]>;
export type TransferBooking = { departure: string; arrival: string; reference: string; booked: boolean; arrival_buffer: number; departure_buffer: number };
export const BUFFER_MAX = 240;

export const REFERENCE_MAX = 100;
const TIME = /^$|^([01][0-9]|2[0-3]):[0-5][0-9]$/;
const plain = (v: string) => ![...v].some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127);

/** Returns the saved booking, or a traveler-facing reason it cannot be saved yet. */
export function finishBooking(input: TransferBooking): { booking: TransferBooking } | { error: string } {
  const reference = input.reference.trim();
  if (!TIME.test(input.departure)) return { error: "Enter the departure as a time, or leave it blank." };
  if (!TIME.test(input.arrival)) return { error: "Enter the arrival as a time, or leave it blank." };
  if (reference.length > REFERENCE_MAX || !plain(reference)) return { error: `Keep the reference to ${REFERENCE_MAX} plain characters.` };
  for (const minutes of [input.arrival_buffer, input.departure_buffer])
    if (!Number.isSafeInteger(minutes) || minutes < 0 || minutes > BUFFER_MAX) return { error: `Enter a buffer from 0 to ${BUFFER_MAX} minutes, or leave it blank.` };
  return { booking: { departure: input.departure, arrival: input.arrival, reference, booked: input.booked, arrival_buffer: input.arrival_buffer, departure_buffer: input.departure_buffer } };
}

/** Immutable update of one journey's booking fields; the mode, hours, nights and allowance stay as they were. */
export function withTransferBooking(prefs: Trip["travelPreferences"], key: string, booking: TransferBooking): Prefs {
  const previous = prefs?.[key] ?? { mode: "", hours: "", overnight: 0, rate: "", basis: "person" as const };
  return { ...prefs, [key]: { ...previous, ...booking } };
}

export const hasBooking = (p?: Prefs[string]) => !!p && !!(p.departure || p.arrival || p.reference || p.booked || p.arrival_buffer || p.departure_buffer);

/** One honest line about what the traveler entered. */
export function bookingSummary(p?: Prefs[string]): string | null {
  if (!hasBooking(p) || !p) return null;
  return [
    p.booked ? "Marked as booked by you" : "Your planned times",
    p.departure && `departs ${p.departure}`,
    p.arrival && `arrives ${p.arrival}`,
    p.reference && `reference ${p.reference}`,
    p.arrival_buffer ? `${p.arrival_buffer} min allowed to settle in` : "",
    p.departure_buffer ? `be there ${p.departure_buffer} min before` : "",
  ].filter(Boolean).join(" · ") + ". As you entered it; not checked with the supplier.";
}

/**
 * Activities that clash with the times the traveler recorded for the journeys into and out of a stop.
 * Arrival counts on the stop's first day, departure on its last. No boarding or check-in buffer is added:
 * the traveler's own times are taken as they are.
 */
export function transferConflicts(trip: Trip, stopId: string, day: number): Record<string, string[]> {
  const index = trip.stops.findIndex((s) => s.id === stopId);
  if (index < 0) return {};
  const legs = routeLegs(trip);
  const arrival = trip.travelPreferences?.[legs[index]?.key ?? ""]?.arrival;
  const departure = trip.travelPreferences?.[legs[index + 1]?.key ?? ""]?.departure;
  const settle = trip.travelPreferences?.[legs[index]?.key ?? ""]?.arrival_buffer ?? 0;
  const gate = trip.travelPreferences?.[legs[index + 1]?.key ?? ""]?.departure_buffer ?? 0;
  const lastDay = trip.stops[index].nights + 1;
  const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  const result: Record<string, string[]> = {};
  for (const a of trip.activities) {
    if (a.stopId !== stopId || a.day !== day || a.skipped) continue;
    const start = minutes(a.start), end = start + a.minutes;
    const issues: string[] = [];
    if (day === 1 && arrival) {
      if (start < minutes(arrival)) issues.push(`Starts before your recorded arrival at ${arrival}.`);
      else if (start < minutes(arrival) + settle) issues.push(`Starts inside the ${settle} minutes you allowed to settle in after arriving at ${arrival}.`);
    }
    if (day === lastDay && departure) {
      if (end > minutes(departure)) issues.push(`Runs past your recorded departure at ${departure}.`);
      else if (end > minutes(departure) - gate) issues.push(`Ends inside the ${gate} minutes you allowed before departing at ${departure}.`);
    }
    if (issues.length) result[a.id] = issues;
  }
  return result;
}

/** Combine two issue maps without losing either side. */
export function mergeIssues(a: Record<string, string[]>, b: Record<string, string[]>): Record<string, string[]> {
  const out: Record<string, string[]> = { ...a };
  for (const [id, issues] of Object.entries(b)) out[id] = [...(out[id] ?? []), ...issues];
  return out;
}
