"use client";
import { useId } from "react";
import type { Trip } from "../../lib/trips/adapter";
export default function BudgetPreference({trip,onChange}:{trip:Trip;onChange:(mode:"target"|"strict")=>void}) {
  const note=useId();
  return <div className="budget-preference">
    <label>How should we treat this budget?
      <select value={trip.budgetMode??"target"} disabled={trip.budget===""} aria-describedby={note}
        onChange={event=>onChange(event.target.value as "target"|"strict")}>
        <option value="target">Target · room to adjust</option>
        <option value="strict">Strict limit · don’t exceed</option>
      </select>
    </label>
    <p id={note} className="creation-note">{trip.budget===""?"Enter a whole-trip amount to choose a target or strict limit.":trip.budgetMode==="strict"?"You can save this draft. Acceptance needs every allowance and cost known (amounts, rates and tax) and your confirmation that nothing is missing; it then checks your own entries, not live prices.":"A target guides planning. Estimated spending may exceed it; review the incomplete cost breakdown before accepting."}</p>
  </div>;
}
