import { AccountError, accountRequest } from "./account-adapter";

export type RebalanceActivity = { activity_id: string; stop_id: string; label: string; destination: string; day: number; start: string; protected: boolean };
export type RebalanceRequest = { stop_id: string; delta_nights: number; counterpart: string | "trip_length"; drop_activity_ids: string[]; relocate: { activity_id: string; day_offset: number; local_start_time?: string; stop_id?: string }[] };
export type RebalanceSummary = {
  stays: { stop_id: string; name: string; nights_before: number; nights_after: number }[];
  trip_days_before: number | null;
  trip_days_after: number | null;
  end_date_after: string | null;
  dropped: RebalanceActivity[];
  moved: (RebalanceActivity & { to_day: number; to_start: string; to_stop_id: string; to_destination: string; map_cleared: boolean })[];
  estimated_before: string;
  estimated_after: string;
  kept_payments: string[];
  /** Stays the traveler marked as booked whose nights this change alters. Absent from an older server. */
  booked_stays?: { stop_id: string; name: string; stay: string; booked_nights: number | null; nights_before: number; nights_after: number }[];
  /** Journeys the traveler marked as booked that fall on a different day after the change. Absent from an older server. */
  booked_journeys?: { key: string; origin: string; destination: string; shift_nights: number; departure: string; arrival: string; reference: string }[];
  notice: string;
  applied: boolean;
  etag: string;
};
/** A blocked change that needs the traveler's decision, with the affected activities. */
export class RebalanceBlocked extends Error {
  constructor(public code: string, message: string, public activities: RebalanceActivity[]) {
    super(message);
  }
}

const money = (v: unknown) => typeof v === "string" && /^\d+(\.\d{1,4})?$/.test(v);
const isActivity = (a: unknown): a is RebalanceActivity => {
  const x = a as RebalanceActivity;
  return !!x && typeof x.activity_id === "string" && typeof x.stop_id === "string" && typeof x.label === "string" && typeof x.destination === "string" && Number.isInteger(x.day) && typeof x.start === "string" && typeof x.protected === "boolean";
};

/** The reply must describe exactly the requested move and nothing else. */
export function isRebalanceSummary(v: unknown, req: RebalanceRequest, apply: boolean): v is RebalanceSummary {
  if (!v || typeof v !== "object") return false;
  const s = v as RebalanceSummary;
  if (!Array.isArray(s.stays) || !s.stays.every((x) => typeof x.stop_id === "string" && Number.isInteger(x.nights_before) && Number.isInteger(x.nights_after) && x.nights_after >= 0)) return false;
  const changed = s.stays.filter((x) => x.nights_after !== x.nights_before);
  const target = s.stays.find((x) => x.stop_id === req.stop_id);
  if (!target || target.nights_after - target.nights_before !== req.delta_nights) return false;
  if (req.counterpart === "trip_length") {
    if (changed.length !== 1) return false;
  } else {
    const other = s.stays.find((x) => x.stop_id === req.counterpart);
    if (!other || other.nights_before - other.nights_after !== req.delta_nights || changed.length !== 2) return false;
    if (s.trip_days_after !== s.trip_days_before) return false;
  }
  const dropped = new Set(req.drop_activity_ids);
  return (
    Array.isArray(s.dropped) && s.dropped.every(isActivity) && s.dropped.length === dropped.size && s.dropped.every((a) => dropped.has(a.activity_id) && !a.protected) &&
    Array.isArray(s.moved) && s.moved.length === req.relocate.length &&
    s.moved.every((m) => isActivity(m) && !m.protected && req.relocate.some((r) => r.activity_id === m.activity_id && r.day_offset + 1 === m.to_day && m.to_start === (r.local_start_time ?? m.start) && m.to_stop_id === (r.stop_id ?? m.stop_id) && typeof m.to_destination === "string" && typeof m.map_cleared === "boolean" && (!m.map_cleared || m.to_stop_id !== m.stop_id))) &&
    money(s.estimated_before) && money(s.estimated_after) && Array.isArray(s.kept_payments) && s.kept_payments.every((k) => typeof k === "string") &&
    (s.booked_stays === undefined || (Array.isArray(s.booked_stays) && s.booked_stays.every((b) => typeof b.stop_id === "string" && typeof b.name === "string" && typeof b.stay === "string" && (b.booked_nights === null || Number.isInteger(b.booked_nights)) && Number.isInteger(b.nights_before) && Number.isInteger(b.nights_after) && b.nights_before !== b.nights_after))) &&
    (s.booked_journeys === undefined || (Array.isArray(s.booked_journeys) && s.booked_journeys.every((j) => typeof j.key === "string" && typeof j.origin === "string" && typeof j.destination === "string" && Number.isInteger(j.shift_nights) && j.shift_nights !== 0 && typeof j.departure === "string" && typeof j.arrival === "string" && typeof j.reference === "string"))) &&
    typeof s.notice === "string" && s.applied === apply && typeof s.etag === "string"
  );
}

export async function rebalanceStays(tripId: string, etag: string, req: RebalanceRequest, apply: boolean, signal: AbortSignal): Promise<RebalanceSummary> {
  let result: { data: unknown };
  try {
    result = await accountRequest<unknown>(`/trips/${tripId}/draft/stay-rebalance`, {
      method: "POST",
      signal,
      headers: { "If-Match": etag },
      body: JSON.stringify({ ...req, apply }),
    });
  } catch (error) {
    if (error instanceof AccountError && error.code?.startsWith("REBALANCE_")) {
      const list = error.problem?.activities;
      const detail = typeof error.problem?.detail === "string" ? error.problem.detail : error.message;
      throw new RebalanceBlocked(error.code, detail, Array.isArray(list) ? list.filter(isActivity) : []);
    }
    throw error;
  }
  if (!isRebalanceSummary(result.data, req, apply)) throw new Error("The stay change came back incomplete. Your trip is unchanged.");
  return result.data;
}
