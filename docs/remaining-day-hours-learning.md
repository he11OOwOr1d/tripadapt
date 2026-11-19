# Check reported venue hours without weakening remaining-day route guards

14 November 2026

## What changed

The saved remaining-day review now offers an explicit check of reported Google opening hours for **every remaining visit, including upcoming commitments**. It reuses the existing matching-listing picker and the shared venue-check policy. Completed and unrelated activities are excluded. Users choose each listing; proximity alone is not treated as venue identity.

Routes remain mandatory whether the hours option is on or off. When enabled, unknown, closed, out-of-hours, out-of-coverage and provider failures stop acceptance with the affected candidate visit named. There is no automatic fallback. Users can explicitly turn off the optional hours check to request provisional acceptance, but cannot bypass fresh route/context guards.

The review also displays the reported starting place, local date/time, timezone, travel mode and arrival buffer. Date/mode/buffer are bound to the saved proposal and cannot be changed through the hours controls. The backend independently enforces those values and the exact listing set. No venue facts or provider bodies are persisted.

## Decisions and lessons

- **Reuse one provider policy.** Venue checks use `recheck_visits_and_journeys` with the exact remaining visits and no duplicate leg checks. The remaining-day route guard runs afterward, covering the initial journey and every connection with the frozen candidate's actual gaps.
- **Check freshness before spending provider requests.** Expired starting context is rejected before hours calls. The route guard revalidates again after hours, so slow lookups cannot turn stale context into accepted changes.
- **Separate provisional intent from verified scope.** Selecting hours means every displayed remaining visit must pass; leaving it off leaves hours provisional. Weather, prices, reservations and the rest of the trip are not certified by either choice. Success feedback preserves which checks were requested.
- **Show the report being acknowledged.** A reopened review must name the starting location and time rather than ask users to remember what “reported start” means.

## Verification report

**Story:** readiness → timing preview → save proposal → select Google listings → check each visit's reported hours → check initial/connecting routes → accept snapshot/update draft → reload.

| Boundary | Evidence |
|---|---|
| UI renders and transports choices | Desktop/390×844 phone review; actual matched museum listing selected; date read-only, mode disabled and DRIVE, 10-minute buffer retained |
| API validates scope and failures | Ten new backend cases; closed/unknown/outside-hours/outside-coverage named diagnostics, exact IDs/date/mode/buffer, no provider calls for expired context |
| Providers respond | Real Google match approximately 21 m from the retained Amrapali Museum point; real reported hours and driving route requests passed |
| Accepted data persists | Controlled test accepted as version 45, visit 13:45–14:05 retained after reload; earlier real-clock timing acceptance is documented separately in the preceding learning note |
| Cleanup and normal operation | Normal server clock restored and browser hint read 23:58 on 14 November; restored snapshot 44 with one temporary item removed, no route/settings changes; reload day 5 empty; read-only database check: current version 46, accepted/draft both 11 activities |

**Controlled-time qualification:** normal destination time was near midnight, so a 10-minute arrival buffer could not fit before day-end. The browser hours rehearsal therefore ran a temporary in-memory backend clock fixed to **13:30 Asia/Kolkata on 14 November 2026**, while Google/Geoapify and the hosted database remained real. The temporary visit moved 13:35→13:45 after **5 minutes estimated driving + 10 minutes buffer**; real Google hours covered 13:45–14:05 and acceptance succeeded. This proves the UI/API/provider/database path under simulated current time, not actual traveler readiness at midday. The test process was stopped and replaced with the normal `uvicorn app.main:app` server; no clock override or env flag was committed.

- **389 backend tests** pass on Python 3.12 and CI Python 3.14; CI retains 13 existing LangSmith deprecation warnings. **98 frontend tests**, TypeScript, production build, changed-backend Ruff and diff whitespace checks pass.
- Browser console contains only the previously identified extension-injected `cz-shortcut-listen` hydration warnings. No suppression was added.
- Screenshots: `/tmp/elsewhere-remaining-hours-review-desktop.png`, `/tmp/elsewhere-remaining-hours-accepted-phone.png`.

## Trade-offs and next sequence

Hours are provider-reported estimates, not tickets or admission guarantees. Listing selection remains manual; facts are transient and must be checked again at acceptance. The six-visit per-action bound, fresh context requirement, preserved durations/order and rejection of clock-change dates remain unchanged. Positive hours acceptance is browser-verified with controlled time; closed/unknown/error behavior is covered by integration tests rather than a second live browser rehearsal.

Next, connect a conversational remaining-day request to this explicit confirmation and proposal path. Chat should propose a scoped handoff, not infer completion/current location, mutate the plan directly or bypass any guard. Broader AI alternatives remain constrained by the same preview and acceptance boundary.

Learning notes/journal and generated OpenAPI updated; finalized PRD, architecture, database/API design documents and locked landing untouched. No push or deployment.
