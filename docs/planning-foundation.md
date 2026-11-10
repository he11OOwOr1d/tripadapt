# Planning foundation — step 1

10 November 2026. This implements the review/acceptance boundary that future generated plans will use. It does not invoke an AI model or simulate a generated day.

## Delivered slice

A signed-in traveler opens **Review plan** from the saved itinerary workspace. The action is disabled while local changes await account sync. The backend freezes a separate copy of the saved manual draft, validates it and returns a structured proposal. The dialog displays destination stays, scheduled items, commitment/completion flags and validation issues. A conflicted schedule can be reviewed but cannot be accepted. Unverified external information requires explicit acknowledgment before accepting a provisional manual plan. Discarding leaves both the editable draft and previously accepted snapshot unchanged.

Acceptance sets the trip's current-version pointer to the frozen candidate. The existing draft stays editable and references its accepted parent. Later edits do not mutate the accepted snapshot. A new trip still has no accepted version until the traveler accepts one.

## Contracts and persistence

Migration `0013_plan_proposals` adds `plan_proposal` with a frozen candidate version reference, base draft ID/edit sequence, base accepted version, status, submit key and acceptance replay receipt. Application data remains in the existing Supabase PostgreSQL database; browser API roles have no table access. The configured database has been migrated.

Implemented endpoints:

- `POST /trips/{id}/draft/submit`: requires draft `If-Match` and UUID `Idempotency-Key`; snapshots the draft without changing it.
- `GET /trips/{id}/proposals/{proposalId}`: owner-scoped frozen review.
- `POST /trips/{id}/proposals/{proposalId}/accept`: requires UUID `Idempotency-Key`, nullable `expected_current_version_id`, and acknowledged advisory issue IDs.
- `POST /trips/{id}/proposals/{proposalId}/discard`: repeat-safe discard of a pending review.

All operations check ownership. Submission and acceptance serialize on the trip row. Acceptance rechecks the exact base draft/edit sequence and current accepted version, then reruns deterministic checks inside the transaction. Stale proposals return `STALE_PROPOSAL`; blocking conflicts return `PLAN_CONFLICT`. Matching acceptance retries replay the prior result. A competing accepted proposal makes an older pending one stale. Slow provider/model requests do not run inside this transaction.

The typed response includes `plan`, `validation`, base references and candidate ID. Client networking remains in `lib/trips/proposals.ts` and the account transport; the dialog contains UI state only.

## Validation boundary

Current deterministic checks cover missing destinations/stay allocations, missing activity destinations, duplicate activity IDs, activity day bounds, midnight crossings, local-time precision/offsets, same-destination/day overlaps, allocated stay/overnight nights versus total duration, and date-window duration conflicts. Long and undated trips remain supported.

No provider evidence is available yet. Every review is explicitly provisional. Opening hours, actual travel buffers/schedules and availability are not validated. Strict-budget acceptance is blocked until a complete cost validator is implemented; it cannot be bypassed through an acknowledgment. This is a manual-review foundation, not the complete feasibility engine required for generated plans.

## Verification

The flow was exercised in the existing QA trip, not the traveler's original trip: review → acknowledge → accept → return to the unchanged editable day → review again → discard. The accepted snapshot was retained. Desktop and 390px phone review layouts were checked, with no document horizontal overflow. Native dialogs isolate focus and restore it to Review plan on close. Screenshots are in `docs/references/planning-foundation/`.

Backend tests cover frozen-copy acceptance, later draft edits retaining accepted content, replay safety, required acknowledgment, stale drafts, competing proposals, conflicts, discard, ownership/preconditions, and validation boundaries. Transactional fixtures roll back test data. Frontend regression tests and production build/type checks cover the adapter transport refactor and UI compilation.

## Next step

Build durable planning jobs and candidate input schemas, then a fixture-backed one-day generation workflow. Add protected-item comparison, cross-destination/timezone feasibility, cost calculations and provider evidence before allowing agent-produced plans through acceptance. The existing review UI will need old/new differences, evidence detail and generated reasons. Pending proposal listing/resumption, accepted-history browsing, restoration and asynchronous provider revalidation remain unimplemented. No model key is required for this step. No deployment was performed.
