import type { Activity } from "./adapter";
import type { HoursCheck } from "./place-hours";
export function dayHours(activities: Activity[], checks: Record<string, HoursCheck>) {
  const visits = activities.filter(a => !!a.place || !a.kind || a.kind === "custom").sort((a,b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id));
  const items = visits.map(activity => {
    const check = activity.place ? checks[activity.id] : undefined;
    const state = !activity.place ? "missing_location" : !check ? "unchecked" : check.status === "fits_reported_hours" ? "fits" : check.status === "outside_reported_hours" ? "conflict" : "unknown";
    return { activity, check, state };
  });
  return { items, fits: items.filter(i=>i.state==="fits").length, conflicts: items.filter(i=>i.state==="conflict").length, unknown: items.filter(i=>!["fits","conflict"].includes(i.state)).length };
}
