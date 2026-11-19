# Recording that an activity didn't happen

16 November 2026. Implementation note, not a change to the finalized requirements.

## Problem

The core workflow audit listed a persistent skipped/ongoing execution model as missing. An activity could only be planned or `completed`. The recovery guidance (entry 59) deliberately saved no invented state: "I didn't do it" only steered the traveler to reschedule or delete. So there was no lasting, honest record that something didn't happen.

## Work

- **A new outcome.** The traveler can record **"Didn't happen (keep it as a record)"** (`skipped`) in the activity editor, alongside "Already completed". The two are exclusive: the server model, the database check `activity_one_outcome` and the client validation all enforce this. Ticking one clears the other, including the itinerary card's quick "Done" checkbox. The app never sets it.
- **What a skipped activity does:**
  - It stays in the plan with its costs, because the traveler may still have paid.
  - It counts as **resolved** (`ActivityInput.resolved` = completed or skipped). Every protection check that used `completed` now uses `resolved` (13 checks): chat moves, resizes and removals; delay and remaining-day planning; restoration; stay rebalancing; the planning fixture. A skipped activity is never moved or removed automatically.
  - It **holds no time**, so it can't overlap on the server or in the client's day-conflict check.
  - Remaining-day readiness lists it in a new **"Didn't happen"** group instead of "Earlier, status needed", so it no longer blocks replanning.
- **Display.** The itinerary card shows "· Didn't happen" with a muted, struck-through style.
- **Migration.** `0024_activity_skipped` adds `skipped boolean NOT NULL DEFAULT false` plus the exclusivity check. Applied to Supabase; browser roles still have no grants.

## Decisions

- **Skipped stays separate from deleted.** Deletion still exists for mistakes; skipped is history.
- **"Ongoing" is not a stored state.** The existing guidance for in-progress activities, which focuses on duration, remains the right tool, and an "ongoing" flag would go stale immediately.
- **Costs are untouched.** Whether a skipped activity's estimate should still count is the traveler's call; they can edit or remove it.

## Verification

- **Backend:** new tests for exclusivity, the skipped activity holding no time, protection from chat removal and stay rebalancing, and the readiness grouping. The affected existing test files (validation, removal, resize, reschedule, delay, remaining day and proposals, replanning, rebalance, costs, trips, revisions) were run on Supabase; see the journal entry for the result.
- **Frontend:** 162 tests, covering the client overlap rule and the exclusive outcomes in trip validation. Trips without skips round-trip unchanged, because `skipped` is only included when true.
- **Signed-in browser on "UX check · two-stop escape":**
  - Marked "Test suggestion: a pause" as didn't happen; the database showed `skipped=True`, and the card showed "· Didn't happen".
  - This found and fixed a bug: the card's quick **Done** checkbox didn't clear `skipped`. That would have produced a state autosave rejects. Ticking Done now switches the activity cleanly to completed and saves.
  - Unticked Done afterwards. The trip was compared against its saved baseline: draft and accepted plans are identical.

## Next

- Offering "Didn't happen" directly from the readiness and recovery guidance, which lives in the other session's area.
- A trip-level summary of what happened (done, skipped, still planned) after a trip finishes.
