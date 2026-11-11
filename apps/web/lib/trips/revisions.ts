import { accountRequest } from "./account-adapter";
import type { Proposal } from "./proposals";
export type Revision = {
  id: string;
  version_number: number;
  source: string;
  accepted_at: string | null;
  current: boolean;
  destinations: string[];
  activity_count: number;
  traveler_count: number;
};
export const revisionAdapter = {
  async list(id: string, before?: number) {
    return (await accountRequest<{ revisions: Revision[]; next_before: number | null }>(`/trips/${id}/revisions${before ? `?before=${before}` : ""}`)).data;
  },
  async restore(id: string, revision: string, etag: string, key: string) {
    return (await accountRequest<Proposal>(`/trips/${id}/revisions/${revision}/restore`, {
      method: "POST", headers: { "If-Match": etag, "Idempotency-Key": key },
    })).data;
  },
};
