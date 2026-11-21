/** What the account service gives back for a request: the ETag is the trip's version when it was read. */
export type DeleteRequest = (path: string, options?: RequestInit) => Promise<{ etag: string | null }>;

const statusOf = (error: unknown): number | undefined => (error && typeof error === "object" ? (error as { status?: number }).status : undefined);

/**
 * Delete a trip from the traveler's account. Reads the trip's current version first and sends it with the delete, so a
 * change made elsewhere is never deleted blind; if the trip changed in between (its own autosave, another tab), read
 * again and retry a few times. A trip that is already gone counts as deleted: the traveler asked for it to be gone.
 * Returns "deleted" or "gone"; anything else (sign-in, network, server) is thrown for the caller to explain.
 */
export async function deleteAccountTrip(request: DeleteRequest, id: string, attempts = 3): Promise<"deleted" | "gone"> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    let etag: string | null;
    try {
      etag = (await request(`/trips/${id}`)).etag;
    } catch (error) {
      if (statusOf(error) === 404) return "gone";
      throw error;
    }
    if (!etag) throw new Error("The account service did not say which version of the trip this is, so nothing was deleted.");
    try {
      await request(`/trips/${id}`, { method: "DELETE", headers: { "If-Match": etag } });
      return "deleted";
    } catch (error) {
      const status = statusOf(error);
      if (status === 404) return "gone";
      if (status === 412 && attempt < attempts) continue;
      throw error;
    }
  }
  throw new Error("The trip kept changing while it was being deleted. Nothing was deleted; try again.");
}
