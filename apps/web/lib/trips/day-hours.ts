import type { Activity } from "./adapter";
import type { GoogleCheck } from "./google-places";
export function dayHours(activities: Activity[], checks: Record<string, GoogleCheck>) {
  const visits = activities.filter(a => !!a.place || !!a.googlePlaceId || !a.kind || a.kind === "custom").sort((a,b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id));
  const items = visits.map(activity => {
    const check = activity.place ? checks[activity.id] : undefined;
    const state = !activity.place ? "missing_location" : !check ? "unchecked" : check.status === "fits_reported_hours" ? "fits" : ["reported_closed", "outside_reported_hours"].includes(check.status) ? "conflict" : "unknown";
    return { activity, check, state };
  });
  return { items, fits: items.filter(i=>i.state==="fits").length, conflicts: items.filter(i=>i.state==="conflict").length, unknown: items.filter(i=>!["fits","conflict"].includes(i.state)).length };
}
