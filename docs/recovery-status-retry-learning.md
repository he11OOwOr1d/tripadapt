# Retry review status and clear discarded resume links

15 November 2026.

## Work and decisions

The recovery reminder now offers **Check review status** while it knows a proposal ID. A failed read changes this to **Retry review status**, with explicit failure guidance. The action loads the current saved trip and reads the existing proposal receipt. It never submits a draft, accepts a proposal or retries a mutation. The existing bounded receipt reconciliation handles a concurrent acceptance.

Metadata/draft loading now accepts a shared cancellation signal. The explicit status action applies a ten-second timeout to that load and to the receipt read; a permitted reconciliation reload is also timed out. Loading copy explains that nothing is being accepted or submitted. Review/check actions wait while this read is in progress.

Late results apply only if owner, trip, metadata revision, draft revision and reminder identity still match, with no editing/saving/dirty state. Unmount invalidates the attempt; a user edit, sign-out, dismissal or trip switch prevents the result from replacing newer state. Status success refreshes the saved account/draft only under these guards and resets the autosave reference generation.

A successful discard callback now returns the discarded proposal to callers. The workspace clears only the matching resume/review/acceptance links, preserving the correction reminder, scope and saved draft binding. The panel immediately offers **Review saved corrections**. Failed or unrelated discard operations cannot clear that pointer.

## Accessibility and design

Reuse the existing Elsewhere reminder and button treatment, native modal and focus styles. A status message announces the read, and the initiating button changes to “Checking review status…”. Browser testing found disabled-button focus was lost; focus now returns after the read only if it has fallen to the document body. It does not steal focus from a user who has moved elsewhere. Phone layout remains wrapped and touch friendly, with no additional animation.

React review keeps the current-state snapshot in a ref, invalidates unmounted requests and uses derived guards rather than a second mutation/state synchronization loop.

## Verification

- **128 frontend tests**, TypeScript and production build pass. Four added tests cover matching immutable discard cleanup, late-response invalidation, read-only retry after a simulated outage and cancellation signals propagated through the three account-load reads. Existing receipt/race tests remain. Whitespace passes.
- Real authenticated browser/API: saved a temporary QA correction, prepared a pending review, closed its modal and used Check review status. The panel showed the checking state, then returned to pending. Database checks confirmed unchanged proposal count, the same pending review and unchanged accepted pointer.
- Retested focus after the fix: status-check button regained focus. Resumed the review at phone width and explicitly discarded it. Resume/status actions disappeared immediately; the draft review action remained. Reload preserved this normalized state.
- Outage → retry success and late-result rejection were exercised in automated tests. A live service outage was not induced. No live sign-out/account switch was performed during a request.
- QA cleanup dismissed the reminder and explicitly cleared the temporary completion mark. Both accepted/draft sets of **11 activities** matched every baseline activity field except row/version/stop storage IDs. **Accepted version 55 remained unchanged**, lifecycle planning, test proposal discarded. Final reload showed no dialog/reminder and the temporary mark false. No new accepted snapshot, chat turn or reservation operation was created.
- Desktop and 390×844 phone checks completed; viewport reset. Screenshot: `.local/qa/recovery-discard-cleared-phone.png` (ignored local artifact).

## Remaining scope

The status action requires a known proposal ID and an available saved-trip API. A review creation response lost before its ID was captured still uses pending-review history. Persistent execution states, broader route replanning and external-provider coverage remain separate core-workflow work.

Next: audit remaining core replanning workflow gaps against the finalized requirements and choose the next functional slice.

Backend source/contracts unchanged; backend suites were not repeated for this frontend slice. Learning notes/journal only updated; finalized PRD/architecture/API/database design documents and locked landing preserved. No key, migration, push or deployment.
