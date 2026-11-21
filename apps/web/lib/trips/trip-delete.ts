/** What the account service gives back for a request: the ETag is the trip's version when it was read. */
export type DeleteRequest = (path: string, options?: RequestInit) => Promise<{ etag: string | null; data?: unknown }>;

/**
 * How long a deleted trip is kept hidden before it is permanently erased. The server decides (`TRIP_RETENTION_DAYS`,
 * 30 by default) and tells us the exact date when a trip is deleted; this is only for the question asked before that.
 */
export const TRIP_ERASURE_DAYS = 30;

export type DeleteOutcome = { outcome: "deleted" | "gone"; eraseAfter: string | null };

/** The date a deleted trip will be erased, if the answer carried a usable one. */
export function eraseDate(data: unknown): string | null {
  const value = data && typeof data === "object" ? (data as { erase_after?: unknown }).erase_after : null;
  return typeof value === "string" && !Number.isNaN(Date.parse(value)) ? value : null;
}

/** "21 Dec 2026" for a moment, in the traveler's own time zone unless one is given. */
export function formatEraseDate(iso: string, timeZone?: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone }).format(new Date(iso));
}

/** What to tell the traveler once a trip is deleted. */
export function deletedNotice(title: string, eraseAfter: string | null, timeZone?: string): string {
  return eraseAfter
    ? `Deleted “${title}”. It is hidden now and will be permanently erased on ${formatEraseDate(eraseAfter, timeZone)}.`
    : `Deleted “${title}”.`;
}

const statusOf = (error: unknown): number | undefined => (error && typeof error === "object" ? (error as { status?: number }).status : undefined);

/**
 * Delete a trip from the traveler's account. Reads the trip's current version first and sends it with the delete, so a
 * change made elsewhere is never deleted blind; if the trip changed in between (its own autosave, another tab), read
 * again and retry a few times. A trip that is already gone counts as deleted: the traveler asked for it to be gone.
 * Returns the outcome ("deleted" or "gone") and the date the trip will be erased; anything else (sign-in, network, server) is thrown for the caller to explain.
 */
export async function deleteAccountTrip(request: DeleteRequest, id: string, attempts = 3): Promise<DeleteOutcome> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    let etag: string | null;
    try {
      etag = (await request(`/trips/${id}`)).etag;
    } catch (error) {
      if (statusOf(error) === 404) return { outcome: "gone", eraseAfter: null };
      throw error;
    }
    if (!etag) throw new Error("The account service did not say which version of the trip this is, so nothing was deleted.");
    try {
      const answer = await request(`/trips/${id}`, { method: "DELETE", headers: { "If-Match": etag } });
      return { outcome: "deleted", eraseAfter: eraseDate(answer.data) };
    } catch (error) {
      const status = statusOf(error);
      if (status === 404) return { outcome: "gone", eraseAfter: null };
      if (status === 412 && attempt < attempts) continue;
      throw error;
    }
  }
  throw new Error("The trip kept changing while it was being deleted. Nothing was deleted; try again.");
}
