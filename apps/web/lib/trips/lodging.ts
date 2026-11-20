import type { ActivityPlace } from "./activity-search";
import type { CostRecord } from "./adapter";
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
  /** The retained place record behind a searched stay; lets it serve as "where I am". */
  place_id?: string | null;
  booked?: boolean;
  /** "Keep fixed": the nights of this stay are not changed automatically until the traveler unlocks it. Not a booking. */
  locked?: boolean;
  /** Nights the traveler's own booking covers, as entered; never checked with the supplier. */
  booked_nights?: number | null;
  /** Which of the destination's nights this stay covers (1-based, inclusive); a stay without a range covers every night no other stay claims. */
  first_night?: number | null;
  last_night?: number | null;
  check_in?: string;
  check_out?: string;
};
export const MAX_EXTRA_STAYS = 4;
export type StayPreferences = Record<string, { style: string; rate: string; basis: "room" | "bed"; lodging?: Lodging | null; extra_lodgings?: Lodging[] }>;

export const LODGING_NAME_MAX = 120;
export const LODGING_ADDRESS_MAX = 200;
const TIME = /^$|^([01][0-9]|2[0-3]):[0-5][0-9]$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EXTERNAL = /^((node|way|relation)\/[1-9][0-9]*|geoapify\/[A-Za-z0-9_-]{1,400})$/;
const plain = (v: unknown, max: number) => typeof v === "string" && v.length <= max && ![...v].some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127);

