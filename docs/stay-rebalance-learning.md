# Moving nights between stays

15 November 2026. Implementation note, not a change to the finalized requirements.

## Work and scope

This is the first piece of multi-stay replanning from the core workflow audit. A traveler can move nights between two stays, or between a stay and the trip length. Example: "one more night in Jaipur, taken from Udaipur", or "two more nights in Udaipur, and make the trip longer".

- **Draft-only.** `POST /trips/{id}/draft/stay-rebalance` previews by default and writes the draft only with `apply: true`. It requires the draft precondition (If-Match) and is refused for completed or archived trips. The accepted plan changes only through the existing Review plan and Accept flow.
- **Trip length.** When nights come from or go to the trip length, the duration changes for flexible-length trips and the end date moves for exact-date trips. Route order and journeys never change.
- **No silent changes.** A stay with N nights spans day offsets 0 to N. Activities on days that would no longer exist block the change:
  - fixed, booked or completed ones always block (`REBALANCE_PROTECTED`, with the list);
  - flexible ones block until the traveler explicitly ticks them to drop (`REBALANCE_DISPLACED`, with the list).
  Nothing is moved to another day automatically.
- **Costs follow the existing rules.** Stay allowances recalculate from the new nights. The candidate is re-validated, so a dropped activity's estimate goes and any paid cost linked to it stays as a removed-link record. The preview shows estimates before and after, and any kept payments.
- **Not supported here.** Stays with fixed arrival or departure dates are refused (`REBALANCE_DATED_STOPS`), as are changes that would break the trip's duration or window.

## Placement and coordination

- **Placement.** The UI is a "Change nights between stays" disclosure in the itinerary route panel, shown only for saved account trips that are planning or active. It reloads the trip after an apply.
- **New files:** `app/planning/stay_rebalance.py`, `app/api/stay_rebalance.py`, `lib/trips/stay-rebalance.ts`, `app/trips/StayRebalance.tsx` and tests.
- **Small edits to shared files:**
  - router registration in `main.py`;
  - one insertion in `ItineraryWorkspace.tsx`;
  - CSS;
  - `AccountError` now keeps the parsed problem body (an additive change), so the blocked activity list reaches the UI.

This work ran alongside a separate Codex session doing QA in the same working tree.

## Verification

- **Backend:**
  - Pure tests: moving between stays (allowance change 1200 → 1300 with the 30 guide estimate on top), never dropping silently, explicit drops keeping a paid ticket, rejecting drops of activities that aren't displaced, protected blocks, negative nights, extending a flexible-length trip and an exact-date trip.
  - Endpoint test on Supabase: a displaced block with its list; a preview that leaves the draft tag unchanged; an apply that edits only the draft; a stale tag rejected with 412.
- **Frontend:** 153 tests, covering the reply describing exactly the requested move (no other stay changes, exact drops, never a protected drop) and blocked lists with the draft precondition. TypeScript passes for these files.
- **Browser, signed in, on "UX check · two-stop escape":**
  - Preview of Jaipur 6 → 7 and Udaipur 6 → 5.
  - Removing 4 Jaipur nights blocked on "Rest break" (day 4), which had to be ticked before the preview showed the trip at 14 → 10 days. Not applied.
  - Applied +1 night and then the reverse. This found and fixed a stuck "Checking…" state after apply: the component was aborting its own request controller.
  - The trip was compared against a saved baseline afterwards: draft and accepted plans are identical, with 11 activities and 6 + 6 nights.
- **Not verified:** the production build is currently blocked by the other session's in-progress `ProposalReview.tsx` type errors, which are outside this work.

## Moving displaced activities within their stay (entry 74)

Shrinking a stay no longer forces a drop. For each displaced flexible activity, the traveler now chooses either **drop it** or **move it to a remaining day of the same stay**, at the same time and with the same duration.

- **Within the same stay only.** The activity keeps its map place and its linked costs. Moving a mapped place to another city wouldn't make sense.
- **Only remaining days.** The day must exist after the change (`REBALANCE_MOVE_INVALID`). An activity gets one decision: drop or move. Only displaced activities can be moved.
- **No overlaps.** A move that would overlap another activity on its new day is blocked with the exact clash (`REBALANCE_OVERLAP`, for example "Overlaps Meal break"), and the traveler chooses again. Fixed, booked and completed activities still block before any choice.
- **The reply must match the choices.** The preview lists each move (day before → day after). The client rejects a reply whose moves differ from what was chosen.
- **Evidence:**
  - Pure tests: a valid move that keeps its costs linked, a day that won't exist, an overlap with the cooking class, both choices for one activity, protected blocking.
  - The Supabase endpoint test still passes.
  - Frontend: 154 tests.
  - Signed-in browser on "UX check · two-stop escape": removing 4 Jaipur nights offered days 1–3 for "Rest break"; day 2 previewed as "day 4 → day 2 at 12:00"; day 3 was blocked as "Overlaps Meal break". Preview only, so the trip is verified unchanged against its baseline.

## Choosing a new time for a moved activity (entry 75)

A move can now set a new start time on the new day. Leaving it out keeps the original time.

- **Time format.** Times are validated as HH:MM.
- **Checks.** Overlaps and running past midnight are both checked against the moved activity. They come back as a decision with a plain reason ("Overlaps Free time.", "Would run past midnight at this time."), not as a generic validation error.
- **Reply check.** The preview lists the time before and after. The client rejects a reply whose time differs from the one chosen.
- **Evidence:**
  - Backend: 7 rebalance tests (a move to 14:00 on a clear day, midnight blocked, invalid times rejected).
  - Frontend: 155 tests.
  - Signed-in browser on "UX check · two-stop escape": day 3 at 14:00 was correctly blocked by "Free time" (13:15–14:15); day 3 at 15:00 previewed as "day 4 12:00 → day 3 15:00"; 23:45 showed the midnight message. Preview only, and the trip is verified unchanged against its baseline.

## Moving an activity to another stay (entry 76)

A displaced activity can now move to any stay that remains in the plan, on a day and time the traveler picks.

- **The map link is cleared.** A mapped place belongs to its original destination, so carrying it would point a Udaipur activity at a Jaipur venue. The place and Google listing links are removed, and the preview says "map location removed; choose a place in <destination> afterwards". The activity keeps its ID, so linked costs stay attached.
- **Target day checks.** The target day must exist in the target stay after the change. Overlap and midnight checks apply on the new day as before.
- **Reply check.** The client verifies the reply reports the chosen stay, and that a same-stay move never clears a map link.
- **Evidence:**
  - Backend: 8 rebalance tests (a cross-stay move clears map links and keeps costs, a day beyond the target stay, an unknown stay).
  - Frontend: 156 tests.
  - Signed-in browser on "UX check · two-stop escape": the choices are grouped by stay; "Rest break" previewed as "Jaipur day 4 12:00 → Udaipur day 2 15:00", with no map note because it had no place. Preview only; the trip is verified unchanged.
- **Fixed during the check.** The option-group label claimed a map location "will be removed" even for unmapped activities. It now reads "any map location is removed".

## Next

- Reconciling transfers when the route order itself changes (journey keys, allowances and linked journey costs).
- Prompting to choose a new place after a cross-stay move.
- Recording what actually happened to each activity.
- Production deployment (in progress in the other session).
