# Learning: user-reported day delays

12 November 2026. The first disruption-replanning slice lets a traveler choose the first affected activity, enter a later local ready time and confirm they can be at that activity's location. A saved review lists every proposed start-time change before explicit acceptance. The existing paper/green workspace and proposal/history boundary are reused.

## Decisions and tradeoffs

- Keep durations and every existing nonnegative gap. This avoids inventing faster journeys or silently consuming rest time. It is deliberately conservative: a protected commitment can block this proposal even when a manually shortened activity or gap might make another plan possible.
- Move only flexible activities from the selected point on the same destination/day. Fixed, booked and completed items remain protected; conflicts name the commitment. Midnight overflow is rejected rather than clipped or moved to another day.
- Require an explicit location/readiness confirmation. The app does not infer current location or journey time to the first activity.
- Use deterministic backend logic rather than an LLM for time arithmetic. Frozen candidates, ownership, draft ETags, idempotency and full-plan reconstruction at acceptance prevent retries or concurrent edits from silently changing scope.
- Preserve the existing review recovery and accepted-history paths. Acceptance updates the editable draft and retains a separate snapshot; choosing this adjustment makes no reservation.
- Keep provider evidence honest. This command does not recheck hours, routes, costs, availability or weather. The optional live guard for a single requested move is not presented as coverage for a multi-activity delay.

## What we learned

A delay is more than adding minutes to one activity: all later flexible items, preserved gaps and protected anchors must be considered together. A failed conservative adjustment must explain the restriction without claiming that every possible alternative is infeasible. UI copy must distinguish a user-reported delay from live disruption detection.

The data adapter owns transport and a bounded request timeout; the form owns input and retry state. Saved command metadata supports a readable before/after review without persisting provider payloads. No schema migration is needed. Generated OpenAPI is refreshed as a code contract; the PRD, architecture, database-design and API-design documents are unchanged.

## Verification

240 backend tests pass, including CI-matching Python 3.14. Coverage includes multi-item propagation, day 13, other-day isolation, fixed/booked/completed conflicts, midnight, malformed readiness, ownership, stale drafts, idempotency, candidate tampering, discard and accepted-draft synchronization. Ruff passes. All 54 frontend tests and the production build pass.

Browser verification used the existing QA trip, adding two temporary manual activities to its empty day 5. Preview kept the underlying timeline unchanged; explicit acceptance moved 10:00 to 10:30 and 11:15 to 11:45, retaining both 60-minute durations and the 15-minute gap. Accepted times survived reload. Desktop and 390/320-pixel phone layouts were checked. Both temporary activities were removed, autosave completed and reload confirmed the empty day restored. The accepted QA snapshot remains in history. Screenshots: `/tmp/elsewhere-day-delay-desktop.png` and `/tmp/elsewhere-day-delay-phone.png`.

## Remaining scope

Provider revalidation across the shifted schedule, alternative plans around protected commitments, cross-day redistribution, weather/fatigue triggers and conversational delay extraction remain future work. No push or deployment in this slice.

13 November follow-up: optional bounded provider revalidation is implemented in [day-delay live checks](day-delay-live-checks-learning.md), with its verification limits recorded separately. The description above records the initial slice.
