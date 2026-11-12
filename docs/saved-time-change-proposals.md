# Saved proposals for requested time changes

11 November 2026. Suggested time adjustments can now enter the same frozen proposal/review/acceptance boundary used by existing agent edits and history restoration. This does not introduce a second save architecture or persist Google facts.

## Flow

For a signed-in trip whose latest draft has finished saving, **Review as a saved proposal** submits only one activity ID and proposed local start time. The backend resolves the current saved destination/day, rebuilds the move, protects fixed/booked/completed items and validates the complete schedule. The original draft remains untouched while review is pending. Before/after values are shown in the existing review dialog, with explicit acknowledgments and **Accept time change**. Acceptance updates the editable draft and creates an accepted snapshot. Discard changes nothing. Browser-only drafts and manual fine-tuning retain the ordinary editor option.

The client uses a stable idempotency key for uncertain retries; a discarded review gets a fresh key for another attempt. A changed command cannot reuse the same key. Controls are unavailable while account saving is pending or failed. Request cancellation/unmount suppresses stale UI completion; an already-created server proposal cannot mutate the trip without acceptance.

## Server contract

Authenticated `POST /api/v1/trips/{trip_id}/proposals/time-change` accepts `{activity_id, local_start_time}` with required draft `If-Match` and UUID `Idempotency-Key` headers. Scope is derived from the saved activity, not trusted from client/provider text. Stale ETags return 412; missing preconditions 428; protected/conflicting changes 409; missing/foreign resources remain isolated. Responses use the existing ProposalView and no-store trip response policy.

Frozen candidates use the existing `source=user` schema and a server-created `requested_move` validation-report entry, containing the typed command, scope and change summary. At acceptance the command is rebuilt against the unchanged saved draft and compared with the entire candidate; a modified duration, route, protection, other activity or trip setting fails. Existing current-version/draft-sequence fences, acknowledgment equality, idempotent acceptance, owned history and discard rules remain active. Only the accepted start time is applied through normal plan synchronization.

There is no new database migration, queue, provider call or model request. No Google hours, route payload or preview “verified” boolean enters the proposal. The acknowledgment explicitly says provider checks are temporary and not revalidated at acceptance. This is saved-schedule validation, not durable supplier validation. A pending proposal is retrievable by its ID; a general pending-review inbox remains future work.

Tradeoff: an explicit review/acceptance step and a frozen snapshot in exchange for ownership, staleness and whole-command checks. Live provider revalidation at acceptance, hours-aware slot search, multi-activity replanning and distributed operational quotas remain subsequent work.

## Verification

Eleven new backend cases cover immutable pending state, exact acceptance/draft synchronization, idempotent retries, changed-key payloads, generic-submit key isolation, protected targets, overlap/midnight rejection, preconditions, authentication/ownership, stale drafts, tampered candidates and discard. Backend suite: 210 tests, passing on Python 3.12 and CI-matching 3.14.4. Frontend: 51 tests, TypeScript and production build pass. OpenAPI regenerated; Ruff passes.

Browser QA uses two temporary mapped museums in the existing QA trip. The live route shortfall led into an 11:10 → 11:40 saved review for Albert Hall, and acceptance retained its 60-minute duration and source attribution. Reload confirmed 11:40 in the saved draft, and Plan history showed accepted version 21 as the current QA snapshot. Cleanup was saved and an empty QA day was confirmed after reloading. discard and subsequent fresh review, explicit acceptance, account reload and source/duration preservation are checked. Desktop/phone layouts are checked. Temporary draft entries are removed after testing; the test acceptance remains in the QA trip's immutable history. Screenshots are local in `/tmp/elsewhere-saved-time-change-*.png`. No push or deployment.

Later extension: [explicit live rechecking at acceptance](live-time-change-acceptance.md) is now available for these requested-move proposals. The default provisional path remains unchanged.

Later implemented: [pending review recovery](pending-reviews.md) provides reload/resume access through Review plan; stale reviews remain inspectable but cannot be accepted.
