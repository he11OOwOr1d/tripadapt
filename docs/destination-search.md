# Live destination lookup

11 November 2026. **Places to follow** now offers explicit **Search places** alongside manual destination/timezone entry. Enter a place (optionally its country/region), press Search or Enter, inspect the matching labels/timezones, then choose a result. Selection fills the name and IANA timezone; Add to route remains an explicit separate action. Existing destinations, repeated visits, duration and route order are untouched by a lookup. Editing the destination clears the previous timezone; adding a place clears both entry fields so a previous timezone is not silently reused.

## Provider and honesty

The backend uses the [Open-Meteo Geocoding API](https://open-meteo.com/en/docs/geocoding-api), based on GeoNames, for local non-commercial evaluation. [Open-Meteo pricing/usage](https://open-meteo.com/en/pricing) distinguishes evaluation from commercial API use; commercial deployment requires the appropriate provider arrangement. No API key or new database is required for this prototype. Result UI links both Open-Meteo and GeoNames and shows retrieval time plus cached/live status. Results can include named landmarks as well as cities; the traveler must choose the intended place.

This is location lookup, not a destination recommendation, hotel/transport offer, opening-hours check or reservation. No result is automatically selected. The AI activity planner **still uses its explicitly labeled sample catalog**. Lookup records are not silently passed to Groq as researched activity evidence.

The current stop contract stores the chosen label and timezone. Provider coordinates/ID are returned for disambiguation/future integration but are not persisted to destination stops in this slice. Complete geocoded-reference/provenance persistence, origin lookup, destination-based live activity evidence and weather/routing integration remain next work. Do not claim these are connected.

## API and boundaries

`GET /api/v1/destinations/search?q=...` implements the destination-discovery contract's initial subset. Public/guest use needs no session, and the web adapter sends no account credentials. It returns an Envelope containing results (ID, label, name, region, country, IANA timezone, coordinates), source, retrieved_at and cached status. Search text is 2–100 characters; whitespace is normalized and control characters rejected. Results are capped at eight, deduplicated by ID and validated. Bad/missing timezone or nonfinite/out-of-range coordinates cannot become choices. Manual labels may still be up to the existing 300-character stop limit.

`PLACE_SEARCH_ENABLED=false` by default in the backend. The ignored local backend .env enables it for verification; the web reuses NEXT_PUBLIC_API_BASE_URL. There is no new public key. Disabled, invalid, busy, rate-limited and unavailable states use explicit 422/429/503 responses. Errors and successes are private/no-store. The existing HTTP error handler now preserves declared headers, including Retry-After.

The adapter uses a fixed HTTPS provider URL, URL-encoded query, verified TLS with certifi, a five-second upstream timeout and a 64 KiB body cap. It has four concurrent outbound slots, thirty outbound attempts/minute/process and a 200-query, 24-hour in-memory cache. Failed requests are not cached. Cached results retain their original retrieval time. Restart loses the cache; production shared quotas/caching and abuse protection remain operational work. No raw upstream error bodies reach the UI.

The browser waits at most eight seconds for lookup transport. Query edits/unmounts cancel requests and suppress stale responses; selection clears results even when the result label equals the query. Searches are user-triggered, not per-keystroke autocomplete. Empty results and network/disabled/provider failures keep manual entry available. Only explicit selection can fill timezone, and only Add to route changes trip state.

## Verification

119 backend tests, 17 frontend regression tests, Ruff, TypeScript and production build pass. Tests cover cache isolation/expiry/bounds, concurrency/rate admission, malformed evidence, guest access, disabled/invalid/error states, Retry-After, TLS/body/timeout settings, encoded fixed-host requests, missing configuration, credential-free frontend requests and fallback messages. Provider calls are faked in automated tests; live lookup is verified separately. No deployment was performed.

Browser evidence: live provider lookup returned Kyoto matches, with the city explicitly chosen as Kyoto, Japan / Asia/Tokyo. Search worked using Enter, selection moved focus to timezone, and a matching label correctly closed the result list after refinement. Add to route, forward/back navigation, account autosave and reload retained the chosen label/timezone. Live no-match lookup showed manual guidance; missing-timezone validation still worked. At 320px, document width was 305px. The temporary Kyoto stop was removed from the synthetic QA draft afterward; the personal trip and accepted snapshots were untouched. Desktop/phone captures are in `docs/references/destination-search/`.
