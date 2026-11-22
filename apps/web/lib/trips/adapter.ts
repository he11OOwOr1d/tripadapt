import { validDayHours } from "./traveler-day";
import { validCoordinates } from "./day-map";
import { isActivityPlace, type ActivityPlace } from "./activity-search";
import type { PlaceResult } from "./place-search";
import { isLodging, validStays, type Lodging } from "./lodging";
import { validShortlists, type Shortlists } from "./shortlist";
/** UI view models, NOT published API schemas. Replace the adapter after OpenAPI is available. */
export type Stop = {
  id: string;
  name: string;
  timezone: string;
  nights: number;
  location?: PlaceResult;
};
export type Activity = {
  place?: ActivityPlace;
  kind?: "custom" | "meal" | "rest" | "free_time";
  id: string;
  stopId: string;
  day: number;
  title: string;
  start: string;
  minutes: number;
  fixed: boolean;
  completed: boolean;
  /** Traveler-recorded "didn't happen"; exclusive with completed, never inferred. */
  skipped?: boolean;
  booked: boolean;
};
export type Trip = {
  title: string;
  mode: "exact" | "window" | "duration";
  start: string;
  end: string;
  days: number;
  travelers: number;
  rooms: number;
  budget: string;
  budgetMode?: "target" | "strict";
  currency: string;
  pace: string;
  interests: string;
  /** The hours the traveler wants to be out and about, HH:MM. Both or neither; absent means the default day. */
  dayStart?: string;
  dayEnd?: string;
  origin: string;
  /** Map point for the starting location, set only when it was chosen from a map search. */
  originPoint?: { latitude: number; longitude: number };
  stops: Stop[];
  activities: Activity[];
  finish?: string;
  returnToOrigin?: boolean;
  stayPreferences?: Record<
    string,
    { style: string; rate: string; basis: "room" | "bed"; lodging?: Lodging | null; extra_lodgings?: Lodging[] }
  >;
  /** Places and things wanted in each destination (keyed by stop id), scheduled or not. */
  shortlists?: Shortlists;
  costRecords?: CostRecord[];
  /** Traveler attests every cost is entered; required for a strict-budget check. */
  costsConfirmed?: boolean;
  travelPreferences?: Record<
    string,
    {
      mode: string;
      hours: string;
      overnight: number;
      rate: string;
      basis: "person" | "vehicle";
      /** A journey booked elsewhere, as the traveler entered it; never verified. Local times at the journey's two ends. */
      departure?: string;
      arrival?: string;
      reference?: string;
      booked?: boolean;
      /** "Keep fixed": automatic changes that would move this journey to another day are refused until unlocked. Not a booking. */
      locked?: boolean;
      /** Minutes to settle in after arriving and to be at the gate before departing; 0 or absent means none assumed. */
      arrival_buffer?: number;
      departure_buffer?: number;
    }
  >;
};
/**
 * Traveler-entered cost. `amount` is a unit price; blank = unknown, "0" = free.
 * Optionally linked to one activity or stay (stop). `link_removed` marks a paid
 * cost whose item left the plan: kept as a commitment, never an implied refund.
 */
