# Review of concurrent Claude/T3 work — 16 November 2026

Reviewed the current uncommitted checkout, particularly journal entries 73–77 and the activity-outcomes implementation note. Attribution comes from those notes and the user's account of parallel work; Git has no separate Claude commits, so authorship cannot be independently proven per line. No application code was changed in this review.

## Work present

- Preview/apply of stay-night changes between stays or against total trip length; draft preconditions and ownership checks.
- Explicit handling of displaced activities: drop, move to a remaining day, choose another time, or move to another stay. Cross-stay moves clear old map identity and preserve linked costs.
- Journey-impact disclosure and explicit carry-over of travel preferences/linked costs after route edits.
- Persistent skipped activity outcome, migration 0024, mutually exclusive with completed, editor/card display, backend protection and readiness grouping.

## Findings

### P1 — Stay rebalancing silently shifts dated commitments

`services/backend/app/planning/stay_rebalance.py:106–137` only protects activities displaced beyond the shortened stay. Changing an earlier stay also shifts the calendar dates of subsequent stays, including booked/fixed activities still within their stay bounds. On the existing test fixture converted to an exact December 1–10 trip, transferring one night from Jaipur to Udaipur succeeds and moves its booked Cooking class from December 7 to December 6; the preview's moved list is empty. Applying writes this candidate to the draft, which could then be accepted without a specific date-shift disclosure.

Recommendation: compare each protected activity's original and candidate calendar date, including travel nights; block such shifts or require an explicit supported decision. Preview all date changes, not just changed local day offsets. Add exact-date regression coverage.

### P2 — Historical skipped activity breaks remaining-day preview validation

`apps/web/lib/trips/replanning.ts:23` counts all non-completed context activities as expected preview changes. It does not exclude persistent `skipped` activities. The backend correctly excludes both outcomes with `not a.resolved`. A valid preview with one upcoming visit passes the client guard; adding a historical skipped visit to the context makes the identical valid preview fail. The UI then reports unexpected changes instead of showing the preview.

Recommendation: represent skipped in ReadinessActivity, validate its type/exclusivity, and exclude completed or skipped entries from every remaining-activity comparison.

### P2 — Skipped records still occupy time in the displayed timeline

`apps/web/lib/trips/itinerary.ts:92–97` advances its time cursor for every activity, including skipped records. A lone skipped 10:00–11:00 entry produces gaps 08:00–10:00 and 11:00–22:00. The freed hour is unavailable in the gap display even though conflict checks now treat skipped entries as holding no time.

Recommendation: keep the historical card but calculate availability from non-skipped activity intervals. Cover overlapping historical cards and full-day availability without duplicating gaps.

### P2 — Journey-impact panel misses hours/overnight-only entries

`apps/web/lib/trips/journey-impact.ts:24–36` only surfaces a lost journey if it has mode, rate or linked costs. Valid preferences containing only hours or overnight travel are omitted. Reordering a route with an entered eight-hour/one-night journey returns an empty lost list, so there is no carry-over option for that entered timing.

Recommendation: include hours and overnight values in impact detection and disclosure; carry them through the same explicit action.

## Verification

- Existing targeted backend tests: 11 passed (stay rebalance and activity outcomes).
- Existing targeted frontend tests: 17 passed (stay rebalance, journey impact, outcomes, replanning).
- Independent reproductions of the above client defects: `node .local/qa/claude-review/reproduce.cjs`.
- Booked-date shift reproduced with the backend's actual `rebalance_stays` and test fixture, without writing account data.
- The previous whole-checkout check passed 471 backend and 162 frontend tests plus build/typecheck/lint; these new findings expose missing scenarios in those passing suites.

This turn was a code and executable regression review, not a new signed-in browser certification. No deployment or account data was changed. These findings are not fixed yet.

## Fix follow-up — 16 November 2026

All four findings have now been addressed locally:

