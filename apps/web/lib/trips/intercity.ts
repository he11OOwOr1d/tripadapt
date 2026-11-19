import type { Stop, Trip } from "./adapter";
import type { IntercityCheck, IntercityEnd } from "./journeys";

/** One end of a journey: a name to show and, when it can be mapped, how the server finds it. */
export type JourneyPlace = { name: string; end: IntercityEnd | null };

/** "4 h 30 min", "1 h", "45 min": whole minutes only, no false precision. */
export function formatTravelTime(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60), m = total % 60;
  return [h ? `${h} h` : "", m || !h ? `${m} min` : ""].filter(Boolean).join(" ");
}

/** A destination is mapped only when it has a retained location reference. */
export function stopPlace(stop?: Stop): JourneyPlace | undefined {
  return stop ? { name: stop.name, end: stop.location?.reference_id ? { reference_id: stop.location.reference_id } : null } : undefined;
}

/** The trip's starting point is mapped only when it was chosen from a map search; a typed name is never geocoded. */
export function originPlace(trip: Pick<Trip, "origin" | "originPoint">): JourneyPlace {
  const p = trip.originPoint;
  return { name: trip.origin || "Starting point", end: p ? { latitude: p.latitude, longitude: p.longitude } : null };
}

const same = (a: IntercityEnd, b: IntercityEnd) =>
  "reference_id" in a && "reference_id" in b ? a.reference_id === b.reference_id : "latitude" in a && "latitude" in b && a.latitude === b.latitude && a.longitude === b.longitude;

/** Both ends must be mapped and different. */
export function intercityEndpoints(from?: JourneyPlace, to?: JourneyPlace): { origin: IntercityEnd; destination: IntercityEnd } | null {
  const a = from?.end, b = to?.end;
  return a && b && !same(a, b) ? { origin: a, destination: b } : null;
}

export function intercityHeadline(result: IntercityCheck): string {
  return `About ${formatTravelTime(result.travel_minutes)} by road · ${(result.distance_meters / 1000).toFixed(0)} km`;
}
