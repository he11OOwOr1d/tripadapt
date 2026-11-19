import type { Trip } from "./adapter";
import { routeLegs } from "./planning";
import { formatTravelTime, intercityEndpoints, originPlace, stopPlace, type JourneyPlace } from "./intercity";
import type { IntercityCheck } from "./journeys";

export type RouteJourney = { key: string; from: JourneyPlace; to: JourneyPlace };

/** The route's journeys in order (start, each destination, then back to the start when the trip returns), paired with their map ends. */
export function routeJourneys(trip: Trip): RouteJourney[] {
  const places: JourneyPlace[] = [originPlace(trip), ...trip.stops.map((s) => stopPlace(s) as JourneyPlace)];
  if (trip.returnToOrigin !== false) places.push(originPlace(trip));
  else if (trip.finish) places.push({ name: trip.finish, end: null });
  return routeLegs(trip).map((leg, i) => ({ key: leg.key, from: places[i], to: places[i + 1] }));
}

/** A journey can be estimated only when both of its ends are mapped and different. */
export const estimable = (j: RouteJourney) => intercityEndpoints(j.from, j.to) !== null;

export type DriveSummary = { total: number; estimable: number; checked: number; minutes: number; meters: number; complete: boolean };

/** Totals only over journeys that were actually estimated; `complete` means every journey on the route was. */
export function driveSummary(journeys: RouteJourney[], results: Record<string, IntercityCheck | undefined>): DriveSummary {
  const done = journeys.filter((j) => results[j.key]);
  return {
    total: journeys.length,
    estimable: journeys.filter(estimable).length,
    checked: done.length,
    minutes: done.reduce((n, j) => n + (results[j.key]?.travel_minutes ?? 0), 0),
    meters: done.reduce((n, j) => n + (results[j.key]?.distance_meters ?? 0), 0),
    complete: journeys.length > 0 && done.length === journeys.length,
  };
}

export function driveSummaryLine(s: DriveSummary): string {
  if (!s.checked) return "No journeys estimated yet.";
  const road = `${formatTravelTime(s.minutes)} of driving · ${(s.meters / 1000).toFixed(0)} km`;
  return s.complete
    ? `About ${road} across ${s.total} ${s.total === 1 ? "journey" : "journeys"}.`
    : `About ${road} across the ${s.checked} of ${s.total} journeys estimated so far.`;
}
