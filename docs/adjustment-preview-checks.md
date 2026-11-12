# Check a proposed time before saving

11 November 2026. This extends [reviewed timing adjustments](timing-adjustments.md) with explicit validation of the proposed full visit and the onward journey. The current itinerary remains unchanged throughout the preview.

## Flow

A journey shortfall can produce one later-start suggestion. **Check this suggested time first** opens optional checks at that proposed start/duration. Choose a preview-only date for flexible trips; exact trips use the provisional trip date. Confirm the Google listing or reuse an already selected listing, then request the full-visit hours comparison. Independently check travel from the proposed activity end to the next activity's unchanged start, using the selected mode and arrival buffer.

Closed/outside-hours evidence or an onward travel shortfall produces a conflict verdict. Missing/out-of-coverage hours and missing next-place coordinates remain unknown. A fitting route with a provider warning retains a warning verdict. A final activity has no invented onward route; accommodation/return travel remains outside scope.

Results show Google attribution, retrieval time, original-listing links and provider warnings. Date changes clear hours evidence; changes to suggestion/mode/buffer/day/activity schedule reset the preview and cancel pending work. Static onward estimates are date-independent. Current-day coverage and proposed-time evidence are separate: checking the suggestion cannot mark the old itinerary as fitting.

## Mutation and architecture boundary

Checking and reviewing do not save or create reservations. The existing activity editor remains the explicit review/Save boundary; its normal validation, account autosave and source preservation apply. Preview checks are advisory, not a new acceptance prerequisite or durable server proposal. Further edits require new checks, and hours/access/tickets/traffic/weather remain provisional.

The existing authenticated Places and Routes adapters are reused. No new endpoint, key, migration or backend implementation. Requests are explicit, bounded by the existing shared quotas, and never fan out automatically. Google payloads remain in transient UI state, outside saved drafts, proposals, storage and Groq input.

Tradeoff: two separate provider operations and optional user review rather than an automatic cascade or opaque “safe plan.” Durable provider-aware server acceptance, hours-aware slot search, multi-activity replanning and automatic adaptation remain subsequent work.

## Verification

Five new regression cases cover unchecked/far-future hours, closed/outside-hours conflicts, independent onward shortfalls, route warnings and last-activity handling. The frontend suite has 50 passing tests; TypeScript and production build pass. Backend unchanged from the verified 199-test baseline.

Browser QA uses three temporary sourced activities in the existing QA trip. Live checks confirmed the proposed Albert Hall 11:40–12:40 visit fit reported hours, while onward travel to Jaipur Wax Museum at 14:00 needed five more minutes (75 minutes walking + ten-minute buffer, only 80 available). The combined preview stayed in conflict and the saved activity remained at 11:10. Changing the preview date cleared hours while retaining the date-independent onward result. Explicit listing confirmation and desktop/390px/320px layouts passed. QA entries are removed afterward. Provider-content screenshots remain local under `/tmp/elsewhere-adjustment-checks-*.png`, outside source control. No push or deployment.

Next implemented: [saved time-change proposal handoff](saved-time-change-proposals.md). This adds durable schedule checks, not supplier revalidation at acceptance.
