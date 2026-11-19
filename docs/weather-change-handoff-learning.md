# Weather check to an explicit change request

2026-11-14

**Historical slice:** superseded by the [direct weather revision preview](weather-revision-learning.md). The forecast panel no longer inserts a chat request. The decisions and verification below describe this earlier implementation.

## What this slice adds

After a usable daily forecast, a traveler can select one flexible activity and prepare an explicit removal request in the existing chat. Nothing is sent automatically. The request must be placed in an empty composer, sent, and reviewed through the existing proposal flow before acceptance. Other activity times stay unchanged.

The request is scoped to the account trip, destination and selected local day. Fixed, booked and completed items are excluded. Empty and duplicate names (case and surrounding whitespace ignored) are excluded because chat resolves activities by name. Choices appear in time order. An existing unsent message is preserved rather than overwritten. Forecast failures and missing coverage do not offer this handoff.

## Decision and trade-off

Daily weather does not establish conditions at an activity's exact time. Current activities also lack reliable indoor/outdoor classification. We therefore let the traveler choose what to reconsider and do not declare an activity unsafe or unsuitable. The agent receives the explicit removal request, not an unsupported weather verdict or a fabricated weather tool result.

This reuses the existing deterministic removal validation and proposal acceptance path. It is a small traveler-led bridge, **not** the completed weather-aware replanning agent. No automatic replacement, indoor discovery, forecast provenance in proposal metadata, or on-trip remaining-day replanning is implemented here. A check-only date on a flexible trip remains check-only.

## Verification

- Browser: live Jaipur daily forecast, explicit activity selection, chat handoff, composer insertion, phone viewport 390×844, and unchanged original activity. QA request was cleared without sending; no proposal was created or accepted during this check.
- 78 frontend tests passed, TypeScript passed, production build passed. Subsequent account scoping and name filtering refinements passed TypeScript.
- Screenshots: `/tmp/elsewhere-weather-change-desktop.png`, `/tmp/elsewhere-weather-change-phone.png`.
- This turn did not re-verify removal proposal generation/acceptance end to end. Existing backend validation remains authoritative at submission and acceptance.

## Next implementation

Add typed forecast context and traveler intent to a dedicated proposal operation, with server-side freshness/date/scope checks and deterministic protected-item preservation. Then verify proposal generation, review, stale-state rejection and acceptance with a disposable trip. Replacement recommendations and on-trip replanning need their own explicit scope and evidence checks.
