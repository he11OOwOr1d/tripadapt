# Route remaining-day conversation into explicit confirmation

15 November 2026

## Outcome

Requests such as “Could you help me replan what is left of today?” now produce a typed, read-only chat handoff to the existing remaining-day confirmation screen. The model classifies the intent; the server derives destination/day from the selected saved scope. A quick “Replan the rest of today” choice uses the same path without requiring model classification.

Clicking **Confirm today’s starting point** closes chat and opens confirmation for that day. The user still chooses accepted plan versus saved draft, explicitly loads the context, then confirms actual date/time and a mapped starting location. Chat supplies none of those reports and does not mark past activities completed. Preview, save-proposal, hours and route checks, review and acceptance retain their existing boundaries.

## Decisions and lessons

- **Pointer, not instructions to mutate.** The worker persists only a handoff type, selected destination/day and draft ETag in job metadata. No proposal, candidate, clock, location, progress assertion or inferred completion is produced by this intent.
- **Derive scope from trusted request data.** Model-provided activity IDs, categories and dates are not needed. Cross-destination routing asks the user to select that destination/day first. The existing fresh-base/cancellation boundary still applies before publishing.
- **Revalidate old messages.** Message reads mark a pointer stale when its draft token/scope is no longer valid or the trip is closed. The frontend additionally requires the same account, selected day, current token, successful non-proposal job and completed autosave. No old reply can substitute another day or open edits behind a dirty draft.
- **Consume the UI request once.** The workbench hands a scoped signal to the itinerary; the itinerary consumes it when opening confirmation. Closing does not reopen the modal on another render. Escape returns focus to the planner’s manual readiness action, even though the originating chat button has unmounted.
- **Keep the next screen honest.** Loading context shows a clock hint, but date/time inputs remain blank and readiness is disabled until the user fills/confirms the actual report. “Today” does not silently overwrite an exact trip date or select a different route day.

## Verification

**Story:** chat message → owned conversation API → worker/model intent router → durable typed pointer → revalidated message → guarded workbench handoff → existing confirmation screen.

- **394 backend tests** pass on Python 3.12 and CI Python 3.14 (13 existing LangSmith deprecation warnings on CI). Five new cases cover read-only quick/natural routing, no model needed for the quick choice, durable publish/get with unchanged draft/no proposal, edit staleness and wrong-token/destination/day rejection.
- **100 frontend tests** pass. New cases cover long routes, empty/unmapped days, wrong trip/day, unfinished/proposal-producing jobs and stale tokens. TypeScript, production build, changed-backend Ruff and diff whitespace checks pass. Generated OpenAPI includes optional handoff fields in conversation responses; no database migration or new key is needed.
- **Live browser/model/worker:** sent “Could you help me replan what is left of today?” on Jaipur day 5. This is not a deterministic shortcut; the configured provider classified the new action. The reply named the selected day and offered confirmation without a candidate. The 44px phone action opened the existing screen. Wrong-day selection disabled it; returning to the correct day enabled it. Reload restored the durable action.
- **Freshness and keyboard:** after loading the saved-draft context, date/time were both empty and Check readiness disabled. Escape closed the modal, restored focus to the planner action and did not reopen it. Desktop and 390×844 phone layouts inspected; viewport reset afterward.
- **Data boundary:** read-only database check after the browser flow: accepted version **46**, accepted activities **11**, draft activities **11**, job `succeeded`, turn `remaining_handoff`, no proposal ID, metadata keys only `remaining_handoff`. One QA chat turn remains in the conversation; no itinerary or accepted snapshot changed.
- Screenshots (local, ignored by git): `.local/qa/remaining-chat-desktop.png`, `.local/qa/remaining-chat-phone.png`, `.local/qa/remaining-chat-confirmation-phone.png`.

## Trade-offs and next sequence

The model routes intent, not schedules or completion. Ambiguous/custom wording can still require clarification; no claim is made that arbitrary conversational replanning is autonomous. The existing conversation service’s lifecycle/engine availability rules remain unchanged; this slice does not expand active-trip chat permissions. Manual readiness retains its own lifecycle checks.

The pointer can remain useful until the saved plan changes because it contains no traveler report. Every new confirmation still obtains fresh context and every proposal/acceptance revalidates it. Broader reordering, duration changes and removals remain explicit operations rather than model side effects.

Next, make unresolved past/in-progress readiness results actionable with explicit status/edit choices. Preserve completed and booked items, keep changes visible, and never infer “done” or cancellation merely from the clock.

The previous disposable test database directory was unavailable; a fresh isolated PostgreSQL database was initialized and migrated to head for tests. Hosted application data was not used as the test database.

Learning notes/journal and generated OpenAPI updated; finalized PRD, architecture, API/database design documents and locked landing untouched. No push or deployment.

### Follow-up correction — 15 November 2026

Inspection in the next slice found that general chat admission/publication did **not** enforce the lifecycle restriction described above. The explicit active read-only/planning mutation policy is now implemented and verified; see [active-trip chat policy learning](active-trip-chat-policy-learning.md). The earlier statement should not be read as evidence of a preexisting gate.