export type CostRecord = {
  id: string;
  category: "food" | "activity" | "accommodation" | "transport" | "taxes_fees" | "miscellaneous";
  label: string;
  unit: "per_person" | "per_group";
  quantity: number;
  amount: string;
  status: "estimated" | "paid";
  activity_id?: string | null;
  stop_id?: string | null;
  /** Intercity journey key from `routeLegs`; journeys are not rows. */
  leg_key?: string | null;
  link_removed?: boolean;
  /** Original currency; absent/null means the trip's display currency. */
  currency?: string | null;
  /** Traveler-entered display-currency units per one unit of `currency`. */
  conversion_rate?: string | null;
  rate_note?: string | null;
  rate_date?: string | null;
  /** Whether `amount` includes tax; "unknown" is the honest default. */
  tax_status?: "included" | "excluded" | "unknown";
  /** Only for tax not included: percentage added on top. */
  tax_percent?: string | null;
};
export const costCategories = ["food", "activity", "accommodation", "transport", "taxes_fees", "miscellaneous"] as const;
export function isCostRecord(value: unknown): value is CostRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const r = value as Record<string, unknown>;
  const uuid = (v: unknown) =>
    typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
  const link = (v: unknown) => v === undefined || v === null || uuid(v);
  const allowed = ["id", "category", "label", "unit", "quantity", "amount", "status", "activity_id", "stop_id", "leg_key", "link_removed", "currency", "conversion_rate", "rate_note", "rate_date", "tax_status", "tax_percent"];
  const optional = (v: unknown, ok: (x: unknown) => boolean) => v === undefined || v === null || ok(v);
  const links = [r.activity_id, r.stop_id, r.leg_key].filter(Boolean).length;
  return (
    Object.keys(r).every((k) => allowed.includes(k)) &&
    uuid(r.id) &&
    (costCategories as readonly unknown[]).includes(r.category) &&
    link(r.activity_id) &&
    link(r.stop_id) &&
    (r.leg_key === undefined || r.leg_key === null || (typeof r.leg_key === "string" && r.leg_key.length > 0 && r.leg_key.length <= 1500)) &&
    links <= 1 &&
    optional(r.currency, (v) => typeof v === "string" && /^[A-Z]{3}$/.test(v)) &&
    optional(r.conversion_rate, (v) => typeof v === "string" && /^\d{1,10}(\.\d{1,10})?$/.test(v) && Number(v) > 0) &&
    optional(r.rate_note, (v) => typeof v === "string" && v.length > 0 && v.length <= 200) &&
    optional(r.rate_date, (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) &&
    (r.currency || (!r.conversion_rate && !r.rate_note && !r.rate_date)) &&
    (r.tax_status === undefined || ["included", "excluded", "unknown"].includes(String(r.tax_status))) &&
    optional(r.tax_percent, (v) => typeof v === "string" && /^\d{1,3}(\.\d{1,3})?$/.test(v) && Number(v) <= 100 && r.tax_status === "excluded") &&
    (r.link_removed === undefined || typeof r.link_removed === "boolean") &&
    (!r.link_removed || (r.status === "paid" && links === 0)) &&
    typeof r.label === "string" &&
    r.label.trim().length > 0 &&
    r.label.length <= 120 &&
    (r.unit === "per_person" || r.unit === "per_group") &&
    Number.isSafeInteger(r.quantity) &&
    Number(r.quantity) >= 1 &&
    Number(r.quantity) <= 10000 &&
    typeof r.amount === "string" &&
    /^$|^\d{1,14}(\.\d{1,2})?$/.test(r.amount) &&
    (r.status === "estimated" || (r.status === "paid" && r.amount !== ""))
  );
}
export const emptyTrip: Trip = {
  title: "",
  mode: "duration",
  start: "",
  end: "",
  days: 0,
  travelers: 2,
  rooms: 1,
  budget: "",
  budgetMode: "target",
  currency: "INR",
  pace: "balanced",
  interests: "",
  origin: "",
  stops: [],
  activities: [],
};
export const sampleTrip: Trip = {
  ...emptyTrip,
  title: "A little Rajasthan",
  origin: "Delhi",
  budget: "60000",
  days: 12,
  interests: "Culture, food, unhurried afternoons",
  stops: [
    { id: "jaipur", name: "Jaipur", timezone: "Asia/Kolkata", nights: 4 },
    { id: "udaipur", name: "Udaipur", timezone: "Asia/Kolkata", nights: 4 },
  ],
  activities: [
    {
      id: "a1",
      stopId: "jaipur",
      day: 1,
      title: "Explore the old city",
      start: "09:00",
      minutes: 120,
      fixed: false,
      completed: false,
      booked: false,
    },
    {
      id: "a2",
      stopId: "jaipur",
      day: 1,
      title: "Leave room for lunch and a wander",
      start: "12:00",
      minutes: 120,
      fixed: false,
      completed: false,
      booked: false,
    },
    {
      id: "a3",
      stopId: "jaipur",
      day: 1,
      title: "Dinner with a view",
      start: "20:00",
      minutes: 90,
      fixed: true,
      completed: false,
      booked: false,
    },
  ],
};
export function issuesFor(trip: Trip): string[] {
  const issues: string[] = [];
  if (
    trip.mode !== "duration" &&
    (!trip.start || !trip.end || trip.end < trip.start)
  )
    issues.push("Choose a valid date range.");
  if (
    trip.mode === "window" &&
    trip.start &&
    trip.end &&
    trip.days > (Date.parse(trip.end) - Date.parse(trip.start)) / 86400000 + 1
  )
    issues.push(
      "Desired duration does not fit within the tentative date window.",
    );
  for (const stop of trip.stops) {
    try {
      new Intl.DateTimeFormat("en", { timeZone: stop.timezone }).format();
      if (!stop.timezone) throw new Error();
    } catch {
      issues.push(
        `${stop.name || "Unnamed destination"}: enter a valid IANA timezone.`,
      );
    }
  }
  const capacity =
    trip.mode === "exact" && trip.start && trip.end
      ? Math.round((Date.parse(trip.end) - Date.parse(trip.start)) / 86400000) +
        1
      : trip.days;
  if (capacity > 0 && trip.stops.reduce((n, s) => n + s.nights, 0) >= capacity)
    issues.push(
      "Stay nights exceed the available nights. Shorten a stay or extend the trip.",
    );
  for (const a of trip.activities) {
    const stop = trip.stops.find((s) => s.id === a.stopId);
    if (!stop || a.day > stop.nights + 1)
      issues.push(`${a.title}: day falls outside this destination stay.`);
    const start = minutes(a.start);
    if (start + a.minutes > 1440)
      issues.push(
        `${a.title}: crosses midnight; split this activity into day blocks.`,
      );
    if (
      trip.activities.some(
        (b) =>
          b.id !== a.id &&
          b.stopId === a.stopId &&
          b.day === a.day &&
          minutes(b.start) < start + a.minutes &&
          minutes(b.start) + b.minutes > start,
      )
    )
      issues.push(`${a.title}: overlaps another activity.`);
  }
  return issues;
}
function minutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}
export interface TripAdapter {
  load(): Promise<Trip | null>;
  save(trip: Trip): Promise<void>;
}
function optionalRecord(
  value: unknown,
  valid: (entry: Record<string, unknown>) => boolean,
) {
  return (
    value === undefined ||
    (!!value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      Object.values(value).every(
        (entry) =>
          entry &&
          typeof entry === "object" &&
          !Array.isArray(entry) &&
          valid(entry),
      ))
  );
}
const optionalAmount = (value: unknown) =>
  typeof value === "string" &&
  (value === "" ||
    (/^\d+(\.\d{1,2})?$/.test(value) && Number.isFinite(Number(value))));
