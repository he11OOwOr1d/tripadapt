# Google Places checks in the activity editor

11 November 2026. This implements on-demand matching, reported opening-hours checks and available price information through Places API (New). It does not replace Geoapify/OSM discovery or feed Google details to Groq. Google Routes, admission-ticket inventory and automatic whole-trip feasibility remain separate work.

## Journey

Choose a sourced activity and open **Check with Google Maps** in its editor. Match search uses the retained public place name and coordinates, not the trip title, traveler identity or conversation. Up to three Google matches are shown; the traveler confirms the listing. A location-bias result more than 1 km from the retained place is excluded. A selected detail listing is checked against the same boundary again.

The planned start/duration come from the activity. Exact trip dates supply a read-only visit date. Flexible trips can choose a date for the check; this does not change their trip dates. Date entry is captured from the visible date input when requesting the check, including native date-control/autofill changes. Changing the check date, source, time or duration invalidates the previous result, and in-flight/stale responses are cancelled or ignored. No request runs on render or typing; refreshing is explicit.

Reported current hours, regular hours when current ones are missing, business closure status, retrieval time, available price level/range and Google Maps attribution are displayed in a separate visual section. Source links go to Google Maps. A reported price level/range is **not** a confirmed admission fee or ticket quote; missing data stays “Not provided” and is not added to the trip budget. Neither matching, checking nor saving reserves anything.

## Hours behavior

The deterministic check compares the **entire** visit against dated current periods in the retained destination's IANA timezone. It handles split periods, adjacent periods, closing boundaries and overnight openings. Ambiguous/nonexistent clock-change times return an unknown result rather than assuming a fit. Reported temporary/permanent closure is surfaced even without a visit date.

Statuses: `date_needed`, `outside_coverage`, `reported_closed`, `hours_unknown`, `fits_reported_hours`, `outside_reported_hours`. “Fits reported hours” is a comparison with provider information, not guaranteed future access. Current opening hours cover the local current date plus six days. A date outside that window gets an explicit “check nearer your visit” result; regular hours are only indicative. This does **not** impose a seven-day limit on trips or prevent long/flexible planning.

The check is an editor aid, not an acceptance prerequisite or a stored “verified trip” badge. It does not resolve untimed transfers, venue access or ticket availability. Existing provisional-plan warnings remain accurate. User changes still use the current draft/proposal boundaries.

## API and storage

Authenticated endpoints, with `Cache-Control: private, no-store`:

- `POST /api/v1/google-places/matches`: `{source_place_id: UUID}`. Returns typed Google identifiers, display names, addresses and coordinates for explicit matching.
- `POST /api/v1/google-places/check`: `{source_place_id: UUID, google_place_id: string, visit_date: date|null, start: time, duration_minutes: 1..1440}`. Returns transient reported details and the deterministic verdict.

Both require a valid existing discovered-place reference. The backend resolves the source and timezone; arbitrary upstream URLs, field masks or query strings are never accepted. Google credentials are sent only in the server-side `X-Goog-Api-Key` header. Search uses a bounded field mask/page size, and details request only ID/name/address/location/status/hours/price/attribution fields. No photos/reviews/summaries are requested. Transport uses fixed HTTPS, verified TLS, an eight-second socket timeout and 128 KiB body cap; the frontend has a twelve-second deadline. Safe errors distinguish missing configuration, denied key/IP/billing/API access, missing listings, rate limits and temporary outage without exposing key-bearing data or upstream response bodies.

Per API process: two concurrent requests, six upstream attempts per rolling minute, 100 per rolling day and 30 per authenticated owner per rolling day. Failed attempts consume budget. No response cache or automatic retry. Durable/shared production quotas remain an operational requirement.

Migration `0019_google_place_ids` adds a nullable, format-checked `activity.google_place_id`. **Only the Google identifier** enters application records, browser draft backups, snapshots and restoration. Google names/addresses/hours/prices/details remain component memory; they are not copied into the permanent discovery JSON, job metadata or saved plan. The itinerary name continues to come from its independent existing source/user input. Reopening shows Refresh Google details, with no retained hours verdict or check date for flexible trips. Renaming the activity or changing its destination detaches the Google ID. Time/day/duration changes retain the ID but invalidate fetched checks.

The existing Groq prompt excludes the Google ID and receives no Google check payload. Geoapify/OSM evidence continues to ground the agent. This avoids treating ordinary Places API content as unrestricted permanent or model-grounding data. Apply with `make migrate-supabase` (or the local/disposable migration path); application table grants remain revoked from browser roles.

Configuration: backend-only `GOOGLE_MAPS_API_KEY`, restricted to Places API (New) and the backend's public outbound IP. No `NEXT_PUBLIC_` Google key. The key is present in the ignored local backend environment and was verified live. The later [journey-check slice](journey-checks.md) supports a separate Routes key; this Places panel still uses the Places key. Deployment needs its own credential/IP arrangement; no deployment was performed.

## Verification

179 backend tests and 27 frontend tests pass, plus Ruff, TypeScript, production build, Alembic drift checks and CI-matching Python 3.14.4 tests. Checks include whole-visit hours/date/timezone/closure/split/overnight/DST handling, missing prices, header-only credentials, authenticated cost boundaries, safe failures, location mismatch, persisted ID without details, proposal preservation and input mapping. Existing original tests remain covered.

Live Google search and detail requests succeeded. The signed-in browser confirmed the matching listing, 12 November 2026 14:00–15:00 visit fitting reported hours, visible Google Maps attribution, and “Not provided” for missing price information. Saving/reloading retained the identifier but not the fetched result; reopening required an explicit refresh. Desktop 1440px, phone 390px and narrow 320px layouts were checked; the active 320px dialog had equal client/scroll widths. A native date-input issue was found and corrected during browser verification.

The dedicated QA trip was used; the temporary museum entry was removed and its original schedule retained. Local verification screenshots are at `/tmp/elsewhere-google-checks/desktop.png` and `/tmp/elsewhere-google-checks/phone.png`; they are not committed provider-response fixtures. Google API payloads are not stored in repository test fixtures. Database readiness confirms connected at `0019_google_place_ids`.

## Discovery outage behavior

An independent Geoapify refresh failed during verification. Destination/category discovery can now return its newest retained batch only when no older than 24 hours, with the original timestamp, cached status and an explicit live-refresh-unavailable notice. An absent or expired batch still fails normally; rate-limit errors are not converted into fallback success. A subsequent live refresh succeeded. This is for retained Geoapify/OSM geography only; it does not cache or substitute Google hours. Automated tests cover the explicit retained-result path.

## References and remaining work

[Places field definitions](https://developers.google.com/maps/documentation/places/web-service/data-fields), [current/regular hours](https://developers.google.com/maps/documentation/places/web-service/reference/rest/v1/places), [Places storage and attribution policy](https://developers.google.com/maps/documentation/places/web-service/policies), [server key restrictions](https://developers.google.com/maps/api-security-best-practices), [service-specific terms](https://cloud.google.com/maps-platform/terms/maps-service-terms).

Later implemented: [same-destination walking/driving estimates and buffers](journey-checks.md). Remaining: intercity/transit estimates, ticket/admission suppliers, aggregate itinerary feasibility, operational quotas, production credential/hosting setup and required public policy pages before launch. There is no claim of a live routing or reservation integration in this slice.
