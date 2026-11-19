# Reconcile the parallel implementation and connect missed-activity recovery

16 November 2026. Current checkout: `codex/planning-recovery-discovery`. This assessment combines source inspection, existing learning notes and new verification. Most additions remain uncommitted; Git cannot independently attribute individual lines to Claude or Codex. Earlier learning entries describe earlier states and must not be read as the current feature inventory.

## Work now present

- Version-owned editable cost records, linked activity/stay/journey costs and retention rules for paid commitments.
- Manual currency conversion with rate/source/date, taxes/fees and confirmed-entry completeness. Strict checks can pass with the explicit traveler acknowledgment when detectable coverage is complete; this is not supplier-price verification.
- Rest-first and explicit traveler-chosen skips in the guarded remaining-day proposal flow.
- Stay-night rebalancing with preview/apply, explicit displaced-activity drop/move, target day/time and cross-stay moves. Moving to another stay clears old map identity.
- Lost-journey disclosure and explicit carry-over of timing, mode, allowances and linked costs after route edits.
- Persistent `skipped` activity outcome, migration 0024, mutual exclusion with completion, historical cards, freed timeline capacity and backend replanning protection.
- Embedded-worker/deployment configuration and independent integration fixes documented in the November 16 audit notes. Current local readiness reports schema 0024. Production deployment of this working tree was not verified here.

The independent T3 follow-up already fixed protected calendar-date shifts during stay rebalancing, client rejection of saved skipped outcomes in previews, timeline capacity around skipped cards and hours/overnight-only journey carry-over. These were not reimplemented.

## Next slice completed in this turn

The recovery UI still treated “I didn’t do it” as reschedule/remove guidance. It now opens the existing **Didn’t happen** outcome control, with the disclosure open and checkbox focused but unchecked. Explicit Save is still required. Guidance explains that the record/costs stay, the slot becomes free, and no booking cancellation or refund occurs. Rescheduling remains available in the same editor without selecting the outcome.

The unresolved-record handoff now rejects a current skipped activity or a mismatched skipped flag in either context/report. Missing legacy flags normalize to false. No backend policy, persistence schema or account mutation path was added.

## Additional issues found

A failed initial account load was rewritten to a guest URL, dropping the requested trip ID. The workspace now preserves that ID while account loading has failed; explicit new-trip/auth-boundary paths clear the request. The failure path was observed in the browser and the corrected URL retained its trip/destination/day parameters.

The local API's authenticated request returned 503 despite healthy database readiness. Public Supabase signing-key retrieval failed with `SSL: UNEXPECTED_EOF_WHILE_READING` through Python/JWK, HTTPX and curl. Restarting local frontend/API did not resolve it. TLS/authentication were not bypassed. The adapter now explains `AUTH_PROVIDER_UNAVAILABLE` as temporarily unavailable sign-in verification, preserving confidence that the saved trip still exists.

## New verification

- **477 backend tests pass** on a separately created disposable local database, migrated through 0024; Ruff and Alembic drift check pass. Initial invocation assumed an older database name that no longer exists; it was an environment failure, not the final test result. The existing `tripadapt_review` database/server was left alone. Only this turn's disposable database was removed afterward.
- **167 frontend tests**, TypeScript, production build and whitespace checks pass. New regressions cover current/report/context skipped outcomes and safe auth-provider outage messaging.
- Signed-in end-to-end verification of the new handoff is **blocked by the signing-key TLS connection**, despite current local readiness being healthy. Earlier signed-in checks in the audit notes are historical evidence, not certification of this new change.
- Used a temporary, explicitly labeled local component QA route with sample data and no account writes. Real ActivityEditor with `recoveryChoice="missed"`: disclosure open, skipped focus true, skipped unchecked; Cancel preserved all values. Explicit selection + Save produced skipped true, completed false, fixed true and booked true. Phone client/scroll widths both 341px; viewport reset. The temporary route was removed before final checks.
- No account trip was edited: the existing QA trip was read only to capture a baseline. No proposal, accepted revision, booking, refund or cost record was created by this verification.
- Screenshot: `.local/qa/missed-outcome-phone-20261116.png` (isolated component QA, ignored local artifact).

## Remaining work

- Restore the normal local network path to Supabase JWKS, then rerun signed-in readiness → missed outcome → autosave → fresh readiness against real persistence, including linked-cost retention.
- Prompt for a replacement mapped place after cross-stay moves; broader route changes still need explicit downstream reconciliation.
- Add a trip-level done/skipped/planned recap for finished trips; ongoing work remains timing guidance rather than a stale persistent flag.
- Review/commit the combined local changes in meaningful sections when requested, and verify any intended deployment independently.

Learning notes/journal only updated. Finalized PRD/architecture/API/database documents and locked landing unchanged. No migration, key, push or deployment.
