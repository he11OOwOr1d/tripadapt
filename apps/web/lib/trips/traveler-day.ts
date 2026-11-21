/** The window the day view shows when the traveler has set no hours: 08:00 to 22:00, in minutes after midnight. */
export const DEFAULT_VIEW = { start: 8 * 60, end: 22 * 60 } as const;
/** Where "Add activity" suggests starting when the traveler has set no hours. */
export const DEFAULT_SUGGESTED_START = 9 * 60;
/** The shortest day a traveler may ask for. Mirrors the API. */
export const MIN_DAY_MINUTES = 4 * 60;

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const minutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
export const clockText = (value: number) => `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;

/**
 * Whether a pair of daily hours is acceptable: both empty (the default day), or both set as HH:MM with the end at
 * least four hours after the start, within one day. Same rule as the API, so a draft is never saved that it would refuse.
 */
export function validDayHours(start: unknown, end: unknown): boolean {
  const a = start ?? "", b = end ?? "";
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a === "" && b === "") return true;
  if (!TIME.test(a) || !TIME.test(b)) return false;
  return minutes(b) - minutes(a) >= MIN_DAY_MINUTES;
}

/** A sentence for what is wrong with a pair of hours, or "" when they are fine. */
export function dayHoursProblem(start: unknown, end: unknown): string {
  if (validDayHours(start, end)) return "";
  const a = start ?? "", b = end ?? "";
  if ((a === "") !== (b === "")) return "Set both the start and the end of your day, or leave both empty.";
  if (typeof a === "string" && typeof b === "string" && TIME.test(a) && TIME.test(b)) return "Your day needs to cover at least four hours, and end by midnight.";
  return "Use times like 07:30 and 22:00.";
}

export type TravelerDay = { start: number; end: number; custom: boolean; label: string };

/** The traveler's day, or the default view window when they have not set hours or the hours are not usable. */
export function travelerDay(trip: { dayStart?: string; dayEnd?: string }): TravelerDay {
  const set = !!trip.dayStart && !!trip.dayEnd && validDayHours(trip.dayStart, trip.dayEnd);
  const start = set ? minutes(trip.dayStart as string) : DEFAULT_VIEW.start;
  const end = set ? minutes(trip.dayEnd as string) : DEFAULT_VIEW.end;
  return { start, end, custom: set, label: `${clockText(start)}–${clockText(end)}` };
}
