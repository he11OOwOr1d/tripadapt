import type { Activity, Stop } from "./adapter";
import type { Lodging } from "./lodging";

// Pure map models. The map never owns trip data: it renders what the itinerary
// already holds, and anything without usable coordinates stays in the timeline.
export type MapScope = "day" | "route";
export type MapPoint = {
  id: string;
  kind: "activity" | "stop" | "lodging";
  /** 1-based position along the line; 0 marks a destination centre. */
  order: number;
  label: string;
  detail: string;
  lng: number;
  lat: number;
};
export type MapModel = {
  scope: MapScope;
  points: MapPoint[];
  /** Straight, illustrative connections between consecutive points, never routes. */
  links: { from: string; to: string }[];
  unmapped: { id: string; label: string }[];
  /** [[west, south], [east, north]]; null when fewer than two points exist. */
  bounds: [[number, number], [number, number]] | null;
  center: [number, number] | null;
};

export const STOP_ID_PREFIX = "stop:";
export const LODGING_ID_PREFIX = "lodging:";

/** Null Island (0, 0) is almost always a missing value, so it is not a place. */
export function validCoordinates(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180 &&
    !(lat === 0 && lng === 0)
  );
}

function bounds(points: MapPoint[]): MapModel["bounds"] {
  if (points.length < 2) return null;
  const lngs = points.map((p) => p.lng), lats = points.map((p) => p.lat);
  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ];
}

function finish(scope: MapScope, points: MapPoint[], unmapped: MapModel["unmapped"]): MapModel {
  const line = points.filter((p) => p.order > 0);
  return {
    scope,
    points,
    unmapped,
    links: line.slice(1).map((p, i) => ({ from: line[i].id, to: p.id })),
    bounds: bounds(points),
    center: points.length === 1 ? [points[0].lng, points[0].lat] : null,
  };
}

/** One destination day: the stay's centre plus mapped visits in timeline order. */
export function dayMapModel(stop: Stop | undefined, activities: Activity[], lodging?: Lodging | Lodging[] | null): MapModel {
  const points: MapPoint[] = [];
  const unmapped: MapModel["unmapped"] = [];
  const centre = stop?.location;
  if (stop && centre && validCoordinates(centre.latitude, centre.longitude)) {
    points.push({
      id: STOP_ID_PREFIX + stop.id,
      kind: "stop",
      order: 0,
      label: stop.name,
      detail: "Destination centre",
      lng: centre.longitude,
      lat: centre.latitude,
    });
  }
  // Type-only import above: lodging.ts imports this file, so no runtime cycle.
  // The traveler's own record of where they sleep; never part of the visit line. One pin for each stay that has a location.
  const stays = Array.isArray(lodging) ? lodging : lodging ? [lodging] : [];
  stays.forEach((stay, i) => {
    if (!stop || !validCoordinates(stay.latitude, stay.longitude)) return;
    const nights = stay.first_night != null && stay.last_night != null ? (stay.first_night === stay.last_night ? `night ${stay.first_night}` : `nights ${stay.first_night}\u2013${stay.last_night}`) : "";
    points.push({
      id: LODGING_ID_PREFIX + stop.id + (i ? `:${i}` : ""),
      kind: "lodging",
      order: 0,
      label: stay.name,
      detail: ["Your stay", nights, stay.booked ? "marked booked by you" : ""].filter(Boolean).join(" \u00b7 "),
      lng: stay.longitude as number,
      lat: stay.latitude as number,
    });
  });
  const ordered = [...activities]
    .filter((a) => !a.skipped)
    .sort((a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id));
  let order = 0;
  for (const activity of ordered) {
    const place = activity.place;
    if (place && validCoordinates(place.latitude, place.longitude)) {
      points.push({
        id: activity.id,
        kind: "activity",
        order: ++order,
        label: activity.title,
        detail: `${activity.start} · ${activity.minutes} min`,
        lng: place.longitude,
        lat: place.latitude,
      });
    } else if (!activity.kind || activity.kind === "custom") {
      // Meals, rests and free time are not venues, so they are never "missing".
      unmapped.push({ id: activity.id, label: activity.title });
    }
  }
  return finish("day", points, unmapped);
}

/** The whole route: one marker per destination that has a usable location. */
export function routeMapModel(stops: Stop[]): MapModel {
  const points: MapPoint[] = [];
  const unmapped: MapModel["unmapped"] = [];
  let order = 0;
  for (const stop of stops) {
    const l = stop.location;
    if (l && validCoordinates(l.latitude, l.longitude)) {
      points.push({
        id: STOP_ID_PREFIX + stop.id,
        kind: "stop",
        order: ++order,
        label: stop.name,
        detail: `${stop.nights} ${stop.nights === 1 ? "night" : "nights"}`,
        lng: l.longitude,
        lat: l.latitude,
      });
    } else unmapped.push({ id: stop.id, label: stop.name });
  }
  return finish("route", points, unmapped);
}

/** Text alternative for the map, so the timeline and screen readers agree. */
export function mapSummary(model: MapModel): string {
  const n = model.points.filter((p) => p.order > 0).length;
  const what = model.scope === "route" ? (n === 1 ? "destination" : "destinations") : n === 1 ? "mapped visit" : "mapped visits";
  const missing = model.unmapped.length;
  const homes = model.points.filter((p) => p.kind === "lodging").length;
  const stay = homes > 1 ? "; your recorded stays are marked" : homes === 1 ? "; your recorded stay is marked" : "";
  return `${n} ${what} shown${stay}${missing ? `; ${missing} without a map location stay in the list only` : ""}.`;
}
