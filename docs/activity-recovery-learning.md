# Guide unresolved activities to an explicit edit

15 November 2026.

## What changed

Saved-draft day-check results now ask what happened to each unresolved earlier or overlapping activity. “I finished it” opens completion review; “I’m still doing it” focuses duration; “I didn’t do it” focuses day selection for rescheduling or explicit removal. Guidance stays visible in the editor. No choice automatically changes duration, completion, fixed/booked flags or the saved schedule.

This extends the existing guarded readiness-to-editor handoff. Current draft token, matching activity fields, selected destination/day and unexpired report are still required. Accepted-snapshot results retain their explicit saved-draft switch. All three paths return to the original day-check reminder, including a reschedule to another day. A new check requires fresh time/location confirmation after editing or cancellation.

## Decisions and trade-offs

The data model currently persists completion only. These answers are navigation choices, not new saved skipped/in-progress states, and the interface says so. Do not represent this slice as a progress-event log. A persistent execution model would need its own schema, synchronization and accepted-plan semantics.

An ongoing activity uses total duration from its original start, not a replacement remaining-duration value. A missed activity can be rescheduled or removed explicitly; it must not be marked completed to unblock a check. Fixed/booked warnings and existing protected-removal confirmation remain. Removing an itinerary item does not cancel a reservation.

Reuse Elsewhere’s compact green surface and native radio groups, with unique group names, arrow-key selection, 44px labels/actions and visible focus. No animation, new provider or second mutation path was introduced. React review: choice state is local, permissions/guard resolution remain derived, and editor focus is handled on opening without applying activity patches.

## Verification

- 109 existing frontend tests, TypeScript and production build pass. Existing readiness guard tests cover stale/accepted/wrong-day results, changed fields and protected records. No backend changes or migration were made; backend suites were not repeated for this frontend slice.
- Real authenticated browser/API check while the known QA trip was temporarily active: selected a retrieved Geoapify location solely as QA context and checked saved-draft Jaipur day 3. Five earlier unresolved items showed recovery choices.
- Ongoing focused `minutes` and preserved completion false. Missed focused `day` and preserved completion false. Finished focused the visible `completed` checkbox and still left it unchecked. Every editor was cancelled; no Save or Remove operation occurred.
- Native arrow keys moved through all three radio choices. Phone editor client/scroll widths both 322px; desktop and phone layout inspected. Viewport override reset afterward. A screenshot taken after a turn interruption was malformed and is excluded from evidence.
- Cancellation returned the day-check reminder. Reopening/loading the saved draft left date/time empty and readiness disabled. A report over five minutes old was rejected by the existing server check; reloading context required confirmation again.
- QA trip restored to planning with expected revision/lifecycle and accepted/draft pointer assertions. Every column of all 22 accepted/draft activity rows matched the baseline exactly. Accepted version 46 stayed in place; no proposal, chat turn or new accepted version was created.
- Usable screenshots: `.local/qa/activity-ongoing-editor-desktop.png`, `.local/qa/activity-missed-editor-phone.png` (ignored local artifacts).

## Remaining scope

Persistent skipped/ongoing statuses, elapsed execution tracking and changes applied directly to the accepted day are not implemented. The current path remains explicit draft editing followed by review/acceptance where needed. Next, improve the handoff from a corrected draft to review and back to a fresh accepted-day check, so a traveler can clearly distinguish saved edits from the plan being followed.

Learning notes/journal updated only. Finalized PRD/architecture/API/database design documents and locked landing unchanged. No push or deployment.
