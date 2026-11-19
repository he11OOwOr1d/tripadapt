# Learning: establish weather evidence before weather-driven replanning

14 November 2026. The day workspace now includes an explicit, read-only weather check for the selected destination and local date. This starts the weather branch of PRD FR-08 without letting a forecast silently change the itinerary. The locked landing is untouched.

## Decisions and tradeoffs

- Use the existing destination reference to resolve coordinates and timezone on the server. No device location, account details, itinerary labels or private trip contents are sent upstream. The provider receives public destination coordinates, timezone and allowlisted daily variables.
- Use Open-Meteo's forecast endpoint for this local prototype. Its [official forecast documentation](https://open-meteo.com/en/docs) supports up to 16 forecast days and requires a timezone for daily aggregates. A production commercial deployment needs the provider's applicable plan and terms reviewed; this slice adds no key or deployment configuration.
- Keep an explicit check button rather than introducing background polling. Exact trips use the selected day's provisional date, including the existing route/overnight calculation. Flexible trips request a check-only date and never assume today. The weather date does not modify trip dates.
- Distinguish the nominal forecast window, actual returned date bounds, partial fields and no usable data. Missing dates and dates outside the window return descriptive states without provider calls. A distant or historical date never receives a fabricated forecast. The forecast horizon is not a trip-length limit.
- Validate units, finite numeric ranges, array alignment, unique dates, temperature ordering, timezone offsets and a bounded weather-grid distance from the destination. Keep zero precipitation distinct from unknown precipitation. Unknown WMO conditions are not treated as clear weather.
- Cache normalized forecasts in bounded process memory for 15 minutes, with a 128-entry cap, two concurrent calls and per-process request limits. Responses are private/no-store and show original retrieval time plus a cached label. There is no database migration, trip persistence, model ingestion or stale-data fallback on provider failure. Shared/distributed quotas remain production work.
- Place the panel beside the existing timing review, collapsed by default. Daily condition, temperature range, precipitation total and maximum precipitation probability remain separate from activity-hour forecasts, venue opening hours, official warnings and feasibility verdicts.

The endpoint implements the existing planned public, limited `GET /weather` contract with a destination reference and optional local date. The data adapter owns request/response validation, cancellation and timeouts. The UI owns only transient date/result state. Day/destination changes clear prior results and cancel outstanding reads.

## Verification

290 backend tests pass on Python 3.12 and CI-matching 3.14. New coverage includes zero versus missing evidence, unknown/partial coverage, timezone date boundaries, malformed units/arrays/numbers, distant grid or timezone mismatch, cache expiry/copy isolation, quota/concurrency bounds, public reference validation, no-store responses, explicit outage/rate-limit problems and bounded TLS transport. Ruff passes; OpenAPI is regenerated as a code contract.

All 78 frontend tests, TypeScript and production build pass. New cases verify source/date-only public transport, null flexible dates, unknown conditions, malformed/conflicting evidence rejection, zero values and outage handling without substituting a forecast.

Live browser QA on the existing trip verified: an undated flexible check asks for a date; 1 January 2027 remains outside coverage; an explicit 14 November 2026 check retrieves a real Jaipur daily forecast; Refresh displays the cached result with the original retrieval time. Desktop and 390-pixel phone layouts were inspected. Changing to another day clears the date and forecast; Udaipur's missing map reference gives an explanatory empty state with no check button. Returning to Jaipur day 3 and reloading preserved the original activity titles, timing and unmapped activity state. No trip, proposal or accepted version was modified.

Screenshots: `/tmp/elsewhere-day-weather-desktop.png` and `/tmp/elsewhere-day-weather-phone.png`.

## Remaining scope

Weather evidence is not yet an agent tool or a proposal trigger. Comparing weather with explicit outdoor/indoor preferences, asking for current readiness/location, generating alternatives and validating them through the saved proposal boundary are next. Hourly forecasts, official alerts and background monitoring are outside this slice. The earlier successful live Google multi-visit acceptance gap is unchanged.

Only learning documentation updated. PRD, architecture, API-design and database-design documents remain unchanged. No push or deployment.
