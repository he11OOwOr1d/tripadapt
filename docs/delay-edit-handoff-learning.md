# Learning: move from a review warning to the real activity

13 November 2026. Missing-location entries in a day-delay review now open the existing activity editor directly at its map controls. This works both from the nested delay preview and from a saved pending review. Closing the review for editing neither accepts nor discards it.

## Decisions and tradeoffs

- Resolve the editable activity from the current draft, never from candidate times in the frozen review. A proposal showing 10:45 must not overwrite the real activity's 10:15 start when the traveler only wants to add a map location.
- Keep the selected delay start and ready time in an in-session return reminder scoped to the account trip, destination and day. Returning requires a fresh readiness confirmation and an explicit new preview. Acknowledgments, Google choices and acceptance state are not carried over.
- Wait for account autosave before enabling continuation. The new preview uses the latest draft ETag and a fresh idempotency key. The original review remains pending and becomes stale after a saved edit; it is not silently rebased or deleted.
- Allow editing the immediately preceding activity when its map location is needed for the incoming journey. Reject unrelated IDs, stale/accepted/discarded reviews, other operations and missing or moved starting activities. Protected flags are retained in the manual editor.
- Open the map disclosure and focus its control. After closing the editor, focus returns to the day reminder. The reminder offers explicit Continue and Dismiss actions without adding top-level navigation.

The return reminder is transient UI state. Reload does not restore that reminder; saved pending reviews remain recoverable through Review plan. This slice does not automatically retry provider calls, apply the candidate, confirm the traveler's location or make reservations. Existing backend contracts, schema and environment variables are unchanged.

## Verification

All 72 frontend tests, TypeScript and production build pass. Five new tests cover current-draft versus candidate-time isolation, incoming predecessor scope, stale/status/operation rejection, changed or completed starting activities, and day-13 continuation without imposing a trip-length cap. Backend behavior is unchanged from the previously verified 264-test baseline.

Browser QA used the existing two-stop QA trip's day 3. A delay starting at the second activity with ready time 10:45 created review 28. Its missing-location action opened the preceding culture visit at the real 09:00–10:00 time, with the map disclosure open and focused. Cancel returned to the day reminder. Continue restored the second activity and 10:45 while readiness remained unchecked and Preview disabled.

The same review was resumed through Review plan, and its direct edit action opened the same current activity. Albert Hall Museum was linked using live discovery. Saving showed the autosave gate, then continuation became available and received focus. A fresh explicit preview used the new saved location: the preceding culture visit no longer appeared among missing locations, while the four affected unmapped items remained listed. The new review was discarded, and the temporary map link removed from the editable trip. The original review was inspected as stale and discarded separately. No proposed schedule was accepted or applied. Original QA activity titles/times and earlier pending reviews were preserved.

Desktop and 390-pixel phone layouts were checked. Screenshots: `/tmp/elsewhere-delay-handoff-desktop.png` and `/tmp/elsewhere-delay-handoff-phone.png`.

## Remaining scope

Successful all-mapped live Google day acceptance remains unverified. Broader place search, partial provider-result inspection, cross-day redistribution, weather and fatigue triggers remain separate work. Only learning documentation updated; core design documents unchanged. No push or deployment.
