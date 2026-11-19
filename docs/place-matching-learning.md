# Learning: improve nearby identity matching without moving the activity

13 November 2026. Google matching now combines the discovery record's name with its authoritative destination label, considers up to ten results in one request, and supports an explicitly entered alternative venue name or street address. A shared picker is used by activity details, single-move acceptance and day-delay acceptance. No result is automatically selected.

## Why the old lookup was fragile

The old lookup searched the discovery name alone, read three results and filtered out distant namesakes. A valid nearby fourth result could therefore be missed. A missing result could also mean different spelling, an outdated map record or a moved venue; it did not prove the venue was absent from Google.

The revised lookup keeps the existing one-kilometre source-identity boundary. It adds destination context, a larger bounded first page and explicit query refinement. Google results are deduplicated by Place ID and carry an approximate straight-line distance from the linked map point. Users still confirm the name, address and original listing. Distance alone does not establish venue identity, opening hours or access.

## Decisions and tradeoffs

- Keep circle bias plus an independent server-side distance filter. Google's [Text Search documentation](https://developers.google.com/maps/documentation/places/web-service/text-search) distinguishes bias from a geographic boundary and documents strict location restriction for categorical queries. We did not treat a bias as a guarantee or introduce an unsupported strict restriction for named-venue searches.
- One explicit request, up to ten provider results, no pagination loop or automatic query retries. Existing timeouts, response-size bounds, field masks, per-owner quotas and concurrency limits remain unchanged.
- Accept an optional trimmed, single-line query of 2–160 characters only on the matching endpoint. The source reference remains required; the destination and source coordinates come from server records. Hour checks reject this extra field rather than silently ignoring it.
- Never change the activity's title, map point, timing or current Google choice while searching. Selection changes only after an explicit result action. Activity details still run their own location validation; saved acceptance still rechecks the selected ID independently.
- Keep queries, addresses, distances and Google results transient. No search data is added to snapshots, local storage or model input. Only the existing selected Google Place ID can be saved through the activity editor. Automatically supplied context comes from public map records, not the traveler's personal activity label; manual input is visibly sent to Google Maps.
- Reuse one picker across the existing flows so empty/error/refinement behavior is consistent. Enter triggers a search and prevents submission of the surrounding activity form. Changing a query aborts obsolete work; disabling or unmounting the picker prevents late results from changing selection.

This does not reconcile a relocated venue by silently accepting a distant namesake. A venue outside the existing source boundary needs its map link corrected. Broader primary place discovery and moved-record reconciliation remain separate work. The new query is an optional API input and distance an additive response field; deploy the backend before relying on refinement in a separately released frontend. No new key, migration or provider is required.

## Verification

273 backend tests pass on Python 3.12 and CI-matching 3.14. New cases recover a nearby fourth result after three distant namesakes, verify destination-qualified and trimmed queries, deduplicate IDs, check distance labels, reject malformed/long/multiline queries before provider calls, preserve immutable discovery records and prove manual refinement cannot bypass the distance limit or enter the hours endpoint. Existing auth and Google identity checks remain covered. Ruff passes; OpenAPI regenerated as a code contract.

All 73 frontend tests, TypeScript and production build pass. The new adapter regression verifies trimmed explicit queries, blank-query omission and source-only transport without a browser key.

Browser QA edited the existing day-3 culture activity without saving. Live discovery selected Albert Hall Museum in the local form. Default contextual matching returned a clear nearby listing; an invalid one-character query was rejected locally; a deliberately nonexistent venue name returned an honest empty state. An explicit alternate name returned the expected museum with name, address, straight-line distance and original-listing link. Enter did not submit the activity. Explicit Check this place opened Google details and, with the check date intentionally blank, correctly requested a visit date rather than claiming fitting hours. Cancel and reload confirmed the original title, 09:00–10:00 timing and unmapped state unchanged. No activity, pending review or accepted version was added or modified.

Desktop and 390-pixel phone layouts were inspected. Screenshots are local at `/tmp/elsewhere-place-matching-desktop.png` and `/tmp/elsewhere-place-matching-phone.png`; Google response bodies were not added to repository artifacts.

Successful multi-visit live acceptance remains unverified. This slice verifies matching/refinement and its details handoff, not a bypass of the real-data conflicts from the preceding rehearsal. Core PRD, architecture, API-design and database-design documents remain untouched. Learning docs only; no push or deployment.
