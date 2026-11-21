# Current implementation status

Local implementation and verification status. The dated sections below preserve the evidence recorded at each stage.

## Stay features and calendar file — 21 November 2026 (pushed and deployed)

The stay, journey, route-estimate and calendar work (66 commits after `568a6b7`) was pushed to `main` and deployed on 21 November: CI passed, both Vercel projects succeeded, Render answers the new routes, and the signed-in checklist was run on the hosted app on a dedicated QA trip (see [the release record](../deployments/stay-features-release-plan.md)). Since then, the calendar file (.ics) was hardened (local, not yet pushed): every event has `LAST-MODIFIED` and a `SEQUENCE` that rises with each export so a newer file should update events instead of duplicating them, an optional reminder (off by default, timed events only), map positions (`GEO`) and a link back to a saved trip on a secure address. 267 frontend tests pass; the file was parsed by an independent library; not yet imported into a real calendar app. The event logic now lives in one shared module for the file and a future in-app calendar view, and a bug in the released file (a journey with only an arrival time made the download fail) is fixed locally and not yet pushed. See [the calendar note](../calendar-export-learning.md).

## Where you stay — 19 November 2026 (on main and deployed)

Each destination with nights has a **Where you're staying** panel: name, address, check-in/out, "booked by me" and an optional place from a nearby-stays search (Geoapify/OpenStreetMap, 12 results within 5 km). A stay with a location is a blue pin on the day map. It is the traveler's own record; nothing is booked, priced or checked. No migration: it lives in `stay_preferences`. 549 backend tests (18 new) and 201 frontend tests pass, build passes, and a live search returned 12 Jaipur stays. Verified signed in on a new QA trip (search, save, reload, pin on the real basemap, removal restoring the baseline, 390 px). **Not verified:** a screenshot, the hosted app, and a stay next to numbered visits. Deploy order when approved: backend first (it must accept `lodging`), then frontend. After the push (`afca645`): CI passed, both Vercel projects reported success, Render serves the new backend (a live lodging search returned results) and the production bundle contains the stay panel and search. A signed-in check on the hosted app has not been run yet. Also on `main` locally (not pushed): a driving estimate between two mapped destinations on the arrival and departure cards (`POST /journeys/intercity`; a starting location chosen from the map search also gets estimates for the first and last journeys). See [the intercity note](../intercity-estimate-learning.md). A journey the traveler booked elsewhere can be recorded (departure, arrival, reference) with day-view flags for clashing activities: see [the booking note](../transfer-bookings-learning.md). A booked stay can record the nights it covers, is flagged when the plan's nights stop matching, shows dates from the trip's exact dates, and the "Change nights between stays" preview warns before shortening it. The AI planner's day respects recorded arrivals and departures with the traveler's own buffers, and the chat's route summary lists recorded journeys. A destination can have several stays (each for its own nights, with the map, route checks, AI and chat following the stay for a night), a stay or a journey can be kept fixed so "Change nights between stays" refuses to move it, that preview warns about booked stays and journeys, and stays can carry a confirmation reference. The whole-trip view can download a calendar file (.ics). 645 backend and 258 frontend tests pass; none of this is pushed or deployed. See [the learning note](../lodging-learning.md). **Update, 20 November (all committed locally on `main`, none pushed or deployed):** a recorded stay now also feeds (1) a leave-by check to the day's first visit and an arrive-by check back from the last visit (`POST /journeys/from-stay` and `/journeys/to-stay`), with notes when check-in or check-out means the traveler may not be at the stay; (2) the AI day planner (the stay as plain evidence plus a straight-line distance to each candidate); (3) the chat's route and day answers; and (4) the fresh-start readiness check, where a searched stay is offered as "where I am" through a new optional `place_id` on the stay record. 582 backend and 209 frontend tests pass; each feature was run live and signed in on a QA trip that was restored to baseline; two code reviews found and fixed four defects. **Not verified:** the hosted app, any screenshot, whether the AI prefers nearer places, and a full readiness check started from the stay. Deploy order when approved: backend first (it must accept `place_id`), then frontend; no migration. See [the learning note](../lodging-learning.md).

