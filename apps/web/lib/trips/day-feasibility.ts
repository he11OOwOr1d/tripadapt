import type { Activity } from "./adapter";
import type { JourneyCheck } from "./journeys";

const minute = (time: string) => { const [h, m] = time.split(":").map(Number); return h * 60 + m; };
export const pairKey = (from: Activity, to: Activity) => JSON.stringify([from.id, to.id]);
export type JourneyState = "missing_location" | "unchecked" | "shortfall" | "warning" | "fits";

/** Derive coverage from the whole selected day; never skip an unmapped item. */
export function dayFeasibility(activities: Activity[], results: Record<string, JourneyCheck>, mode: "WALK" | "DRIVE", buffer: number) {
  const ordered = [...activities].sort((a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id));
  const conflicts: { from: Activity; to: Activity; minutes: number }[] = [];
  for (let i = 0; i < ordered.length; i++) {
    const from = ordered[i], end = minute(from.start) + from.minutes;
    for (let j = i + 1; j < ordered.length && minute(ordered[j].start) < end; j++) {
      const to = ordered[j];
      conflicts.push({ from, to, minutes: Math.min(end, minute(to.start) + to.minutes) - minute(to.start) });
    }
  }
  const overnight = ordered.filter(a => minute(a.start) + a.minutes > 1440);
  const pairs = ordered.slice(1).map((to, i) => {
    const from = ordered[i], key = pairKey(from, to);
    const gap = minute(to.start) - minute(from.start) - from.minutes;
    const saved = results[key];
    // A result for another mode/buffer/schedule cannot count toward coverage.
    const result = saved && saved.mode === mode && saved.buffer_minutes === buffer && saved.gap_minutes === gap ? saved : undefined;
    const state: JourneyState = !from.place || !to.place ? "missing_location" : !result ? "unchecked" : result.spare_minutes < 0 ? "shortfall" : result.warnings.length ? "warning" : "fits";
    return { from, to, key, gap, result, state };
  });
  const checked = pairs.filter(p => p.state !== "missing_location" && p.result).length;
  const missing = pairs.filter(p => p.state === "missing_location").length;
  const unchecked = pairs.filter(p => p.state === "unchecked").length;
  const shortfalls = pairs.filter(p => p.state === "shortfall").length;
  const warnings = pairs.filter(p => p.result?.warnings.length).length;
  const title = !ordered.length ? "A day still open" : conflicts.length || overnight.length || shortfalls ? "Some timing needs a look" : missing || unchecked ? "A few gaps to check" : warnings ? "Route warnings to review" : pairs.length ? "Checked journeys fit the estimates" : "One activity, no journeys to compare";
  return { ordered, pairs, conflicts, overnight, checked, missing, unchecked, shortfalls, warnings, title };
}
