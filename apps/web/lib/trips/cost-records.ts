import { isCostRecord, type CostRecord } from "./adapter";

/** Editable form state: quantity stays text so a half-typed value is not coerced. */
export type CostRecordDraft = Omit<CostRecord, "quantity"> & { quantity: string };

export function blankCostRecord(id: string): CostRecordDraft {
  return { id, category: "food", label: "", unit: "per_person", quantity: "1", amount: "", status: "estimated", activity_id: null, stop_id: null, leg_key: null };
}

/** Encodes the "linked to" choice as one select value: "", "activity:<id>", "stop:<id>" or "leg:<key>". */
export function linkValue(record: Pick<CostRecord, "activity_id" | "stop_id" | "leg_key">): string {
  return record.activity_id
    ? `activity:${record.activity_id}`
    : record.stop_id
      ? `stop:${record.stop_id}`
      : record.leg_key
        ? `leg:${record.leg_key}`
        : "";
}
export function withLink<T extends CostRecordDraft>(draft: T, value: string): T {
  // Split on the first colon only: journey keys contain colons themselves.
  const at = value.indexOf(":");
  const kind = at < 0 ? "" : value.slice(0, at);
  const id = at < 0 ? "" : value.slice(at + 1);
  // Choosing a link is an explicit decision; it clears any removed-link flag.
  return {
    ...draft,
    activity_id: kind === "activity" ? id : null,
    stop_id: kind === "stop" ? id : null,
    leg_key: kind === "leg" ? id : null,
    link_removed: false,
  };
}

export function draftFromRecord(record: CostRecord): CostRecordDraft {
  return { ...record, quantity: String(record.quantity) };
}

/** Returns the saved record, or a traveler-facing reason it cannot be saved yet. */
export function finishCostRecord(draft: CostRecordDraft): { record: CostRecord } | { error: string } {
  const label = draft.label.trim();
  if (!label) return { error: "Describe what this cost is for." };
  if (label.length > 120) return { error: "Keep the description to 120 characters." };
  const amount = draft.amount.trim();
  if (amount !== "" && !/^\d{1,14}(\.\d{1,2})?$/.test(amount))
    return { error: "Enter the amount as a number with up to two decimal places, or leave it blank if unknown." };
  if (draft.status === "paid" && amount === "") return { error: "Enter the amount you paid." };
  if (!/^\d{1,5}$/.test(draft.quantity.trim()))
    return { error: "Enter how many times this applies, from 1 to 10,000." };
  const quantity = Number(draft.quantity.trim());
  if (quantity < 1 || quantity > 10000) return { error: "Enter how many times this applies, from 1 to 10,000." };
  const record: CostRecord = { ...draft, label, amount, quantity };
  if (!record.activity_id) record.activity_id = null;
  if (!record.stop_id) record.stop_id = null;
  if (!record.leg_key) record.leg_key = null;
  const currency = (record.currency ?? "").trim().toUpperCase();
  const rate = (record.conversion_rate ?? "").trim();
  const note = (record.rate_note ?? "").trim();
  if (currency && !/^[A-Z]{3}$/.test(currency)) return { error: "Use a three-letter currency code, such as EUR." };
  if (rate && !(/^\d{1,10}(\.\d{1,10})?$/.test(rate) && Number(rate) > 0))
    return { error: "Enter the conversion rate as a positive number, or leave it blank if unknown." };
  if (!currency && (rate || note || record.rate_date)) return { error: "Choose the currency this cost was in before adding a rate." };
  if (note.length > 200) return { error: "Keep the rate source note to 200 characters." };
  record.currency = currency || null;
  record.conversion_rate = rate || null;
  record.rate_note = note || null;
  record.rate_date = record.rate_date || null;
  const tax = record.tax_status ?? "unknown";
  const percent = (record.tax_percent ?? "").trim();
  if (percent && tax !== "excluded") return { error: "A tax percentage only applies when tax is not included." };
  if (percent && !(/^\d{1,3}(\.\d{1,3})?$/.test(percent) && Number(percent) <= 100))
    return { error: "Enter tax as a percentage from 0 to 100, or leave it blank if unknown." };
  record.tax_status = tax;
  record.tax_percent = percent || null;
  if (!record.link_removed) delete record.link_removed;
  else if (record.status !== "paid") return { error: "A cost whose linked item was removed can only stay as a paid record. Link it again or remove it." };
  return isCostRecord(record) ? { record } : { error: "This cost could not be saved. Check each field." };
}

export function upsertCostRecord(records: CostRecord[] | undefined, record: CostRecord): CostRecord[] {
  const list = records ?? [];
  return list.some((r) => r.id === record.id) ? list.map((r) => (r.id === record.id ? record : r)) : [...list, record];
}

export function removeCostRecord(records: CostRecord[] | undefined, id: string): CostRecord[] {
  return (records ?? []).filter((r) => r.id !== id);
}

/** Exact total as a decimal string (amount × quantity × travelers for per-person), or null when unknown. */
export function costRecordTotal(record: CostRecord, travelers: number): string | null {
  if (record.amount === "") return null;
  const base = preTaxTotal(record, travelers);
  if (record.tax_status !== "excluded" || !record.tax_percent) return base;
  const [bw, bf = "00"] = base.split(".");
  const cents = BigInt(bw) * BigInt(100) + BigInt(bf);
  const [pw, pf = ""] = record.tax_percent.split(".");
  const scale = BigInt("1" + "0".repeat(pf.length)) * BigInt(100);
  const pct = BigInt(pw) * (scale / BigInt(100)) + BigInt(pf || "0");
  // Half-up to whole cents, matching the server.
  const tax = (cents * pct * BigInt(2) + scale) / (scale * BigInt(2));
  const total = cents + tax;
  return `${total / BigInt(100)}.${(total % BigInt(100)).toString().padStart(2, "0")}`;
}

/** Tax status still unknown: blank, or not included without a percentage. */
export function taxUnknown(record: CostRecord): boolean {
  return (record.tax_status ?? "unknown") === "unknown" || (record.tax_status === "excluded" && !record.tax_percent);
}

function preTaxTotal(record: CostRecord, travelers: number): string {
  const [whole, fraction = ""] = record.amount.split(".");
  const hundred = BigInt(100);
  const cents =
    (BigInt(whole) * hundred + BigInt((fraction + "00").slice(0, 2))) *
    BigInt(record.quantity) *
    BigInt(record.unit === "per_person" ? travelers : 1);
  return `${cents / hundred}.${(cents % hundred).toString().padStart(2, "0")}`;
}

/**
 * Total in the trip's display currency, or null when unknown: blank amount, or a
 * foreign currency without an entered rate. Rounds half-up to whole cents.
 */
export function displayTotal(record: CostRecord, travelers: number, displayCurrency: string): string | null {
  const original = costRecordTotal(record, travelers);
  if (original === null) return null;
  if (!record.currency || record.currency === displayCurrency) return original;
  if (!record.conversion_rate) return null;
  const [rw, rf = ""] = record.conversion_rate.split(".");
  const scale = BigInt("1" + "0".repeat(rf.length));
  const rate = BigInt(rw) * scale + BigInt(rf || "0");
  const [ow, of = "00"] = original.split(".");
  const cents = BigInt(ow) * BigInt(100) + BigInt(of);
  const product = cents * rate;
  const rounded = (product * BigInt(2) + scale) / (scale * BigInt(2));
  return `${rounded / BigInt(100)}.${(rounded % BigInt(100)).toString().padStart(2, "0")}`;
}
