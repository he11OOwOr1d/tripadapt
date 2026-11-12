# Activity discovery: first provider slice

11 November 2026. This adds explicit geographical research to the existing itinerary workspace. It does **not** replace Groq's sample catalog or claim verified opening hours, availability, prices, reviews or route times.

## Experience

Open **Explore nearby places** on a destination day. Manual destinations can gain a location by an explicit Open-Meteo/GeoNames search and selection inside the workspace; the same stop ID, nights and existing activities are retained. The confirmation shows the selected label/timezone and explains that existing local clock times remain unchanged. No location is silently inferred.

For a referenced destination, select museums, galleries, attractions, parks or viewpoints and press **Search nearby places**. No search runs on page load, day changes or typing. Results are a partial search around the selected destination centre, not exhaustive recommendations. Source attribution, retrieval/cache information, original map links and limitations are visible. **Set a time for this place** opens the existing activity editor; cancellation changes nothing. Its 60-minute starting duration is an estimate the traveler can change. Saving uses normal draft autosave, not a reservation or automatic proposal acceptance.

Changing an activity's name or destination in the editor detaches the source reference. Time/day/duration edits preserve it. The retained attribution is shown in the saved itinerary, editor and proposal/recovery review. Account writes submit only the opaque place ID; authoritative reads rehydrate the source snapshot. Guest backups retain the selected metadata.

## Provider choice and limits

OpenStreetMap data through Overpass is a no-key **local evaluation** choice. The PRD's Google/Tripadvisor candidates for richer ratings, reviews and commercial discovery remain candidates, not implemented integrations. No review text is processed by Groq. The [Overpass public-instance documentation](https://dev.overpass-api.de/overpass-doc/en/preface/commons.html) cautions against relying on shared public servers as a production application backend. Production needs dedicated/hosted capacity or a separately selected provider; this feature is disabled by default.

The adapter fixes the HTTPS host, uses verified TLS, an allowlisted category and server-resolved destination coordinates, a 5 km radius, six-second server query budget, eight-second transport timeout and 128 KiB response cap. At most 40 source records are parsed and 12 valid nearby results returned, sorted by straight-line proximity. Way/relation centres are representative coordinates, not entrances. The initial provider truncation means the set is not guaranteed to contain the nearest twelve overall. No distance is represented as walking time.

Per process: two concurrent requests, six outbound requests/minute, 300/day, 128 cached coordinate/category searches, 24-hour TTL. Cache reads retain retrieval time and do not consume provider quota. Failures/timeout remarks are not cached or converted into “nothing nearby”; wholly unusable responses fail explicitly. This is a conservative trial budget, not distributed production abuse control. No upstream retries or random endpoint failover.