## Itinerary map — 19 November 2026 (live on the hosted app)

A day map and a whole-route map (MapLibre with Geoapify tiles, lazy loaded, with two-way selection with the timeline and a plain fallback) are on `main`. The owner added a separate browser key (`NEXT_PUBLIC_GEOAPIFY_MAP_KEY`) in Vercel and redeployed; the hosted map renders the basemap and was checked with screenshots, which led to a pin-color and duplicate-credit fix. Large trips and real touch gestures were not exercised. See [the learning note](../day-map-learning.md).

## Google replaced by Geoapify — 19 November 2026 (merged to main and deployed)

The change (merged to `main` as a fast-forward, `ee8f586`, with no PR) removes Google Places and Routes because the Google project had no billing. Journey estimates and opening hours now use Geoapify and OpenStreetMap data; hours are regular rules, labeled unverified. 528 backend and 183 frontend tests pass; live Geoapify checks of routes and of 12 San Francisco museums passed from the backend code. A signed-in browser run on a dedicated QA trip (local web and API against the hosted database) passed: hours check, journey check, and acceptance of a time change with fresh live hours and route checks, plus a 390 px overflow check. After deployment: CI on `main` passed; Render serves the new routes (`/place-checks/hours` present, `/google-places/*` gone, readiness 200 at schema `0025`, no migration needed); both Vercel projects reported success and the production frontend bundle contains the new hours call and no Google endpoint; unauthenticated requests get 401 and CORS allows the Vercel origin. A signed-in click-through of the hosted app later passed (hours check, journey check, and an add/remove write after the column drop). The remaining-day and day-delay live checks, drive routes and the live-acceptance panels at 390 px were then also run on the hosted app and passed; that run found the per-minute limit too low, now raised (40 a minute). See the learning note for the evidence. Not exercised: a six-visit acceptance and cold-start latency. The `google_place_id` field and column were later removed (code release, then migration `0026`, applied to the hosted database with no data loss). See [the learning note](../geoapify-checks-learning.md).

## Hosted release state — 19 November 2026

PR #5 merged into `main` as `94bf8bb`, and CI on `main` passed. Before the release, production was misaligned: Render was still running the 13 November commit `6a20c30`, whose readiness check requires migration `0019`, while the hosted database had been upgraded to `0024` during local feature work. That API was probably returning `503 DATABASE_NOT_READY` since 15 November (inferred from the hardcoded check; Render logs were not inspected).

- **Migration.** `make migrate-supabase` applied `0025_immutable_cost_items` to the hosted Supabase database with the owner's approval. `alembic current` showed head and `alembic check` found no drift; the helper reported browser API roles still have no table access.
- **Deployment.** The owner redeployed the Render service with `GOOGLE_MAPS_API_KEY` and `ROUTES_API_KEY` added. External checks: `/health/ready` returned 200 at `0025`, `/health/live` returned 200, the CORS preflight for `elsewhere-ui-review.vercel.app` was allowed, an unauthenticated `/trips` request returned 401, and OpenAPI lists 37 paths including day-delay proposals.
- **Signed-in production smoke test** (desktop-width preview browser and a 390px overflow check, dedicated QA trip `3812a381-7407-48dc-bb39-2b71c0c024f9`). Passed: trip list, create/save, live destination lookup, two saved activities, Geoapify nearby discovery, chat explanation, a Groq time-change proposal with correct before/after review, and discard leaving the draft unchanged. **Failed:** Google Maps matching returned "rejected this backend key" (Render logged HTTP 503 from the backend, mapped from Google 401/403). Initially attributed to Render's IPs; see the later correction below. Google Routes and venue-hours acceptance were not exercised live on Render.
- **Google correction (19 November, later).** Both keys already list Render's Singapore ranges (74.220.52.0/24, 74.220.60.0/24). The same failure occurs from an allowlisted local IP, and Google's Geocoding API answered "You must enable Billing on the Google Cloud Project". Root cause is project billing, not the IP allowlist. Places and Routes remain untested until billing is restored.
- **Remaining.** Restore billing on the Google Cloud project, then re-test Places and Routes on Render; the QA trip remains in the account (the app has no delete or rename); the Render free tier still sleeps and is not an always-on worker; the Render service's tracked branch was not re-confirmed after the owner's redeploy.

