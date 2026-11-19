# Learning: live checks when accepting a day delay

13 November 2026. The saved day-delay review now offers an explicit Google Maps recheck before acceptance. Provisional acceptance remains available by deliberately leaving the option off; a failed live check never silently falls back.

## Decisions and tradeoffs

The backend derives the affected suffix and connecting edges from the frozen candidate's original command, rather than trusting a client-provided list of activities to validate. Every affected visit needs a selected matching Google listing. Hours are checked at candidate times; each connecting route is checked once, including the incoming edge from a preceding activity when present. Exact trip dates are derived on the server, including prior nights and inbound overnight travel; flexible trips use a check-only date.

Unknown hours, inadequate gaps, access warnings, unmapped locations and provider failures stop acceptance and preserve the pending proposal. Existing ownership, staleness and full-candidate reconstruction checks run first. Mixed or wrong-operation guards are rejected. Acceptance idempotency fingerprints include the day-check choices; replay after a successful commit avoids repeating paid requests.

One action supports up to six affected visits, bounding paid calls and synchronous waiting while the trip lock is held. This is a provider-check limit, not a destination, trip-duration or itinerary-size limit. Longer affected suffixes can remain pending or be accepted explicitly as provisional. Moving this work outside the transaction with a freshness/fencing protocol remains a future improvement.

No Google response facts are stored in the proposal or passed to the model. Listing/date/mode/buffer input is transient; only the existing request fingerprint is saved. No database migration or provider package is introduced. Google listing identity checks and route attribution retain their existing adapters. This remains evidence from reported hours and static routes, not a booking or guarantee. Tickets, weather, accessibility, live traffic and travel to an initial activity without a preceding item remain unconfirmed.

## Verification and limits

252 backend tests pass, including multi-visit hours, unique candidate-time route edges, unknown/conflict outcomes, missing/extra/malformed listing choices, exact-date mismatch, request bounds, provider-failure recovery, guard isolation and successful idempotent replay. All 55 frontend tests, TypeScript, production build and Ruff pass. Generated OpenAPI is refreshed as a code contract.

Browser QA on the existing two-stop QA trip created and discarded one day-3 delay review without accepting it or editing activities. All acknowledgments alone cannot enable live acceptance when mapped locations are missing. Turning the option off explicitly enables provisional acceptance. Keyboard focus and the 390-pixel phone layout were checked. Screenshots are `/tmp/elsewhere-day-live-desktop.png` and `/tmp/elsewhere-day-live-phone.png`.

Successful multi-visit provider behavior is verified with controlled responses, not a successful live Google browser acceptance. The existing sample day contains unmapped breaks/activities, so the browser correctly reports the missing coverage instead of inventing it. An all-mapped live success remains a verification gap. More actionable per-visit failure explanations and partial evidence inspection are future work.

Only learning documentation is updated; core PRD, architecture, API-design and database-design documents remain unchanged. No push or deployment.

Follow-up: [named failure feedback](day-check-feedback-learning.md) now identifies the first failed visit/journey and missing map locations. Partial-result inspection and successful all-mapped live browser acceptance remain outstanding.

Live rehearsal: [real-provider outcomes and date-input fix](live-day-verification-learning.md) verify actual hours checks, route-warning rejection and missing-match handling. Successful live acceptance remains unverified; no fallback or warning suppression was used.
