import type { Trip } from "./adapter";
import { routeLegs } from "./planning";

export type LostJourney = {
  key: string;
  label: string;
  mode: string;
  rate: string;
  hours: string;
  overnight: number;
  estimates: string[];
  payments: string[];
};
export type JourneyImpact = { lost: LostJourney[]; added: { key: string; label: string }[] };

/**
 * Journeys that existed at `baseline` but not now, with what depends on them,
 * and new journeys that have no travel details yet. Pure; never edits the trip.
 */
export function journeyImpact(baseline: Trip, trip: Trip): JourneyImpact {
  const now = routeLegs(trip);
  const keys = new Set(now.map((l) => l.key));
  const lost = routeLegs(baseline)
    .filter((l) => !keys.has(l.key))
    .map((l) => {
      const p = trip.travelPreferences?.[l.key];
      const linked = (trip.costRecords ?? []).filter((c) => c.leg_key === l.key);
      return {
        key: l.key,
        label: `${l.from} → ${l.to}`,
        mode: p?.mode ?? "",
        rate: p?.rate ?? "",
        hours: p?.hours ?? "",
        overnight: p?.overnight ?? 0,
        estimates: linked.filter((c) => c.status !== "paid").map((c) => c.label),
        payments: linked.filter((c) => c.status === "paid").map((c) => c.label),
      };
    })
    // Only journeys that carried something the traveler entered.
    .filter((l) => l.mode || l.rate || l.hours || l.overnight || l.estimates.length || l.payments.length);
  const added = now
    .filter((l) => !routeLegs(baseline).some((b) => b.key === l.key) && !trip.travelPreferences?.[l.key])
    .map((l) => ({ key: l.key, label: `${l.from} → ${l.to}` }));
  return { lost, added };
}

/**
 * Explicitly move a lost journey's travel details and linked costs to a new
 * journey. The source details are removed so nothing is counted twice.
 */
export function carryJourney(trip: Trip, from: string, to: string): Partial<Trip> {
  if (from === to || !routeLegs(trip).some((l) => l.key === to) || routeLegs(trip).some((l) => l.key === from)) return {};
  const prefs = { ...(trip.travelPreferences ?? {}) };
  if (prefs[from] && !prefs[to]) prefs[to] = prefs[from];
  delete prefs[from];
  return {
    travelPreferences: prefs,
    costRecords: (trip.costRecords ?? []).map((c) => (c.leg_key === from ? { ...c, leg_key: to } : c)),
  };
}