## Current verification update

19 November 2026. The latest `make check-local` run passed 488 backend tests and 185 frontend tests, plus lint, migration drift detection, type checking and the production build. The backend checks ran on disposable PostgreSQL.

- **Remaining-day recovery.** Signed-in browser testing accepted a revised visit after a rest break and a fresh Google walking-route check between two mapped locations. The QA trip was in planning mode. Automated tests cover route timing drift, stale context and protected commitments.
- **Optional venue hours.** Automated acceptance covers missing listings, mismatched dates or buffers, provider rejection, venue closure and successful verification using simulated provider results. The live browser reached listing selection, where Google Places returned HTTP 403. Live acceptance with venue hours enabled remains open.
- **Cost migration.** A populated local upgrade preserved legacy costs on accepted plans, including paid zero and unknown estimates. Migration 0025 protects accepted cost rows; a local rollback preserved all cost fields and reapplying restored the guard.
- **Restoration and payments.** The review requires consent before changing or removing recorded payments, including changes caused by inherited currency, saved conversion rates or per-person traveler counts. Signed-in desktop and phone checks covered the consent control. The newer conditions and stale review protection were verified in backend tests.
- **Release state.** On 19 November, the verified work was organized into separate backend, frontend, verification-tooling, hosting-configuration and documentation commits on `codex/planning-recovery-discovery` for publication. The full local check was rerun successfully before committing. This publication does not certify the hosted app or apply database migrations; the browser evidence and QA itinerary restorations remain documented in the journal.

See the [development journal](journal.md) and [remaining-day learning notes](../tired-traveler-learning.md) for details.

## 12 November snapshot

| Section | Working locally | Remaining boundary |
| --- | --- | --- |
| Landing | Approved Fieldtrip meadow/postcard/Alpine composition and responsive layouts | Locked; later product work preserves it |
| Trip creation | Unfolding, multiple/repeated destinations, flexible/long duration, preferences, review | Live destination lookup retains selected label, timezone, coordinates and source snapshot; explicit activity research is implemented; AI place grounding is implemented; availability remains unconnected |
| Identity | Supabase SDK/SSR, backend JWT verification and owned application records | Owner disabled email confirmation; recovery delivery/production SMTP remain separate checks |
| Database | Application schema in Supabase-hosted PostgreSQL through FastAPI/SQLAlchemy; browser table grants revoked | Production operational setup, retention/deletion and migration procedures need further work |
| Saving/library | Serial coalesced account autosave, local backup, list/reopen and stale-write feedback | Title/schedule writes are separate; reconcile partial failures explicitly |
| Manual workspace | Editable activities, locks, completion/undo, day-wide overlaps, reported-hours coverage and walking/driving gap checks | Interactive map, intercity/transit schedules and comprehensive feasibility remain |
| Proposals | Frozen candidates, protected acceptance/discard, restoration, pending review recovery and optional live guard for requested time changes | Live guards for other operations, item-level recovery and asynchronous revalidation remain |
| Jobs | PostgreSQL leases, fencing, cancellation, retries, progress and bounded admission | Node checkpoints, production hosting, daily quotas and multi-process operational testing remain |
| Groq agent | Real one-day LangGraph generation with scoped tools, strict output, retained mapped places and reasons | Full-trip generation, richer ranking and downstream/weather/delay/fatigue replanning remain |
| Conversation | Persistent private messages, selected facts, clarification, additions and single-activity time-change proposals, responsive chat and stage-driven progress | Richer reasoning retrieval, long-term summaries and streaming remain |

## Verification evidence

