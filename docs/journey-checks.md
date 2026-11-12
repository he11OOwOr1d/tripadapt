# Journey estimates between activities

11 November 2026. The next provider slice adds an explicit **Time to get there** disclosure in the existing day itinerary. It follows retained place discovery and Google reported-hours checks. The approved landing and trip creation flow are unchanged.

## Traveler flow

Choose a consecutive pair of activities, walking or driving, and an arrival buffer (default ten minutes, adjustable from zero to 120). Both activities must have retained mapped places; manual names are never geocoded implicitly, and unmapped intermediate activities are not skipped. Empty days explain how to start. Only the selected pair triggers a request, avoiding a burst of paid calls when a day opens.

The view compares the gap from the first activity's end to the next one's start with rounded-up travel minutes plus the buffer. It shows spare time or a shortfall, including overlaps. Suggestions to change mode, move an activity or shorten it are guidance; no time is changed automatically. Each result covers one pair, not a verified whole day. Changing pair, mode, buffer, activity time/duration/location or day invalidates the result and cancels pending UI work. Reloading requires another explicit check.

Design: a quiet disclosure and left-hand result rule inside the existing paper/green planner, using its typography. Departure and arrival times remain together. Controls stack on phones, have visible focus and touch-sized targets, and introduce no animation.

## Contract and evidence boundary

Authenticated `POST /api/v1/journeys/check` accepts `origin_place_id`, `destination_place_id`, `mode` (`WALK` or `DRIVE`), `origin_start`, `origin_minutes`, `destination_start`, and `buffer_minutes`. Times are local same-day values without offsets. Both source records must belong to the same retained destination reference. Intercity journeys, public transit, cycling, live traffic and departure-date predictions are outside this slice. Flexible trips do not assume today's travel conditions or acquire artificial dates.

The server resolves public coordinates, calls the fixed Google Routes `computeRoutes` endpoint, and requests only duration, distance and warnings. Driving uses `TRAFFIC_UNAWARE`. Provider warnings and a walking-safety notice appear alongside Google Maps attribution. Missing or malformed routes fail explicitly; there is no zero-time or sample substitute. Durations round upward to the next minute before comparison. A result is an estimate, not proof of pedestrian access, parking, accessibility, venue entry, ticket availability or a reservation.

Google credentials stay in request headers on the backend. The existing bounded Google transport shares its two concurrent requests, six requests/minute, 100/day/process and 30/owner/day/process across Places and Routes; these are local safeguards, not distributed production quotas. Eight-second socket timeout, bounded response body, explicit field mask and no automatic retry remain. Responses use `private, no-store`. Google responses stay transient, outside database snapshots and Groq context. No schema migration is needed.

## Configuration

`ROUTES_API_KEY` optionally supplies a separate Routes-only key. Otherwise the backend uses `GOOGLE_MAPS_API_KEY`, which must permit both Places API (New) and Routes API. The owner's separate `ROUTES_API_KEY` is configured in the ignored backend environment and was verified with a successful live browser check after restarting the backend. Restrict each key to the appropriate API and backend outbound public IP; enable billing/API access in the same Cloud project. Restart the backend after environment changes. No browser Google key is introduced.

## Verification

Automated checks: 199 backend tests, 28 frontend tests, Ruff, TypeScript and production build. Route tests cover malformed/missing evidence, fractional rounding, enough/insufficient time, overlap, buffer arithmetic, unsupported modes, timezone rejection, authentication, missing records, cross-destination rejection, safe provider errors and key/host separation. Python 3.14 CI parity is also checked.

Browser checks use the existing disposable QA trip. Two temporary mapped activities (Amrapali and Albert Hall museums) test the live route: walking returned 30 minutes/2.1 km, driving 11 minutes/3.3 km. A ten-minute gap with ten-minute buffer showed shortfalls; a sixty-minute gap showed twenty minutes to spare walking. Mode/buffer/time changes removed old results. Google returned a restricted/private-road warning, displayed in the UI. Desktop and 390px/320px phone layouts, empty/missing-location guidance and input validation are checked. Temporary activities are removed afterward. Screenshots containing transient Google content remain local under `/tmp/elsewhere-journey-*.png`, outside source control.

Later implemented: [day-wide timing coverage](day-feasibility.md). Remaining: full-day reported-hours feasibility, proposal-aware route validation, intercity/transit schedules, traffic/date-specific checks, weather and ticket suppliers, shared operational quotas and production hosting. No push or deployment.

References: [Google Routes request contract](https://developers.google.com/maps/documentation/routes/reference/rest/v2/TopLevel/computeRoutes), [traffic-unaware estimates](https://developers.google.com/maps/documentation/routes/config_trade_offs), [key restrictions](https://developers.google.com/maps/api-security-best-practices).
