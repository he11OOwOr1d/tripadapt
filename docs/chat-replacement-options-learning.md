# Real replacement options inside chat

14 November 2026

## What changed

A saved conversational replacement request now opens research directly in the chat panel. The traveler confirms a date/category, sees the daily forecast and up to three retrieved places, selects one and previews it through the existing weather-change proposal. The planner chooser remains available as a secondary path.

The new owned `POST /trips/{trip_id}/messages/{turn_id}/replacement-options` endpoint is research only. It returns no candidate version and changes no itinerary. It validates the stored handoff, trip owner, saved draft ETag, target protections, planning lifecycle and exact schedule date before provider calls. It checks the forecast first and skips place discovery when the date is outside coverage or has no usable weather. It checks the draft/lifecycle again after the external lookup so intervening edits cannot return apparently current options.

## Decisions and lessons

- **Keep one proposal boundary.** Selection sends an explicit activity ID, date and retained place ID to the existing weather-change endpoint. Chat does not gain an alternative edit/accept path. Protection, forecast age, same-destination identity, idempotency, candidate reconstruction and optional Google acceptance checks remain shared.
- **Retrieve facts before presenting choices.** The response includes the forecast source/retrieval/cache label, actual retained place records, source attribution, distance and the original activity's time slot. Provider failures never substitute sample places. A recent retained discovery fallback is allowed only through the existing discovery service and retains its explicit stale-refresh notice.
- **Make ordering inspectable.** The deterministic shortlist uses straight-line distance from the original activity's map point, or the saved destination centre when the activity is unmapped. It does not claim walking/driving time, indoor shelter, admission, availability or quality. The current venue, foreign/old/category-mismatched records and duplicate external IDs are excluded.
- **Use small choices without losing source identity.** At most three names are shown. Case/whitespace variants of a name take one display slot, preserving diversity; their distinct provider identities are not merged or rewritten. The eligible count still describes the retained records. The full planner research remains available. This presentation bound does not limit trip length or destination count.
- **Keep exact dates exact and flexible dates flexible.** Exact-trip dates are read-only in chat. Flexible dates are explicit check-only inputs. A future date outside the forecast window produces an honest empty forecast state rather than invented distant weather or a trip-duration cap.
- **Recover review work.** Closing and reopening a prepared preview uses the same saved proposal. Refreshing or changing research inputs begins a fresh research state. After discarding a review, the existing saved preview stays inspectable; refresh options to prepare a different one. Uncertain retries within the current panel retain the idempotency key. Saved reviews remain recoverable independently through the existing review list.
- **Check selected states under hover.** Screenshot review caught a global hover background washing out the light selected-button text. A panel-scoped selected rule now wins; browser-computed colors confirmed dark green with a cream foreground, and both screenshots were recaptured.
- **Keep interaction accessible.** Opening research focuses its heading; closing returns keyboard focus to its launcher. Controls have visible focus and touch-sized targets. Research requests abort on panel unmount. Responses are checked against the requested activity/date/category/ETag and malformed data does not become selectable options. Place quota/outage messages explain retry/manual planning without suggesting samples.

## Trade-offs and remaining gaps

This is conversationally initiated research with explicit selection controls inside chat. A language model does not rank venues or declare them suitable: proximity is the only ordering signal. Selecting “the first one” through a subsequent free-text message is not implemented. Rich preference ranking needs trustworthy evidence for those preferences, and a museum/gallery label still does not prove indoor access. Active-trip remaining-day replanning still needs explicit current time/location confirmation.

Optional Google hours and adjacent-route acceptance guards are inherited from the existing proposal review. This slice does not close the outstanding successful live adjacent-journey acceptance gap or certify complete FR-08 feasibility.

## Verification

- **349 backend tests** passed on Python 3.12 and CI Python 3.14; Ruff passed. CI retains the existing 13 LangSmith deprecation warnings.
- **90 frontend tests**, TypeScript and production build passed.
- Fourteen new backend cases cover bounded real results, deterministic ordering/name diversity, date/category changes, missing/distant weather, quota/outage behavior, labeled retained fallback, target protections, ownership, lifecycle, stale edits before/during retrieval and lookup → shared proposal → acceptance without changing other items. Five frontend cases cover minimal request/precondition/cancellation, response guards, empty coverage, malformed results and meaningful quota/outage feedback.
- **Live browser → local API → real providers/hosted database → UI:** reused the stored Groq replacement request for the day-3 walk. A gallery query returned one map record. A check for 2099-01-01 showed the current forecast window and no choices. Switching explicitly to museums returned three of eleven records with the destination-centre distance basis, map attribution and the current daily forecast.
- Selecting the retrieved Amrapali record opened the shared review for **10:15 / 45 minutes**. Closed/reopened the same saved preview, then discarded it. No itinerary change was accepted in this browser QA. Final workspace inspection still showed the original “Sample easy outdoor walk”, 10:15–11:00, 45 minutes. Prior pending reviews were untouched.
- Desktop and 390×844 phone layouts checked. Phone selection enabled the review action; keyboard focus returned to the launcher on close. Final browser console read returned no warnings or errors. Screenshots: `/tmp/elsewhere-inline-options-desktop.png`, `/tmp/elsewhere-inline-options-phone.png`.

Only learning/journal documentation and the generated OpenAPI artifact were updated as documentation. Finalized PRD, architecture, API/database design docs and locked landing remain unchanged. No migration, new key, push or deployment. Local frontend/API/worker remain available; the disposable test database was stopped after checks.

## Next sequence

Update: the [adjacent-journey rehearsal](adjacent-journey-acceptance-learning.md) now verifies successful guarded replacement acceptance with two mapped driving legs. Remaining-day readiness is next; multi-visit day-delay acceptance is still a separate gap.

Verify a real replacement with mapped adjacent journeys through guarded acceptance. Then add evidence-backed preference refinement and remaining-day scope with explicit time/location confirmation. Preserve the single preview/accept path as conversation becomes more capable.
