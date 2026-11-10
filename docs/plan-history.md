# Accepted-plan history and restoration

11 November 2026. Use **Plan history** in the saved itinerary workspace. History lists only accepted snapshots, newest version first, with a current marker, acceptance time, route, activity count and travelers. Editable drafts and pending/discarded proposals are separate. Empty history explains how to accept a first snapshot. Earlier pages load on demand.

**Review restore** prepares a new proposal without changing the draft or current pointer. Review shows the activity add/remove/change counts, whether route/settings change, dates/flexible duration, travelers/rooms, budget, stay/transport preferences in travel order, route timezones and the complete candidate schedule. Accept restoration explicitly replaces the editable draft and creates a new accepted snapshot. Earlier versions remain immutable. Trip title/lifecycle are trip metadata, not version settings, and are not restored. No supplier reservation is restored, cancelled or revalidated. Historical/sample suggestions remain unverified.

## Contract and implementation

- `GET /api/v1/trips/{id}/revisions` returns `{revisions, next_before}` with version-number pagination; default 20, maximum 50. Only owned accepted versions are visible. History summaries use grouped database queries instead of loading every activity from every snapshot.
- `POST /api/v1/trips/{id}/revisions/{version_id}/restore` requires draft `If-Match` and a UUID `Idempotency-Key`. It returns 202 and a ready local restoration proposal with Location. There is no fabricated background job: only deterministic local validation is currently available. Future external revalidation remains separate.
- Restore copies every supported PlanInput setting, stops and activities. The selected historical ID is the new candidate's parent reference; the proposal retains current/draft base references and edit sequence. Restore summary metadata is stored in the existing JSON validation report and exposed under generation metadata. No migration or new key is needed.
- Acceptance rechecks ownership, draft/current freshness, candidate equality to its immutable historical source and full-plan validation. Existing fixed/booked/completed items must remain identical, including their destination stay/timezone and trip-date context. A historical version that rewinds them produces blocking explanations. Users must reconcile these differences manually; an acknowledgment cannot bypass them.
- Retry keys reuse the same restoration proposal. Reusing one for another target/base is rejected. Stale proposals, discard and acceptance retries reuse the established proposal boundaries. Applying restored settings and schedule, advancing the current pointer and accepting the new version happen in one transaction.

## Decisions and tradeoffs

Restoration is deterministic and does not need Groq or a new orchestrator. Reusing immutable versions makes recovery inspectable and consistent with AI acceptance. Copying only activities would silently combine old schedules with current dates/preferences, so this restores the complete supported plan instead. A compact change summary and full review are required because that can replace recent draft work.

This is whole-plan recovery, not item-level undo, branching comparison or automatic merging. Protected-state conflicts block it rather than guessing which records are still valid. Live supplier evidence, costs, timezone feasibility and reservation status remain unverified. Full provenance inheritance and revalidation are future work.

## Verification

106 backend tests pass, including full snapshot equality after restore, immutable originals, pagination, empty history, retry identity, stale/discard behavior, protected-context conflicts and account ownership. The 13 frontend regression tests, TypeScript and production build pass; Alembic reports no schema drift. OpenAPI includes the new endpoints. Browser captures are in `docs/references/plan-history/`.

Browser evidence on the synthetic QA trip: version 15 was current after removal. Review restore of version 14 reported one activity returning and no settings/other activity changes. It showed historical guesthouse/hotel choices and Delhi → Jaipur → Udaipur → Delhi transfers in order. Phone acceptance recovered “Explore the old city” on Jaipur day 2, 11:00–12:00. Reload at 320px retained it; document width was 305px within the viewport. The personal trip was untouched.

The existing Chrome session emitted an extension-related hydration warning for an injected `cz-shortcut-listen` body attribute. The warning was not suppressed in application code. This did not prevent the verified recovery flow.

After reload, history showed new version 16 as the current restored snapshot, with versions 15 and 14 still listed separately. Keyboard focus returned to Plan history when the dialog closed. No migration, new key, Groq call or deployment was required.
