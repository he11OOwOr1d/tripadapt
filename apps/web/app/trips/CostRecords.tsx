"use client";
import { useEffect, useId, useRef, useState } from "react";
import type { CostRecord, Trip } from "../../lib/trips/adapter";
import { costMoney } from "../../lib/trips/cost-coverage";
import { routeLegs } from "../../lib/trips/planning";
import {
  blankCostRecord,
  costRecordTotal,
  displayTotal,
  draftFromRecord,
  finishCostRecord,
  linkValue,
  removeCostRecord,
  taxUnknown,
  upsertCostRecord,
  withLink,
  type CostRecordDraft,
} from "../../lib/trips/cost-records";

const categoryNames = { food: "Meals", activity: "Activity", accommodation: "Stay", transport: "Transport", taxes_fees: "Taxes & fees", miscellaneous: "Other" };

function linkLabel(trip: Trip, record: CostRecord): string | null {
  if (record.link_removed) return "Its linked item was removed; the payment is still recorded.";
  if (record.activity_id) {
    const a = trip.activities.find((x) => x.id === record.activity_id);
    if (!a) return "Linked item is no longer in this plan.";
    const stop = trip.stops.find((s) => s.id === a.stopId);
    return `For ${a.title}${stop ? ` · ${stop.name}, day ${a.day}` : ""}`;
  }
  if (record.stop_id) {
    const stop = trip.stops.find((s) => s.id === record.stop_id);
    return stop ? `For your stay in ${stop.name}` : "Linked item is no longer in this plan.";
  }
  if (record.leg_key) {
    const leg = routeLegs(trip).find((l) => l.key === record.leg_key);
    return leg ? `For the journey ${leg.from} → ${leg.to}` : "Linked journey is no longer in this plan.";
  }
  return null;
}

