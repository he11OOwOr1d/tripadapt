import { parseDayCheck, type DayCheckDiagnostic } from "./day-check-feedback";
import type { ActivityPlace } from "./activity-search";
import { authClient } from "../auth/client";
import { authConfigured } from "../auth/config";
import { emptyTrip, isTrip, type Trip } from "./adapter";

import type { PlaceResult } from "./place-search";

type ActivityKind = "custom" | "meal" | "rest" | "free_time";
type TripRow = {
  id: string;
  title: string;
  draft_version_id: string | null;
  lock_version: number;
  lifecycle: string;
  current_version_id: string | null;
};
type StopRow = {
  logical_item_id: string;
  name: string;
  timezone: string;
  desired_nights: number | null;
  place_reference?: PlaceResult | null;
};
type Plan = {
  place_details?: Record<string, ActivityPlace>;
  date_mode: string;
  start_date: string | null;
  end_date: string | null;
  window_start: string | null;
  window_end: string | null;
  desired_days: number | null;
  traveler_count: number;
  room_count: number;
  display_currency: string;
  budget: { amount: string; mode: "target" | "strict" } | null;
  origin: { label: string } | null;
  return_location: { label: string } | null;
  preferences: {
    pace: string;
    interests: string[];
    return_to_origin?: boolean;
    stay_preferences?: Trip["stayPreferences"];
    travel_preferences?: Trip["travelPreferences"];
    costs_confirmed?: boolean;
  };
  costs?: Trip["costRecords"];
  activities: {
    place_id?: string | null;
    kind?: ActivityKind;
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
export class SignInRequired extends Error {}
export class AccountError extends Error {
  constructor(
    message: string,
    public status: number,
    public dayCheck?: DayCheckDiagnostic,
    public code?: string,
    /** Parsed problem body, for callers that need structured details. */
    public problem?: Record<string, unknown>,
  ) {
    super(message);
  }
}
const base = () => {
  const value = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!value)
    throw new Error(
      "The account API is not configured. Your browser draft is safe.",
    );
  return value.replace(/\/$/, "");
};
const remainingDayFeedback: Record<string, string> = {
  "REPLAN_REVIEW_EXPIRED": "This preview no longer fits the fresh timing check. Discard this review and create a new preview before accepting.",
  "REPLAN_TIME_STALE": "Your reported time is more than five minutes old. Confirm the current local time and location, then create a new preview.",
  "REPLAN_DATE_NOT_TODAY": "The reported date is not today at this destination. Confirm today’s local date before checking again.",
  "REPLAN_SCHEDULE_DATE_MISMATCH": "This itinerary day is scheduled for a different date. Choose today’s scheduled day or adjust the trip dates in the planner.",
  "REPLAN_TIME_OFFSET_MISMATCH": "The reported time does not match this destination’s time zone. Confirm the local time again.",
  "REPLAN_BASE_CHANGED": "The saved plan changed after this check. Load the updated plan and create a new preview.",
  "REPLAN_DRAFT_DIVERGED": "Your draft differs from the accepted plan used for this check. Review those draft changes before creating another preview.",
  "REPLAN_PREVIEW_CHANGED": "The preview changed during review. Run a fresh preview and review its timing again.",
  "REPLAN_ROUTE_UNAVAILABLE": "A connecting journey has no usable travel estimate. Try another travel mode or check again later.",
  "REPLAN_ROUTE_WARNING": "A connecting route has an access warning. Check the route before creating another preview.",
  "REPLAN_MAP_REQUIRED": "Link a map location to each remaining activity before checking connecting journeys.",
  "REPLAN_COMMITMENT_CONFLICT": "The proposed timing would miss a fixed or booked activity. Adjust flexible activities or reduce rest in a new preview.",
  "REPLAN_NOT_READY": "Resolve the issues in the readiness check, then confirm your current time and location again.",
  "REPLAN_TRIP_CLOSED": "This trip is completed or archived. Resume the trip before checking the remaining day.",
  "REPLAN_BASE_UNAVAILABLE": "The plan used for this check is unavailable. Load the current saved plan and check again.",
  "REPLAN_SCOPE_UNAVAILABLE": "This destination or day is no longer available in the selected plan. Load the current plan and choose a day again.",
  "REPLAN_LOCATION_MISMATCH": "The starting place does not match this check. Confirm your current mapped location again.",
  "REPLAN_SKIP_PROTECTED": "A selected activity is fixed or booked. Change it explicitly in the planner before skipping it.",
  "REPLAN_SKIP_INVALID": "The skip selection no longer matches the remaining activities. Load the day again and choose which activities to skip.",
  "REPLAN_PREVIEW_LIMIT": "This check supports up to six remaining visits. Adjust this day manually in the planner.",
  "REPLAN_DST_DAY": "This day includes a clock change. Adjust its timing manually in the planner.",
  "REPLAN_MIDNIGHT": "The proposed activities would finish after midnight. Shorten the remaining day in the planner.",
  "REPLAN_CANDIDATE_CONFLICT": "The proposed schedule has a conflict. Adjust the remaining day and create another preview.",
  "REPLAN_NO_CHANGES": "This preview makes no changes to the saved schedule. No acceptance is needed."
};

export async function accountRequest<T>(
  path: string,
  options: RequestInit = {},
) {
  options.signal?.throwIfAborted();
  if (!authConfigured)
    throw new Error("Supabase sign-in is not configured yet.");
  const client = authClient();
  const { data, error } = await client.auth.getSession();
  options.signal?.throwIfAborted();
  if (error || !data.session)
    throw new SignInRequired("Sign in to access your account trips.");
  // The API verifies the bearer token; getSession only retrieves it for transport.
  const response = await fetch(base() + path, {
    ...options,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${data.session.access_token}`,
      ...options.headers,
    },
  });
  if (response.status === 401)
    throw new SignInRequired(
      "Your session has expired. Sign in again; your draft is safe.",
    );
  if (!response.ok) {
    let code = "", detail = "";
    let dayCheck: DayCheckDiagnostic | undefined;
    let body: Record<string, unknown> | undefined;
    try {
      const problem = await response.json();
      body = problem && typeof problem === "object" ? problem : undefined;
      dayCheck = parseDayCheck(problem.day_check);
      code = typeof problem.code === "string" ? problem.code : "";
      detail = typeof problem.detail === "string" ? problem.detail.slice(0,1000) : "";
    } catch {
      /* Preserve safe status feedback for non-JSON outages. */
    }
    throw new AccountError(
      code === "AUTH_PROVIDER_UNAVAILABLE" ? "Sign-in verification is temporarily unavailable. Your trip is still saved; retry when the connection returns." : code === "TRIP_ACCEPTED_PLAN_REQUIRED" ? "Review and accept a plan before starting this trip. Your draft is unchanged." : code === "TRIP_CHAT_CLOSED" ? "Completed or archived trips cannot start new planning requests. Your saved trip and conversation remain available." : code === "AGENT_PLANNING_ONLY" ? "AI itinerary changes are available while planning. For an active trip, chat can explain the day or open a remaining-day check." : code.startsWith("REPLAN_") ? `${remainingDayFeedback[code] ?? "This remaining-day check could not finish. Confirm fresh time and location and try a new preview."} Your saved trip is unchanged.` : code.startsWith("DELAY_") && detail ? detail : code === "LIVE_CHECK_HOURS_NOT_CONFIRMED" ? "Live acceptance stopped: the proposed visit does not fit the regular opening hours, or hours are unknown for that place. Your proposal is still pending."
        : code === "LIVE_CHECK_ROUTE_SHORTFALL" ? "Live acceptance stopped: an adjacent journey needs more time. Your proposal is still pending."
        : code === "LIVE_CHECK_ROUTE_WARNING" ? "Live acceptance stopped: the route service returned an access warning. Review the route; your proposal is still pending."
        : code === "LIVE_CHECK_LOCATION_REQUIRED" ? "Live acceptance needs mapped locations for this activity and its adjacent journeys. Your proposal is still pending."
        : code === "LIVE_CHECK_DAY_LIMIT" ? "Live day checks cover up to six affected visits per action. Your review is still pending."
        : code === "LIVE_CHECK_DATE_MISMATCH" ? "Use the date from the saved trip for live acceptance. Your proposal is still pending."
        : code === "ROUTES_ACCESS_DENIED"
        ? "The route service rejected the request. Check the Geoapify key on the backend. Your schedule is unchanged."
        : code === "ROUTES_NOT_CONFIGURED"
          ? "Journey checks are not configured on this backend. Your schedule is unchanged."
        : code === "ROUTES_RATE_LIMITED" || code === "ROUTES_BUSY"
          ? "Route checks have reached the local usage limit. Try later; your schedule is unchanged."
        : code === "ROUTES_UNAVAILABLE" || code === "ROUTES_NOT_FOUND"
          ? "No usable route estimate was returned. Try another mode or check again later; your schedule is unchanged."
        : code === "JOURNEY_DIFFERENT_DESTINATIONS"
          ? "This check supports two places within the same destination. Intercity journeys need a separate check."
        : code === "PLACE_HOURS_UNAVAILABLE"
        ? "Opening-hours data is temporarily unavailable. Your activity is kept; try again later."
        : code === "PLACE_HOURS_NOT_FOUND"
          ? "That place’s record is no longer available, so its hours cannot be checked. Your activity is kept."
      : code === "PLACE_HOURS_ACCESS_DENIED"
        ? "The place-data service rejected the request. Check the Geoapify key on the backend. Your activity is kept."
        : code === "PLACE_HOURS_NOT_CONFIGURED"
          ? "Opening-hours checks are not configured on this backend. Your activity is kept."
          : code === "PLACE_HOURS_RATE_LIMITED" || code === "PLACE_HOURS_BUSY"
            ? "Opening-hours checks are busy or have reached the local usage limit. Try later; your activity is kept."
            : code === "PLACE_LOCATION_MISMATCH"
              ? "The place record no longer matches the selected map location. Link the map location again."
      : code === "AI_LOCATION_REQUIRED"
        ? "Choose a map location for this destination in Explore nearby places, then try again."
        : code.startsWith("ACTIVITY_") && response.status === 429
          ? "Place lookup is busy or has reached its usage limit. Wait a minute and try again; your trip is unchanged."
        : code.startsWith("ACTIVITY_") && response.status === 503 && code !== "ACTIVITY_SEARCH_DISABLED"
          ? "Nearby place lookup is unavailable here. Try later or use the planner manually; no sample places were substituted."
        : code === "ACTIVITY_SEARCH_DISABLED"
          ? "Real-place search is disabled on the backend. No sample places will be substituted."
      : code === "AUTH_NOT_CONFIGURED"
        ? "Account saving is unavailable because the server sign-in configuration is missing. Your browser draft is kept."
         : code === "WEATHER_REQUEST_UNAVAILABLE"
          ? "This chat request no longer matches the saved day. Ask again from the latest saved plan."
        : code === "WEATHER_REPLACEMENT_LOCATION" || code === "WEATHER_REPLACEMENT_CATEGORY" || code === "WEATHER_REPLACEMENT_EXPIRED" || code === "WEATHER_REPLACEMENT_UNCHANGED"
          ? "Choose a different museum or gallery from a fresh search for this destination. Your activity is unchanged."
        : code === "WEATHER_REVIEW_EXPIRED"
          ? "This weather review has expired. Discard it, refresh the forecast and prepare a new preview. Your trip is unchanged."
        : code === "WEATHER_PLANNING_ONLY"
          ? "Weather-related removals currently support trips still being planned. Active-trip replanning needs a separate time and location check."
        : code === "WEATHER_DATE_MISMATCH" || code === "WEATHER_CONTEXT_MISMATCH"
          ? "The weather date or location does not match this saved day. Reopen the current day and check its forecast again."
        : code === "WEATHER_LOCATION_REQUIRED"
          ? "Choose a map location for this destination before preparing a weather-related change."
        : code === "WEATHER_FORECAST_REQUIRED"
          ? "No usable forecast covers this date. Your trip is unchanged; you can still edit it manually."
        : code === "WEATHER_RATE_LIMITED" || code === "WEATHER_BUSY"
          ? "Weather checks are busy. Wait a minute, then try again. Your trip is unchanged."
        : code === "WEATHER_UNAVAILABLE"
          ? "Weather is unavailable right now. Try again later; your trip is unchanged."
        : code === "STALE_PROPOSAL"
          ? "Your trip changed after this review. Close it and review the latest saved draft."
          : code === "PLAN_CONFLICT"
            ? "This plan has scheduling conflicts. Return to editing to resolve them."
            : code === "ACKNOWLEDGEMENT_REQUIRED"
              ? "Acknowledge the unverified information before accepting this provisional plan."
              : response.status === 412
                ? "This trip changed elsewhere. Reopen the account version before saving again; your local edits are kept."
                : response.status === 404
                  ? "This trip is unavailable for your account."
                  : response.status === 503
                    ? "The account service is temporarily unavailable. Retry when it returns."
                    : `Account request failed (${response.status}). Your local draft is kept.`,
      response.status,
      dayCheck,
      code,
      body,
    );
  }
  const envelope = await response.json();
  return {
    page: envelope.page as
      { next_cursor: string | null; has_more: boolean } | undefined,
    data: envelope.data as T,
    etag: response.headers.get("etag"),
  };
}
function input(trip: Trip) {
  if (!isTrip(trip))
    throw new Error(
      "Check your draft’s numeric and preference values before saving.",
    );
  return {
    date_mode:
      trip.mode === "duration" && !trip.days ? "open_ended" : trip.mode,
    start_date: trip.mode === "exact" ? trip.start || null : null,
    end_date: trip.mode === "exact" ? trip.end || null : null,
    window_start: trip.mode === "window" ? trip.start || null : null,
    window_end: trip.mode === "window" ? trip.end || null : null,
    desired_days: trip.days || null,
    traveler_count: trip.travelers,
    room_count: trip.rooms,
    display_currency: trip.currency,
    budget: trip.budget ? { amount: trip.budget, mode: trip.budgetMode ?? "target" } : null,
    origin: trip.origin ? { label: trip.origin } : null,
    return_location: trip.finish ? { label: trip.finish } : null,
    preferences: {
      pace: trip.pace === "busy" ? "fast" : trip.pace,
      interests: trip.interests ? [trip.interests] : [],
      return_to_origin: trip.returnToOrigin !== false,
      stay_preferences: trip.stayPreferences ?? {},
      travel_preferences: trip.travelPreferences ?? {},
      costs_confirmed: trip.costsConfirmed === true,
    },
    costs: trip.costRecords ?? [],
    stops: trip.stops.map((s) => ({
      client_id: s.id,
      name: s.name,
      timezone: s.timezone,
      desired_nights: s.nights,
      place_reference_id: s.location?.reference_id ?? null,
    })),
    activities: trip.activities.map((a) => ({
      place_id: a.place?.id ?? null,
      kind: a.kind ?? "custom",
      logical_id: a.id,
      stop_logical_id: a.stopId,
      user_label: a.title,
      local_day_offset: a.day - 1,
      local_start_time: a.start,
      duration_minutes: a.minutes,
      fixed: a.fixed,
      completed: a.completed,
      skipped: a.skipped === true,
      booked: a.booked,
    })),
  };
}
export const accountTripAdapter = {
  async list(cursor?: string) {
    const result = await accountRequest<TripRow[]>(
      "/trips" + (cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""),
    );
    return { rows: result.data, nextCursor: result.page?.next_cursor ?? null };
  },
  async metadata(id: string) {
    const result = await accountRequest<TripRow>(`/trips/${id}`);
    return { id, lifecycle: result.data.lifecycle, currentVersionId: result.data.current_version_id, tripEtag: result.etag! };
  },
  async transition(saved: {id: string; tripEtag: string}, lifecycle: "planning" | "active" | "completed") {
    const result = await accountRequest<TripRow>(`/trips/${saved.id}`, {
      method: "PATCH",
      headers: { "If-Match": saved.tripEtag },
      body: JSON.stringify({lifecycle}),
    });
    return { id: saved.id, lifecycle: result.data.lifecycle, currentVersionId: result.data.current_version_id, tripEtag: result.etag! };
  },
  async load(id: string, signal?:AbortSignal) {
    const metadata = await accountRequest<TripRow>(`/trips/${id}`, {signal});
    if (!metadata.data.draft_version_id)
      throw new Error("This trip has no editable draft.");
    const path = `/trips/${id}/versions/${metadata.data.draft_version_id}`;
    const [version, stops] = await Promise.all([
      accountRequest<Plan>(path, {signal}),
      accountRequest<StopRow[]>(path + "/stops", {signal}),
    ]);
    const p = version.data;
    const trip: Trip = {
      ...emptyTrip,
      title: metadata.data.title,
      mode:
        p.date_mode === "open_ended"
          ? "duration"
          : (p.date_mode as Trip["mode"]),
      start: (p.date_mode === "window" ? p.window_start : p.start_date) ?? "",
      end: (p.date_mode === "window" ? p.window_end : p.end_date) ?? "",
      days: p.desired_days ?? 0,
      travelers: p.traveler_count,
      rooms: p.room_count,
      currency: p.display_currency,
      budget: p.budget?.amount ?? "",
      budgetMode: p.budget?.mode ?? "target",
      origin: p.origin?.label ?? "",
      finish: p.return_location?.label ?? "",
      returnToOrigin: p.preferences.return_to_origin ?? true,
      pace: p.preferences.pace === "fast" ? "busy" : p.preferences.pace,
      interests: p.preferences.interests.join(", "),
      stayPreferences: p.preferences.stay_preferences ?? {},
      travelPreferences: p.preferences.travel_preferences ?? {},
      costRecords: p.costs ?? [],
      costsConfirmed: p.preferences.costs_confirmed === true,
      stops: stops.data.map((s) => ({
        id: s.logical_item_id,
        name: s.name,
        timezone: s.timezone,
        nights: s.desired_nights ?? 0,
        location: s.place_reference ?? undefined,
      })),
      activities: p.activities.map((a) => ({
        place: a.place_id ? p.place_details?.[a.place_id] : undefined,
        kind: a.kind ?? "custom",
        id: a.logical_id,
        stopId: a.stop_logical_id,
        title: a.user_label,
        day: a.local_day_offset + 1,
        start: a.local_start_time.slice(0, 5),
        minutes: a.duration_minutes,
        fixed: a.fixed,
        completed: a.completed,
        ...(a.skipped ? { skipped: true } : {}),
        booked: a.booked,
      })),
    };
    return { trip, id, currentVersionId: metadata.data.current_version_id, lifecycle: metadata.data.lifecycle, versionEtag: version.etag!, tripEtag: metadata.etag! };
  },
  async create(trip: Trip) {
    const body = JSON.stringify({
      title: trip.title.trim() || "My untitled escape",
      plan: input(trip),
    });
    const hash = Array.from(
      new Uint8Array(
        await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body)),
      ),
    )
      .map((n) => n.toString(16).padStart(2, "0"))
      .join("");
    const stored = sessionStorage.getItem("elsewhere.create-retry");
    const previous = stored ? JSON.parse(stored) : null;
    const key = previous?.hash === hash ? previous.key : crypto.randomUUID();
    sessionStorage.setItem(
      "elsewhere.create-retry",
      JSON.stringify({ hash, key }),
    );
    const result = await accountRequest<TripRow>("/trips", {
      method: "POST",
      headers: { "Idempotency-Key": key },
      body,
    });
    const saved = await this.load(result.data.id);
    sessionStorage.removeItem("elsewhere.create-retry");
    return saved;
  },
  async save(
    trip: Trip,
    saved: { id: string; tripEtag: string; versionEtag: string },
  ) {
    const plan = input(trip);
    // Explicit user replacement of the editable schedule; never modifies an accepted version.
    await accountRequest(`/trips/${saved.id}/draft/commands`, {
      method: "POST",
      headers: { "If-Match": saved.versionEtag },
      body: JSON.stringify({
        commands: [
          {
            type: "plan.update_settings",
            changes: { ...plan, stops: [], activities: [], costs: [] },
          },
          { type: "stop.reorder", stops: plan.stops, cascade: true },
          {
            type: "activity.replace_user_schedule",
            activities: plan.activities,
          },
          { type: "cost.replace_records", costs: plan.costs },
        ],
      }),
    });
    const nextTripEtag = saved.tripEtag.replace(
      /:(\d+)"$/,
      (_, lock) => `:${Number(lock) + 1}"`,
    );
    await accountRequest(`/trips/${saved.id}`, {
      method: "PATCH",
      headers: { "If-Match": nextTripEtag },
      body: JSON.stringify({
        title: trip.title.trim() || "My untitled escape",
      }),
    });
    return this.load(saved.id);
  },
};
