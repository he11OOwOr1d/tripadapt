import type { WeatherDay } from "./weather";
import type { ActivityPlace } from "./activity-search";
import { accountRequest } from "./account-adapter";
import type { PlaceResult } from "./place-search";
// The server derives each visit and journey from the reviewed plan; only the date,
// travel mode and arrival buffer are sent. `scope` picks the request field.
export type LiveAcceptance = {visit_date:string;mode:"WALK"|"DRIVE";buffer_minutes:number};
export type LiveCheckScope = "live_check" | "day_live_check";
export type PendingReview = {id:string;version_number:number;source:string;title:string;summary:string;stale:boolean};
export type PendingReviewPage = {reviews:PendingReview[];next_before:number|null};
export type Proposal = {
  stale?:boolean;
  place_details?: Record<string, ActivityPlace>;
  location_references?: Record<string, PlaceResult>;
  source: string;
  generation?: {
    command?: {activity_id:string;ready_time:string;at_start_location:true};
    request?: {activity_id:string;local_start_time?:string;intent?:"leave_time_open"|"replace_place"};
    provisional_date?:string|null;
    remaining_context?:{location_name:string;local_date:string;local_time:string;timezone:string;mode:"WALK"|"DRIVE";buffer_minutes:number};
    evidence?: "sample_catalog" | "mapped_places";
    day?:number;destination?:string;changes?:{activity_id:string;label:string;before:string;after:string;minutes:number}[];
    operation?: "remaining_day" | "delay_day" | "move_activity" | "resize_activity" | "remove_activity" | "replace_activity" | "restore_plan";
    restoration?: { version_number: number; added: number; removed: number; changed: number; settings_changed: boolean };
    weather?: {source:"Open-Meteo";destination_reference_id:string;timezone:string;visit_date:string;date_basis:"trip_schedule"|"check_only";retrieved_at:string;cached:boolean;day:WeatherDay};
    replacement?: {before:string;after:string;day:number;destination:string;start:string;duration_minutes:number;place_id:string};
    removal?: { label: string; day: number; destination: string; start: string; duration_minutes: number };
    change?: { label: string; before: string; after: string; day: number; destination_day?: number; destination?: string; start?: string };
    engine?: string;
    model?: string;
    summary?: string;
    additions?: { candidate_id: string; start: string; reason: string }[];
  } | null;
  id: string;
  status: "pending" | "accepted" | "discarded";
  candidate_version_id: string;
  base_current_version_id: string | null;
  base_draft_id?: string;
  base_edit_sequence?: number;
  validation: {
    status: string;
    issues: {
      id: string;
      code: string;
      detail: string;
      blocking: boolean;
      acknowledgeable: boolean;
    }[];
  };
  plan: {
    date_mode?: string;
    start_date?: string | null;
    end_date?: string | null;
    window_start?: string | null;
    window_end?: string | null;
    desired_days?: number | null;
    traveler_count?: number;
    room_count?: number;
    display_currency?: string;
    budget?: { amount: string; mode: string } | null;
    origin?: { label: string } | null;
    return_location?: { label: string } | null;
    preferences?: { pace: string; interests: string[]; preferred_modes: string[]; return_to_origin: boolean; stay_preferences: Record<string, {style: string; rate: string; basis: string}>; travel_preferences: Record<string, {mode: string; hours: string; overnight: number; rate: string; basis: string}> };

    stops: { client_id: string; name: string; desired_nights: number | null; timezone?: string; place_reference_id?: string | null }[];
    activities: {
      place_id?: string | null;
      logical_id: string;
      stop_logical_id: string;
      user_label: string;
      local_day_offset: number;
      local_start_time: string;
      duration_minutes: number;
      fixed: boolean;
      completed: boolean;
      skipped?: boolean;
      booked: boolean;
    }[];
  };
};
export const proposalAdapter = {
  async weatherChange(tripId:string,etag:string,input:{activity_id:string;visit_date:string;intent:"leave_time_open"|"replace_place";replacement_place_id?:string},key:string,signal:AbortSignal) {
    return (await accountRequest<Proposal>(`/trips/${tripId}/proposals/weather-change`,{method:"POST",signal:AbortSignal.any([signal,AbortSignal.timeout(15000)]),headers:{"If-Match":etag,"Idempotency-Key":key},body:JSON.stringify(input)})).data;
  },
  async dayDelay(tripId:string,etag:string,input:{activity_id:string;ready_time:string;at_start_location:true},key:string,signal:AbortSignal) {
    return (await accountRequest<Proposal>(`/trips/${tripId}/proposals/day-delay`,{method:"POST",signal:AbortSignal.any([signal,AbortSignal.timeout(15000)]),headers:{"If-Match":etag,"Idempotency-Key":key},body:JSON.stringify(input)})).data;
  },
  async pending(tripId:string,before?:number,signal?:AbortSignal) {
    return (await accountRequest<PendingReviewPage>(`/trips/${tripId}/proposals${before?`?before=${before}`:""}`,{signal})).data;
  },
  async timeChange(tripId: string, etag: string, activityId: string, start: string, key: string, signal: AbortSignal) {
    return (await accountRequest<Proposal>(`/trips/${tripId}/proposals/time-change`, {method:"POST",signal,headers:{"If-Match":etag,"Idempotency-Key":key},body:JSON.stringify({activity_id:activityId,local_start_time:start})})).data;
  },
  async get(tripId: string, id: string, signal?:AbortSignal) {
    return (await accountRequest<Proposal>(`/trips/${tripId}/proposals/${id}`, {signal}))
      .data;
  },
  async submit(id: string, versionEtag: string, key: string) {
    const signal = AbortSignal.timeout(15000);
    let onAbort: (() => void) | undefined;
    const timeout = new Promise<never>((_, reject) => {
      onAbort = () => reject(signal.reason);
      signal.addEventListener("abort", onAbort, { once: true });
      if (signal.aborted) onAbort();
    });
    try {
      const result = await Promise.race([accountRequest<Proposal>(`/trips/${id}/draft/submit`, {
        method: "POST",
        signal,
        headers: { "If-Match": versionEtag, "Idempotency-Key": key },
      }), timeout]);
      return result.data;
    } finally {
      if (onAbort) signal.removeEventListener("abort", onAbort);
    }
  },
  async accept(
    id: string,
    proposal: Proposal,
    acknowledged: string[],
    key: string,
    liveCheck?: LiveAcceptance | null,
    scope: LiveCheckScope = "live_check",
  ) {
    return (
      await accountRequest<Proposal>(
        `/trips/${id}/proposals/${proposal.id}/accept`,
        {
          method: "POST",
          headers: { "Idempotency-Key": key },
          body: JSON.stringify({
            expected_current_version_id: proposal.base_current_version_id,
            acknowledged_issue_ids: acknowledged,
            ...(liveCheck ? {[scope]:liveCheck}:{}),
          }),
        },
      )
    ).data;
  },
  async discard(id: string, proposal: Proposal) {
    return (
      await accountRequest<Proposal>(
        `/trips/${id}/proposals/${proposal.id}/discard`,
        { method: "POST" },
      )
    ).data;
  },
};
