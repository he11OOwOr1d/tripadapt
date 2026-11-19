import type { ActivityPlace } from "./activity-search";
import { validCoordinates } from "./day-map";

/**
 * Where the traveler is staying. It records their own choice: it is not a
 * booking, a price or an availability check, and nothing here contacts a supplier.
 */
export type Lodging = {
  name: string;
  address?: string;
  latitude?: number | null;
  longitude?: number | null;
  /** Set only when picked from a map search. */
  external_id?: string | null;
  source?: string;
  booked?: boolean;
  check_in?: string;
  check_out?: string;
};
export type StayPreferences = Record<string, { style: string; rate: string; basis: "room" | "bed"; lodging?: Lodging | null }>;

export const LODGING_NAME_MAX = 120;
export const LODGING_ADDRESS_MAX = 200;
const TIME = /^$|^([01][0-9]|2[0-3]):[0-5][0-9]$/;
const EXTERNAL = /^((node|way|relation)\/[1-9][0-9]*|geoapify\/[A-Za-z0-9_-]{1,400})$/;
const plain = (v: unknown, max: number) => typeof v === "string" && v.length <= max && ![...v].some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127);

/** Mirrors the backend `Lodging` model, so a bad record is caught before saving. */
export function isLodging(value: unknown): value is Lodging {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const l = value as Record<string, unknown>;
  const allowed = ["name", "address", "latitude", "longitude", "external_id", "source", "booked", "check_in", "check_out"];
  const has = (k: string) => l[k] !== undefined && l[k] !== null;
  const mapped = has("latitude") || has("longitude");
  return (
    Object.keys(l).every((k) => allowed.includes(k)) &&
    plain(l.name, LODGING_NAME_MAX) && String(l.name).trim().length > 0 &&
    (l.address === undefined || plain(l.address, LODGING_ADDRESS_MAX)) &&
    (l.source === undefined || plain(l.source, 120)) &&
    (l.booked === undefined || typeof l.booked === "boolean") &&
    (l.check_in === undefined || (typeof l.check_in === "string" && TIME.test(l.check_in))) &&
    (l.check_out === undefined || (typeof l.check_out === "string" && TIME.test(l.check_out))) &&
    (!mapped || (has("latitude") && has("longitude") && validCoordinates(l.latitude, l.longitude))) &&
    (!has("external_id") || (typeof l.external_id === "string" && EXTERNAL.test(l.external_id) && mapped))
  );
}

/** A lodging with a usable map location; a name-only record is still a valid stay. */
export function lodgingPoint(lodging: Lodging | null | undefined): { lat: number; lng: number } | null {
  if (!lodging || !validCoordinates(lodging.latitude, lodging.longitude)) return null;
  return { lat: lodging.latitude as number, lng: lodging.longitude as number };
}

/** Turn a searched result into a record, keeping the traveler's own times and flags. */
export function lodgingFromPlace(place: ActivityPlace, keep?: Lodging | null): Lodging {
  return {
    name: place.name.slice(0, LODGING_NAME_MAX),
    address: keep?.address ?? "",
    latitude: place.latitude,
    longitude: place.longitude,
    external_id: place.external_id,
    source: place.source.slice(0, 120),
    booked: keep?.booked ?? false,
    check_in: keep?.check_in ?? "",
    check_out: keep?.check_out ?? "",
  };
}

/** Immutable update of one stay's lodging, creating the stay's default entry if needed. */
export function withLodging(prefs: StayPreferences | undefined, stopId: string, lodging: Lodging | null): StayPreferences {
  const previous = prefs?.[stopId] ?? { style: "", rate: "", basis: "room" as const };
  const { lodging: _old, ...rest } = previous;
  void _old;
  return { ...prefs, [stopId]: lodging ? { ...rest, lodging } : rest };
}

/** One honest line: what is recorded and what is not. */
export function lodgingSummary(lodging: Lodging | null | undefined): string {
  if (!lodging) return "No place to stay recorded yet.";
  const times = [lodging.check_in && `check-in ${lodging.check_in}`, lodging.check_out && `check-out ${lodging.check_out}`].filter(Boolean).join(", ");
  return `${lodging.name}${lodging.booked ? " · marked as booked by you" : " · not marked as booked"}${times ? ` · ${times}` : ""}`;
}
