# Opening-hours coverage in the day review

11 November 2026. This continues the day-feasibility sequence by combining reported venue-hour coverage with the existing activity-overlap and journey overview. No new backend API or key is required.

## Flow and design

**Check this day’s timing** now opens the combined review. The header distinguishes conflicts, incomplete evidence and access warnings. Journey estimates retain their existing explicit per-pair controls. A second section, **Will the places be open?**, lists venue visits and their reported-hours coverage.

A shared check date uses the provisional date for exact trips. Flexible trips require the traveler to choose a date for checking only; this never sets trip dates. Each mapped visit uses the existing Google listing-confirmation and full-visit check. Switching visits retains current-view results, including the original Google attribution, explanation, timestamp and listing link. A source change, time/duration edit, day/date/timezone change or removal clears affected coverage through the existing keyed review boundary. Changing only the shared hours date clears hours checks but retains date-independent route estimates.

Generic meal/rest/free-time blocks are not assumed to be venues. Sourced items remain venue checks even if their type is changed to meal or rest. Manual custom visits remain explicitly unknown. No location is inferred from an activity name. Closed/outside-reported-hours visits are conflicts; missing hours, missing dates and dates beyond Google's current coverage remain unknown. Unknown never contributes to a fitting count. The summary cannot imply tickets, accessibility, availability, weather, live traffic or intercity travel were checked.

The paper/green planner and existing typography are preserved. Sections use chronological lists, selected-row rules, existing disclosures and touch-sized controls. No extra animation or landscape assets are introduced. Price information remains in the dedicated activity editor; this review focuses on timing.

## Data and tradeoffs

Only one user-requested provider operation runs per check. No automatic day-wide paid fan-out or silent retry. Google details stay in transient React state, outside trip drafts, accepted snapshots, local storage and Groq input. Choosing a new Google listing inside the day review is temporary; persisting its ID still requires the activity editor's normal Save action. Existing saved Google IDs can be refreshed, with the same geographic validation and safe failure behavior as before.

The UI-domain aggregation is separate from the existing authenticated Google adapter and server-side whole-visit evaluator. No database migration, backend contract change, extra credential or deployment. Tradeoff: explicit listing confirmation and per-venue checks add actions, but keep costs, identity and evidence boundaries visible. Durable provider-aware proposal validation, bulk checks, mixed journey modes, weather and downstream replanning remain subsequent work.

## Verification

Five new regression tests cover generic breaks, sourced meals, manual/unchecked visits, closed/outside-hours evidence versus unknown coverage, and removal of mapped identity. The frontend suite has 39 tests; TypeScript and production build pass. Backend remains unchanged from the 199-test verified Routes/Places baseline.

Browser QA uses the existing test trip and temporary museum activities. Albert Hall on 12 November 2026 at 14:00–15:00 fit reported hours; coverage correctly stayed at 1/2 with the other visit unknown. Switching away and back retained that result, and selecting 1 May 2027 cleared old coverage. A fresh live check for that date correctly returned outside-current-hours coverage and did not count as a fitting visit. Checks cover a real Google match/full-visit result, partial hours coverage, result retention across visit selection, shared-date invalidation, flexible-date preservation, empty/missing-location guidance, keyboard disclosure and desktop/phone layouts. Temporary QA activities are removed after checking. Provider-content screenshots stay local in `/tmp/elsewhere-day-hours-*.png`, outside source control. No push or deployment.

Next implemented slice: [review one timing adjustment after a journey shortfall](timing-adjustments.md). Durable provider-aware proposal validation remains outstanding.