- Rebalance compares actual dates of every fixed/booked/completed/skipped activity before and after the change using the shared calendar calculation, including overnight journeys. It returns REBALANCE_PROTECTED_DATE with affected activities and before/after dates. Both preview and apply refuse the change without writing. Changes that leave protected dates unchanged still work. No automatic booking-date adjustment was introduced.
- Remaining-day client models and guards recognize skipped, reject invalid/conflicting outcomes, and exclude saved skipped records from required changes and new skip choices. Existing contexts without the optional flag remain supported.
- Timeline cards retain skipped history but never advance occupied time for it. Historical cards outside the normal planning day do not expand availability bounds. Regression tests sum free minutes and check overlapping historical cards alongside active visits.
- Lost journey records now include hours and overnight timing in detection and UI disclosure. Carry-over preserves these preferences and removes the source once, as before.

Regression coverage includes the four protected flags, a successful no-date-shift control, overnight travel dates, API preview/apply refusal with unchanged draft ETag/stops, client malformed outcomes, preserved historical skipped records, required upcoming activity coverage, timeline availability totals, and hours-only/overnight-only carry-over. No migration or environment-variable change is needed. No production deployment was performed.

Final verification after these fixes: **477 backend tests, 165 frontend tests, TypeScript, production build, Ruff, Alembic drift check and git diff whitespace checks all passed.** Automated tests ran against disposable local PostgreSQL; this follow-up did not change account trip data or repeat a full signed-in browser walkthrough.

## Signed-in browser walkthrough — 16 November 2026

Verified these four fixes through the local web app and API, using the signed-in account and a separate new trip, `QA four fixes · browser walkthrough · 16 Nov` (`71d6699c-1e87-4486-b756-6b64cb3699bb`). Original user trips were not edited. The QA draft remains saved for inspection; no accepted version was created.

- **Journey timing:** entered eight hours with no mode or price, reordered the two mapped destinations, saw “8 hours” in the removed-journey panel, carried it to the new origin leg, and verified eight hours in its editor. Repeated with hours blank and one overnight: “1 travel night” appeared and carried over correctly. Restored zero overnight for the rest of the QA trip.
- **Protected calendar date:** recorded a booked QA cooking class in Oakland. Taking one night from the earlier San Francisco stay was blocked with the exact date change (November 17 → 16); the blocked result exposed no Apply button. No reservation was made.
- **Valid stay change:** extended the final Oakland stay from two to three nights, previewed the trip-length/end-date change, applied to draft, reloaded and observed three nights. Removed that added night through another preview/apply and restored two nights.
- **Skipped availability:** recorded a skipped 09:00–10:00 museum visit, then a mapped future 18:00–19:00 visit. Both persisted after reload. Free-time gaps total 13 hours (1 + 9 + 3), so the historical skipped hour is fully available while the upcoming hour stays occupied.
- **Real remaining-day integration:** loaded the saved draft, used the destination's actual current date/time, and explicitly chose a synthetic QA current location at International Art Museum of America. Readiness grouped the saved skip under “Didn't happen” and the future visit separately. Google Routes returned a real six-minute drive plus a ten-minute buffer, and the browser accepted/rendered the preview. This directly verifies the previously failing client/backend skipped-record integration. Current-location selection was test data, not a claim about the user's physical location.
- **No silent mutation:** closed the read-only preview and reloaded; skipped outcome and future 18:00 visit remained unchanged. Also checked enabled controls at 390×844 and reset viewport afterwards.

The destination clock had crossed midnight, so the QA dates were explicitly updated to November 16–20 before readiness; no stale clock or date bypass was used. The route-backed preview reported unchanged timings, so this session did not save or accept a new remaining-day proposal, or certify opening hours. Console inspection showed only the existing Chrome-injected cz-shortcut-listen hydration warning. No new application defect was found in these exercised flows. No production deployment was performed.

Evidence screenshots are in `.local/qa/four-fixes-browser/`: `protected-date.jpg`, `skipped-route-preview.jpg`, `readiness-phone.jpg`, and `final-itinerary.jpg`.
