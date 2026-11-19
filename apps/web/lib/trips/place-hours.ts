import { accountRequest } from "./account-adapter";
// Regular opening hours reported by OpenStreetMap contributors via Geoapify.
// The server derives the place from the saved map link; nothing here is stored.
export type HoursCheck = {
  place_name: string;
  retrieved_at: string;
  status: string;
  explanation: string;
  hours: string[];
  hours_basis: "regular" | "unavailable";
  source: string;
};
export const HOURS_ATTRIBUTION = "Hours: Powered by Geoapify · © OpenStreetMap contributors";
export const placeHoursAdapter = {
  async check(sourcePlaceId: string, date: string, start: string, minutes: number, signal: AbortSignal) {
    return (await accountRequest<HoursCheck>("/place-checks/hours", {method:"POST", signal:AbortSignal.any([signal,AbortSignal.timeout(12000)]), body:JSON.stringify({source_place_id:sourcePlaceId,visit_date:date||null,start,duration_minutes:minutes})})).data;
  },
};
