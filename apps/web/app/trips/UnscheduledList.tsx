"use client";
import type { Trip } from "../../lib/trips/adapter";
import { unscheduledMustVisits } from "../../lib/trips/shortlist";

/**
 * Must-visit places from the shortlists that have no day in the plan, each with the reason (PRD FR-02 and FR-06).
 * Shown on the whole-trip view, which works with or without exact dates. Nothing here changes the plan.
 */
export default function UnscheduledList({ trip, onOpen }: { trip: Trip; onOpen: (stopId: string, day: number) => void }) {
  const items = unscheduledMustVisits(trip);
  if (!items.length) return null;
  return (
    <section className="unscheduled-list" aria-labelledby="unscheduled-title">
      <h2 id="unscheduled-title">Not scheduled yet</h2>
      <p>
        {items.length === 1
          ? "A place you marked must-visit has no day in the plan. It stays here, with the reason, until you place it or change your mind."
          : `${items.length} places you marked must-visit have no day in the plan. They stay here, with the reasons, until you place them or change your mind.`}
      </p>
      <ul>
        {items.map(({ stop, state }) => (
          <li key={state.wish.id}>
            <div>
              <strong>{state.wish.label}</strong>
              <span> · {stop.name}</span>
            </div>
            <p>{state.reason}</p>
            <button type="button" onClick={() => onOpen(stop.id, state.fit?.day ?? 1)}>
              Open {stop.name}<span className="sr-only"> to place {state.wish.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
