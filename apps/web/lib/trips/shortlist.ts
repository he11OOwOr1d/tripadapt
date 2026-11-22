import type { Activity, Stop, Trip } from "./adapter";
import { isActivityPlace, type ActivityPlace } from "./activity-search";
import { dayTimeline } from "./itinerary";
import { splitForJourneys } from "./transfers";
import { clockText, travelerDay } from "./traveler-day";

/**
 * A destination's shortlist: places and things the traveler wants, before they have a day or a time (PRD FR-02).
 * It is the traveler's own list. A saved place is a copy of what the nearby search returned; nothing here is a
 * booking, an opening time or a promise that it fits. Mirrors the API's `WishItem`.
 */
export type WishPlace = ActivityPlace & { category: Exclude<ActivityPlace["category"], "lodging"> };
export type Wish = { id: string; label: string; note: string; must: boolean; minutes: number | null; place: WishPlace | null };
export type Shortlists = Record<string, Wish[]>;

export const MAX_WISHES = 30;
export const MAX_LABEL = 120;
export const MAX_NOTE = 300;
/** What planning assumes for a place whose length the traveler has not set. Always said out loud, never hidden. */
export const ASSUMED_MINUTES = 60;
export const MIN_WISH_MINUTES = 5;
export const MAX_WISH_MINUTES = 720;

const hasControl = (text: string) => [...text].some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127);

export function isWish(value: unknown): value is Wish {
  if (!value || typeof value !== "object") return false;
  const w = value as Record<string, unknown>;
  const place = w.place;
  return (
    Object.keys(w).every((k) => ["id", "label", "note", "must", "minutes", "place"].includes(k)) &&
    typeof w.id === "string" && w.id.length > 0 &&
    typeof w.label === "string" && w.label.trim().length > 0 && w.label.length <= MAX_LABEL && !hasControl(w.label) &&
    typeof w.note === "string" && w.note.length <= MAX_NOTE && !hasControl(w.note) &&
    typeof w.must === "boolean" &&
    (w.minutes === null || (Number.isSafeInteger(w.minutes) && Number(w.minutes) >= MIN_WISH_MINUTES && Number(w.minutes) <= MAX_WISH_MINUTES)) &&
    (place === null || (isActivityPlace(place) && place.category !== "lodging"))
  );
}

/** Whether a whole `shortlists` value is acceptable (absent is). The same limits as the API, so a draft it would refuse is never saved. */
export function validShortlists(value: unknown): boolean {
  if (value === undefined) return true;
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value as Record<string, unknown>).every((list) => {
    if (!Array.isArray(list) || list.length > MAX_WISHES || !list.every(isWish)) return false;
    const places = list.flatMap((w: Wish) => (w.place ? [w.place.id] : []));
    return new Set(list.map((w: Wish) => w.id)).size === list.length && new Set(places).size === places.length;
  });
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export function wishFromPlace(place: ActivityPlace): Wish | null {
  if (place.category === "lodging") return null;
  return { id: crypto.randomUUID(), label: place.name.slice(0, MAX_LABEL), note: "", must: false, minutes: null, place: place as WishPlace };
}

export function wishFromName(label: string, minutes: number | null = null, must = false): { wish: Wish } | { error: string } {
  const text = label.trim();
  if (!text) return { error: "Give the place a name." };
  if (text.length > MAX_LABEL) return { error: `Keep the name to ${MAX_LABEL} characters.` };
  if (hasControl(text)) return { error: "Use plain text for the name." };
  if (minutes !== null && !(Number.isSafeInteger(minutes) && minutes >= MIN_WISH_MINUTES && minutes <= MAX_WISH_MINUTES))
    return { error: `Give the time in minutes, from ${MIN_WISH_MINUTES} to ${MAX_WISH_MINUTES}, or leave it blank if you do not know.` };
  return { wish: { id: crypto.randomUUID(), label: text, note: "", must, minutes, place: null } };
}

export function addWish(lists: Shortlists | undefined, stopId: string, wish: Wish): { shortlists: Shortlists } | { error: string } {
  const current = lists?.[stopId] ?? [];
  if (current.length >= MAX_WISHES) return { error: `A destination's shortlist holds up to ${MAX_WISHES} places. Remove one first.` };
  if (wish.place && current.some((w) => w.place?.id === wish.place?.id)) return { error: "That place is already on the shortlist." };
  if (current.some((w) => same(w.label, wish.label))) return { error: "Something with that name is already on the shortlist." };
  return { shortlists: { ...lists, [stopId]: [...current, wish] } };
}

export function changeWish(lists: Shortlists | undefined, stopId: string, id: string, patch: Partial<Pick<Wish, "must" | "minutes" | "note">>): Shortlists {
  return { ...lists, [stopId]: (lists?.[stopId] ?? []).map((w) => (w.id === id ? { ...w, ...patch } : w)) };
}

export function removeWish(lists: Shortlists | undefined, stopId: string, id: string): Shortlists | undefined {
  const rest = (lists?.[stopId] ?? []).filter((w) => w.id !== id);
  const next = { ...lists };
  if (rest.length) next[stopId] = rest;
  else delete next[stopId];
  return Object.keys(next).length ? next : undefined;
}

/** Lists belong to destinations: when a destination leaves the plan its list goes with it. */
export function prune(lists: Shortlists | undefined, stops: { id: string }[]): Shortlists | undefined {
  if (!lists) return undefined;
  const live = new Set(stops.map((s) => s.id));
  const kept = Object.fromEntries(Object.entries(lists).filter(([id, list]) => live.has(id) && list.length));
  return Object.keys(kept).length ? kept : undefined;
}

