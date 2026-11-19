/** A tab-scoped retry key contains no trip content or credentials. */
export const reviewSubmitRetryKey = "elsewhere.review-submit-retry.v1";
type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const lifetime = 24 * 60 * 60 * 1000;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function reviewSubmitKey(storage: Store, tripId: string, etag: string, fallback: string, now = Date.now()): string {
  try {
    const raw = storage.getItem(reviewSubmitRetryKey);
    if (raw && raw.length <= 2048) {
      const value = JSON.parse(raw);
      if (value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).every(k => ["schema", "tripId", "etag", "key", "savedAt"].includes(k)) && value.schema === 1 && value.tripId === tripId && value.etag === etag && typeof value.key === "string" && uuid.test(value.key) && Number.isFinite(value.savedAt) && value.savedAt <= now && now - value.savedAt < lifetime) return value.key;
    }
  } catch { /* Unavailable or malformed storage falls back to the current request. */ }
  try { storage.setItem(reviewSubmitRetryKey, JSON.stringify({ schema: 1, tripId, etag, key: fallback, savedAt: now })); } catch { /* Retrying within the dialog still uses the same key. */ }
  return fallback;
}

/** Never erase a newer request stored by another render. */
export function clearReviewSubmitKey(storage: Store, tripId: string, etag: string, key: string): void {
  try {
    const raw = storage.getItem(reviewSubmitRetryKey);
    if (!raw || raw.length > 2048) return;
    const value = JSON.parse(raw);
    if (value?.tripId === tripId && value?.etag === etag && value?.key === key) storage.removeItem(reviewSubmitRetryKey);
  } catch { /* Storage is optional. */ }
}
