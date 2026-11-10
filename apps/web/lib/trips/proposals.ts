import { accountRequest } from "./account-adapter";
export type Proposal = {
  source: string;
  generation?: {
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

    stops: { client_id: string; name: string; desired_nights: number | null; timezone?: string }[];
    activities: {
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
