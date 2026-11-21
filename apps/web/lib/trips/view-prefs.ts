/** The little of `Storage` these helpers need, so tests can pass a stand-in. */
export type PrefStorage = { getItem(key: string): string | null; setItem(key: string, value: string): void };

/** The browser's local storage, or null where it is missing or blocked (private windows, blocked site data, previews). */
function browserStorage(): PrefStorage | null {
  try { return typeof window !== "undefined" ? window.localStorage : null; } catch { return null; }
}

/**
 * A remembered per-viewer choice, such as which view of the plan to show. Only a value from `allowed` is ever returned,
 * so a stale, edited or unrelated stored value falls back instead of reaching the page. Never throws.
 */
export function readPref<T extends string>(key: string, allowed: readonly T[], fallback: T, storage: PrefStorage | null = browserStorage()): T {
  try {
    const value = storage?.getItem(key);
    return allowed.find((a) => a === value) ?? fallback;
  } catch { return fallback; }
}

/** Remember a choice for next time. Returns whether it was stored; a blocked or full store is not an error, only a lost convenience. */
export function writePref(key: string, value: string, storage: PrefStorage | null = browserStorage()): boolean {
  try {
    if (!storage) return false;
    storage.setItem(key, value);
    return true;
  } catch { return false; }
}

export const AGENDA_VIEW_KEY = "elsewhere.agenda-view.v1";
export const GRID_DAYS_KEY = "elsewhere.agenda-grid-days.v1";
