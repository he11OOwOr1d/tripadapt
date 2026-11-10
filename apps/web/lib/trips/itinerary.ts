import type { Activity, Trip } from "./adapter";
import { routeLegs, timeAllocation } from "./planning";
export const clockMinutes = (value: string) => {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
};
export function clock(value: number) {
  if (!Number.isFinite(value)) return "—";
  const n = Math.max(0, Math.min(1440, value));
  return `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
}
export function routeSchedule(trip: Trip) {
  const legs = routeLegs(trip);
  let offset = legs.length
    ? (trip.travelPreferences?.[legs[0].key]?.overnight ?? 0)
    : 0;
  return trip.stops.map((stop, index) => {
    const arrivalDay = offset + 1,
      departureDay = arrivalDay + stop.nights;
    const result = {
      stop,
      index,
      arrivalDay,
      departureDay,
      days: stop.nights + 1,
      inbound: legs[index],
      outbound: legs[index + 1],
    };
    offset +=
      stop.nights +
      (legs[index + 1]
        ? (trip.travelPreferences?.[legs[index + 1].key]?.overnight ?? 0)
        : 0);
    return result;
  });
}
export function provisionalDate(trip: Trip, globalDay: number) {
  if (trip.mode !== "exact" || !/^\d{4}-\d{2}-\d{2}$/.test(trip.start))
    return null;
  const date = new Date(trip.start + "T12:00:00Z");
  date.setUTCDate(date.getUTCDate() + globalDay - 1);
  return Number.isNaN(date.valueOf()) ? null : date.toISOString().slice(0, 10);
}
export function displayDate(iso: string) {
  return new Intl.DateTimeFormat("en", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(iso + "T12:00:00Z"));
}
export function dayConflicts(trip: Trip, stopId: string, day: number) {
  const activities = trip.activities.filter(
    (a) => a.stopId === stopId && a.day === day,
  );
  const messages: Record<string, string[]> = {};
  for (const item of activities) {
    const start = clockMinutes(item.start),
      end = start + item.minutes;
    const issues = [];
    if (end > 1440)
      issues.push("Ends after midnight. Split this into two day blocks.");
    for (const other of activities) {
      if (
        other.id !== item.id &&
        clockMinutes(other.start) < end &&
        clockMinutes(other.start) + other.minutes > start
      )
        issues.push(`Overlaps ${other.title}.`);
    }
    if (issues.length) messages[item.id] = issues;
  }
  return messages;
}
export type DayEntry =
  | { type: "activity"; activity: Activity }
  | { type: "gap"; start: number; end: number };
export function dayTimeline(activities: Activity[]): DayEntry[] {
  const sorted = [...activities].sort(
    (a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id),
  );
  const start = Math.min(480, ...sorted.map((a) => clockMinutes(a.start)));
  const end = Math.min(
    1440,
    Math.max(1320, ...sorted.map((a) => clockMinutes(a.start) + a.minutes)),
  );
  const entries: DayEntry[] = [];
  let cursor = start;
  for (const activity of sorted) {
    const begins = clockMinutes(activity.start);
    if (begins > cursor)
      entries.push({ type: "gap", start: cursor, end: begins });
    entries.push({ type: "activity", activity });
    cursor = Math.max(cursor, Math.min(1440, begins + activity.minutes));
  }
  if (cursor < end) entries.push({ type: "gap", start: cursor, end });
  return entries;
}
export function activityProblems(activity: Activity, trip: Trip) {
  const stop = trip.stops.find((s) => s.id === activity.stopId);
  const issues = [];
  if (!activity.title.trim()) issues.push("Give this part of the day a name.");
  if (!stop) issues.push("Choose a destination in this trip.");
  if (
    !Number.isSafeInteger(activity.day) ||
    activity.day < 1 ||
    (stop && activity.day > stop.nights + 1)
  )
    issues.push(
      `Choose a day from 1 to ${stop?.nights !== undefined ? stop.nights + 1 : "the end of this stay"}.`,
    );
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(activity.start))
    issues.push("Choose a local start time.");
  if (!Number.isSafeInteger(activity.minutes) || activity.minutes < 1)
    issues.push("Enter a whole number of minutes greater than zero.");
  if (clockMinutes(activity.start) + activity.minutes > 1440)
    issues.push(
      "This ends after midnight. Shorten it or split it across two days.",
    );
  return issues;
}
export function itineraryStats(trip: Trip) {
  const time = timeAllocation(trip);
  return {
    days: time.days,
    unallocated: time.remaining,
    activities: trip.activities.length,
    needsDay: trip.activities.filter((a) => {
      const stop = trip.stops.find((s) => s.id === a.stopId);
      return !stop || a.day > stop.nights + 1;
    }),
  };
}
export function tripUrl(
  id: string | null,
  selection?: { view: string; stop: string; day: number },
) {
  const params = new URLSearchParams();
  if (id) params.set("trip", id);
  if (selection?.view === "itinerary") {
    params.set("view", "itinerary");
    if (selection.stop) params.set("stop", selection.stop);
    params.set("day", String(selection.day));
  }
  return "/trips/new" + (params.size ? "?" + params.toString() : "");
}
