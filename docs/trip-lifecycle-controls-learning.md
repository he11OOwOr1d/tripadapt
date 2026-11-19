# Explicit trip start, finish and resume

15 November 2026.

## Work and decisions

Added Start trip, Finish trip and Resume trip to the existing workspace status strip. Each opens a shared native dialog that explains the consequence and provides a keep-current-status action. No dates trigger a transition automatically. Finishing does not mark activities completed, accept a draft, make reservations or cancel them.

Starting or resuming requires an accepted plan. The backend now enforces that prerequisite on an actual transition into active state, returning `TRIP_ACCEPTED_PLAN_REQUIRED` without modifying metadata. The UI explains how to review first. An accepted plan can still be provisional under existing acknowledgment rules; starting does not upgrade hours, prices, routes or availability to verified facts.

The account adapter exposes explicit conditional metadata updates and a metadata-only refresh. Lifecycle stays separate from the editable itinerary. Controls wait for unsaved work, saving errors and open editor/review surfaces to resolve. Successful updates merge metadata without replacing local trip contents or selected destination/day.

A stale ETag returns a conflict. The confirmation then requires a status refresh before another attempt. Refresh reads metadata rather than replacing the draft; it also resolves uncertain outcomes after a lost network response. Server lifecycle/revision fences continue to invalidate older agent work and reviews. There is no automatic retry or inferred success.

## Design and accessibility

Reuse Elsewhere’s green typography, paper surfaces, existing modal and visible focus styles. Native modal focus containment and Escape are retained; closing is blocked while an update is in flight. Cancel returns focus to the status trigger. Phone controls have at least 44px height, and footer actions wrap without horizontal overflow.

The React review keeps effects limited to modal lifecycle, derives capabilities during rendering and introduces no new polling or provider calls.

## Verification

- **419 backend tests** pass on local Python 3.12 and CI Python 3.14 (13 existing LangSmith warnings). Three new tests cover missing accepted plan, start/finish/resume without snapshot or completion mutations, stale conditional updates and other-owner denial. Changed-backend Ruff passes.
- **109 frontend tests**, TypeScript and production build pass. Adapter coverage checks lifecycle-only PATCH bodies, trip ETags, accepted snapshot metadata, stale status and accepted-plan error feedback. Diff whitespace passes.
- Real authenticated browser/API: known QA trip start → finish → resume → finish succeeded. Active hid AI day generation; completed exposed Resume trip. A second tab using an older ETag received a conflict and recovered to the latest status through metadata refresh. Cancel preserved completed state.
- Escape returned focus to Start trip. An open activity editor disabled the status action; cancelling the editor made it available again. No activity was saved. Desktop and 390×844 phone confirmation screens inspected; phone dialog client/scroll widths both 362px. Viewport reset afterward.
- QA restored to its original planning state using expected lifecycle/revision and snapshot assertions. Accepted version 46 and accepted/draft sets of 11 activities remained unchanged. Original updated timestamp restored, lock revision advanced. No new proposal, chat turn or accepted version created.
- Local screenshots: `.local/qa/trip-start-confirmation-desktop.png`, `.local/qa/trip-finish-confirmation-desktop.png`, `.local/qa/trip-resume-confirmation-phone.png` (ignored artifacts).

## Trade-offs and next sequence

This is a small deliberate lifecycle UI, not a full lifecycle state machine. The existing API still accepts its documented lifecycle values subject to ownership, ETag and the new accepted-plan prerequisite. The UI provides start/finish/resume, not archive management or return-to-planning controls. Completed status does not make every manual editing surface immutable. Cross-tab status updates appear on load/save or explicit conflict refresh, not through a live subscription.

Next: review active-day progress and recovery from a missed or ongoing activity, so travelers can report what happened without incorrectly marking an item completed. Keep every revision explicit and preserve fixed/booked commitments.

No new environment variables or migration. Learning notes/journal updated; finalized PRD, architecture, API/database design documents and locked landing preserved. No push or deployment.
