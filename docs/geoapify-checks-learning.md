# Opening-hours and route checks without Google

19 November 2026. This note records why the Google Places and Routes checks were replaced by Geoapify and OpenStreetMap data, what changed, and what we learned. It supersedes [Google Places checks](google-place-checks.md) and the Google parts of [journey estimates](journey-checks.md), which stay as history.

## Why

The Google Cloud project had no billing, so every Places and Routes call returned 403 (Google's Geocoding API said so explicitly). The owner is a student and chose not to enable billing. The checks were optional, so the app degraded to "unknown" rather than failing, but the live features were dead.

## What changed

- **Routes.** `/journeys/check` keeps its request and response. Estimates now come from Geoapify routing (walk, drive). Drive uses free-flow speeds, like the old traffic-unaware request. Geoapify has no route-warning field, so `warnings` is always empty.
- **Hours.** One new endpoint, `POST /place-checks/hours`, reads Geoapify place details for the place already retained from discovery. There is no listing-match step and no saved provider ID. The response is the regular opening hours that OpenStreetMap contributors list, labeled unverified.
- **Live acceptance and the remaining-day check** no longer take `google_place_id` or `listings`; each visit's place is derived from the plan. The client picks `live_check` or `day_live_check` with an explicit scope instead of inferring it from the body's shape.
- **Removed.** The Google endpoints, adapter, settings and the listing-picker components.
- **Removed in two safe releases.** First the API stopped accepting and returning `google_place_id` while the nullable column stayed mapped and unused (so the code worked with or without the column). Then migration `0026_drop_google_place_id` dropped the column and its check; it is reversible and was applied to the hosted database after confirming that none of 679 activity rows held a value.

## Decisions and tradeoffs

- **Use a library for OSM hours.** Live data showed real rules like `Tu-Sa 10:00-17:00; Jan 1 off; Nov Th[4] off; Dec 25 off` and `We-Su,PH 10:00-16:00`. A small hand-written parser would have returned "unknown" for about half the venues that have hours. `opening-hours-py` (MIT/Apache-2.0, stable-ABI wheels for Python 3.10+) evaluates them. Tradeoff: a compiled dependency.
- **Fail closed.** Public-holiday rules are only evaluated with a valid country code, because without one the library silently ignores them and answers wrongly. School-holiday rules, rules with comments, `unknown` states, empty or unparseable rules, and ambiguous or nonexistent clock times all return `hours_unknown`.
- **Honest wording.** Coverage is partial (8 of 12 sampled San Francisco museums had hours) and holidays or special closures may be missing, so every answer says it is unverified. A missing listing blocks "live" acceptance, which is an existing explicit, separate choice from provisional acceptance.
- **Shared budget.** Routes and hours share one per-process limit (40 a minute, 300 a day per user, 1,000 a day overall, 2 at once), inside Geoapify's free 3,000 credits a day, and the same key serves discovery. The first limits (6 a minute, 100 a day, 30 per user) were carried over from the Google adapter and were found too low in the hosted remaining-day check: a three-visit acceptance needs about 7 calls and a six-visit one about 13. The free plan needs no card; credit text is required and shown.
- **No price or closed-business data.** Geoapify has neither, so those fields and the "reported closed" status are gone; outside-hours is the only hours conflict.

## Lessons

- A generic "caller does not have permission" hides the real cause. Test a key from a known-good location before changing network rules (the earlier IP-allowlist theory was wrong).
- Verify third-party semantics against real data, not only the docs. A comma in an OSM rule adds an extra rule instead of limiting a date range, so "Fridays until 21:00" applies all year. My first test expected otherwise and the library was right.
- Removing a field from a strict API schema breaks any client that still sends it, so the column and field are dropped in a separate, later release.

## Verification

- **Automated.** 528 backend tests on disposable PostgreSQL (488 before) and 183 frontend tests, plus lint, TypeScript and the production build.
- **Live, against Geoapify, from the backend code.** Walk, drive, same-point and unroutable routes; hours for 12 San Francisco museums (for example a Wednesday visit fits Counterculture and is outside the Pioneer Museum's Thursday-to-Sunday hours); both place-ID lookup paths.
- **Live signed-in browser run (19 November, local web and API against the hosted database, before deployment).** On a new dedicated QA trip (`452b84e7-4ca4-4f1c-b3bd-9dbce366c2c9`): live destination lookup, Geoapify nearby discovery, two saved mapped activities, the hours check on the Museum of the African Diaspora ("Fits the regular hours" on a Wednesday, "Choose another time" on a Monday), the journey check (25 minutes walking, 1.7 km), a deliberate 25-minute shortfall with a suggested 11:35 start, and a saved proposal accepted **with fresh live hours and route checks**, which moved the activity to 11:35. The server log showed only 200 responses and no errors. At 390 px width the hours panel and journey result had no horizontal overflow. The device-only draft that was cleared for a blank form was restored byte for byte.
- **Not verified.** The hosted app before deployment; the live-acceptance panel's layout at phone width (the panel shares styles that were checked); the remaining-day and day-delay live checks, which use the same code but were covered by unit tests only; drive routes in the browser. The QA trip stays in the account (the app cannot delete trips) with the two activities and one accepted version.

## Remaining

Nothing for this change. The owner deleted the Google Cloud project and removed the keys from local, Render and Vercel settings.

## Hosted verification and the column drop (19 November, after deployment)

- **Hosted click-through.** Once the Vercel site was reachable, the signed-in production app ran the new hours check on the existing QA trip (Asian Art Museum at 10:00 on a Wednesday was "outside the regular opening hours", matching the museum's real 11:00 opening) and the journey check between two mapped activities (25 minutes walking, 1.7 km), with Geoapify credits shown. A temporary third activity was added and removed; the trip is back to its two original activities.
- **Column drop.** After the migration the hosted API reported schema `0026` and returned 200 on readiness, the QA trip loaded, a new activity was saved and removed (write and delete on the new schema) and a reload showed the original two. Because Render's readiness check requires an exact schema match, the migration was applied while the new build waited, so any window was seconds; no errors were observed.
- **Still untested in the browser:** the remaining-day and day-delay live checks, drive routes, and the live-acceptance panel at phone width.
