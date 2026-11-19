# Choosing a weather-related replacement

14 November 2026

## What changed

The day-weather panel now offers two explicit choices: leave an activity's time open, or choose a museum/gallery instead. Replacement search reuses the real destination-scoped discovery adapter. A traveler selects a map record before a frozen proposal is created. The review shows the old and new activity, unchanged start/duration, forecast context and place attribution. Acceptance replaces that one activity's place and label, makes its kind `custom`, and clears the previous Google listing ID. Logical identity, local day, time slot, other activities, stops and trip settings remain unchanged.

The existing optional Google acceptance guard now supports these replacement proposals. It checks the proposed visit's reported hours and both adjacent mapped journeys when they exist. The date must equal the proposal's forecast/check date. Missing maps/listing, unknown hours, insufficient travel time, access warnings or provider failures prevent guarded acceptance. Nothing silently switches to provisional acceptance.

## Decisions and trade-offs

- Museums and galleries are **possible alternatives**, not verified indoor or weather-safe venues. Providers can include gardens, courtyards, ambiguous names and duplicate map records. We show the real records and their sources without inventing shelter, admission, availability or suitability. Travelers choose what meets their needs.
- The typed request adds `replace_place` and a retained replacement UUID. The server requires that UUID to identify a museum/gallery for the same destination, retrieved less than 24 hours ago. Missing, foreign, stale and unchanged records are rejected. Labels, coordinates and provider payloads cannot be submitted as substitutes for that identity.
- Creation and acceptance reconstruct the deterministic replacement. Existing protection, stale-draft, ownership, idempotency and 15-minute forecast-age guards still apply. Candidate tampering cannot move, resize or edit another activity.
- Exact choice controls do not need a language-model decision. Conversational orchestration should reuse this typed operation later rather than create a parallel, less constrained edit path.
- Provisional acceptance remains an explicit option consistent with existing manual proposal flows. This is not a complete FR-08 feasibility certificate. Indoor access, admission prices, reservations, accommodation travel, live traffic and full-day feasibility remain outside these checks. Planning lifecycle only; active-trip replanning still needs time/location confirmation.
- Forecast-panel form selectors originally reached the nested review modal. Scoping them to the actual weather controls restores the modal's own field/checkbox layout. Successful acceptance also clears the selected replacement so the form does not offer the just-accepted venue as its own replacement.

## A test cleanup lesson

The larger CI Python suite exposed `too many clients already` late in otherwise passing tests. Each TestClient shutdown disposes the application's engine pool while the rollback fixture still holds its outer connection. Returning that connection to its retired pool can defer physical closure until garbage collection. The shared test fixture now detaches its dedicated connection before use; SQLAlchemy closes the DB connection when the fixture exits, while the outer rollback still isolates test data. Production pooling is unchanged. Both Python suites passed after this correction.

## Verification

- **320 backend tests** passed on Python 3.12 and CI Python 3.14. Ruff passed. CI retains the existing 13 LangSmith deprecation warnings.
- **80 frontend tests**, TypeScript and production build passed. Adapter coverage includes both intents, only explicit IDs/date/intent, draft preconditions, retry key and cancellation.
- Eleven new backend cases cover frozen preview/acceptance, idempotency, protected activities, missing/foreign/expired/wrong-category/same-place records, altered candidates and explicit date-bound live checks that fail closed.
- Browser: real Geoapify/OSM museum records and live Open-Meteo forecast; day-3 walk replacement preview kept 10:15/45 minutes. Enabling Google checks with unmapped adjacent items disabled acceptance. Discard preserved the original day.
- A temporary QA item on otherwise empty day 5 was replaced by Albert Hall Museum. An explicitly selected nearby Google listing (about 15 m from its map record) passed the live hours acceptance path for 09:00–10:00. Reload preserved the replacement and time slot. **That test day had no adjacent journeys**, so it does not verify successful Google Routes acceptance or the earlier multi-visit live-day gap.
- Restored original QA snapshot 34 through the existing preview/accept flow after testing. Reload confirmed day 5 empty and the original day-3 walk intact; the tested replacement remains in history as version 36, with restoration afterward. Prior pending reviews were not discarded.
- Desktop and 390×844 phone checks covered selection, review and acceptance. Screenshots: `/tmp/elsewhere-weather-replacement-desktop.png`, `/tmp/elsewhere-weather-replacement-phone.png`, `/tmp/elsewhere-weather-replacement-saved-phone.png`.
- Browser console showed an extension-injected `cz-shortcut-listen` body-attribute hydration warning on reload. No application failure occurred; no hydration warnings were suppressed in source.

Learning documentation and generated OpenAPI were updated. Finalized PRD, architecture, API/database design documents and the locked landing remain unchanged. No new environment key, schema migration, push or deployment.

## Next slice

Update: [chat-to-chooser handoff](weather-chat-learning.md) now supports conversational activity identification and draft-bound navigation into this flow. Entirely conversational venue selection remains outstanding.

Expose the typed replacement operation through conversation with explicit activity, date and selected place identity. Preserve the same preview/accept boundary and clarify ambiguous preferences. Separately verify a successful real replacement with mapped adjacent journeys; richer remaining-day alternatives and active-trip weather replanning remain outstanding.
