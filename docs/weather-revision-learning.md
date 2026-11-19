# A reviewed weather-related removal

14 November 2026

## What changed

The weather panel now opens a real immutable proposal directly instead of preparing a chat message. Choose one flexible activity, preview the forecast context and proposed removal, then accept or discard. The original plan remains unchanged until acceptance. The proposal is recoverable through saved reviews and acceptance creates an accepted history version.

This supersedes the chat handoff from journal entry 44. Chat drafts are no longer involved. Selecting by activity UUID also removes the earlier restriction on duplicate activity names.

## Decisions and lessons

- **Separate facts from intent.** The client supplies an activity UUID, explicit date and `leave_time_open` intent. The server derives the destination and local day from the saved draft and retrieves its forecast through the existing provider. Client-supplied weather facts or coordinates are rejected. The stored context contains the provider, destination reference, local date/timezone, daily values, retrieval time and cache label.
- **Use deterministic logic where the request is exact.** The existing single-activity removal command constructs the candidate. No model is needed to interpret a choice made in a select control. Acceptance reconstructs that command and compares the complete candidate, preserving every other activity and trip setting. Fixed, booked and completed items remain protected.
- **Keep dates honest.** Exact trips require the computed schedule date, including prior stops and overnight transfers. Flexible trips keep an explicitly labeled check-only date: viewing a forecast never assigns actual travel dates.
- **Bound evidence age.** A weather review expires 15 minutes after the forecast's original retrieval, matching the provider cache lifetime. Acceptance validates destination/date binding and freshness again. An old review is kept for inspection or discard; it is not silently refreshed into a different proposal. An idempotent retry returns the same frozen review, even if it has since expired. A successful acceptance retry also returns the same accepted result.
- **Do not infer suitability.** Daily destination weather does not establish conditions at an activity's exact time. Indoor/outdoor classification remains unknown. The traveler chooses the removal; the UI never claims the forecast makes it necessary or safe.
- **Keep on-trip scope separate.** This operation supports lifecycle `planning` only. Active-trip replanning requires explicit current time/location and remaining-day scope, which this form does not collect. The server checks lifecycle on both proposal creation and acceptance.

## Trade-offs and remaining gaps

This is a small, traveler-led planning change with real forecast context, not the full adaptive weather agent. It leaves the chosen time open rather than selecting an indoor replacement. Other start times, stays, intercity transfers, budgets and supplier reservations are unchanged. Removal can affect adjacent journeys: this proposal remains explicitly provisional and requires affected travel to be rechecked; it does not certify route feasibility, admission, prices or availability. Full FR-08 route/offer checks and downstream replanning remain outstanding.

The forecast provider can return a recent cached outlook. The UI preserves that original retrieval time. Acceptance does not make a second provider request; it requires the stored forecast to remain within the stated freshness window. Missing/out-of-window forecasts, outages and quota failures create no candidate and never fall back to a sample forecast. No new API key or schema migration is needed for this local slice. Production weather licensing/commercial service review remains as noted in the weather provider learning document.

## Verification

- **309 backend tests** passed under both local Python 3.12 and CI Python 3.14; Ruff passed. Python 3.14 reports the existing 13 LangSmith deprecation warnings.
- **79 frontend tests**, TypeScript and the production build passed. New adapter coverage verifies the minimal request, draft precondition, idempotency key and abort propagation.
- Nineteen backend cases cover frozen previews, accept/retry/discard, exact versus flexible dates, protected activities, auth/ownership, missing map locations, forecast outage/quota/coverage/age, required acknowledgements, stale drafts, changed lifecycle and tampered candidate/scope.
- **Browser → API → hosted database → UI:** real Jaipur daily forecast; selected a day-3 sample walk, inspected its saved review, discarded it and confirmed the original remained. Added one temporary QA activity on otherwise empty day 5, accepted its reviewed removal on a 390×844 viewport, reloaded and confirmed the day stayed empty. History shows accepted version 34. Day 3's original activities remain unchanged; prior pending reviews were not discarded.
- The browser console reported no warnings or errors. Desktop and phone review screenshots: `/tmp/elsewhere-weather-proposal-desktop.png`, `/tmp/elsewhere-weather-proposal-phone.png`.

Only learning/journal documentation changed. The generated OpenAPI artifact reflects the additive endpoint; finalized PRD, architecture, database and API design documents and the locked landing were left untouched. No push or deployment.

## Next slice

Update: the [explicit replacement slice](weather-replacement-learning.md) now supports museum/gallery choices and optional live acceptance checks. The remaining notes below describe the broader follow-up scope.

Add explicit replacement preferences and retrieve credible indoor alternatives. Present a small proposed replacement with place identity and affected hours/journey checks, preserving completed and protected activities. Connect the conversational agent only after that typed proposal boundary is supported; retain explicit current-time/location confirmation for active trips.