/** Traveler-entered meal/other costs. Nothing here is booked, charged or refunded. */
export default function CostRecords({ trip, onChange, onConfirm }: { trip: Trip; onChange: (records: CostRecord[]) => void; onConfirm?: (confirmed: boolean) => void }) {
  const records = trip.costRecords ?? [];
  const [draft, setDraft] = useState<CostRecordDraft | null>(null);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState<string | null>(null);
  const [returnFocus, setReturnFocus] = useState<string | null>(null);
  const labelInput = useRef<HTMLInputElement>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const formId = useId();
  const editing = draft !== null && records.some((r) => r.id === draft.id);

  useEffect(() => {
    if (draft) labelInput.current?.focus();
  }, [draft?.id]);
  useEffect(() => {
    if (!returnFocus) return;
    const target = returnFocus === "add" ? addButton.current : document.getElementById(`${formId}-edit-${returnFocus}`);
    (target ?? addButton.current)?.focus();
    setReturnFocus(null);
  }, [returnFocus, formId]);

  function close(focus: string) {
    setDraft(null);
    setError("");
    setReturnFocus(focus);
  }
  function save() {
    if (!draft) return;
    const result = finishCostRecord(draft);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    onChange(upsertCostRecord(records, result.record));
    close(result.record.id);
  }
  function remove(record: CostRecord) {
    if (record.status === "paid" && confirming !== record.id) {
      setConfirming(record.id);
      return;
    }
    setConfirming(null);
    onChange(removeCostRecord(records, record.id));
    setReturnFocus("add");
  }
  const set = (patch: Partial<CostRecordDraft>) => {
    setDraft((d) => (d ? { ...d, ...patch } : d));
    setError("");
  };

  return (
    <div className="cost-records">
      <div className="preference-intro">
        <span aria-hidden="true">✎</span>
        <div>
          <h3>Meals & other costs</h3>
          <p>Your own estimates, or amounts you’ve already paid. Link one to a stay, journey or activity if you like. Linked stay and journey amounts count toward their matching allowance; only amounts above it add to the total. Record separate extras as Other. Nothing is booked or charged.</p>
        </div>
      </div>
      {records.length > 0 && (
        <ul className="cost-record-list">
          {records.map((r) => {
            const foreign = !!r.currency && r.currency !== trip.currency;
            const own = r.currency || trip.currency;
            const original = costRecordTotal(r, trip.travelers);
            const total = displayTotal(r, trip.travelers, trip.currency);
            const link = linkLabel(trip, r);
            return (
              <li key={r.id}>
                <div>
                  <strong>{r.label}</strong>
                  {link && <span className={r.link_removed ? "cost-record-removed" : undefined}>{link}</span>}
                  <span>
                    {categoryNames[r.category]} ·{" "}
                    {r.unit === "per_person" ? `${trip.travelers} ${trip.travelers === 1 ? "traveler" : "travelers"} × ` : "Whole group × "}
                    {r.quantity}
                    {r.amount !== "" ? ` × ${costMoney(r.amount, own)}` : " · amount unknown"}
                  </span>
                  <span>
                    {foreign && original !== null ? `${costMoney(original, own)} → ` : ""}
                    {total === null ? (foreign && original !== null ? `${trip.currency} unknown` : "Unknown") : costMoney(total, trip.currency)} ·{" "}
                    {r.status === "paid" ? "you recorded this as paid" : "your estimate"}
                  </span>
                  {r.amount !== "" && (
                    <span>
                      {r.tax_status === "included"
                        ? "Tax included"
                        : r.tax_status === "excluded" && r.tax_percent
                          ? `Includes ${r.tax_percent}% tax added on top`
                          : r.tax_status === "excluded"
                            ? "Tax not included · rate unknown"
                            : "Tax not sure"}
                    </span>
                  )}
                  {foreign && original !== null && (
                    <span>
                      {r.conversion_rate
                        ? `At your rate: 1 ${own} = ${r.conversion_rate} ${trip.currency}${r.rate_note ? ` · ${r.rate_note}` : ""}${r.rate_date ? ` · ${r.rate_date}` : ""}`
                        : `No conversion rate entered, so this stays out of ${trip.currency} totals.`}
                    </span>
                  )}
                </div>
                <div className="cost-record-actions">
                  <button
                    type="button"
                    id={`${formId}-edit-${r.id}`}
                    aria-label={`Edit ${r.label}`}
                    disabled={draft !== null}
                    onClick={() => {
                      setConfirming(null);
                      // Mirror the server rule for a link whose item has left the plan,
                      // so the form never shows "nothing" while holding a stale link.
                      const stale =
                        (r.activity_id && !trip.activities.some((a) => a.id === r.activity_id)) ||
                        (r.stop_id && !trip.stops.some((s) => s.id === r.stop_id)) ||
                        (r.leg_key && !routeLegs(trip).some((l) => l.key === r.leg_key));
                      const next = draftFromRecord(r);
                      setDraft(stale ? { ...next, activity_id: null, stop_id: null, leg_key: null, link_removed: r.status === "paid" } : next);
                    }}
                  >
                    Edit
                  </button>
                  <button type="button" aria-label={`Remove ${r.label}`} disabled={draft !== null} onClick={() => remove(r)}>
                    Remove
                  </button>
                </div>
                {confirming === r.id && (
                  <div className="cost-record-confirm" role="alert">
                    <p>Removing this record does not refund or cancel the payment. It only removes your note of it from this plan.</p>
                    <button type="button" onClick={() => remove(r)}>
                      Remove record
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setConfirming(null);
                        setReturnFocus(r.id);
                      }}
                    >
                      Keep it
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {draft ? (
        <fieldset className="cost-record-form">
          <legend>{editing ? `Edit ${records.find((r) => r.id === draft.id)?.label}` : "Add a cost"}</legend>
          <div className="trip-fields">
            <label>
              What it’s for
              <input ref={labelInput} value={draft.label} maxLength={120} placeholder="e.g. Dinners in Jaipur" onChange={(e) => set({ label: e.target.value })} />
            </label>
            <label>
              Kind
              <select value={draft.category} onChange={(e) => set({ category: e.target.value as CostRecord["category"] })}>
                {Object.entries(categoryNames).map(([value, name]) => (
                  <option key={value} value={value}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            {(trip.stops.length > 0 || trip.activities.length > 0) && (
              <label>
                Linked to
                <select value={linkValue(draft)} aria-describedby={`${formId}-link`} onChange={(e) => {
                  setDraft((d) => (d ? withLink(d, e.target.value) : d));
                  setError("");
                }}>
                  <option value="">Nothing in particular</option>
                  {trip.stops.length > 0 && (
                    <optgroup label="Stays">
                      {trip.stops.map((stop, i) => (
                        <option key={stop.id} value={`stop:${stop.id}`}>
                          {stop.name}{trip.stops.filter((s) => s.name === stop.name).length > 1 ? ` (stop ${i + 1})` : ""}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {routeLegs(trip).length > 0 && (
                    <optgroup label="Journeys">
                      {routeLegs(trip).map((leg) => (
                        <option key={leg.key} value={`leg:${leg.key}`}>
                          {`${leg.from} → ${leg.to}`}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {trip.activities.length > 0 && (
                    <optgroup label="Activities">
                      {[...trip.activities]
                        .sort((a, b) => a.day - b.day || a.start.localeCompare(b.start))
                        .map((a) => (
                          <option key={a.id} value={`activity:${a.id}`}>
                            {`${trip.stops.find((s) => s.id === a.stopId)?.name ?? "Trip"}, day ${a.day} · ${a.title}`}
                          </option>
                        ))}
                    </optgroup>
                  )}
                </select>
              </label>
            )}
            <label>
              Amount · {draft.currency || trip.currency}
              <input type="text" inputMode="decimal" value={draft.amount} placeholder="Leave blank if unknown" aria-describedby={`${formId}-amount`} onChange={(e) => set({ amount: e.target.value })} />
            </label>
            <label>
              For each
              <select value={draft.unit} onChange={(e) => set({ unit: e.target.value as CostRecord["unit"] })}>
                <option value="per_person">Person</option>
                <option value="per_group">Whole group</option>
              </select>
            </label>
            <label>
              How many times
              <input type="number" min="1" max="10000" step="1" value={draft.quantity} onChange={(e) => set({ quantity: e.target.value })} />
            </label>
          </div>
          <p id={`${formId}-amount`} className="creation-note">
            {draft.unit === "per_person"
              ? `Amount per person, counted for ${trip.travelers} ${trip.travelers === 1 ? "traveler" : "travelers"} each time.`
              : "Amount for the whole group each time."}{" "}
            Zero means free; blank means unknown.
          </p>
          <div className="trip-fields">
            <label>
              Tax
              <select value={draft.tax_status ?? "unknown"} onChange={(e) => set({ tax_status: e.target.value as CostRecord["tax_status"], tax_percent: e.target.value === "excluded" ? draft.tax_percent : null })}>
                <option value="unknown">Not sure</option>
                <option value="included">Included in the amount</option>
                <option value="excluded">Not included</option>
              </select>
            </label>
            {draft.tax_status === "excluded" && (
              <label>
                Tax percentage
                <input type="text" inputMode="decimal" value={draft.tax_percent ?? ""} placeholder="Leave blank if unknown" onChange={(e) => set({ tax_percent: e.target.value })} />
              </label>
            )}
          </div>
          {taxUnknown({ ...draft, quantity: 1 }) && draft.amount !== "" && (
            <p className="creation-note">Until the tax is known, this cost may be missing some of its total. It is not treated as tax-free.</p>
          )}
          <details className="cost-record-currency" open={!!draft.currency}>
            <summary>{draft.currency ? `In ${draft.currency}` : `Paid or priced in another currency?`}</summary>
            <div className="trip-fields">
              <label>
                Currency code
                <input value={draft.currency ?? ""} maxLength={3} placeholder={trip.currency} autoCapitalize="characters" onChange={(e) => set({ currency: e.target.value.toUpperCase() })} />
              </label>
              <label>
                {`1 ${draft.currency || "unit"} = ? ${trip.currency}`}
                <input type="text" inputMode="decimal" value={draft.conversion_rate ?? ""} placeholder="Leave blank if unknown" onChange={(e) => set({ conversion_rate: e.target.value })} />
              </label>
              <label>
                Rate source
                <input value={draft.rate_note ?? ""} maxLength={200} placeholder="e.g. My bank statement" onChange={(e) => set({ rate_note: e.target.value })} />
              </label>
              <label>
                Rate date
                <input type="date" value={draft.rate_date ?? ""} onChange={(e) => set({ rate_date: e.target.value })} />
              </label>
            </div>
            <p className="creation-note">We only use a rate you enter. Without one, this cost keeps its own amount but stays out of {trip.currency} totals.</p>
          </details>
          <div className="cost-record-status" role="radiogroup" aria-label="Status">
            <label>
              <input type="radio" name={`${formId}-status`} checked={draft.status === "estimated"} onChange={() => set({ status: "estimated" })} />
              My estimate
            </label>
            <label>
              <input type="radio" name={`${formId}-status`} checked={draft.status === "paid"} onChange={() => set({ status: "paid" })} />
              Already paid
            </label>
          </div>
          {(trip.stops.length > 0 || trip.activities.length > 0) && (
            <p id={`${formId}-link`} className="creation-note">
              If a linked activity, stay or journey leaves the plan, an estimate goes with it. A paid cost stays recorded.
            </p>
          )}
          {draft.link_removed && <p className="creation-note">This payment’s linked item was removed. Choose a new link, or keep it as a recorded payment.</p>}
          <p className="creation-note">If you paid for something you estimated earlier, mark that record as paid rather than adding a second one.</p>
          {error && (
            <p className="creation-alert" role="alert">
              {error}
            </p>
          )}
          <div className="cost-record-actions">
            <button type="button" onClick={save}>
              {editing ? "Save changes" : "Add cost"}
            </button>
            <button type="button" onClick={() => close(editing ? draft.id : "add")}>
              Cancel
            </button>
          </div>
        </fieldset>
      ) : (
        <button
          type="button"
          ref={addButton}
          className="cost-record-add"
          disabled={records.length >= 200}
          onClick={() => {
            setConfirming(null);
            setDraft(blankCostRecord(crypto.randomUUID()));
          }}
        >
          Add a meal or other cost
        </button>
      )}
      {onConfirm && (
        <label className="cost-records-confirm">
          <input type="checkbox" checked={trip.costsConfirmed === true} onChange={(e) => onConfirm(e.target.checked)} />
          <span>
            I’ve entered every cost I expect for this trip.
            <small> Needed before a strict budget can be checked. You can change this any time.</small>
          </span>
        </label>
      )}
    </div>
  );
}
