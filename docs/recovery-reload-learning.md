# Recover correction navigation after reload

15 November 2026.

## Work and decisions

Saved correction reminders now survive a reload in the same browser tab. Storage contains a versioned allowlist of navigation IDs, signed-in user ID, saved timestamp, draft token, current accepted pointer and optional exact-review/accepted pointer fields. It contains no activity labels/content, reported time, mapped place, readiness report or route evidence.

The marker binds only after a successful current-snapshot autosave. Unsaved edits, cancelled editors and save errors cannot produce a durable correction reminder. Restore requires a verified signed-in account, matching trip/draft/accepted revisions, a valid destination/day, and a pointer less than 24 hours old. It supports long stays and explicit removal: the original activity need not still exist, because the action reviews the whole draft rather than reopening an old record.

Storage is tab-scoped, with one reminder slot. Restore offers navigation but never opens a dialog. Accepted navigation still requires the exact receipt recognition from the previous slice. A fresh day check clears/consumes the pointer and requires new time/location confirmation.

New-trip and explicit sign-out paths clear the pointer; an auth sign-out/user-change listener clears the in-memory reminder and storage as well. Account-library loads validate independently rather than carrying the previous trip’s reminder. Newer drafts, changed accepted pointers, closed lifecycle states, invalid route scope and malformed/extra payload fields are rejected. Dismissal uses the same null-marker persistence path. Unavailable storage leaves the existing in-memory path usable.

## Verification

- **118 frontend tests**, TypeScript and production build pass. Six new tests cover long routes/removal, allowlisted storage, owner/trip/revision/closed-state rejection, malformed/future/expired/injected records, exact accepted pointers, and unsaved/cancelled markers. Final whitespace check passes. Backend unchanged; no backend suite was repeated.
- Real authenticated browser/API: saved a temporary QA completion correction through readiness recovery, waited for autosave, reloaded, and found the draft reminder with zero dialogs. Its review action remained available.
- Completed an exact draft acceptance, waited for its accepted reminder, reloaded, and verified the accepted-day action survived. Phone action loaded accepted context with blank date/time and readiness disabled. Using that action consumed the pointer; a further reload showed no reminder.
- An intentionally early reload during acceptance encountered a newer accepted pointer with the older stored marker. Restore rejected it safely rather than inferring acceptance. This is a conservative fallback, not recovery of an interrupted transaction receipt.
- Desktop and 390×844 phone layout inspected; viewport reset. No live sign-out was performed because it would require account handoff; account mismatch and sign-out cleanup boundaries were covered by guard tests/code review. React review kept the auth listener synchronous, unsubscribed on cleanup and gated persistence behind loading/saving state.
- QA cleanup explicitly cleared both temporary completion marks and accepted the restoration as **version 52**. Every activity field except row/version/stop storage IDs matched baseline in accepted and draft sets (**11 each**); lifecycle remained planning. Reload showed both marks false, no dialogs and no reminder. Test accepted versions 50/51 and restoration 52 remain in history; historical snapshots were not rewritten.
- Screenshots: `.local/qa/recovery-reloaded-draft-desktop.png`, `.local/qa/recovery-reloaded-accepted-phone.png` (ignored local artifacts).

## Trade-offs and next step

The pointer is a convenience within one tab, not a server-synchronized task or progress log. Its age is measured from the latest successful pointer write. A removed destination, newer draft or changed accepted plan clears it. Old or missing context is never reconstructed from storage.

Reloading during acceptance may discard the hint before the client has recorded its exact successful receipt; the actual saved/accepted plan and existing review history remain authoritative. Next: investigate recovery of interrupted review/acceptance through server-read proposal receipts, preserving exact draft/current guards and avoiding any repeated mutation on reload.

Learning notes/journal only were updated. Finalized PRD/architecture/API/database design documents and locked landing unchanged. No new key, migration, push or deployment.
