# Traveler-entered meal and other cost records

15 November 2026. Implementation note, not a change to the finalized requirements or database design.

## Work and scope

Travelers can now add, edit and remove their own **meal** and **other** cost records in the stay-and-travel step. Each record has a description, a unit amount, a basis (per person or whole group), how many times it applies and a status: **my estimate** or **already paid**. Records are not linked to activities, stays or legs. They are not supplier quotes, bookings or charges.

Amount semantics follow the database design note for `cost_item`: the amount is a unit price, and the total is amount × quantity, multiplied by the traveler count for per-person records. A blank amount is unknown and stays out of every subtotal; `0` is an explicitly free item. A paid record must have an amount.

## Storage decision and trade-off

**Superseded by entry 67:** records now live in the `cost_item` table; see [linked costs](linked-costs-learning.md). Originally, records were stored as a typed, validated `preferences.cost_records` list on the plan version, next to the existing stay and intercity travel allowances. That means they:

- are frozen into a submitted proposal's candidate version, so later draft edits do not change a review;
- copy into every later draft and accepted revision through the existing `PlanInput` path, with no new copy code;
- count as plan changes in `same_plan`, because preferences are part of plan identity;
- never reach the language model. Agent inputs still include only activities.

This is **not** the normalized `cost_item` table described in the finalized database design. A table would need a migration and changes to every version-copy path. That is the right move once records link to activities, stays or legs, or need conversion provenance. For unlinked records, the JSON list has the same version-ownership and freezing behavior at much lower risk. The backend schema rejects unknown fields, duplicate IDs, negative amounts or amounts with more than two decimal places, quantities outside 1–10,000, blank labels and categories other than food/miscellaneous. The limit is 200 records.

## Coverage changes

`GET …/versions/{id}/budget` now also returns:

- `records`, with the per-record basis, the traveler multiplier and an estimated/paid/unknown status;
- `estimated_records`, `paid_records` and `unknown_records` counts;
- `recorded_paid_subtotal`, kept separate from estimates;
- `known_subtotal`, which is estimates plus recorded payments. "Exceeds budget" now compares this value.

`estimated_subtotal` now includes estimated records as well as allowances. `total` and `paid_total` stay `null` and `coverage_complete` stays `false`. A category with one record is not a complete category. `unpriced_categories` lists only categories with no entries at all, and the UI calls them "No entries yet". Strict-budget acceptance remains blocked by the existing validation. A test confirms this still holds when records are present.

## UI safeguards

- The add/edit form keeps its own state and commits only a record that passes validation. A half-typed record never reaches autosave, and an invalid record is never silently dropped.
- Removing a paid record first shows that removal does not refund or cancel the payment.
- The form suggests marking an existing estimate as paid instead of adding a second record, to avoid double counting.
- Focus moves into the form when it opens. After saving or cancelling it returns to the edited row's Edit button or to the Add button. Edit and Remove buttons have accessible names that include the record's description, and status uses a labelled radio group.
- Per-record totals in the editor use exact BigInt cent arithmetic. The coverage panel shows the server's Decimal values.

## Verification

- **Backend:** 4 new coverage tests: unit multiplication, separate paid totals, unknown versus zero, exceeding the budget, categories, invalid-record rejection, strict blocking, and freezing into a review plus copying through later draft edits. Ruff check passes.
- **Frontend:** 141 tests, TypeScript and production build pass. There are 6 new tests: form validation and exact totals, adapter round-trip through create, reload and an unrelated save, invalid-record refusal before transmission, and coverage reply validation for record units and counts. One existing round-trip test now expects reload to normalize missing records to an empty list.
- **Browser (on-device mode, real dev server, restarted API):**
  - Created a temporary Delhi → Jaipur draft with 3 travelers.
  - A blank description and a paid record without an amount were both refused with specific messages.
  - Per person, 4 × INR 12.50 showed INR 150. A paid whole-group INR 40 record showed separately as paid.
  - Removing the paid record first showed the no-refund warning. "Keep it" returned focus to that record's Edit button, and cancelling an edit did the same.
  - The draft saved to device storage contained exactly the remaining validated record.
- **Layout:**
  - Checked at desktop 1280×800 and phone 390×844 widths. On phone the page and the costs section fit (375/305px), with no horizontal scroll.
  - Fixed one defect found on phone: a broader `label` rule stacked each status radio above its text. A more specific selector restores the row layout.
  - Temporary device storage was removed afterwards.
- **Not covered by the browser check:** the preview browser was not signed in, so the account autosave and the saved coverage/review panel were not exercised in a browser. That path is covered by the API integration test (record → draft → frozen review → later draft change) and the adapter round-trip test.

## Remaining scope

Linked activity/stay/leg costs, taxes and fees, currency conversion provenance, and paid commitments that survive removal of a linked item still need the normalized ledger. Strict-budget feasibility stays blocked until coverage can genuinely be complete.
