# Linked costs in a version-owned ledger

15 November 2026. Implementation note, not a change to the finalized requirements or database design.

## Work and scope

Cost records moved from the version's `preferences` JSON into a new `cost_item` table (migration `0020_cost_items`). A cost can now link to one **activity** or one **stay** (destination stop). Categories are meals, activity, stay, transport and other. The plan carries costs as a top-level `costs` list, and the draft replaces them only through the explicit `cost.replace_records` command. A settings save cannot carry costs; that path returns 422, so an unrelated autosave never rewrites them.

## The removal rule

When a linked activity or stay leaves the plan:

- an **estimate** for it is removed with it, because the plan no longer includes what it estimated;
- a **paid** cost stays, unlinked and flagged `link_removed`. It remains in the recorded-paid subtotal. Removing an item never implies a refund or cancellation.

The rule is a pure, idempotent function (`reconcile_costs`) applied in two places:

1. **plan validation**, so every candidate built from a plan sees the same costs;
2. **`sync_costs`**, called by `sync_route` on every write path: trip create, draft commands, proposal candidates (manual, agent, weather, delay, remaining-day, restore) and the accept path that copies a candidate back to the draft. When a write path supplies no costs, the version's existing costs are reused and reconciled against the new schedule. A route or activity edit therefore cannot silently drop a payment.

Frozen reviews and accepted snapshots keep their own rows. A later draft edit changes neither.

## Storage decisions and trade-offs

- **Links use logical IDs, not foreign keys to physical rows.** Activity and stop rows are deleted and reinserted on every schedule sync, so a physical foreign key would cascade or break on routine edits. Same-version integrity is enforced in application code by the rule above. This deviates from the composite foreign keys in the finalized database design and is recorded here rather than by editing that document.
- **Amounts** are stored as `numeric(18,4)` and exchanged as canonical two-decimal strings (`"40"` becomes `"40.00"`), so plan equality checks compare equal after a database read. A blank amount is stored as NULL (unknown). Zero means free.
- **Not yet built:** currency per item, conversion provenance, taxes and fees, quotes, and linking to a specific transport leg. Legs are preference keys, not rows.
- **Migration on Supabase:** applied with `scripts.migrate_supabase` on your instruction. The new table has no `anon`/`authenticated`/`PUBLIC` grants. No JSON records existed to move. The migration's data move remains in place for any other environment.

## UI

- The editor gains a "Linked to" picker. It groups stays and activities, and adds a stop number when two stays share a name. It also shows each record's link or a removed-link note.
- Opening a record whose link target has gone applies the same rule as the server. A payment shows as a kept, removed-link record, and the form never shows "nothing" while still holding a stale link. Choosing a new link clears the flag.
- The coverage panel says what each cost is for, or that its linked item was removed.

## Verification

- **Backend:** the migration applied to Supabase head. 13 cost tests pass against it, including new or rewritten tests for:
  - the removal rule (estimate dropped, payment kept and flagged, idempotent);
  - linked labels;
  - invalid links and flags;
  - freezing into a review, copying on accept, and survival when the draft removes an activity while the frozen and accepted snapshots stay unchanged;
  - duplicate rejection and settings saves that try to carry costs.
- **Frontend:** 142 tests, TypeScript and production build pass. They cover the adapter round trip of linked, paid and removed-link records, the explicit cost command, the link helpers and coverage validation.
- **Browser (on-device mode):** the picker listed both stays. A paid INR 300 deposit was linked to Udaipur. Removing Udaipur (after its confirmation) kept the payment and labelled it no longer in the plan. Editing it showed the removed-link note, and saving kept it flagged. Temporary device storage was removed.
- **Not covered:** the signed-in account flow in a browser. It is covered by the API integration tests.

## Journey links (entry 68)

A cost can also link to one intercity **journey**. Journeys are not rows, so the link is the same stable key that already indexes travel budgets: the compact JSON pair of endpoint IDs, such as `["origin:Delhi","<stop id>"]`.

- **One key builder.** The web client and the server both produce the keys, and the server now uses a single function (`route_legs`) for both the coverage panel and the removal rule. The existing coverage tests confirm the keys did not change.
- **Removal rule.** A journey disappears when the route changes: a reordered or removed stop, a new starting point, or "return to origin" switched off. The same rule then applies: its estimate goes, and a paid ticket stays as an unlinked commitment.
- **Draft command ordering.** Settings are now applied first, and the schedule and costs are always resynced afterwards. A settings-only save that changes the starting point is therefore reconciled on the server, not just in memory.
- **Migration `0021_cost_item_legs`.** Adds `leg_key` and widens the single-link and removed-link checks with `num_nonnulls`. The downgrade keeps any paid journey cost as a removed-link record and does not delete it. Applied to Supabase; browser roles still have no grants.
- **Editor.** The picker gains a "Journeys" group, and the stale-link check covers journeys. Link values split on the first colon only, because journey keys contain colons.
- **Trade-off.** A journey's key includes the starting-point label, so renaming the starting point counts as a new journey. This matches how travel budgets already behave: orphaned keys are ignored.
- **Tests:**
  - Backend: pure journey tests (labels, one-way trip, origin change, exclusivity), plus an API test where a settings-only origin change unlinks the paid ticket and drops the estimate.
  - Frontend: 143 tests, covering colon-safe journey links and adapter round-trip and validation.

