# Active-trip chat policy learning

15 November 2026. This slice makes the remaining-day conversational handoff usable while a trip is active, with explicit job and proposal boundaries.

## What changed and why

Active trips can start chat jobs for explanations, clarification and the remaining-day confirmation handoff. Requests to generate additions, move, resize, remove, replace or research candidate edits return guidance instead of a candidate. The existing planner still supports explicitly requested, guarded remaining-day timing proposals while active. Nothing changes merely because chat opens a confirmation screen.

New day-generation jobs require planning lifecycle. Completed and archived trips reject new chat/generation jobs; history and matching idempotent requests can still return existing records. No automatic lifecycle transition was added.

Admission pins lifecycle and trip lock revision alongside the existing plan snapshots. Workers check freshness before provider work and again at publication; active replies must have a read-only kind and no candidate/weather mutation payload. Candidate validation and agent-proposal acceptance independently enforce planning lifecycle. Previously pending agent reviews are stale after activation or a trip revision change. These checks also fence a planning → active → planning round trip.

**Correction to earlier learning notes:** the conversation service did not already enforce a general planning-only lifecycle policy. Earlier remaining-day chat and status-recovery notes overstated that restriction. This implementation adds the explicit policy; the separate manual remaining-day guards already existed.

## Trade-offs

The trip revision check is conservative: metadata edits can supersede work even if activity timing is unchanged. Old snapshots without lifecycle fields default to planning; current-state restrictions still apply, but they cannot reconstruct an absent historical revision. Read-only active chat deliberately does not provide arbitrary conversational itinerary editing. Travelers use fresh time/place confirmation and the existing review flow for remaining-day changes.

No database migration, new key or reservation operation is involved. The interface explains server refusals, but lifecycle-aware navigation and a dedicated active-trip mode remain a later UX slice.

## Verification

- 416 backend tests pass on Python 3.12 and CI Python 3.14; CI reports 13 existing LangSmith deprecation warnings. The 22 new cases cover active handoffs/refusals, closed-trip admission, lifecycle races, unsafe publication, stale agent acceptance and explicitly guarded user proposals while active.
- 105 frontend tests, TypeScript and production build pass. Changed backend Ruff and whitespace checks pass.
- Real authenticated browser/API/worker/model check: a natural request to replan the remaining day produced the confirmation handoff while active. Its confirmation opened with date/time blank. “Suggest a rest break” returned guidance without a proposal. Direct Generate day proposal returned the planning-only explanation.
- Desktop and 390×844 phone layouts checked. Local evidence: `.local/qa/active-chat-readonly-phone.png` and `.local/qa/active-generation-guard-desktop.png`.
- The known QA trip was temporarily activated, then restored to planning using lifecycle/revision/snapshot assertions. Accepted version 46 and both sets of 11 activities stayed unchanged. Both new chat jobs succeeded with no proposal ID; blocked generation admitted no new job. The two QA conversation turns remain as history.

Only learning notes/journal were updated; finalized design documents and the locked landing were preserved. No push or deployment.

## Next sequence

Expose trip lifecycle deliberately in the workspace: make planning versus active capabilities visible before users hit a server refusal, while keeping the fresh remaining-day check and explicit review boundary.
