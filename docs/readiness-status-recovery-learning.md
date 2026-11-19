# Resolve readiness status warnings through the current draft

15 November 2026

## What changed

Earlier and in-progress items in a saved-draft readiness result now offer **Review status or timing**. This opens the existing activity editor at its status controls. Completion is not preselected or inferred. Opening/cancelling changes nothing; only the user's explicit Save changes uses the existing draft/autosave adapter.

After the editor closes, a scoped return reminder offers **Check this day again**. It waits for autosave to finish, opens the saved-draft basis and requires fresh time/location confirmation. Only trip/destination/day/activity IDs are retained for navigation; the previous report, location and clock are not reused. A timing edit initiated from this handoff returns to the original day check even if the user moves the activity elsewhere.

Accepted-snapshot warnings offer **Check saved draft instead**, clearing the old result and inputs without opening an editor. Accepted data is never copied into the draft. Changing the accepted snapshot still requires the existing proposal/review/accept flow.

## Decisions and why

- **Reuse the explicit editor.** A new one-click “done” action would make it too easy to resolve an in-progress warning by asserting completion. The editor lets users confirm status or change timing deliberately; existing protected-removal confirmation and reservation language stay intact.
- **Resolve from current UI draft data.** A pure guard requires a current matching draft token/base, selected scope, unexpired report and an unresolved activity present in both context/report. It checks label, timing, duration, map identity and all protection/completion flags against the current draft, then returns a copy of that current record. It never applies snapshot fields.
- **Preserve commitments.** Fixed/booked flags are carried unchanged into the editor. Manual changes remain explicit; no reservation is booked/cancelled and no item is automatically shortened or removed.
- **Make return navigation useful.** The status disclosure opens with keyboard focus on Already completed, initially preserving its value. Cancel/save returns focus to the reminder. Continuing consumes the reminder, starts a fresh check and cannot auto-reopen an old result.
- **Keep phone copy compact.** Visible actions use a short label; accessible names include the activity title so repeated buttons are distinguishable.

## Verification

- **105 frontend tests**, TypeScript and production build pass. Five new tests cover immutable current-record resolution with fixed/booked flags, long stays, accepted/expired/newer-draft rejection, wrong/missing scopes/records, changed fields and in-progress versus unrelated/completed items. Diff whitespace checks pass. Backend/API/schema code is unchanged in this slice; no migration or key is needed.
- Browser against the real Supabase-backed API: created a temporary mapped **QA explicit status review** activity at **00:05 for 20 minutes** on Jaipur day 5. A real-clock draft readiness check listed it as unresolved. The action opened the status disclosure, focused Already completed and kept it **unchecked**. Cancel left the timeline checkbox false and focused the return reminder.
- Returning selected **Saved draft** but date/time were empty, readiness disabled and no current place selected. Explicit completion + Save changes showed the autosave waiting state; continue became available after saving. A newly confirmed readiness result listed the item as **Already completed**, with no unresolved edit action for it. No readiness/proposal action silently marked it done.
- Accepted-basis Jaipur day 3 showed **zero edit buttons**, an explicit draft-switch action and both earlier/in-progress warnings. Switching set the draft basis, removed the old report and opened no editor. Fresh draft confirmation then showed the four scoped actions.
- Desktop and **390×844** phone checks: no horizontal overflow (dialog client/scroll widths both **347px**), four action buttons measured **48px** high, status focus and cancel/return behavior verified. Existing extension-injected `cz-shortcut-listen` hydration warning remains; no suppression was added.
- Cleanup: explicitly cleared the temporary completion and removed only that test item from the draft. Reload confirmed empty day 5, zero temporary items and no open dialogs. Read-only database check: accepted version **46**, accepted/draft each **11 activities**, temporary item count **0**. No accepted snapshot was changed and no proposal created.
- Screenshots: `.local/qa/readiness-status-editor-desktop.png`, `.local/qa/readiness-status-completed-phone.png`, `.local/qa/readiness-status-actions-desktop.png`, `.local/qa/readiness-status-actions-phone.png` (ignored local QA artifacts).

## Trade-offs and next sequence

This is guided manual resolution, not a new progress-state model. Users still decide whether an activity is completed, should be retimed or removed; a still-ongoing item remains unresolved until they make an appropriate explicit choice. Accepted-basis changes require draft review/acceptance, and a result older than five minutes requires checking again. No bulk completion, inferred skip or automatic duration reduction is introduced.

Next, support the read-only remaining-day conversational handoff for active trips without broadening other agent mutation permissions. The existing conversation service currently retains its planning-lifecycle restrictions; manual readiness/proposal guards remain separate.

The local web/API servers were restarted for QA, and the existing authenticated Chrome session was used; no password or auth token was handled. No backend source, finalized PRD/architecture/API/database document or locked landing changes were needed. Learning notes/journal only were updated. No push or deployment.

### Follow-up correction — 15 November 2026

The next slice found no general planning-only lifecycle gate in the conversation service. The statement above was inaccurate. An explicit active read-only handoff policy and planning-only agent mutation guards have now been added; see [active-trip chat policy learning](active-trip-chat-policy-learning.md). Manual remaining-day guards remain separate.
