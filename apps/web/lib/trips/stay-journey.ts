import type { Activity } from "./adapter";
import type { Lodging } from "./lodging";
import type { StayJourneyCheck, StayReturnCheck } from "./journeys";

const minutes = (time: string) => { const [h, m] = time.split(":").map(Number); return h * 60 + m; };

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

/** The day's last planned visit: latest end, ignoring skipped ones. */
export function lastVisit(activities: Activity[]): Activity | undefined {
  const end = (a: Activity) => minutes(a.start) + a.minutes;
  return [...activities].filter((a) => !a.skipped).sort((a, b) => end(b) - end(a) || b.id.localeCompare(a.id))[0];
}

/** The clock time a visit ends, or null when it runs past midnight (the day should be split). */
export function visitEnd(visit: Activity): string | null {
  const end = minutes(visit.start) + visit.minutes;
  return end >= 1440 ? null : `${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`;
}

export function stayReturnHeadline(result: StayReturnCheck, visitTitle: string, visitEndTime: string) {
  return result.status === "arrive_by" && result.arrive_by
    ? `Leaving ${visitTitle} at ${visitEndTime}, you would be back at your stay by ${result.arrive_by}`
    : `Leaving ${visitTitle} at ${visitEndTime}, you would reach your stay after midnight.`;
}

/**
 * When the recorded check-in/out times mean the traveler may not be at the stay
 * for this leg. Only the arrival day uses check-in and only the departure day
 * uses check-out; times compare as zero-padded HH:MM strings.
 */
export function stayTimingNote(lodging: Lodging | null | undefined, leg: "out" | "back", visit: Activity, firstDay: boolean, lastDay: boolean): string | null {
  if (!lodging) return null;
  const end = visitEnd(visit);
  if (firstDay && lodging.check_in) {
    const early = leg === "out" ? visit.start < lodging.check_in : end !== null && end < lodging.check_in;
    if (early) return `Check-in is from ${lodging.check_in}, so you may not be at your stay yet. This estimate assumes you ${leg === "out" ? "start from" : "return to"} it.`;
  }
  // Out: the visit starts after check-out. Back: it ends after check-out (or runs past midnight).
  const late = leg === "out" ? visit.start >= (lodging.check_out ?? "") : end === null || end > (lodging.check_out ?? "");
  if (lastDay && lodging.check_out && late) {
    return `You check out at ${lodging.check_out}, ${leg === "out" ? "before this visit starts" : "before this visit ends"}, so you may have left your stay by then. This estimate assumes you ${leg === "out" ? "start from" : "return to"} it.`;
  }
  return null;
}
