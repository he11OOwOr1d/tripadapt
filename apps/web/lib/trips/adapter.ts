/** UI view models, NOT published API schemas. Replace the adapter after OpenAPI is available. */
export type Stop = {
  id: string;
  name: string;
  timezone: string;
  nights: number;
};
export type Activity = {
  id: string;
  stopId: string;
  day: number;
  title: string;
  start: string;
  minutes: number;
  fixed: boolean;
  completed: boolean;
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
  currency: string;
  pace: string;
  interests: string;
  origin: string;
  stops: Stop[];
  activities: Activity[];
  finish?: string;
  returnToOrigin?: boolean;
  stayPreferences?: Record<
    string,
    { style: string; rate: string; basis: "room" | "bed" }
  >;
  travelPreferences?: Record<
    string,
    {
      mode: string;
      hours: string;
      overnight: number;
      rate: string;
      basis: "person" | "vehicle";
    }
  >;
};
export const emptyTrip: Trip = {
  title: "",
  mode: "duration",
  start: "",
  end: "",
  days: 0,
  travelers: 2,
  rooms: 1,
  budget: "",
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
function isTrip(value: unknown): value is Trip {
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
    (t.finish === undefined || typeof t.finish === "string") &&
    (t.returnToOrigin === undefined || typeof t.returnToOrigin === "boolean") &&
    optionalRecord(
      t.stayPreferences,
      (p) =>
        typeof p.style === "string" &&
        optionalAmount(p.rate) &&
        ["bed", "room"].includes(String(p.basis)),
    ) &&
    optionalRecord(
      t.travelPreferences,
      (p) =>
        typeof p.mode === "string" &&
        optionalAmount(p.rate) &&
        optionalAmount(p.hours) &&
        Number.isSafeInteger(p.overnight) &&
        Number(p.overnight) >= 0 &&
        ["person", "vehicle"].includes(String(p.basis)),
    ) &&
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
        s.nights >= 0,
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
        [a.fixed, a.completed, a.booked].every((v) => typeof v === "boolean"),
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
