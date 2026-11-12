# Review a time adjustment after a journey shortfall

11 November 2026. This continues the combined day-review sequence with a bounded response to a route shortfall. It is deterministic planning guidance, not a new autonomous agent or durable server proposal.

## Traveler flow

After a journey check reports insufficient time, the planner computes the next activity's earliest later start from the previous activity's end, rounded route estimate and selected arrival buffer. A review panel shows the activity, old/new start, end time and minutes moved. **Review time change in editor** opens the existing activity editor with that time prefilled. Cancel leaves the trip unchanged. Save uses the normal editable-draft/autosave path, preserving duration, source identity and every other activity. The usual edit invalidation clears old day checks.

A suggestion is unavailable when the target is fixed, booked or completed, would cross midnight, overlap another activity, change activity order, use stale/unknown route evidence or cross day/destination scope. It never cascades changes through the rest of the itinerary. The current activity can still be reviewed manually through the existing editor; protection changes remain the traveler's explicit choice.

## Evidence boundary and decisions

Only one start time is suggested. The current incoming route estimate supports that arrival gap; it does not validate the next journey or venue hours at the new time. The panel explicitly asks for fresh checks and retains road-access warnings. No claim of a reservation change, venue availability, accessibility, weather or a fully feasible itinerary.

Google content remains transient in the day review, outside Groq context and stored proposals. The saved result is only the user's ordinary activity time. No new provider call runs when calculating or opening the suggestion. No endpoint, API contract, key or migration changes.

The design uses the existing paper planner and one warm-toned margin rule to distinguish a proposed adjustment from saved facts. Plain before/after times and an explicit editor handoff make the mutation boundary visible. No new animation or landscape assets.

Tradeoff: an extra review/save step and no automatic cascade, in exchange for preserving commitments and making scope clear. Durable provider-aware server proposal validation, hours-aware slot search, multi-activity replanning and automatic adaptation remain later work.

## Verification

Six domain regression tests cover exact calculation and input preservation, protected targets, later conflicts, order changes, midnight/stale evidence and cross-scope/missing-location rejection. The frontend suite has 45 tests; TypeScript and production build pass. Backend unchanged from the 199-test Routes/Places baseline.

Browser QA uses temporary sourced museum activities in the existing QA trip. Live Google route evidence produced an 11:10 → 11:40 suggestion for Albert Hall, ending 12:40 with unchanged 60-minute duration. Cancel retained 11:10; Save applied 11:40 and reset route/hour coverage to unknown. the existing editor handles Cancel and Save, unchanged duration and source details. The time change clears previous check coverage. Desktop and phone layouts are checked, and QA activities are removed afterward. Screenshots containing provider evidence remain local under `/tmp/elsewhere-timing-adjustment-*.png`. No push or deployment.

Next implemented: [check suggested venue hours and onward travel before saving](adjustment-preview-checks.md). This still does not introduce durable server-side provider validation.
