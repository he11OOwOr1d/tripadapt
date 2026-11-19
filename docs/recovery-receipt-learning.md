# Recover an interrupted review through its server receipt

15 November 2026.

## Work and decisions

The recovery navigation pointer now retains the exact plain draft proposal ID once that review has loaded. Binding requires the matching saved draft token and accepted base, pending user-source proposal, no generated mutation payload and no stale flag. It is persisted before the review's acceptance action becomes available. Existing version-one records without a proposal ID still follow their stricter restore path.

On reload or account-library load, an owned proposal GET can reconcile the pointer. Pending receipts offer **Resume saved review**, which opens that proposal rather than submitting another draft. An accepted receipt restores the accepted-day action only if its candidate matches the current accepted pointer and its base draft still matches the saved draft. Discarded receipts clear the proposal link; stale, unrelated, wrong-source or generated receipts cannot claim acceptance.

No restore path submits a draft, retries acceptance or opens a dialog automatically. The receipt lookup has a ten-second timeout. If it fails, only an otherwise valid strict reminder is retained, with explicit status-unavailable copy. A changed accepted pointer without a verified receipt is not enough to infer success. Current time, location, readiness and live evidence remain outside storage and must be confirmed again.

## Read-race discovery

The immediate-reload browser test exposed two separately timed reads: trip metadata could return its pre-acceptance pointer while the proposal GET already returned accepted. Previously this safely dropped the reminder but could also leave the loaded account revision behind the completed acceptance.

The accepted-receipt mismatch now permits one additional trip reload, then revalidates using the same receipt. There is no second receipt request and no refresh loop. A newer draft or unrelated accepted pointer still rejects the reminder. This keeps the account/autosave reference aligned with the reloaded trip. A QA tab loaded before this fix retained its old account revision and produced a save conflict; a fresh load and the corrected read path were used for the passing retest. Partial QA draft changes were recovered and explicitly restored, not overwritten.

## Verification

- **124 frontend tests**, TypeScript and production build pass. Six added tests cover exact review binding, single receipt reads, interrupted acceptance, discarded/stale receipts, outages/invalid paths, and the bounded older-trip/newer-receipt race. Tests assert no extra receipt fetch and reject changed drafts/unrelated accepted snapshots. Whitespace checks pass.
- Real authenticated browser/API: saved a QA completion correction, opened a whole-draft review, reloaded while pending, and saw **Resume saved review** with zero dialogs. A database count before/after resume confirmed the same pending proposal and no additional review.
- After the race fix, an immediate reload following the explicit acceptance click recovered **Corrections accepted**. The phone action opened fresh accepted-day context with blank date/time and readiness disabled. It did not repeat acceptance or carry the old mapped location/report.
- Desktop and 390×844 phone layout inspected; viewport reset. React review uses a ref for the optional proposal-loaded callback, avoiding review refetches when parent state changes. Restore remains gated on verified owner/loading/saving state, with the owner checked again after asynchronous reads.
- QA cleanup cleared both temporary completion marks, reviewed and accepted the restoration as **version 55**. All activity fields except row/version/stop storage IDs matched baseline in both accepted/draft plans, **11 each**; lifecycle remained planning. Final reload showed both marks false, no reminder and no dialog. Accepted test versions 53/54 remain in history; historical snapshots were not rewritten. No chat turn or reservation operation was created.
- Screenshot: `.local/qa/recovery-receipt-phone.png` (ignored local artifact).

## Trade-offs and remaining scope

This reconciles a known proposal receipt; it does not recover a review whose creation response never reached the client and whose ID was never captured. That case still uses existing pending-review history. Receipts are not streamed across tabs, and prolonged outages may leave only the normal plan/history path. A discarded review is normalized when its receipt is read; this slice does not redesign every review modal's return behavior.

Next: make status recovery explicitly retryable after a receipt-read outage, without creating or accepting a proposal, and ensure discarding a resumed review immediately clears its resume action.

Backend source/contracts were unchanged; backend tests were not repeated for this frontend slice. Learning notes/journal only updated. Finalized PRD/architecture/API/database design documents and locked landing untouched. No keys, migration, push or deployment.
