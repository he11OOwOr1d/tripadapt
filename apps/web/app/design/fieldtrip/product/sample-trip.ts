export type SampleStop = { id: string; name: string; nights: number };
export type SampleTrip = {
  start: string;
  stops: SampleStop[];
  stay: "hostel" | "room" | "comfort";
  transport: "shared" | "private";
  accepted: boolean;
};
export const initialSample: SampleTrip = {
  start: "2026-12-08",
  stops: [
    { id: "jibhi", name: "Jibhi", nights: 3 },
    { id: "sainj", name: "Sainj", nights: 2 },
  ],
  stay: "room",
  transport: "shared",
  accepted: false,
};
export const currency = (n: number) => `₹${n.toLocaleString("en-IN")}`;
export function datePlus(date: string, days: number) {
  return new Date(Date.parse(date + "T12:00:00Z") + days * 86400000)
    .toISOString()
    .slice(0, 10);
}
export function dateLabel(date: string) {
  return new Date(date + "T12:00:00Z").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}
export function sampleSummary(trip: SampleTrip) {
  const people = 2,
    rooms = 1,
    nights = trip.stops.reduce((sum, s) => sum + s.nights, 0),
    travelNights = trip.transport === "shared" ? 1 : 0;
  const stayRate =
    trip.stay === "hostel" ? 650 : trip.stay === "comfort" ? 2600 : 1800;
  const stayTotal =
      nights * stayRate * (trip.stay === "hostel" ? people : rooms),
    travelTotal = trip.transport === "shared" ? 1750 * people : 6500,
    activityTotal = trip.accepted ? 450 * people : 0;
  const finish = datePlus(trip.start, nights + travelNights);
  return {
    people,
    rooms,
    nights,
    travelNights,
    stayRate,
    stayTotal,
    travelTotal,
    activityTotal,
    finish,
    total: stayTotal + travelTotal + activityTotal,
    route: ["Delhi", ...trip.stops.map((s) => s.name), "Delhi"].join(" → "),
  };
}
