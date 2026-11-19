# Link a new place after a cross-stay move

16 November 2026.

## What changed

An applied stay rebalance now passes its structured result through the workspace reload boundary. Cross-stay moves produce an actionable follow-up panel, naming each current activity, destination and day. Previewing alone creates no reminder. Same-stay moves create no reminder either.

**Choose map location** selects the new stay/day and opens the existing activity editor at its location disclosure. It reads the current activity rather than copying timing, flags, map identity or costs from the rebalance response. The old destination's map remains cleared. A new place is linked only through the traveler's explicit choice and Save.

Multiple moved activities are listed independently. Linking one shows its chosen place while other eligible items remain actionable. Missing, resolved, relocated or already-linked records cannot use an old navigation action. Saving errors/dirty state block linking another item; dismissing the reminder changes no plan data.

## Design and boundaries

Reuse Elsewhere's quiet green reminder treatment, wrapping rows and 44px buttons. Accessible action names include the activity/destination/day. Cancellation returns to the same action; after a save removes that action, focus can return to the reminder when no other control has focus.

The response callback is additive to the existing draft reload, not another API mutation path. Linking preserves current time, duration and fixed/booked flags through the shared editor. No reservation, price, opening hours or journey feasibility is inferred from a map record.

The reminder is session-local. Reload preserves actual saved map links but does not recreate this navigation panel. Later rebalancing can replace the panel; ordinary planner editing remains available for any still-unmapped activity. No durable recovery schema was added in this slice.

## Verification

- **171 frontend tests**, TypeScript and production build pass. Four new tests cover applied-versus-preview and cross-stay filtering, current-record resolution with long stays/commitments, wrong trip/scope/resolved/map guards and independent multi-activity resolution. Whitespace passes.
- The Supabase signing-key connection that blocked the previous turn was available again. Used the real signed-in local app and dedicated **QA four fixes** trip; no authentication/TLS bypass or credential handling occurred.
- Added one temporary mapped activity on Oakland day 3, selected Oakland Museum of California from retrieved records and saved. Previewed shortening only the final stay from two nights to one, with the temporary activity explicitly moved to San Francisco day 1 at noon. Existing booked dates stayed unchanged; preview disclosed clearing the old map.
- Applied to the saved draft. The new panel named the activity at San Francisco day 1, and its action opened the editor with no linked place, location disclosure open and keyboard focus on its summary. Cancel changed nothing. Reopened and explicitly linked Asian Art Museum of San Francisco from retrieved new-destination records; Save persisted it and the panel showed Linked.
- Desktop and **390×844** phone layouts checked, screenshots saved and viewport reset. Multiple-item behavior is unit-tested; the live walkthrough used one temporary activity. No venue-hours or route check was claimed.
- Cleanup: dismissed the panel, removed only the temporary activity, and restored the final stay through preview/apply from one night to two. Full `PlanInput` matched the original baseline exactly, including dates, activity outcomes and costs. Accepted pointer and planning lifecycle stayed unchanged. Reload showed no temporary activity, reminder or dialog. No accepted revision, financial record, reservation or chat turn was created.
- Screenshots: `.local/qa/cross-stay-map-editor-phone-20261116.png`, `.local/qa/cross-stay-map-linked-phone-20261116.png` (ignored local artifacts).

## Remaining scope

Durable map-repair navigation across reload and a trip-level done/skipped/planned recap remain useful follow-ups. Broader downstream changes still use the existing guarded rebalance/review paths. Backend source/schema was unchanged; backend suites were not repeated for this frontend slice.

Learning notes/journal only updated. Finalized PRD/architecture/API/database documents and locked landing preserved. No migration, key, push or deployment.
