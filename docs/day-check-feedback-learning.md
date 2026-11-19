# Learning: explain the first blocked day check

13 November 2026. Day-delay acceptance failures now carry safe context identifying the failed visit or connecting journey. The existing review displays its saved name, a specific explanation and a next step. Before any provider request, the live-check form lists activities missing map locations, including a preceding activity needed for the incoming edge.

## Decisions and tradeoffs

- Use a typed problem extension containing activity IDs, visit/journey kind and an allowlisted reason. Resolve names and candidate times from the owned proposal in the UI. Never display arbitrary provider prose, warnings, URLs or payloads as failure details.
- Distinguish closed, outside reported hours, outside date coverage, unknown hours, listing mismatch, route shortfall, route warning, missing location and provider failure. Preserve existing safe service messages separately for setup/rate-limit troubleshooting.
- Stop at the first problem. Explain that later visits and journeys may not have been checked. A failure does not become a claim about the entire day, and a previously fitting visit is not promoted to durable verified evidence.
- Keep diagnostics transient in the current review. Changing live-check choices clears old feedback; another acceptance attempt runs fresh checks. No diagnostics or provider facts enter snapshots, model input or local storage.
- Retain pending-review recovery, explicit provisional opt-out, idempotency, ownership and stale-draft fences. A failed check applies nothing. Error focus moves to the feedback so keyboard users can find it.

The location guidance uses the actual supported flow: choose mapped replacements through Explore nearby places, then prepare a fresh review. The current activity editor cannot attach an arbitrary map location to an existing manual item. Direct map attachment and an edit-and-return handoff remain future UX work.

## Verification

262 backend tests pass on Python 3.12 and CI-matching 3.14. Tests cover the first versus second failed visit, precise connecting edge, each hours classification, sanitized route-warning/provider failures, Retry-After preservation, problem serialization, no-store responses, pending recovery and absence of persisted diagnostics. Existing authentication/scope/staleness checks remain covered. Ruff passes. All 62 frontend tests and production build pass, including adapter error transport, malformed-context rejection, foreign/non-adjacent IDs, named coverage and long-day check bounds. OpenAPI is regenerated as a code artifact.

Browser QA created one disposable day-3 delay review on the existing QA trip, starting with its second activity. The named missing-location list included the preceding culture visit and all four affected items at their candidate times. Even with all acknowledgments checked, live acceptance remained disabled. Desktop and 390-pixel phone layouts were inspected. The review was discarded, both dialogs closed and original timeline times confirmed unchanged; no activities were added or removed. Screenshots: `/tmp/elsewhere-day-feedback-desktop.png` and `/tmp/elsewhere-day-feedback-phone.png`.

Provider-failure diagnostic transport and descriptions are verified with controlled backend/frontend tests; they were not forced through the live Google browser workflow. A successful all-mapped live day acceptance is still unverified. Partial-result inspection, automatic alternatives, cross-day moves and weather/fatigue replanning remain separate work.

Only learning documentation changed. Core PRD, architecture, API-design and database-design documents remain untouched. No migration, push or deployment.

Follow-up: [existing-activity map links](activity-map-links-learning.md) now resolve the map-attachment gap without replacing activities. The initial-slice limitation above records the earlier behavior; a direct edit-and-return handoff remains open.
