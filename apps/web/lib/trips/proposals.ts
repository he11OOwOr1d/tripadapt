import type { ActivityPlace } from "./activity-search";
import { accountRequest } from "./account-adapter";
import type { PlaceResult } from "./place-search";
export type LiveAcceptance = {google_place_id:string;visit_date:string;mode:"WALK"|"DRIVE";buffer_minutes:number};
export type PendingReview = {id:string;version_number:number;source:string;title:string;summary:string;stale:boolean};
export type PendingReviewPage = {reviews:PendingReview[];next_before:number|null};
export type Proposal = {
  stale?:boolean;
  place_details?: Record<string, ActivityPlace>;
  location_references?: Record<string, PlaceResult>;
  source: string;
  generation?: {
    request?: {activity_id:string;local_start_time:string};
    provisional_date?:string|null;
    evidence?: "sample_catalog" | "mapped_places";
    operation?: "move_activity" | "resize_activity" | "remove_activity" | "restore_plan";
    restoration?: { version_number: number; added: number; removed: number; changed: number; settings_changed: boolean };
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
  validation: {
    status: string;
    issues: {
      id: string;
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
      google_place_id?:string|null;
      place_id?: string | null;
      logical_id: string;
      stop_logical_id: string;
      user_label: string;
      local_day_offset: number;
      local_start_time: string;
      duration_minutes: number;
      fixed: boolean;
      completed: boolean;
      booked: boolean;
    }[];
  };
};
export const proposalAdapter = {
  async pending(tripId:string,before?:number,signal?:AbortSignal) {
    return (await accountRequest<PendingReviewPage>(`/trips/${tripId}/proposals${before?`?before=${before}`:""}`,{signal})).data;
  },
  async timeChange(tripId: string, etag: string, activityId: string, start: string, key: string, signal: AbortSignal) {
    return (await accountRequest<Proposal>(`/trips/${tripId}/proposals/time-change`, {method:"POST",signal,headers:{"If-Match":etag,"Idempotency-Key":key},body:JSON.stringify({activity_id:activityId,local_start_time:start})})).data;
  },
  async get(tripId: string, id: string) {
    return (await accountRequest<Proposal>(`/trips/${tripId}/proposals/${id}`))
      .data;
  },
  async submit(id: string, versionEtag: string, key: string) {
    return (
      await accountRequest<Proposal>(`/trips/${id}/draft/submit`, {
        method: "POST",
        headers: { "If-Match": versionEtag, "Idempotency-Key": key },
      })
    ).data;
  },
  async accept(
    id: string,
    proposal: Proposal,
    acknowledged: string[],
    key: string,
    liveCheck?: LiveAcceptance | null,
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
            ...(liveCheck ? {live_check:liveCheck}:{}),
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
