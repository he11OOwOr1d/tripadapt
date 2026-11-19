import { validCoordinates } from "./day-map";

/** The server returns decimals as strings; keep a point only when both are finite and in range. */
export function originPointFrom(origin: { latitude?: number | string | null; longitude?: number | string | null } | null | undefined) {
  if (!origin || origin.latitude == null || origin.longitude == null) return {};
  const latitude = Number(origin.latitude), longitude = Number(origin.longitude);
  // 0, 0 is how an empty string coerces, and is not a place anyone starts from.
  return validCoordinates(latitude, longitude) && !(latitude === 0 && longitude === 0) ? { originPoint: { latitude, longitude } } : {};
}
