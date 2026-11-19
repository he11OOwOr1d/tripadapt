import type { Stop } from "./adapter";
import type { IntercityCheck } from "./journeys";

/** "4 h 30 min", "1 h", "45 min": whole minutes only, no false precision. */
export function formatTravelTime(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60), m = total % 60;
  return [h ? `${h} h` : "", m || !h ? `${m} min` : ""].filter(Boolean).join(" ");
}

/** Both destinations need a retained map location; the trip origin is only a name and is never guessed. */
export function intercityEndpoints(from?: Stop, to?: Stop): { from: string; to: string } | null {
  const a = from?.location?.reference_id, b = to?.location?.reference_id;
  return a && b && a !== b ? { from: a, to: b } : null;
}

export function intercityHeadline(result: IntercityCheck): string {
  return `About ${formatTravelTime(result.travel_minutes)} by road · ${(result.distance_meters / 1000).toFixed(0)} km`;
}
