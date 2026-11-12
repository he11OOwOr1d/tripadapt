export type ActivityPlace = {
  id: string;
  destination_reference_id: string;
  external_id: string;
  name: string;
  category: "museum" | "gallery" | "attraction" | "park" | "viewpoint";
  latitude: number;
  longitude: number;
  source: string;
  retrieved_at: string;
};
export type ActivitySearch = {
  notice?: string | null;
  source: string;
  results: ActivityPlace[];
  retrieved_at: string;
  cached: boolean;
  coverage: "partial";
  radius_meters: number;
};
export function isActivityPlace(value: unknown): value is ActivityPlace {
  if (!value || typeof value !== "object") return false;
  const place = value as Record<string, unknown>;
  return ["id", "destination_reference_id", "external_id", "name", "source", "retrieved_at"].every(key => typeof place[key] === "string") &&
    /^((node|way|relation)\/[1-9][0-9]*|geoapify\/[A-Za-z0-9_-]{1,400})$/.test(String(place.external_id)) &&
    ["museum", "gallery", "attraction", "park", "viewpoint"].includes(String(place.category)) &&
    typeof place.latitude === "number" && Number.isFinite(place.latitude) && Math.abs(place.latitude) <= 90 &&
    typeof place.longitude === "number" && Number.isFinite(place.longitude) && Math.abs(place.longitude) <= 180 && Number.isFinite(Date.parse(String(place.retrieved_at)));
}
export const activitySearchAdapter = {
  async search(reference: string, category: ActivityPlace["category"], signal: AbortSignal): Promise<ActivitySearch> {
    const base = process.env.NEXT_PUBLIC_API_BASE_URL;
    if (!base) throw new Error("Nearby search is not configured. You can still add an activity yourself.");
    let response: Response;
    try {
      response = await fetch(`${base.replace(/\/$/, "")}/places/search?destination_reference_id=${encodeURIComponent(reference)}&category=${category}`, {
        signal: AbortSignal.any([signal, AbortSignal.timeout(12000)]), cache: "no-store", credentials: "omit",
      });
    } catch (error) {
      if (signal.aborted) throw error;
      throw new Error("Nearby search could not connect in time. Your itinerary is kept; try again later or add an activity yourself.");
    }
    if (!response.ok) throw new Error(response.status === 429 ? "Nearby search is busy. Wait a minute before trying again." : "Nearby search is unavailable here. Your itinerary is kept; add an activity yourself or try later.");
    const page = (await response.json()).data;
    if (!page || !Array.isArray(page.results) || page.results.length > 12 || !page.results.every(isActivityPlace)) throw new Error("Nearby search returned unusable data. Your itinerary is kept.");
    return page;
  },
};
