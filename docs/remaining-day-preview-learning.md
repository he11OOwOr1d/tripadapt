# Route-aware remaining-day timing previews

14 November 2026

## What shipped

The readiness panel now offers walk/drive timing previews. The owned `/replanning/preview` endpoint revalidates the accepted/draft basis, local clock, selected destination and reported mapped location. Google Routes supplies the initial journey from that location and every subsequent connection; driving uses traffic-unaware estimates. The UI adds an explicit 10-minute buffer per leg.

The deterministic scheduler preserves order and durations, never moves an activity earlier, and leaves completed/fixed/booked items unchanged. It shifts flexible activities forward only as needed. Missing map links, unresolved progress, warnings/outages, missed commitments, blocking plan conflicts or a finish after midnight stop the preview. Identical retained origin/destination IDs explicitly mean zero travel, with the chosen buffer still retained.

## Decisions and lessons

- **Preview before persistence.** This does not create a proposal/version, activate the trip or apply anything. The UI explicitly says saving/acceptance is not available yet. Freezing a preview safely across accepted/draft divergence and live acceptance is the next slice.
- **Deterministic timing.** Measured routes and hard constraints are sufficient here; Groq does not invent routes, durations or availability. Reordering, replacement and shortening require a later explicit scope.
- **Keep sources together.** Remaining map points must belong to the selected destination; accepted and draft records are not mixed. Frontend guards reject changed durations, moved commitments, missing activities and mismatched journey chains.
- **Lookup time counts.** Re-read the base pointer/sequence after provider calls, revalidate freshness and recalculate timing from the completion clock using the fetched estimates. Round arrivals forward to whole minutes. No Google payloads or reported location context are persisted.
- **Clock-change dates need richer time semantics.** Readiness understands DST gaps/folds, but activity wall-clock times cannot represent every repeated hour. The preview explicitly rejects dates whose UTC offset changes before calling providers.

## Trade-offs and limits

Up to six remaining visits per action bounds provider work; trip duration is unrestricted. Order and durations are preserved rather than optimized. Hours, weather, prices, traffic, reservations and actual completion are separate checks. A preview is not an authorization token or full feasibility certificate. Past/in-progress statuses still require explicit resolution.

## Verification

- 371 backend tests pass on Python 3.12 and CI Python 3.14; CI retains 13 existing LangSmith deprecation warnings. Nine new tests cover initial/connecting journeys, propagation, no mutation, protected commitments, clock rounding, maps/status, invalid route evidence, midnight, clock-change rejection, preconditions, provider warnings, no version creation and base changes during lookup. Ownership uses the same owned-trip boundary tested in readiness.
- 96 frontend tests pass, including rejection of duration changes, protected shifts, omitted activities, wrong bases and negative travel times. TypeScript, production build and Ruff for changed backend files pass. Generated OpenAPI has a typed preview response.
- Live browser: one temporary Jaipur day-5 visit at Chhoti roundabout view, 22:00 for 20 minutes, with Sawai Jai Singh II as the reported starting point. Google returned **9 minutes driving** plus the explicit **10-minute buffer**; the start remained unchanged. No preview was applied and accepted snapshot 42 was not replaced. Temporary draft item removed; reload confirmed day 5 empty.
- Desktop and 390×844 phone verification show travel versus buffer, unchanged time and honest limits. Phone dialog client/scroll width both 347px. Escape closes the panel. Screenshots: `/tmp/elsewhere-remaining-preview-desktop.png`, `/tmp/elsewhere-remaining-preview-phone.png`.

## Next

Freeze a freshly revalidated preview into an immutable proposal, preserve accepted/draft concurrency, and extend guarded acceptance to cover the initial journey and affected visits/connections. Keep changes behind review and explicit acceptance. Broader model-generated alternatives must respect the same constraints.

Learning notes/journal and generated OpenAPI only; finalized design documents and locked landing untouched. No push or deployment.
