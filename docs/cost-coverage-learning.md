# Structured coverage for saved cost allowances

15 November 2026.

## Work and scope

Implemented the documented owned `GET /trips/{trip_id}/versions/{version_id}/budget` path as a read-only coverage projection over existing stay and intercity travel allowances. It is not the complete `cost_item` ledger described in the finalized database design. No paid records or supplier quotes are invented from preferences or booked flags.

Each row identifies its stable stop/leg key, category, quantity, unit rate, estimated amount and estimated/unknown status. Accommodation multiplies room-nights or bed-nights; each transport leg multiplies travelers once or one vehicle once. Repeated destination names retain distinct logical stop IDs. Orphan preferences do not add spending, zero-night stays are omitted, and unallocated nights remain unknown rather than free.

Amounts use integer-cent arithmetic and Decimal serialization, avoiding floating-point summation. The frontend formats decimal strings without first converting large amounts to floating point. All allowances remain in the saved display currency; there is no conversion claim.

The response always reports incomplete coverage: a known allowance subtotal, unknown complete total and unrecorded paid total. Activities, meals, local transport, taxes/fees and miscellaneous spending remain explicitly unpriced. Exceeding a budget is reported when the known subtotal already exceeds it; a lower subtotal never proves feasibility. Strict acceptance remains blocked by existing validation.

## Integration and safeguards

Coverage appears in the whole-trip creation review and frozen proposal review, using a separate typed account adapter. Dirty/unsynced creation state does not present an older server subtotal as current; saved coverage becomes available after saving. Loading, retryable error and unknown states are explicit.

The endpoint checks owner and trip/version association, supports optional If-Match and returns a snapshot token. A short shared version-row lock keeps draft settings and dependent rows consistent while projecting. No plan/cost mutation or price-provider call occurs. Frozen proposal coverage is read from its own version, not the editable draft.

The UI follows the existing Elsewhere typography/surfaces and uses a native disclosure. Phone rows wrap, and totals keep known subtotal, unknown total and unrecorded payments separate. React review retains request cancellation, ignores late responses after source changes and depends on scalar source fields rather than recreated prop objects.

## Verification

- **427 backend tests** pass on Python 3.12 and CI Python 3.14 (13 existing LangSmith warnings). Seven new tests cover unit multiplication, repeated cities, missing/zero amounts, unknown quantities/categories/paid totals, exact large prices, one-way/orphan handling, owner/cross-trip/ETag boundaries, no mutation and frozen-review isolation after draft edits. Changed-backend Ruff passes.
- **135 frontend tests**, TypeScript and production build pass. Four new tests cover conditional read/cancellation, zero-versus-unknown distinction, malformed/wrong/duplicate replies, outages, exact large-money display and draft source parsing. Whitespace checks pass.
- Real authenticated browser/API: initial QA snapshot showed zero entered and five unknown allowances. Entered a temporary INR 2.50 nightly room rate; saved coverage returned **6 room-nights × INR 2.50 = INR 15**, one entered/four unknown, complete total Unknown and paid amount Not recorded. The frozen proposal panel displayed the same scoped coverage.
- Desktop **1280×900** and phone **390×844** checked; phone coverage client/scroll widths both **307px**. Viewport override reset afterward. Loading and empty/unknown states were seen live; malformed/outage states were tested automatically rather than inducing a hosted outage.
- Discarded the QA review and cleared the temporary rate. Compared the entire saved draft `PlanInput` against its baseline: exact match. Accepted version **55**, planning lifecycle and 11 activities stayed unchanged. Final panel again showed zero entered/five unknown allowances and no dialog. No accepted revision, paid record, reservation or chat turn was created.
- Screenshots: `.local/qa/cost-coverage-desktop.png`, `.local/qa/cost-coverage-phone.png` (ignored local artifacts).

## Remaining scope and next slice

Editable financial entries, linked activity/stay/leg costs, paid commitments, taxes, meal/miscellaneous allowances and conversion provenance still need the normalized version-owned ledger. Paid amounts must survive plan removals; refunds require explicit records. This projection must not be presented as complete expense accounting or verified strict-budget feasibility.

Next: introduce explicit user-entered cost records with clear scope/unit/status and revision copying, beginning with unlinked meal/miscellaneous estimates and paid records. Preserve separation from supplier availability and keep strict acceptance blocked until the relevant coverage is genuinely complete.

Generated OpenAPI and learning notes/journal updated. Finalized PRD/architecture/API/database design documents and locked landing preserved. No migration or key needed for this read-only slice. No push or deployment.
