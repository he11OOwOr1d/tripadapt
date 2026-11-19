# Verify a replacement with both adjacent journeys

14 November 2026

## Outcome

A real weather-related replacement passed guarded acceptance with reported venue hours and **both adjacent driving journeys**. This closes the previously outstanding single-replacement/adjacent-journey rehearsal gap. It does not establish that every trip or multi-visit day adjustment is feasible.

## What changed

- Single time/place changes and day-delay adjustments now use the same evidence-checking implementation after deriving their respective visit/edge scopes. Existing date, listing-set, visit-count, missing-map, hours, buffer, warning and provider-failure guards remain intact.
- A single-change failure now carries the existing safe diagnostic context: proposed visit or exact connecting edge, activity IDs and a bounded reason. Provider bodies/messages are not exposed. The UI resolves labels from the owned candidate and gives the same actionable guidance already used for day adjustments.
- The live acceptance form names the visit whose hours will be checked and lists the incoming/outgoing journeys. It explicitly says neighboring activities retain their saved times and their hours are not rechecked. Missing map locations are named before provider calls.
- Acceptance handlers refuse to submit an enabled but incomplete live-check choice. Successful callbacks can carry a bounded fresh-check confirmation instead of always telling the traveler to recheck the same journeys. This is transient feedback; no Google facts or permanent verification badge are stored.

## Real rehearsal

Only the established QA trip's originally empty Jaipur day 5 was used. Three temporary, unprotected activities were created manually from real map records, with no landing/sample itinerary copied:

| Role | Source/selection | Local time |
| --- | --- | --- |
| Predecessor | Sawai Jai Singh II, selected from real attraction discovery | 09:00–09:15 |
| Replacement slot | A temporary flexible activity, replaced by the retrieved Amrapali Museum record | 12:00–12:30 |
| Successor | Chhoti roundabout view, selected from the same destination's real attraction discovery | 15:00–15:15 |

The check-only date was **2026-11-16**, in Asia/Kolkata. Flexible trip dates were not changed. The museum was explicitly matched to a nearby Google listing, approximately 21 m from its map record. Acceptance used **DRIVE, without live traffic**, with a **10-minute arrival buffer**. The preserved gaps were 165 minutes before the museum and 150 minutes afterward.

One bounded live acceptance attempt succeeded after the venue-hours and both derived journey guards. No warnings were suppressed, locations moved, safety restrictions relaxed or provisional fallback used. The success appeared in the workspace; reload retained Amrapali Museum at 12:00–12:30, with both mapped neighbors unchanged. History showed accepted version **41**, containing the three temporary activities alongside the original plan.

Cleanup used the existing restoration preview for original snapshot **37**. The preview reported **0 returning, 3 removed, 0 changed**, with route/settings unchanged. Acceptance and reload restored the empty day 5; the original day-3 walk remained 10:15–11:00, 45 minutes. The live rehearsal remains inspectable in history, but its temporary activities are absent from the working trip. Earlier pending reviews were not discarded.

## Lessons and trade-offs

- A checked box and plausible timetable are not proof of provider success. The decisive observation was guarded acceptance followed by persisted candidate/history state, without a provisional retry.
- The scope matters: this checked the replacement's hours and two connecting route estimates. It did not check the neighbors' hours, indoor shelter, admission, supplier inventory, accessibility, accommodation travel, live traffic or the whole trip.
- Preserve route access warnings as blockers. This successful driving case does not invalidate the restricted-route warnings from the earlier unsuccessful venue pairs or certify walking routes.
- Reusing one checker prevents different evidence policies for single replacements and day adjustments. Scope derivation stays separate, so day-wide limits do not become trip-length limits.
- Candidate comparison and tests must use logical activity identity. A local full-suite run exposed an existing test comparing PostgreSQL activity row order; the test now compares by logical ID, retaining every field assertion. No production ordering or validation was weakened.

## Verification

- **352 backend tests** passed locally (Python 3.12) and on CI Python 3.14; the corrected identity-order assertion was also checked on CI Python. Ruff passed. The existing 13 LangSmith deprecation warnings remain on CI Python.
- **93 frontend tests**, TypeScript and production build passed.
- New automated cases cover named visit failures, exact outgoing-edge provider failures without upstream-text leakage, missing predecessors before provider calls, both-leg scope, standalone visits, missing neighbors and rejection of unrelated diagnostic edges. Existing failure/atomicity tests continue to pass.
- Desktop showed the explicit visit/two-journey scope; 390×844 phone and reload checks confirmed the accepted replacement. Screenshots: `/tmp/elsewhere-adjacent-checks-desktop.png`, `/tmp/elsewhere-adjacent-checks-phone.png`.
- The browser's reload warning was traced to extension-injected `cz-shortcut-listen` on the body. No app warning suppression or extension setting was changed.

Learning/journal docs only were edited as documentation. Finalized PRD, architecture, API/database design documents and locked landing remain untouched. Existing error-response schemas were reused; no API-key, migration, push or deployment was needed. Local frontend/API/worker remain running; the disposable test database was stopped after checks.

## Next sequence

Add remaining-day replanning readiness: explicit current local time, a traveler-confirmed current location and the intended scope. Preserve completed, fixed and booked commitments, use the same evidence guards, and keep the current accepted version unchanged until a feasible proposal is reviewed and accepted. Successful multi-visit day-delay acceptance remains a separate verification gap.
