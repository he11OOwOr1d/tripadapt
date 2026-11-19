# Independent audit and fixes — 16 November 2026

Scope: local checkout on `codex/planning-recovery-discovery`, including newer uncommitted implementation. This is not a production deployment certification. Existing feature learning notes describe earlier implementation checks; those are not substituted for the observations below.

## Fixes

1. Rate/tax Decimal serialization now uses fixed notation. Values such as 90 and 10 survive persistence and validation without becoming 9E+1 or 1E+1.
2. Readiness compares the database revision with the repository's Alembic head rather than a hardcoded revision. Current head is 0024_activity_skipped; readiness returns 200 against the configured migrated database.
3. Linked accommodation/journey records offset their matching allowances. Partial payment leaves the unrecorded allowance; excess remains counted. Other costs are additional. Payment and allowance disclosures explain the overlap.
4. ORM declares ix_cost_item_version, matching its migration.
5. Embedded worker lifecycle and free Render web-service configuration are present in this checkout. Worker liveness affects readiness; shutdown stops the consumer. This configuration was not deployed in this task.
6. Additional defect found during browser QA: partial VersionView reads inherited full-plan reconciliation despite omitting stops. That could detach linked payments/drop estimates, which autosave then persisted. Partial read validation no longer reconciles an intentionally absent route. Save/read/save regression covers stay and journey links.

The strict-budget review message now distinguishes exceeded, unverified and passing checks. Its missing issue-code TypeScript declaration was corrected during the final build. Existing protected-activity tests now also cover skipped activities and their updated refusal text.

## Automated verification on the final checkout

- Backend: 471 passed, using disposable local PostgreSQL on port 55439, not the account database.
- Frontend: 162 passed.
- TypeScript: passed.
- Next.js production build: passed.
- Ruff: passed.
- Alembic upgrade through 0024 and drift check: passed, no new operations detected.
- git diff --check: passed.
- Local API readiness: 200, schema 0024_activity_skipped, embedded worker enabled.

## Independently observed browser checks

Used the existing signed-in account session with local frontend/API and real account persistence. Created a separate trip, `QA audit · costs and replanning · 15 Nov` (d4bdf479-0cc6-40b1-b156-abe9908c7b3c); original user trips were not edited by this QA workflow.

| Flow | Observation |
| --- | --- |
| Creation and persistence | Saved mapped San Francisco destination, dates, route, allowances and activities; reload restored the trip. |
| Linked payments, tax and conversion | INR 200 hotel allowance plus linked INR 200 paid record counts once. EUR 1 plus 10% tax at manual rate 90 adds INR 99. Complete total INR 299 survives reload and later saves. |
| Strict budget | INR 298.99 blocks review acceptance; INR 299 passes with explicit acknowledgement that the check uses entered costs. |
| Weather change | Real San Francisco rain forecast loaded. Removal preview could be closed, resumed after reload and accepted with acknowledgements. Other activities remained. |
| Recovery of an earlier activity | Unresolved earlier activity blocks readiness. Ongoing and missed choices handed editing to the correct activity; cancelling did not mutate it. Saved corrections survived reload. |
| Saved review | Resume and read-only status refresh preserve the frozen proposal; status refresh did not create another proposal. Acceptance requires a new readiness check afterwards. |
| Active chat | Real explanation reply listed accepted activities. Replanning request produced a readiness handoff rather than silently editing. |
| Fatigue / remaining-day flow | Readiness, explicit current mapped place, rest and skip selections worked. Preview initially failed closed on Google 403 and did not alter itinerary. Successful fatigue preview and acceptance have NOT been verified in this browser session. |
| Lifecycle | Start, finish, reload of completed status, disabled new chat requests, resume, and final finish observed. Activities were not implicitly marked done. QA trip left completed. |
| Responsive layout | Earlier checks included 390×844 viewport for active chat and route failure. |

## Google Routes configuration

The real provider request returned HTTP 403 PERMISSION_DENIED. Google Cloud's API key 2 had IP restrictions and included Routes API, but only allowed 115.244.141.202. Current outbound IP was 122.186.86.102. With explicit user approval, added this one IP, preserving the old IP and API restrictions. Reopened settings and verified both rows persisted. A real backend computeRoutes request between distinct public San Francisco museums then returned HTTP 200 with duration 307 seconds.

An app timing check between two QA activities mapped to the same museum returned “No usable route estimate was returned” and preserved the schedule. This does not establish a successful route-driven proposal/acceptance. Dynamic IP changes can require another explicit allowlist update; the local IP update does not provision Render's outbound IPs.

## Limits / remaining verification

- Newer stay-rebalance, journey carry-over and skipped-outcome work appeared during this audit. Their automated tests pass; their full signed-in browser flows have not been independently repeated here.
- Successful fatigue/remaining-day acceptance, live opening-hours checks, and the full delay/replacement combinations still need browser verification with suitable fresh future activities and provider evidence.
- A Chrome extension inserted cz-shortcut-listen into the page and caused a hydration warning during earlier testing; no application suppression was added.
- No commit, push, production migration, Vercel deployment or Render deployment was performed. The live website still requires deployment of the reviewed changes and corresponding migration/configuration checks.

Screenshots: `.local/qa/audit-fixes/` contains cost totals, strict-budget blocked/passing reviews, active chat, the initial route failure, saved Google allowlist, and the final completed lifecycle state.