function validLocation(value: unknown): value is PlaceResult {
  if (!value || typeof value !== "object") return false;
  const location = value as Record<string, unknown>;
  return ["reference_id", "label", "name", "region", "country", "timezone", "source", "retrieved_at"].every(key => typeof location[key] === "string") &&
    typeof location.latitude === "number" && Number.isFinite(location.latitude) && Math.abs(location.latitude) <= 90 &&
    typeof location.longitude === "number" && Number.isFinite(location.longitude) && Math.abs(location.longitude) <= 180 &&
    Number.isSafeInteger(location.id) && Number.isFinite(Date.parse(String(location.retrieved_at)));
}
export function isTrip(value: unknown): value is Trip {
  if (!value || typeof value !== "object") return false;
  const t = value as Record<string, unknown>;
  const textFields = [
    "title",
    "start",
    "end",
    "budget",
    "currency",
    "pace",
    "interests",
    "origin",
  ];
  const positive = (n: unknown) =>
    typeof n === "number" && Number.isSafeInteger(n) && n > 0;
  return (
    textFields.every((k) => typeof t[k] === "string") &&
    (t.budgetMode === undefined || t.budgetMode === "target" || t.budgetMode === "strict") &&
    (t.dayStart === undefined || typeof t.dayStart === "string") &&
    (t.dayEnd === undefined || typeof t.dayEnd === "string") &&
    validDayHours(t.dayStart, t.dayEnd) &&
    validShortlists(t.shortlists) &&
    (t.originPoint === undefined ||
      (!!t.originPoint &&
        typeof t.originPoint === "object" &&
        Object.keys(t.originPoint).every((k) => k === "latitude" || k === "longitude") &&
        validCoordinates((t.originPoint as Record<string, unknown>).latitude, (t.originPoint as Record<string, unknown>).longitude))) &&
    (t.finish === undefined || typeof t.finish === "string") &&
    (t.returnToOrigin === undefined || typeof t.returnToOrigin === "boolean") &&
    optionalRecord(
      t.stayPreferences,
      (p) =>
        typeof p.style === "string" &&
        optionalAmount(p.rate) &&
        ["bed", "room"].includes(String(p.basis)) &&
        (p.lodging === undefined || p.lodging === null || isLodging(p.lodging)) &&
        (p.extra_lodgings === undefined || (Array.isArray(p.extra_lodgings) && validStays(p as never))),
    ) &&
    optionalRecord(
      t.travelPreferences,
      (p) =>
        typeof p.mode === "string" &&
        optionalAmount(p.rate) &&
        optionalAmount(p.hours) &&
        Number.isSafeInteger(p.overnight) &&
        Number(p.overnight) >= 0 &&
        ["person", "vehicle"].includes(String(p.basis)) &&
        (p.departure === undefined || (typeof p.departure === "string" && /^$|^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(p.departure))) &&
        (p.arrival === undefined || (typeof p.arrival === "string" && /^$|^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(p.arrival))) &&
        (p.reference === undefined || (typeof p.reference === "string" && p.reference.length <= 100 && ![...p.reference].some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127))) &&
        (p.booked === undefined || typeof p.booked === "boolean") &&
        (p.locked === undefined || typeof p.locked === "boolean") &&
        (p.arrival_buffer === undefined || (Number.isSafeInteger(p.arrival_buffer) && Number(p.arrival_buffer) >= 0 && Number(p.arrival_buffer) <= 240)) &&
        (p.departure_buffer === undefined || (Number.isSafeInteger(p.departure_buffer) && Number(p.departure_buffer) >= 0 && Number(p.departure_buffer) <= 240)),
    ) &&
    (t.costsConfirmed === undefined || typeof t.costsConfirmed === "boolean") &&
    (t.costRecords === undefined ||
      (Array.isArray(t.costRecords) &&
        t.costRecords.length <= 200 &&
        t.costRecords.every(isCostRecord) &&
        new Set(t.costRecords.map((r) => r.id)).size === t.costRecords.length)) &&
    ["exact", "window", "duration"].includes(String(t.mode)) &&
    [t.travelers, t.rooms].every(positive) &&
    typeof t.days === "number" &&
    Number.isSafeInteger(t.days) &&
    t.days >= 0 &&
    Array.isArray(t.stops) &&
    t.stops.every(
      (s) =>
        s &&
        [s.id, s.name, s.timezone].every((v) => typeof v === "string") &&
        Number.isSafeInteger(s.nights) &&
        s.nights >= 0 &&
        (s.location === undefined || (validLocation(s.location) && s.location.label === s.name && s.location.timezone === s.timezone)),
    ) &&
    Array.isArray(t.activities) &&
    t.activities.every(
      (a) =>
        a &&
        [a.id, a.stopId, a.title].every((v) => typeof v === "string") &&
        typeof a.start === "string" &&
        /^([01]\d|2[0-3]):[0-5]\d$/.test(a.start) &&
        positive(a.day) &&
        positive(a.minutes) &&
        (a.place === undefined || isActivityPlace(a.place)) &&
        (a.kind === undefined || ["custom","meal","rest","free_time"].includes(a.kind)) &&
        [a.fixed, a.completed, a.booked].every((v) => typeof v === "boolean") &&
        (a.skipped === undefined || typeof a.skipped === "boolean") &&
        !(a.completed && a.skipped),
    )
  );
}
function browserAdapter(key: string): TripAdapter {
  return {
    async load() {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const value = JSON.parse(raw);
      if (value.schema !== 1 || !isTrip(value.trip))
        throw new Error("Saved browser draft is unreadable.");
      return value.trip as Trip;
    },
    async save(trip) {
      if (!isTrip(trip))
        throw new Error("Draft contains invalid numeric or preference values.");
      localStorage.setItem(key, JSON.stringify({ schema: 1, trip }));
    },
  };
}
// Keep personal trips isolated from the editable demonstration.
export const mockTripAdapter = browserAdapter("tripadapt.mock-draft.v1");
export const mockSampleAdapter = browserAdapter("tripadapt.mock-sample.v1");

// Automatic guest recovery never loads the editable sample or an account's local backup.
export const guestTripAdapter = browserAdapter("elsewhere.guest-draft.v1");