export function durationText(minutes: number): string {
  const h = Math.floor(minutes / 60), m = minutes % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : h === 1 ? "1 hour" : `${h} hours`;
}

/** An activity on this destination that stands for the wish: the same saved place, or else the same name. */
export function matches(wish: Wish, activity: Activity): boolean {
  return wish.place && activity.place ? wish.place.id === activity.place.id : same(wish.label, activity.title);
}

export type OpenSpace = { day: number; start: number; end: number };
export type WishState = {
  wish: Wish;
  status: "scheduled" | "skipped" | "open";
  /** The day and time it has, or the day it was skipped. */
  day?: number;
  start?: string;
  /** Minutes planning allows for it, and whether that was assumed. */
  need: number;
  assumed: boolean;
  /** For an open one: why it is not scheduled, and the first open stretch it would fit in, if any. */
  reason?: string;
  fit?: OpenSpace;
  fitDays?: number;
};

/** Open stretches of each day of a destination, as the day view draws them (the traveler's hours, narrowed by recorded journeys). */
export function openSpaces(trip: Trip, stop: Stop): OpenSpace[] {
  const window = travelerDay(trip);
  const spaces: OpenSpace[] = [];
  for (let day = 1; day <= stop.nights + 1; day++) {
    const acts = trip.activities.filter((a) => a.stopId === stop.id && a.day === day);
    for (const entry of splitForJourneys(dayTimeline(acts, window), trip, stop.id, day))
      if (entry.type === "gap") spaces.push({ day, start: entry.start, end: entry.end });
  }
  return spaces;
}

/** Where every wish on a destination stands, in the shortlist's own order. */
export function wishReport(trip: Trip, stop: Stop): WishState[] {
  const wishes = trip.shortlists?.[stop.id] ?? [];
  if (!wishes.length) return [];
  const spaces = openSpaces(trip, stop);
  const mine = trip.activities.filter((a) => a.stopId === stop.id);
  return wishes.map((wish) => {
    const need = wish.minutes ?? ASSUMED_MINUTES;
    const base = { wish, need, assumed: wish.minutes === null };
    const found = mine.filter((a) => matches(wish, a));
    const live = found.find((a) => !a.skipped);
    if (live) return { ...base, status: "scheduled" as const, day: live.day, start: live.start };
    if (found.length) return { ...base, status: "skipped" as const, day: found[0].day, reason: `You skipped it on day ${found[0].day}.` };
    const fits = spaces.filter((s) => s.end - s.start >= need);
    const guess = wish.minutes === null ? ` (an hour is assumed, because you have not said how long you want)` : "";
    if (fits.length) {
      const first = fits[0];
      const days = new Set(fits.map((s) => s.day)).size;
      const more = days > 1 ? ` and on ${days - 1} other ${days === 2 ? "day" : "days"}` : "";
      return { ...base, status: "open" as const, fit: first, fitDays: days, reason: `Not placed yet. It fits on day ${first.day} from ${clockText(first.start)}${more}${guess}.` };
    }
    const longest = spaces.reduce<OpenSpace | null>((best, s) => (!best || s.end - s.start > best.end - best.start ? s : best), null);
    const reason = !longest || longest.end - longest.start <= 0
      ? `Every day in ${stop.name} is full, so there is no open time for it${guess}. Free a slot, or add a night.`
      : `No day in ${stop.name} has ${durationText(need)} open${guess}. The longest open stretch is ${durationText(longest.end - longest.start)} on day ${longest.day}. Shorten something, free a slot, or add a night.`;
    return { ...base, status: "open" as const, reason };
  });
}

export type Unscheduled = { stop: Stop; state: WishState };
/** Must-visit items across the whole trip that have no day yet (or were skipped), each with the reason. */
export function unscheduledMustVisits(trip: Trip): Unscheduled[] {
  return trip.stops.flatMap((stop) =>
    wishReport(trip, stop)
      .filter((state) => state.wish.must && state.status !== "scheduled")
      .map((state) => ({ stop, state })),
  );
}

/** The activity to open in the editor for a wish, on its first fitting day (or the day being viewed when nothing fits). */
export function activityForWish(state: WishState, stopId: string, fallbackDay: number): Activity {
  const { wish, fit } = state;
  return {
    id: crypto.randomUUID(),
    stopId,
    day: fit?.day ?? fallbackDay,
    title: wish.label,
    kind: "custom",
    start: clockText(fit?.start ?? 10 * 60),
    minutes: state.need,
    fixed: false,
    completed: false,
    booked: false,
    ...(wish.place ? { place: wish.place } : {}),
  };
}

const PLACE_FIELDS = ["id", "destination_reference_id", "external_id", "name", "category", "latitude", "longitude", "source", "retrieved_at"] as const;
/** The shape the API stores: only the fields it knows, only for destinations still in the plan, and `null` for what is unknown. */
export function shortlistsToApi(lists: Shortlists | undefined, stops: { id: string }[]): Record<string, unknown[]> {
  const live = prune(lists, stops) ?? {};
  return Object.fromEntries(
    Object.entries(live).map(([stopId, wishes]) => [
      stopId,
      wishes.map((w) => ({
        id: w.id,
        label: w.label,
        note: w.note,
        must: w.must,
        minutes: w.minutes,
        place: w.place ? Object.fromEntries(PLACE_FIELDS.map((k) => [k, (w.place as Record<string, unknown>)[k]])) : null,
      })),
    ]),
  );
}