## Per-cost currency with conversion provenance (entry 69)

- **Fields.** A cost may record the currency it was paid or priced in, plus a rate the traveler enters (display-currency units per one unit), an optional source note and an optional date. Migration `0022_cost_item_currency` adds the nullable columns and two checks: the rate must be positive, and a rate or its provenance requires a currency. Applied to Supabase; browser roles still have no grants.
- **No guessed rates.** No exchange-rate provider is called. A foreign amount without a rate keeps its original value but is **unknown** in display totals, never zero. This holds even when the cost is recorded as paid. Coverage reports `entered_status` separately from the display `amount_status`, and counts `unconverted_records`.
- **Exact arithmetic.** The original total is computed in integer cents, multiplied by the decimal rate, then rounded half-up to display cents. The server uses `Decimal`; the client mirrors it with BigInt (for example EUR 12.50 × 90.125 = INR 1,126.56). The rate is stored as `numeric(20,10)` and normalized on read so snapshots compare equal.
- **UI.** A "Paid or priced in another currency?" disclosure holds the currency code, rate, source and date fields. Rows and the coverage panel show "EUR 22 → INR 1,982.75" with the rate and its source, or "INR unknown" with the reason.
- **Tests:**
  - Backend: 17 cost tests on Supabase, covering conversion and rounding, an unconverted paid amount, invalid rates and currencies, and a storage/review round trip.
  - Frontend: 145 tests (conversion helper, form validation, coverage reply validation). TypeScript and the production build pass.
  - Browser: on-device check of both cases, with no horizontal overflow.

## Taxes and fees (entry 70)

- **Tax status per cost.** Each cost records its `tax_status`, following the design's `included_tax_status`: **included**, **not included** or **unknown**. Unknown is the default.
  - Tax not included, with a percentage (0–100): the tax is computed on the whole original total, rounded half-up to cents, and kept as its own `tax_amount`. It is added before any currency conversion, so it is in the cost's original currency.
  - Tax not included without a percentage, or tax unknown: the entry is flagged `tax_known: false` and counted in `tax_unknown_records`. The UI says the subtotal may be low. Tax is never treated as zero.
- **New category "Taxes & fees"** for standalone items such as a city tax or a booking fee. One such entry removes "Taxes and fees" from the no-entries list, but coverage still says an entry does not make a category complete.
- **Migration `0023_cost_item_taxes`.** Adds `tax_status` (default `unknown`) and `tax_percent numeric(6,3)`, with checks that the status is valid and that a percentage exists only when tax is not included. It widens the category check. The downgrade maps tax entries to "other" instead of deleting them. Applied to Supabase; browser roles still have no grants.
- **Client math.** Mirrors the server with BigInt, for example 2 × 100 + 12% = 224.00 and EUR 10 + 5.5% at 90 = INR 949.50.
- **Tests:**
  - Backend: 19 cost tests on Supabase.
  - Frontend: 146 tests. TypeScript and the production build pass.

## Next

- Strict-budget checking stays blocked until coverage can genuinely be complete.

A historical restoration can change or remove a more recent payment. The review names affected payments and requires acknowledgment. If the traveler edits a payment after the review opens, the old review cannot authorize restoration. A fresh review shows the consequences against the current draft. Desktop and phone browser checks verified the warning and consent control. The payment edit and stale rejection were verified through the backend API test.

Restoration also checks a payment’s inherited currency. An identical amount can represent a different payment when the historical plan uses a different display currency. Recording an explicit currency keeps the payment’s original denomination independent of the trip display currency.

Restoration also accounts for traveler count when a paid record is priced per person. The same unit price can yield a different recorded total. A whole-group payment has no traveler multiplier.

An explicit currency preserves a payment’s original denomination. If the record also includes a conversion rate, that rate is relative to the trip display currency. Restoration flags a display-currency change in that case so the traveler can review the conversion before accepting.

A disposable PostgreSQL rehearsal confirmed that the Supabase migration helper includes the new cost table when removing browser-role access. The rehearsal used simulated roles with permissive default grants. The hosted project's grants still need to be checked when applying its migrations.

The migration helper now checks effective column privileges as well as table privileges. If a browser role retains access through role membership, the helper rolls back rather than modifying unrelated roles. A local rehearsal verified rollback and a successful retry after the inherited grant was removed.

When a browser grant survives revocation, the migration helper reports the affected role and table. Use that pair to inspect inherited grants in the database before retrying. Other migration errors continue to report only their exception type.
