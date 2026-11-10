# Manual itinerary workspace

Implemented 10 November 2026. This continues the approved Unfolding journey; earlier design studies remain explorations. The Fieldtrip landing is unchanged.

## Current behavior

After reviewing a route, open the itinerary workspace. Choose a destination occurrence and one of its days. Add an activity, meal, break or free-time block with a local start time and duration. Edit or move it to another destination/day, mark it completed, or remove and undo. Fixed and booked flags record traveler intent; they do not create reservations.

The route stays beside the timeline on desktop and becomes a horizontal destination rail on phones. The whole-trip overview summarizes destination windows. Gaps remain explicitly unplanned; the default display window is 08:00–22:00 and expands for earlier/later activities. Conflicts remain visible and editable. Structural errors, including crossing midnight, are blocked by the editor. Activities outside a shortened destination window remain visible for reassignment.

Stay nights and calendar-day windows differ: six nights cover seven local days. Same-day destination transfers share a trip day. Overnight travel adds calendar days. Exact-date labels are provisional, derived from the outline, not verified travel schedules. Flexible plans retain relative day numbers. Transfer cards remain untimed estimates until real transport schedules exist.

## Persistence and contracts

UI rendering and validation live in `ItineraryWorkspace.tsx`, `ActivityEditor.tsx` and pure `lib/trips/itinerary.ts`. Account writes remain in the existing account adapter and serialized autosave queue. Guest state remains local. Reload links preserve workspace, destination and day; account reopening selects the workspace when activities exist.

The existing draft activity contract gains `kind`: `custom` (default), `meal`, `rest`, or `free_time`. Migration `0012_activity_kind` adds a non-null column and check constraint with a backward-compatible default. It has been applied to the configured Supabase PostgreSQL project. Generated OpenAPI includes the field. The frontend never connects directly to application tables.

## Verification

- 13 frontend tests passed: adapter round trips, autosave behavior, shared transfer days, overnight dates, overlap/gap calculation, midnight/day validation, long trips, orphan retention and safe return URLs.
- 20 backend tests passed against PostgreSQL with transactional rollback, including kind persistence and ownership/concurrency coverage.
- Production build with TypeScript passed; backend Ruff check passed.
- Browser: created an activity, added an overlapping meal, observed warnings, moved the meal to another destination/day, removed/restored it, added a break, and marked it completed. Reload restored the selected day, activity types and completion state.
- Desktop and 390px phone timeline/editor inspected; 320px route overview inspected. No document horizontal overflow at either phone width. Native dialog focus and keyboard dismissal checked. Screenshots are in `docs/references/itinerary-workspace/`.

## Remaining integration work

AI itinerary generation/replanning, verified attraction opening hours, travel buffers, provider forecasts/prices/availability and actual transport schedules are not connected. The manual plan labels these limitations. No booking is made. No deployment was performed.
