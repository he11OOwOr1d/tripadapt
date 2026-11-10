export const authConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);
export function authConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key)
    throw new Error(
      "Sign-in is not configured yet. Your trip remains in this browser.",
    );
  if (key.startsWith("sb_secret_"))
    throw new Error("Use a Supabase publishable key, not a secret key.");
  return { url, key };
}
/** Only internal trip routes are accepted; never forward arbitrary callback URLs. */
export function tripReturn(value: string | null | undefined) {
  if (!value || !value.startsWith("/trips/new") || value.startsWith("//"))
    return "/trips/new";
  try {
    const url = new URL(value, "https://elsewhere.invalid");
    if (
      url.origin !== "https://elsewhere.invalid" ||
      url.pathname !== "/trips/new" ||
      url.hash
    )
      return "/trips/new";
    const allowed = ["trip", "view", "stop", "day"];
    for (const key of url.searchParams.keys())
      if (!allowed.includes(key) || url.searchParams.getAll(key).length !== 1)
        return "/trips/new";
    for (const key of ["trip", "stop"]) {
      const id = url.searchParams.get(key);
      if (
        id &&
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
          id,
        )
      )
        return "/trips/new";
    }
    const view = url.searchParams.get("view");
    if (view && view !== "itinerary") return "/trips/new";
    const day = url.searchParams.get("day");
    if (
      day &&
      (!/^\d+$/.test(day) ||
        !Number.isSafeInteger(Number(day)) ||
        Number(day) < 1)
    )
      return "/trips/new";
    return url.pathname + url.search;
  } catch {
    return "/trips/new";
  }
}
