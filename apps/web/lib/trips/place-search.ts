export type PlaceResult = {
  id: number;
  label: string;
  name: string;
  region: string;
  country: string;
  timezone: string;
  latitude: number;
  longitude: number;
};
export type PlaceSearch = {
  results: PlaceResult[];
  source: string;
  retrieved_at: string;
  cached: boolean;
};
export const placeSearchAdapter = {
  async search(query: string, signal: AbortSignal): Promise<PlaceSearch> {
    const base = process.env.NEXT_PUBLIC_API_BASE_URL;
    if (!base) throw new Error("Place search is not configured here. Enter a destination and timezone manually.");
    let response: Response;
    try {
      response = await fetch(`${base.replace(/\/$/, "")}/destinations/search?q=${encodeURIComponent(query.trim())}`, {
        signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]), cache: "no-store", credentials: "omit",
      });
    } catch (failure) {
      if (signal.aborted) throw failure;
      throw new Error("Place search could not connect in time. Enter the destination and timezone manually, or try again later.");
    }
    if (!response.ok) {
      throw new Error(response.status === 429 ? "Place search is busy. Wait a minute before searching again, or enter the place manually." : "Place search is unavailable. Your route is kept; enter the destination and timezone manually, or try again later.");
    }
    return (await response.json()).data;
  },
};