/** Mirrors the backend `Lodging` model, so a bad record is caught before saving. */
export function isLodging(value: unknown): value is Lodging {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const l = value as Record<string, unknown>;
  const allowed = ["name", "address", "latitude", "longitude", "external_id", "source", "place_id", "booked", "locked", "booked_nights", "first_night", "last_night", "check_in", "check_out"];
  const has = (k: string) => l[k] !== undefined && l[k] !== null;
  const mapped = has("latitude") || has("longitude");
  return (
    Object.keys(l).every((k) => allowed.includes(k)) &&
    plain(l.name, LODGING_NAME_MAX) && String(l.name).trim().length > 0 &&
    (l.address === undefined || plain(l.address, LODGING_ADDRESS_MAX)) &&
    (l.source === undefined || plain(l.source, 120)) &&
    (l.booked === undefined || typeof l.booked === "boolean") &&
    (l.locked === undefined || typeof l.locked === "boolean") &&
    has("first_night") === has("last_night") &&
    (!has("first_night") || (Number.isSafeInteger(l.first_night) && Number.isSafeInteger(l.last_night) && Number(l.first_night) >= 1 && Number(l.last_night) <= 365 && Number(l.first_night) <= Number(l.last_night))) &&
    (!has("booked_nights") || (Number.isSafeInteger(l.booked_nights) && Number(l.booked_nights) >= 1 && Number(l.booked_nights) <= 365)) &&
    (l.check_in === undefined || (typeof l.check_in === "string" && TIME.test(l.check_in))) &&
    (l.check_out === undefined || (typeof l.check_out === "string" && TIME.test(l.check_out))) &&
    (!mapped || (has("latitude") && has("longitude") && validCoordinates(l.latitude, l.longitude))) &&
    (!has("external_id") || (typeof l.external_id === "string" && EXTERNAL.test(l.external_id) && mapped)) &&
    (!has("place_id") || (typeof l.place_id === "string" && UUID.test(l.place_id) && has("external_id")))
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
    place_id: place.id,
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
  const nights = lodging.booked && lodging.booked_nights ? ` for ${lodging.booked_nights} ${lodging.booked_nights === 1 ? "night" : "nights"}` : "";
  const span = lodging.first_night != null && lodging.last_night != null ? ` · ${range(lodging.first_night, lodging.last_night)}` : "";
  return `${lodging.name}${span}${lodging.booked ? ` · marked as booked by you${nights}` : " · not marked as booked"}${lodging.locked ? " · kept fixed" : ""}${times ? ` · ${times}` : ""}`;
}

/**
 * One plain line for each cost record the traveler linked to this stay. It lists
 * what was entered, with no totals: units and tax make a sum a separate calculation.
 */
export function stayCostLines(records: CostRecord[] | undefined, stopId: string, tripCurrency: string): string[] {
  return (records ?? [])
    .filter((r) => r.stop_id === stopId)
    .map((r) => {
      const amount = r.amount === "" ? "amount not entered" : `${(r.currency ?? "").trim() || tripCurrency} ${r.amount} ${r.unit === "per_person" ? "per person" : "per group"}${r.quantity > 1 ? ` × ${r.quantity}` : ""}`;
      return `${r.label} · ${amount} · ${r.status === "paid" ? "marked paid by you" : "estimated"}`;
    });
}

/**
 * A booked stay is a commitment, so a plan that no longer matches the nights the traveler said they
 * booked is flagged for them to act on. It only compares two of their own numbers; nothing is checked with a supplier.
 */
export function bookedNightsNote(lodging: Lodging | null | undefined, planNights: number): string | null {
  if (!lodging?.booked || !lodging.booked_nights || planNights < 1 || lodging.booked_nights === planNights) return null;
  const n = (k: number) => `${k} ${k === 1 ? "night" : "nights"}`;
  return `You marked this stay as booked for ${n(lodging.booked_nights)}, but your plan now has ${n(planNights)} here. Check your booking, or update the nights you booked.`;
}

type Pref = StayPreferences[string];

/** The destination's stays in order: the main stay, then the others. */
export const staysOf = (pref?: Pref | null): Lodging[] => [pref?.lodging, ...(pref?.extra_lodgings ?? [])].filter((l): l is Lodging => !!l);

/** Mirrors the backend: each other stay has its own nights, and no two stays share a night. */
export function validStays(pref: Pref): boolean {
  const extras = pref.extra_lodgings ?? [];
  if (extras.length > MAX_EXTRA_STAYS || !extras.every((e) => isLodging(e) && e.first_night != null)) return false;
  const taken: [number, number][] = [];
  for (const stay of staysOf(pref)) {
    if (stay.first_night == null || stay.last_night == null) continue;
    const [a, b] = [stay.first_night, stay.last_night];
    if (taken.some(([x, y]) => a <= y && x <= b)) return false;
    taken.push([a, b]);
  }
  return true;
}

/** Immutable update of one of a destination's other stays: add (index null), replace, or remove (lodging null). */
export function withExtraLodging(prefs: StayPreferences | undefined, stopId: string, index: number | null, lodging: Lodging | null): StayPreferences {
  const previous = prefs?.[stopId] ?? { style: "", rate: "", basis: "room" as const };
  const list = [...(previous.extra_lodgings ?? [])];
  if (index === null) { if (lodging) list.push(lodging); }
  else if (lodging) list[index] = lodging;
  else list.splice(index, 1);
  const { extra_lodgings: _old, ...rest } = previous;
  void _old;
  return { ...prefs, [stopId]: list.length ? { ...rest, extra_lodgings: list } : rest };
}

const range = (a: number, b: number) => (a === b ? `night ${a}` : `nights ${a}–${b}`);

/** Plain notes about which nights the recorded stays cover, for a destination with this many nights. Never a check with any supplier. */
export function coverageNotes(pref: Pref | undefined, nights: number): string[] {
  const stays = staysOf(pref);
  const ranged = stays.filter((s) => s.first_night != null && s.last_night != null);
  if (!ranged.length || nights < 1) return [];
  const notes: string[] = [];
  const claimed = new Set<number>();
  for (const s of ranged) {
    const a = s.first_night as number, b = s.last_night as number;
    if (b > nights) notes.push(`${s.name} is set for ${range(a, b)}, but your plan has ${nights} ${nights === 1 ? "night" : "nights"} here.`);
    for (let n = a; n <= Math.min(b, nights); n++) claimed.add(n);
  }
  const mainCoversRest = !!pref?.lodging && pref.lodging.first_night == null;
  const open: number[] = [];
  for (let n = 1; n <= nights; n++) if (!claimed.has(n)) open.push(n);
  if (open.length && !mainCoversRest) {
    const spans: string[] = [];
    let start = open[0], prev = open[0];
    for (const n of [...open.slice(1), Infinity]) { if (n !== prev + 1) { spans.push(range(start, prev)); start = n; } prev = n; }
    notes.push(`No stay is recorded for ${spans.join(" and ")}.`);
  }
  return notes;
}

/** The stay for a given night (1-based): the one whose range holds it, else the main stay without a range. */
export function stayForNight(pref: Pref | undefined, night: number): Lodging | null {
  const stays = staysOf(pref);
  return stays.find((s) => s.first_night != null && s.last_night != null && night >= s.first_night && night <= s.last_night) ?? stays.find((s) => s.first_night == null) ?? null;
}


/** How many of the destination's nights a stay is meant to cover: its own range, or every night no other stay claims. */
export function nightsFor(pref: Pref | undefined, stay: Lodging, nights: number): number {
  if (stay.first_night != null && stay.last_night != null) return Math.max(0, Math.min(stay.last_night, nights) - stay.first_night + 1);
  const claimed = new Set<number>();
  for (const s of staysOf(pref)) if (s !== stay && s.first_night != null && s.last_night != null) for (let n = s.first_night; n <= Math.min(s.last_night, nights); n++) claimed.add(n);
  return Math.max(0, nights - claimed.size);
}

/** The first and last night no other stay claims, when they form one unbroken run; null when none is left or the run is split. */
export function unclaimedSpan(pref: Pref | undefined, stay: Lodging, nights: number): [number, number] | null {
  const claimed = new Set<number>();
  for (const s of staysOf(pref)) if (s !== stay && s.first_night != null && s.last_night != null) for (let n = s.first_night; n <= Math.min(s.last_night, nights); n++) claimed.add(n);
  const open: number[] = [];
  for (let n = 1; n <= nights; n++) if (!claimed.has(n)) open.push(n);
  if (!open.length || open[open.length - 1] - open[0] + 1 !== open.length) return null;
  return [open[0], open[open.length - 1]];
}
