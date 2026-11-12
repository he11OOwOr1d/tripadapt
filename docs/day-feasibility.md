# A day timing review

11 November 2026. This extends the existing **Time to get there** section from an isolated pair check to a day-wide overview. It follows [journey estimates](journey-checks.md), preserving the same backend contract and user-controlled schedule.

## What the traveler sees

Every consecutive journey is listed in itinerary order. Each stays explicitly unknown until checked, or explains that mapped locations are missing. Checking a second journey preserves the first result in the current view. The header reports coverage and prioritizes schedule overlaps/shortfalls, then unknown journeys, then provider access warnings. Only complete fitting journey coverage can say “Checked journeys fit the estimates.” That does not certify the day.

All activity overlaps are detected, including a long activity overlapping a later nonconsecutive item. Activities crossing midnight are flagged separately. Overlap warnings open the relevant activity editor; a route shortfall offers an explicit adjustment button. The traveler edits and saves normally. Protected activities keep the existing editor behavior; nothing is moved automatically.

The design stays inside the paper/green workspace, using a chronological list with a rule on the selected journey. One list replaces a duplicate journey dropdown. The section remains collapsible, touch-friendly and keyboard accessible, with stacked controls on phones and no additional animation.

## Boundaries and decisions

- One explicit paid route request at a time. Opening the review does not trigger a full-day API fan-out or exhaust the existing six-per-minute safeguard.
- Google data remains transient in component state. Changing day, activity timing/duration/place/title, mode or buffer invalidates checks. Selecting another pair preserves results for unchanged pairs; refreshing removes the selected result before requesting new evidence. Failed checks remain unchecked.
- An unmapped intervening activity is never skipped to invent a direct route between other mapped items.
- Provider road/access warnings remain visible even when duration fits. Unknown hours, tickets, accessibility, intercity transfers and live traffic are not folded into an “all clear.” Reported-hours checks remain in the individual activity editor.
- No new key, backend endpoint, migration, storage, model call, automatic acceptance rule or deployment. Aggregate logic is a pure UI-domain function separate from the authenticated journey adapter. It checks the editable local draft, including unsaved changes, rather than claiming the saved database version was verified.

Tradeoff: travelers explicitly check each mapped pair, and changing the shared mode/buffer restarts that coverage. This keeps cost and evidence understandable. Durable/provider-aware proposal validation, mixed per-leg modes, [reported-hours coverage is now implemented](day-opening-hours.md); weather and downstream replanning remain later work.

## Verification

Six new regression tests cover nested overlaps, missing intermediate locations, partial versus complete coverage, shortfalls/provider warnings, stale timing/mode/buffer evidence, and empty/single/overnight days. The frontend suite has 34 passing tests; TypeScript and production build pass. Backend code and API contracts are unchanged from the 199-test verified journey slice.

Browser QA uses temporary mapped activities in the existing QA trip, preserving the traveler's actual trip. Checks cover partial and complete journey coverage with live Google results, preserving results between pairs, explicit edit handoff, schedule-change invalidation, missing map locations, keyboard disclosure and desktop/390px/320px layouts. Live QA showed 1/2 then 2/2 journeys checked, retaining a 30-minute shortfall alongside a fitting route with an access warning. Editing Albert Hall to overlap the earlier activity reset coverage to 0/2 and exposed the 30-minute overlap with its editor link. Test-only activities were removed afterward. Google-content screenshots remain local in `/tmp/elsewhere-day-feasibility-*.png`; no provider content is committed as durable product evidence.