The current local implementation was checked with 230 backend tests, 53 frontend regression tests, Ruff, TypeScript and a production frontend build. Browser checks covered desktop and phone layouts, account save/reload, proposal acceptance, live Groq generation, persistent conversation, clarification and one requested rest-break proposal. Historical notes retain the smaller test counts observed at those earlier milestones; they are not additional independent proof of today's state.

Tests use transactional rollback and mock providers for repeatable automated checks. Separately observed live Groq calls and signed-in browser runs are documented in their implementation notes. The traveler's original trip was not used as disposable test data.

## Deployment status

Historical note (12 November): GitHub main then included merged PR #2 (`5e249c6`), with later work on `codex/planning-recovery-discovery`. That work has since merged through PRs #3 and #5; see "Hosted release state — 19 November 2026" above for the current deployment and verification state.

## CI correction after publication

GitHub Actions exposed an environment-dependent assertion in `test_auth_is_closed`: a configured developer machine returned 401 for an invented token, whereas clean CI correctly returned 503 when Supabase was unconfigured. The test now explicitly covers configured/unconfigured authentication with and without credentials. Runtime authentication behavior is unchanged; CI needs no Supabase credentials. Rechecked fresh PostgreSQL 17 migrations, Alembic drift detection and all 58 backend tests with `SUPABASE_URL` empty, plus 13 frontend tests, TypeScript and the production build.

## Conversational edit slice

Single-activity local start-time proposals now use explicit review and the existing ownership/staleness protections. See [implementation and verification](../conversational-edits.md). Backend suite: 70 tests. No new provider credentials, database migration or deployment.

## 11 November: cross-day moves

Chat can propose moving one unprotected activity from the selected day to another day within the same destination stay, with both days/times shown in review. Target-day conflicts block the proposal. See [conversational edits](../conversational-edits.md). 76 backend tests and frontend checks pass. No migration, new key or deployment.

## 11 November: duration editing

Chat now supports an exact duration change for one unprotected activity, with before/after minutes and unchanged start time in review. Full-plan conflicts block it. Automated checks pass with 87 backend tests and 13 frontend tests, Ruff, TypeScript and build. See [conversational edits](../conversational-edits.md). No migration, new key or deployment.

## 11 November: reviewed removal

Chat can propose removing one named unprotected activity from the selected day, with explicit item review and acceptance. No supplier reservation is cancelled. Immutable snapshots remain; user-facing restoration is still outstanding. 96 backend tests and 13 frontend tests, Ruff, TypeScript and build pass. See [conversational edits](../conversational-edits.md).

## 11 November: accepted history and restore

Accepted snapshots are now listed and can be restored through a reviewed new proposal, including complete supported plan settings. Protected current records and their date/destination context cannot be silently rewound. History recovery does not revalidate reservations or providers. 106 backend tests, 13 frontend tests, TypeScript, build and Alembic drift checks pass. See [plan history](../plan-history.md).

## 11 November: first live discovery adapter

Explicit destination lookup now uses Open-Meteo/GeoNames, with user selection, timezone fill, attribution/cache timestamps and manual fallback. Stop coordinate/provenance persistence and live AI activity evidence are not connected. 119 backend tests, 17 frontend tests, Ruff, TypeScript and build pass. See [destination search](../destination-search.md).

## CI correction: activity identity versus SQL row order

PR #2 failed two scoped-edit tests in GitHub Actions while local tests had passed. Publication validators compared complete PlanInput lists directly, although PostgreSQL does not promise activity row order without ORDER BY. Equivalent activity records could therefore be rejected as an unauthorized edit. Activity ordering is now normalized by stable logical ID only for comparison; destination order and every typed field remain exact, and duplicate activity IDs fail comparison. Move/resize/removal and restore-source verification share this rule. API assertions identify records by logical ID rather than array position.

Four regression cases deliberately reverse record order and retain rejection of changed fields, duplicates and route reordering. All 123 backend tests pass on Python 3.12 and the CI-matching Python 3.14.4 against PostgreSQL 17. The 17 frontend tests, Ruff, TypeScript and build pass. The separate Supabase Preview check reports that per-PR database preview branches are disabled; it is skipped, not the failing test job. That integration setting was not changed.

