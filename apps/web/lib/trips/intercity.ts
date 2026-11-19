import type { Stop, Trip } from "./adapter";
import type { IntercityCheck, IntercityEnd } from "./journeys";

/** One end of a journey: a name to show and, when it can be mapped, how the server finds it. */
export type JourneyPlace = { name: string; end: IntercityEnd | null; /** The place's own coordinates when known, used only to avoid offering a journey from a place to itself. */ point?: { latitude: number; longitude: number } };

/** "4 h 30 min", "1 h", "45 min": whole minutes only, no false precision. */
export function formatTravelTime(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60), m = total % 60;
  return [h ? `${h} h` : "", m || !h ? `${m} min` : ""].filter(Boolean).join(" ");
}

/** A destination is mapped only when it has a retained location reference. */
export function stopPlace(stop?: Stop): JourneyPlace | undefined {
  return stop ? { name: stop.name, end: stop.location?.reference_id ? { reference_id: stop.location.reference_id } : null, ...(stop.location ? { point: { latitude: stop.location.latitude, longitude: stop.location.longitude } } : {}) } : undefined;
}

/** The trip's starting point is mapped only when it was chosen from a map search; a typed name is never geocoded. */
export function originPlace(trip: Pick<Trip, "origin" | "originPoint">): JourneyPlace {
  const p = trip.originPoint;
  return { name: trip.origin || "Starting point", end: p ? { latitude: p.latitude, longitude: p.longitude } : null, ...(p ? { point: { latitude: p.latitude, longitude: p.longitude } } : {}) };
}

const same = (a: IntercityEnd, b: IntercityEnd) =>
  "reference_id" in a && "reference_id" in b ? a.reference_id === b.reference_id : "latitude" in a && "latitude" in b && a.latitude === b.latitude && a.longitude === b.longitude;

/** Both ends must be mapped and different. */
// About 100 m: two places this close are the same place for a journey.
const near = (a?: { latitude: number; longitude: number }, b?: { latitude: number; longitude: number }) => !!a && !!b && Math.abs(a.latitude - b.latitude) < 0.001 && Math.abs(a.longitude - b.longitude) < 0.001;

export function intercityEndpoints(from?: JourneyPlace, to?: JourneyPlace): { origin: IntercityEnd; destination: IntercityEnd } | null {
  const a = from?.end, b = to?.end;
  return a && b && !same(a, b) && !near(from?.point, to?.point) ? { origin: a, destination: b } : null;
}

export function intercityHeadline(result: IntercityCheck): string {
  return `About ${formatTravelTime(result.travel_minutes)} by road · ${(result.distance_meters / 1000).toFixed(0)} km`;
}

/** Hours for the traveler's own "travel time" field: rounded up to the next hundredth, e.g. 187 min -> "3.12". */
export function hoursFromMinutes(minutes: number): string {
  // Hundredths of an hour are minutes * 5 / 3; scale to integers first so floating-point error (33 min: 55.00000000000001) cannot round up.
  return String(Math.ceil(Math.round(Math.max(0, minutes) * 5000) / 3000) / 100);
}

type TravelPreferences = NonNullable<Trip["travelPreferences"]>;

/** Immutable update of one journey's hours, creating the journey's default entry if it has none. */
export function withTravelHours(prefs: Trip["travelPreferences"], key: string, hours: string): TravelPreferences {
  const previous = prefs?.[key] ?? { mode: "", hours: "", overnight: 0, rate: "", basis: "person" as const };
  return { ...prefs, [key]: { ...previous, hours } };
}

