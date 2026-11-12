import { accountRequest } from "./account-adapter";
export type JourneyCheck = {
  retrieved_at: string;
  mode: "WALK" | "DRIVE";
  travel_minutes: number;
  distance_meters: number;
  gap_minutes: number;
  buffer_minutes: number;
  spare_minutes: number;
  status: "fits_estimate" | "shortfall";
  warnings: string[];
};
export const journeyAdapter = {
  async check(input: { origin_place_id: string; destination_place_id: string; mode: "WALK" | "DRIVE"; origin_start: string; origin_minutes: number; destination_start: string; buffer_minutes: number }, signal: AbortSignal) {
    return (await accountRequest<JourneyCheck>("/journeys/check", { method: "POST", signal: AbortSignal.any([signal, AbortSignal.timeout(12000)]), body: JSON.stringify(input) })).data;
  },
};
