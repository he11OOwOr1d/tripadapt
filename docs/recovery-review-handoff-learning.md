# From a corrected draft to a fresh accepted-day check

15 November 2026.

## Work and decisions

The recovery reminder now distinguishes a cancelled editor from an explicit correction. Saving or removing an activity through the readiness editor marks the reminder as a draft correction and offers **Review saved corrections** once saving succeeds. It opens the existing whole-draft review, not an activity-only shortcut. Closing or discarding a review leaves the reminder in its draft state.

After acceptance, the reminder advances only for an exact plain user-draft review: accepted proposal, matching trip, base draft ID/edit sequence, captured review token, refreshed accepted pointer and unchanged draft token. Generated timing/weather/agent/restoration proposals cannot be mistaken for acceptance of the manual corrections. Later edits or a different accepted snapshot invalidate the accepted reminder.

**Check accepted day again** opens the existing confirmation on the original destination/day with accepted basis. It carries no reported clock, current place, route estimate or old readiness result. Loading the accepted context still leaves date/time blank and readiness disabled until explicit confirmation.

The acceptance callback now returns the accepted proposal to callers that need this recognition. The data adapter retains the already-existing base draft fields from the API. No backend contract or persistence change was introduced.

## Bug found through full-story verification

A lifecycle change updated the account ETag in the workspace, but the autosave queue still held its previous account reference. A later save could commit draft commands and then conflict on the metadata PATCH. Local edits were preserved, but this was a real integration defect in the preceding lifecycle slice.

Lifecycle success/metadata refresh now advances the workspace load generation, rebuilding autosave with the current account reference. These actions are already gated on editing/saving, so an in-flight save is not discarded. Browser retest: finish → resume → explicit correction → autosave → review succeeded without the stale-revision conflict. The initial partial QA save was recovered by reopening the saved draft; no user data was overwritten.

## Verification

- **112 frontend tests**, TypeScript and production build pass. Three new guard tests cover exact immutable recognition, rejection of unrelated/pending/generated/stale receipts and invalidation by later changes. Existing freshness/protected-item tests remain. Whitespace checks pass. Backend code is unchanged; its suites were not repeated for this slice.
- Real authenticated browser/API: temporarily active QA trip, current saved-draft readiness, explicit completion correction, autosave waiting/ready states, whole-draft provisional review, discard, retry, acknowledgment and acceptance. The matching accepted review alone changed the reminder to accepted.
- Phone action opened accepted snapshot **48** on the original day. Date/time stayed empty and Check readiness disabled. No prior location/report was reused. Desktop and 390×844 phone layouts inspected; viewport reset afterward. Native modal/focus behavior reused; React review found no additional polling or duplicated state-derived effects.
- QA cleanup explicitly cleared the two temporary completion marks and accepted the restoration as **version 49**. Read-only checks compared every activity field except row/version/stop storage IDs against baseline in both accepted/draft plans: **11 activities each**, matching baseline. Lifecycle restored to planning under a locked row and expected snapshot/content assertions. Reload showed both marks false and no dialog.
- QA history intentionally retains discarded review 47, accepted test review 48 and accepted restoration 49. Older accepted version 46 was preserved; no historical snapshot was rewritten. No new chat turn or reservation operation occurred.
- Screenshots: `.local/qa/recovery-draft-review-desktop.png`, `.local/qa/recovery-accepted-phone.png` (ignored local artifacts).

## Trade-offs and next step

The reminder is session-local and scoped to its originating day. Reload restores the actual saved/accepted plan but not this navigation reminder. Recognition intentionally requires a plain full-draft acceptance; other proposal kinds have their existing return paths. A failed acceptance/load still uses the review’s existing error/retry handling and does not claim successful recognition.

Next: recover this review/check navigation after reload using version-bound pointers, without persisting a traveler’s clock/location or reviving an expired report. Keep cross-trip, newer-draft and sign-out boundaries explicit.

Learning notes/journal updated only. Finalized PRD/architecture/API/database design documents and locked landing untouched. No keys, migration, push or deployment.
