# Optional live rechecking at time-change acceptance

11 November 2026. This extends saved single-activity time-change proposals with an explicit provider guard at acceptance. Existing provisional acceptance remains compatible and clearly labeled.

## User choice and scope

In the saved review, **Recheck with Google Maps before accepting** opts into fresh checks. The traveler confirms the venue listing, a check-only date for flexible trips, a travel mode and arrival buffer. Exact trips show their server-derived provisional date. Missing dates, listing selection or mapped locations keep live acceptance disabled; backend/provider configuration failures stop the request. There is no silent fallback.

When requested, acceptance checks the proposed full visit against current reported hours and recomputes the incoming and outgoing adjacent journeys. Neighbors and times come from the frozen candidate, not client “verified” flags. All adjacent activities need mapped locations. Missing locations are rejected before paid provider requests. No imaginary accommodation leg is added for the first/last activity.

Unknown/out-of-coverage hours, reported closure, insufficient route time, any route warning or provider failure stops acceptance and keeps the proposal pending. The user may explicitly turn the option off and accept provisionally with the existing acknowledgments. A preview result never authorizes acceptance by itself. Tickets, accessibility, weather, live traffic, intercity travel and accommodation return travel remain outside this check.

## API and integrity

The existing accept body now optionally accepts `live_check: {google_place_id, visit_date, mode, buffer_minutes}`. It is supported only for server-created requested-move proposals. The server first verifies ownership, saved-draft/current-version fences, the complete command/candidate match and acknowledgments. Live calls occur immediately before acceptance inside the same locked transaction. Any failure rolls it back; no draft/current pointer changes occur.

Exact dates are derived from start date, prior stay nights, inbound overnight transfers and the selected local day. Supplying a different date cannot bypass far-future coverage. Flexible check dates do not change trip dates. Trip length is not capped by provider coverage.

The existing bounded Places/Routes transports, geographic listing validation, TLS, fixed hosts, field masks and process-local quotas remain. Fetched Google responses and derived verification flags are not saved or sent to Groq. Only the accept request fingerprint includes the selected check inputs for idempotent replay; accepted retry with the same request does not repeat provider calls. Provisional request fingerprints remain backward compatible. No new database fields, migration or credential.

Tradeoff: up to three synchronous provider operations while holding the trip lock, with each transport's existing socket timeout, versus accepting a draft that changed during checking. Production requires distributed admission/quotas and a stronger operational design for long provider calls. No automatic retries or endpoint rotation. A failed check can consume provider quota; subsequent attempts are explicit.

This is bounded revalidation for a single saved requested time change, not supplier guarantees or full-trip autonomous replanning. Other proposal operations retain their existing provisional acceptance boundary.

## Verification

Fifteen new backend cases cover candidate-time usage on both legs, unknown/conflicting hours, route shortfalls/warnings, missing locations, provider failure, exact-date mismatch, first/last activity handling, long stays/overnights, pending state after rejection, explicit provisional acceptance, idempotent successful retry and no persisted Google facts. Backend: 225 tests on Python 3.12 and CI-matching Python 3.14.4. Frontend: 52 tests, TypeScript and production build. Ruff passes; OpenAPI regenerated.

Browser QA uses temporary mapped museums in the existing test trip. The live option, listing selection and 12 November check date were verified. Google returned a route warning: acceptance stopped, the live option remained checked, and the 11:10 draft/proposal stayed unchanged. Explicitly unchecking the live option then accepting applied 11:40 provisionally, preserving duration/source identity. Desktop/390px/320px layouts passed. A successful guarded acceptance is verified with controlled providers; live Google route warnings can intentionally prevent it. QA draft entries are removed after testing; accepted QA snapshots remain in history. Screenshots stay local under `/tmp/elsewhere-live-acceptance-*.png`. No push or deployment.