## 11 November: retained destination references

Selected Open-Meteo/GeoNames locations now retain an immutable server snapshot and nullable stop reference through saves, command reconstruction, accepted snapshots and reviewed restoration. Manual and historical stops remain valid without inferred coordinates. Migration `0017_place_references` is additive and applied to the existing Supabase database; browser table grants remain revoked. No new key, service, deployment or agent activity provider was introduced. See [destination search](../destination-search.md). Automated verification: 129 backend tests, 18 frontend tests, Ruff, TypeScript, production build and Alembic drift check.

Signed-in browser verification confirmed a real lookup, account autosave/reload, retained source/coordinates, route reorder, keyboard disclosure and mobile summary access at 1440px, 390px and 320px. Temporary QA stop removed; original QA route saved. Readiness confirms connected Supabase at `0017_place_references`. Python 3.12 and CI-matching 3.14.4 suites pass. [Screenshots and limitations](../destination-search.md). This slice has not been pushed or deployed.

## 11 November: activity research and retained sources

Explicit OSM/Overpass research and an editor handoff now use retained destination coordinates, with no silent itinerary changes or invented availability. Activity source IDs survive account writes/readback, command reconstruction, proposals, acceptance and restoration; manual activities remain valid. Migration `0018_activity_places` is applied to the existing Supabase database. Search is disabled by default and enabled only in ignored local settings. Public Overpass returned 502/timeouts during live checks, so successful live results are not verified. Controlled-provider tests cover the complete persistence path. 144 backend tests (Python 3.12/3.14.4), 23 frontend tests, Ruff, TypeScript, build and schema drift checks pass. See [scope and provider boundary](../activity-discovery.md). Groq still uses its labeled sample catalog. No push or deployment.

## Hosted discovery and grounded Groq: live verified

The owner configured `GEOAPIFY_API_KEY` server-side. Auto provider selection now uses Geoapify without retrying failing Overpass instances. Live browser search returned eleven Jaipur museums; a selected Albert Hall Museum entry survived account save/reload with attribution, then was removed as QA cleanup. Real Groq chat produced one mapped Albert Hall Museum proposal at 12:15 while preserving the 11:00 old-city activity. Review exposed the authoritative source and estimated timing; the QA proposal was discarded without applying it. Desktop/390px/320px layouts passed. New frontend requests explicitly use real-place mode; legacy jobs remain labeled samples. 155 backend / 23 frontend tests and Ruff/type/build/schema checks pass. [Evidence and limitations](../activity-discovery.md). No new migration, push or deployment. Public Overpass is still inaccessible here; the configured hosted path is working.

## Google Places reported-hours checks

An authenticated on-demand editor panel now confirms the Google listing and compares a full visit with dated current hours, exposing closure/unknown/outside-coverage outcomes and available price information without treating it as admission inventory. Only the selected Google ID persists through saving and snapshots; fetched details are not stored or sent to Groq. `0019_google_place_ids` is applied to Supabase. Live Google key, matching and a 12 November 14:00–15:00 hours check were browser-verified; save/reload and 1440px/390px/320px layouts passed. A native date-input issue was corrected. A separate discovery outage now has explicitly labeled recent retained-geography fallback. 179 backend / 27 frontend tests, Ruff/type/build/schema and CI-matching Python checks pass. Routes and aggregate feasibility remain pending. [Guide and boundaries](../google-place-checks.md). No push/deployment.

## Journey estimates between consecutive activities

The day workspace now compares an explicitly selected walking/driving route estimate and arrival buffer with the actual gap between two mapped activities. Missing map locations remain unknown; mode/time/buffer changes invalidate transient results. The backend uses the separately configured `ROUTES_API_KEY`, with shared Google transport quotas and no Google payload persistence or AI ingestion. Live walking/driving results and shortfalls were browser-verified. No schedule mutation or reservation. 199 backend / 28 frontend tests, Ruff/type/build pass. Aggregate feasibility and intercity/transit remain pending. [Scope and verification](../journey-checks.md). No migration, push or deployment.

