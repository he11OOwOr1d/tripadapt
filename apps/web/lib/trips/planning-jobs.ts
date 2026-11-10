import { accountRequest } from "./account-adapter";
export type PlanningJob = {
  engine: "fixture" | "groq";
  scope: { stop_logical_id: string; local_day_offset: number };
  destination_name: string;
  id: string;
  trip_id: string;
  status:
    "queued" | "running" | "succeeded" | "failed" | "cancelled" | "superseded";
  stage: string;
  attempts: number;
  cancel_requested: boolean;
  proposal_id: string | null;
  error_code: string | null;
  poll_after_seconds: number;
};
export const terminalJob = (job: PlanningJob) =>
  !["queued", "running"].includes(job.status);
export const planningJobAdapter = {
  async start(
    account: { id: string; versionEtag: string },
    stopId: string,
    day: number,
    key: string,
    engine: "fixture" | "groq" = "fixture",
  ) {
    const match = /^"draft:([a-f0-9-]+):\d+"$/.exec(account.versionEtag);
    if (!match) throw new Error("Reopen the saved trip before planning.");
    return (
      await accountRequest<PlanningJob>(`/trips/${account.id}/planning-jobs`, {
        method: "POST",
        headers: { "If-Match": account.versionEtag, "Idempotency-Key": key },
        body: JSON.stringify({
          operation: "generate",
          engine,
          base_version_id: match[1],
          scope: {
            type: "selected_day",
            stop_logical_id: stopId,
            local_day_offset: day - 1,
          },
        }),
      })
    ).data;
  },
  async get(id: string) {
    return (await accountRequest<PlanningJob>(`/jobs/${id}`)).data;
  },
  async cancel(id: string) {
    return (
      await accountRequest<PlanningJob>(`/jobs/${id}/cancel`, {
        method: "POST",
      })
    ).data;
  },
};
