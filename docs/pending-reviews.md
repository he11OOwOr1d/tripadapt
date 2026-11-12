# Resume saved pending reviews

12 November 2026. The existing **Review plan** entry now opens pending reviews for the current account trip, with a separate **Review current draft** action. No additional top-level navigation button is introduced.

## User flow

Pending frozen proposals remain available after closing the dialog or reloading. Each entry identifies its review version and purpose; requested time changes show the activity and before/after times. Planning suggestions remain neutrally labeled until the full proposal explains its evidence. Accepted and discarded reviews leave this list; accepted snapshots remain in Plan history.

A review is out of date if its saved draft identity/edit sequence or accepted base version no longer matches the trip. Out-of-date entries can be inspected or discarded. The full proposal endpoint recomputes that status when resumed, and the dialog removes acceptance and live-check controls for stale proposals. Server-side staleness fences still protect acceptance if another edit occurs while the review is open.

Opening, paging and inspecting are read-only. Nothing automatically regenerates, accepts, discards or applies a proposal. A resumed review starts with fresh acknowledgment/live-check choices; no Google facts or prior “verified” state are restored. Provisional versus optional live acceptance keeps its existing explicit boundary.

## Contract and architecture

Authenticated `GET /api/v1/trips/{trip_id}/proposals` returns `{reviews, next_before}` for pending proposals only. `limit` defaults to 20 and is bounded to 1–50; the descending candidate-version cursor is passed as positive `before`. Each entry contains proposal ID, version number, source, title, summary and stale status. Queries are scoped to the owned trip and response caching remains private/no-store. Missing or foreign trips do not expose another traveler's review metadata.

ProposalView adds a freshly calculated `stale` flag. No database migration, provider request, credential, model call, queue or additional save path. The UI retains the existing paper surfaces, green typography, modal focus behavior and review-list pattern. Paging is explicit; closing cancels pending reads. Loading, empty and error/retry states are included.

Tradeoff: older reviews stay visible with warnings rather than being silently deleted or rewritten. A stale proposal needs a newly prepared review; automatic merging/rebasing and a cross-trip review inbox remain later work.

## Verification

Five new backend tests cover empty state, bounded cursor pagination, accepted/discarded filtering, draft/current-version staleness, resumed status, private ownership and authentication. Backend suite: 230 passing tests on Python 3.12 and CI-matching 3.14.4. Frontend: 53 tests, TypeScript and production build. Ruff passes; OpenAPI regenerated.

Browser QA uses the existing QA trip without adding activities or changing trip settings. Existing review 18 was inspected without alteration; it showed a stale warning and no acceptance button. One new disposable current-draft review (23) was created, closed, recovered after reload, resumed and discarded; it then disappeared from the list while all five original stale reviews remained. Stale review acceptance is unavailable. Desktop and phone layouts are checked. Screenshots are local at `/tmp/elsewhere-pending-reviews-*.png`. Empty/paging edge cases use controlled API tests. No push or deployment.