## Day-wide timing review

The existing journey section now retains per-pair checks and summarizes all day overlaps, journey shortfalls, missing locations and provider warnings. Nested/nonconsecutive overlaps are included. Explicit edit handoffs keep schedule control with the traveler, and relevant edits invalidate transient checks. Opening the overview makes no provider calls; each pair remains an explicit request. Hours/access/intercity/availability remain separate unknowns. Six new regression tests bring the frontend suite to 34; type/build checks pass. Backend contracts are unchanged from the 199-test journey slice. [Scope and verification](../day-feasibility.md). No push or deployment.

## Reported opening hours across the day

The combined day review now tracks reported-hours coverage per venue alongside journey/overlap checks. Exact trips use their provisional date; flexible trips choose a check-only date. Confirmed Google listing checks remain explicit and transient. Closed/outside-hours results are conflicts; missing/far-future hours stay unknown. Generic breaks are excluded, while sourced meals remain venue visits. Five regression cases bring the frontend suite to 39; type/build checks pass. Backend unchanged from the 199-test baseline. [Boundaries and verification](../day-opening-hours.md). No migration, key, push or deployment.

## Review a shortfall adjustment

A checked journey shortfall can now suggest one later start for the next unprotected activity, with before/after times and an explicit existing-editor handoff. Fixed/booked/completed targets, overlaps, order changes, midnight and stale evidence block suggestions; nothing cascades or saves automatically. Hours at the new time and onward travel require fresh checks. Six regressions bring the frontend suite to 45; type/build pass. Backend unchanged from the 199-test baseline. [Scope and verification](../timing-adjustments.md). No key, migration, push or deployment.

## Validate a suggested time before saving

Adjustment previews now offer explicit proposed-visit hours and onward-route checks, separate from current-day evidence. Missing/far-future data stays unknown; onward shortfalls and venue closure prevent a fitting verdict. Listing/date choices remain temporary, and the editor Save boundary is unchanged. Five regressions bring the frontend suite to 50; type/build pass. No new backend contract, migration, key, push or deployment. [Scope and verification](../adjustment-preview-checks.md). Durable server proposal validation remains outstanding.

## Saved proposal boundary for suggested time changes

Signed-in saved drafts can prepare one deterministic time-change proposal with ETag/idempotency fences and before/after review. Acceptance rebuilds the command against the unchanged draft and rejects protected targets or any candidate changes beyond the named start time. Discard leaves the draft unchanged; accepted changes enter history and the editable draft. Provider preview data is neither stored nor revalidated at acceptance. 210 backend / 51 frontend tests, Ruff/type/build and CI-matching Python pass. [Contract and limitations](../saved-time-change-proposals.md). No migration, key, push or deployment.

## Optional live acceptance guard

Saved requested-move proposals can explicitly recheck venue hours and both adjacent routes before acceptance. Candidate-derived scope/times, exact-date validation, protected/stale/candidate fences and existing acknowledgments remain. Provider errors, unknown hours, missing locations, route warnings or shortfalls keep the proposal pending. Provisional acceptance remains an explicit separate choice. No provider facts/verified flags are stored. 225 backend / 52 frontend tests, Ruff/type/build and CI Python checks pass. [Scope and operational tradeoffs](../live-time-change-acceptance.md). No migration, key, push or deployment.

## 12 November: recover pending reviews

Review plan now lists the current trip's pending saved proposals with explicit paging and a current-draft review action. Pending reviews survive reload; accepted/discarded entries are filtered out. Draft/base-version changes mark reviews stale, and resumed stale reviews cannot be accepted in the UI or server. Live choices are fresh on resume; no provider facts are restored. 230 backend / 53 frontend tests, Ruff/type/build and CI Python pass. [Contract and verification](../pending-reviews.md). No migration, key, push or deployment.