Credit links identify [OpenStreetMap contributors and ODbL](https://www.openstreetmap.org/copyright). Retained snapshots contain only public place geography/name/category/source/time, not traveler identities, trip titles, dates, preferences or raw provider tags. Do not mix OSM data into a proprietary provider dataset without assessing the relevant terms.

## API and persistence

- `GET /api/v1/places/search?destination_reference_id=<UUID>&category=museum` is public and uses a retained destination snapshot. Supported categories are enumerated above. No browser coordinates, arbitrary URLs, free-form Overpass query, pagination or provider field masks are accepted in this subset.
- `GET /api/v1/places/{place_id}` returns the retained snapshot, **not** a fresh availability/detail check. Both responses use `Cache-Control: private, no-store`.
- Unknown destination/place references return 404; disabled search returns 503; malformed input returns 422; quota responses return 429 with Retry-After. Provider failures have safe codes and preserve the plan.
- `ActivityInput.place_id` is nullable. Sync resolves it on the server and requires the activity label and the stop's destination reference to match. Unknown, relabeled or cross-destination attachments return 422 `ACTIVITY_PLACE_MISMATCH` before schedule mutation. Clients cannot submit source coordinates or payloads as activity fields.
- Version/proposal views include a `place_details` map keyed by UUID. Command reconstruction, agent scope comparisons, immutable accepted versions and reviewed restoration preserve IDs.

Migration `0018_activity_places` adds `discovered_place` and nullable `activity.place_id`; it depends on `0017_place_references`. Snapshot UPDATE/DELETE is blocked by a trigger; PUBLIC/anon/authenticated table grants are revoked. Manual/legacy activities remain null. Apply with `make migrate-supabase` or the disposable/local migration path. No new database or credential is introduced. Retention/deletion policy is future operational work.

`ACTIVITY_SEARCH_ENABLED=false` is the checked-in default; the ignored local backend configuration enables the trial. No new frontend key or flag is required. The frontend continues to use `NEXT_PUBLIC_API_BASE_URL`. Neither provider nor model credentials enter the client.

Both destination and activity result retention now use batch insert/read instead of one round trip per result; retrieval timestamps and immutability semantics are unchanged.

## Verification and outstanding boundary

144 backend tests pass against disposable PostgreSQL 17 on Python 3.12 and CI-matching Python 3.14.4. They cover parsing, finite coordinates, centres/categories, radius/output limits, deduplication, caching/TTL/size/rate/concurrency, safe transport failures, public API boundaries, source readback, forged IDs/labels, immutable snapshots, saving, acceptance and reviewed restoration. 23 frontend regression tests cover opaque-ID writes, authoritative attribution readback, missing configuration, failure/cancellation and malformed result guards. Ruff, TypeScript, production build and Alembic drift checks pass.

The additive migration is applied to the existing Supabase database. Live Overpass attempts returned HTTP 502 or timed out in this session; successful provider results are **not** claimed as live verified. Successful search/save/recovery tests use controlled provider responses, not fabricated live recommendations. Real provider availability and a successful browser result-to-editor run remain a verification gap until service access recovers. AI grounding in these places, shortlists, richer place details, travel feasibility, ratings/reviews, weather and production capacity remain future slices.

Browser checks: the dedicated QA trip's existing Jaipur stop gained the explicitly selected “Jaipur, Rajasthan, India” reference; six stay nights and the existing “Explore the old city” activity on day 2 at 11:00–12:00 remained. Account autosave completed. Desktop/phone research controls, explicit search, keyboard Tab/Enter, category reset and unavailable-provider feedback were checked. No synthetic results were substituted into the browser. No personal trip was edited. Successful result-card/editor browser verification remains outstanding because Overpass did not return usable live results in this session.

Responsive checks covered 1440px desktop, 390px phone and 320px narrow phone; no horizontal overflow was observed. [Desktop failure-state screenshot](references/activity-discovery/desktop-unavailable.png), [phone failure-state screenshot](references/activity-discovery/phone-unavailable.png). Database readiness reports connected at `0018_activity_places`. No source push or deployment was performed.

## Hosted discovery and grounded Groq mode — supersedes the outage boundary above

Overpass probes continued to time out or return 406/502; reducing the query and testing documented instances did not establish a usable connection. Geoapify's host was reachable with an expected 401 before configuration. After the owner added the server-only `GEOAPIFY_API_KEY`, a real Jaipur museum search returned eleven records. `ACTIVITY_PLACES_PROVIDER=auto` selects Geoapify when configured and otherwise retains the explicit Overpass trial; `geoapify`/`overpass` can pin the choice. There is no cross-provider retry or quota-avoidance fallback. Hosted errors are normalized without logging the key-bearing URL or upstream body.

The hosted Places API uses fixed HTTPS, an allowlisted category, 5 km circle, proximity bias, twelve-result limit and the existing eight-second/128 KiB cap. Only public name/category/coordinates/provider ID are retained. `geoapify/<opaque-id>` is a separate external-ID namespace; original OSM references remain valid. Cards show Powered by Geoapify and OpenStreetMap/ODbL credit, plus a coordinate-based map link labeled View location rather than pretending the opaque Geoapify identifier is an OSM object ID. See [official API](https://apidocs.geoapify.com/docs/places/) and [pricing/usage](https://www.geoapify.com/pricing/).

New frontend day-generation and chat requests explicitly send `evidence: places`. The backend keeps `sample` as a backwards-compatible default for older clients/jobs and labels those reviews accordingly. Real-place requests never silently downgrade to samples: the worker resolves the selected stop, searches at most museum/park categories needed by the requested scope, retains up to twelve records and supplies their opaque IDs to Groq. Meal/rest/free-time blocks remain explicitly estimated local blocks. Missing location, disabled search, provider failure or no usable evidence fails visibly.

Groq receives a dynamic candidate-ID enum; unknown/invented IDs are rejected with one bounded repair. The server derives labels, source references and estimated durations from the retained catalog. Publication and acceptance reconstruct evidence from immutable database records, verify destination and a 24-hour retrieval window, and recheck add-only scope and times. No provider calls occur at acceptance; expired evidence requires a new proposal. Explicit acceptance is still required. History restoration continues to disclose that old source records have not been revalidated. No review text/photos or arbitrary tools are sent to Groq.

155 backend tests pass on Python 3.12 and CI-matching Python 3.14.4, including hosted normalization/key redaction, unknown or expired evidence, wrong destinations, no-sample fallback, and mapped job publication/acceptance. Existing 23 frontend tests pass; type/build checks pass. No additional migration beyond `0018_activity_places` is needed.

### Live end-to-end confirmation

The signed-in QA browser returned eleven live Jaipur museum records through Geoapify. Albert Hall Museum was added at a chosen 14:00 time, autosaved and reopened with its authoritative source/coordinates. The temporary entry was removed afterward, leaving the original schedule. A real Groq chat request then proposed exactly one Albert Hall Museum visit at 12:15 after the existing 11:00–12:00 old-city activity. Review displayed the actual Geoapify/OSM record, estimated duration, unchanged prior activities and required acknowledgments. The proposal was discarded after verification, not accepted into the QA trip.

Desktop 1440px and phone 390px/320px checks verified source/editor/review layouts without horizontal overflow. [Desktop grounded proposal](references/live-place-planning/desktop-groq-review.png), [phone grounded proposal](references/live-place-planning/phone-groq-review.png), [phone source editor](references/live-place-planning/phone-place-editor.png). This supersedes the earlier successful-live-verification gap. Public Overpass remains inaccessible from this network; the configured hosted adapter provides the working path. No deployment or source push.

The observed live job completed with `requested_evidence=places`, `result_evidence=mapped_places`, six retained candidate records, one proposed addition and Groq model `openai/gpt-oss-120b`. Its persisted proposal status is `discarded`, confirming QA cleanup. Old sample activities on other days were preserved as existing user data; none were newly generated by this mapped request.
