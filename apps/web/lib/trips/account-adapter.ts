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
  budget: { amount: string } | null;
  origin: { label: string } | null;
  return_location: { label: string } | null;
  preferences: {
    pace: string;
    interests: string[];
    return_to_origin?: boolean;
    stay_preferences?: Trip["stayPreferences"];
    travel_preferences?: Trip["travelPreferences"];
  };
  activities: {
    google_place_id?: string | null;
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
    booked: boolean;
  }[];
};
export class SignInRequired extends Error {}
export class AccountError extends Error {
  constructor(
    message: string,
    public status: number,
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
export async function accountRequest<T>(
  path: string,
  options: RequestInit = {},
) {
  if (!authConfigured)
    throw new Error("Supabase sign-in is not configured yet.");
  const client = authClient();
  const { data, error } = await client.auth.getSession();
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
    let code = "";
    try {
      code = (await response.json()).code ?? "";
    } catch {
      /* Preserve safe status feedback for non-JSON outages. */
    }
    throw new AccountError(
      code === "LIVE_CHECK_HOURS_NOT_CONFIRMED" ? "Live acceptance stopped: the proposed visit does not fit confirmed current hours, or hours/date coverage is unknown. Your proposal is still pending."
        : code === "LIVE_CHECK_ROUTE_SHORTFALL" ? "Live acceptance stopped: an adjacent journey needs more time. Your proposal is still pending."
        : code === "LIVE_CHECK_ROUTE_WARNING" ? "Live acceptance stopped: Google returned a route-access warning. Review the route; your proposal is still pending."
        : code === "LIVE_CHECK_LOCATION_REQUIRED" ? "Live acceptance needs mapped locations for this activity and its adjacent journeys. Your proposal is still pending."
        : code === "LIVE_CHECK_DATE_MISMATCH" ? "Use the date from the saved trip for live acceptance. Your proposal is still pending."
        : code === "GOOGLE_ROUTES_ACCESS_DENIED"
        ? "Google Maps rejected the route check. Enable Routes API and allow it on the backend key; also check billing and the allowed IP."
        : code === "GOOGLE_ROUTES_NOT_CONFIGURED"
          ? "Journey checks are not configured on this backend. Your schedule is unchanged."
        : code === "GOOGLE_ROUTES_RATE_LIMITED" || code === "GOOGLE_ROUTES_BUSY"
          ? "Google Maps checks have reached the local usage limit. Try later; your schedule is unchanged."
        : code === "GOOGLE_ROUTES_UNAVAILABLE"
          ? "No usable route estimate was returned. Try another mode or check again later; your schedule is unchanged."
        : code === "JOURNEY_DIFFERENT_DESTINATIONS"
          ? "This check supports two places within the same destination. Intercity journeys need a separate check."
        : code === "GOOGLE_PLACES_UNAVAILABLE"
        ? "Google Maps is temporarily unavailable. Your activity is kept; try again later."
        : code === "GOOGLE_PLACE_NOT_FOUND"
          ? "That Google listing is no longer available. Choose a different matching place."
      : code === "GOOGLE_PLACES_ACCESS_DENIED"
        ? "Google Maps rejected this backend key. Check Places API (New), billing and the allowed public IP in Google Cloud."
        : code === "GOOGLE_PLACES_NOT_CONFIGURED"
          ? "Google Maps checks are not configured on this backend. Your activity is kept."
          : code === "GOOGLE_PLACES_RATE_LIMITED" || code === "GOOGLE_PLACES_BUSY"
            ? "Google Maps checks are busy or have reached the local usage limit. Try later; your activity is kept."
            : code === "GOOGLE_PLACE_LOCATION_MISMATCH"
              ? "That Google listing is too far from the selected place. Choose another matching listing."
      : code === "AI_LOCATION_REQUIRED"
        ? "Choose a map location for this destination in Explore nearby places, then try again."
        : code === "ACTIVITY_SEARCH_DISABLED"
          ? "Real-place search is disabled on the backend. No sample places will be substituted."
      : code === "AUTH_NOT_CONFIGURED"
        ? "Account saving is unavailable because the server sign-in configuration is missing. Your browser draft is kept."
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
    budget: trip.budget ? { amount: trip.budget, mode: "target" } : null,
    origin: trip.origin ? { label: trip.origin } : null,
    return_location: trip.finish ? { label: trip.finish } : null,
    preferences: {
      pace: trip.pace === "busy" ? "fast" : trip.pace,
      interests: trip.interests ? [trip.interests] : [],
      return_to_origin: trip.returnToOrigin !== false,
      stay_preferences: trip.stayPreferences ?? {},
      travel_preferences: trip.travelPreferences ?? {},
    },
    stops: trip.stops.map((s) => ({
      client_id: s.id,
      name: s.name,
      timezone: s.timezone,
      desired_nights: s.nights,
      place_reference_id: s.location?.reference_id ?? null,
    })),
    activities: trip.activities.map((a) => ({
      google_place_id: a.googlePlaceId ?? null,
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
  async load(id: string) {
    const metadata = await accountRequest<TripRow>(`/trips/${id}`);
    if (!metadata.data.draft_version_id)
      throw new Error("This trip has no editable draft.");
    const path = `/trips/${id}/versions/${metadata.data.draft_version_id}`;
    const [version, stops] = await Promise.all([
      accountRequest<Plan>(path),
      accountRequest<StopRow[]>(path + "/stops"),
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
      origin: p.origin?.label ?? "",
      finish: p.return_location?.label ?? "",
      returnToOrigin: p.preferences.return_to_origin ?? true,
      pace: p.preferences.pace === "fast" ? "busy" : p.preferences.pace,
      interests: p.preferences.interests.join(", "),
      stayPreferences: p.preferences.stay_preferences ?? {},
      travelPreferences: p.preferences.travel_preferences ?? {},
      stops: stops.data.map((s) => ({
        id: s.logical_item_id,
        name: s.name,
        timezone: s.timezone,
        nights: s.desired_nights ?? 0,
        location: s.place_reference ?? undefined,
      })),
      activities: p.activities.map((a) => ({
        googlePlaceId: a.google_place_id ?? undefined,
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
        booked: a.booked,
      })),
    };
    return { trip, id, versionEtag: version.etag!, tripEtag: metadata.etag! };
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
            changes: { ...plan, stops: [], activities: [] },
          },
          { type: "stop.reorder", stops: plan.stops, cascade: true },
          {
            type: "activity.replace_user_schedule",
            activities: plan.activities,
          },
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
