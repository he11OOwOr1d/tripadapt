"use client";
import { useState } from "react";
import type { Trip } from "../../lib/trips/adapter";
import { carryJourney, journeyImpact } from "../../lib/trips/journey-impact";

/** Shows journeys a route change removed, and lets the traveler carry their details over. */
export default function JourneyImpact({ baseline, trip, onChange }: { baseline: Trip; trip: Trip; onChange: (patch: Partial<Trip>) => void }) {
  const impact = journeyImpact(baseline, trip);
  const [targets, setTargets] = useState<Record<string, string>>({});
  if (impact.lost.length === 0) return null;
  return (
    <section className="journey-impact" aria-live="polite">
      <h3>Journeys your route change removed</h3>
      <p>These connections no longer exist in your route. Carry their details to a new journey, or leave them out of your plan.</p>
      <ul>
        {impact.lost.map((l) => (
          <li key={l.key}>
            <strong>{l.label}</strong>
            <span>
              {[l.mode, l.rate ? `budget ${l.rate}` : "", l.hours ? `${l.hours} hours` : "", l.overnight ? `${l.overnight} travel night${l.overnight === 1 ? "" : "s"}` : ""].filter(Boolean).join(" · ") || "No travel details"}
            </span>
            {l.estimates.length > 0 && <span>Estimates that will be removed if left: {l.estimates.join(", ")}</span>}
            {l.payments.length > 0 && <span>Payments kept as recorded even if left: {l.payments.join(", ")}</span>}
            {impact.added.length > 0 && (
              <div className="journey-impact-carry">
                <label>
                  Carry to
                  <select value={targets[l.key] ?? ""} onChange={(e) => setTargets({ ...targets, [l.key]: e.target.value })}>
                    <option value="">Choose a new journey</option>
                    {impact.added.map((a) => (
                      <option key={a.key} value={a.key}>{a.label}</option>
                    ))}
                  </select>
                </label>
                <button type="button" disabled={!targets[l.key]} onClick={() => onChange(carryJourney(trip, l.key, targets[l.key]))}>
                  Carry details over
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
