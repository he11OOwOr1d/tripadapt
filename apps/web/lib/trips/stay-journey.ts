import type { Activity } from "./adapter";
import type { Lodging } from "./lodging";
import type { StayJourneyCheck } from "./journeys";

/** The day's first planned visit: earliest start, ignoring ones the traveler marked as not happening. */
export function firstVisit(activities: Activity[]): Activity | undefined {
  return [...activities].filter((a) => !a.skipped).sort((a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id))[0];
}

/** Both ends need map coordinates; names are never geocoded. */
export function stayLegReady(lodging: Lodging | null | undefined, visit: Activity | undefined) {
  return lodging?.latitude != null && lodging.longitude != null && !!visit?.place;
}

export function stayJourneyHeadline(result: StayJourneyCheck, visitTitle: string, visitStart: string) {
  return result.status === "leave_by" && result.leave_by
    ? `Leave by ${result.leave_by} to reach ${visitTitle} at ${visitStart}`
    : `${visitTitle} starts at ${visitStart}, which is too early for this trip. Start it later.`;
}
