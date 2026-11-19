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

export type StayJourneyCheck = {
  retrieved_at: string;
  mode: "WALK" | "DRIVE";
  travel_minutes: number;
  distance_meters: number;
  buffer_minutes: number;
  leave_by: string | null;
  status: "leave_by" | "needs_earlier_start";
  warnings: string[];
};
export const stayJourneyAdapter = {
  async check(input: { latitude: number; longitude: number; destination_place_id: string; mode: "WALK" | "DRIVE"; destination_start: string; buffer_minutes: number }, signal: AbortSignal) {
    return (await accountRequest<StayJourneyCheck>("/journeys/from-stay", { method: "POST", signal: AbortSignal.any([signal, AbortSignal.timeout(12000)]), body: JSON.stringify(input) })).data;
  },
};

export type StayReturnCheck = {
  retrieved_at: string;
  mode: "WALK" | "DRIVE";
  travel_minutes: number;
  distance_meters: number;
  arrive_by: string | null;
  status: "arrive_by" | "after_midnight";
  warnings: string[];
};
export const stayReturnAdapter = {
  async check(input: { latitude: number; longitude: number; origin_place_id: string; mode: "WALK" | "DRIVE"; origin_end: string }, signal: AbortSignal) {
    return (await accountRequest<StayReturnCheck>("/journeys/to-stay", { method: "POST", signal: AbortSignal.any([signal, AbortSignal.timeout(12000)]), body: JSON.stringify(input) })).data;
  },
};
