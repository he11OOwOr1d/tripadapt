import { accountRequest } from "./account-adapter";
import type { PlanningJob } from "./planning-jobs";
export type ConversationTurn = {
  id: string;
  user_text: string;
  assistant_text: string | null;
  kind: string | null;
  choices: string[];
  created_at: string;
  job: PlanningJob;
};
export type ConversationPage = {
  turns: ConversationTurn[];
  next_cursor: string | null;
};
export const conversationAdapter = {
  async list(tripId: string, before?: string) {
    return (
      await accountRequest<ConversationPage>(
        `/trips/${tripId}/messages${before ? `?before=${encodeURIComponent(before)}` : ""}`,
      )
    ).data;
  },
  async send(
    account: { id: string; versionEtag: string },
    text: string,
    stopId: string,
    day: number,
    key: string,
  ) {
    const match = /^"draft:([a-f0-9-]+):\d+"$/.exec(account.versionEtag);
    if (!match)
      throw new Error("Reopen your saved trip before sending a message.");
    return (
      await accountRequest<ConversationTurn>(`/trips/${account.id}/messages`, {
        method: "POST",
        headers: { "If-Match": account.versionEtag, "Idempotency-Key": key },
        body: JSON.stringify({
          text,
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
};
export function progressWords(stage: string, seed: string) {
  const n = seed.charCodeAt(seed.length - 1) % 2;
  if (stage.includes("Waiting") || stage.includes("Retry")) return stage;
  if (stage.includes("Understanding"))
    return ["Getting the picture…", "Reading your note…"][n];
  if (/Reading|Gathering/.test(stage))
    return ["Looking over your days…", "Checking the details…"][n];
  if (/Repairing|Checking times/.test(stage))
    return ["Checking what fits…", "Making the timing work…"][n];
  if (/Creating/.test(stage))
    return ["Putting the changes together…", "Shaping a possibility…"][n];
  return "Working on your request…";
}
