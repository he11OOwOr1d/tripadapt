# Daily hours: learning note

22 November 2026. PRD FR-01 lists "optional daily hours" among the things captured at trip setup, and FR-06 expects daily windows to be respected. Neither existed: the day was fixed in three places that did not even agree. The day view drew open time between 08:00 and 22:00, "Add activity" suggested 09:00, and the AI planner was locked to 09:00 to 18:00. A traveler could not say "I am a late riser, plan 10:00 to 23:00" or "I am out from 06:00".

## What it does

- **A new optional "Your day" field** in the trip form (under the optional preferences, beside Pace and Interests): "Day starts" and "Day ends". Leave both empty for the usual day. A short explanation says what it changes.
- **Both or neither, at least four hours, within one day.** One without the other, a malformed time, an end at or before the start, or a day shorter than four hours is refused. The form says why in plain words ("Your day needs to cover at least four hours, and end by midnight") and says it is not saved to the account until fixed. The rule is the same in the browser (`lib/trips/traveler-day.ts`) and the API (`Preferences` in `app/trips/schemas.py`), so a draft is never saved that the API would refuse.
- **The AI plans inside the traveler's day**, narrowed further by a recorded arrival or departure exactly as before. The model is told the window, and anything it proposes outside it is repaired or refused.
- **The day view** draws open time inside the traveler's hours (stretching to show an activity outside them rather than hiding it), says "open gaps shown within your 10:00–23:00 day", and "Add activity" suggests the first free hour inside the day.
- **The wide grid's axis** starts from the traveler's day and still stretches for anything outside it.
- **With no hours set nothing changes**: the same 08:00 to 22:00 view, 09:00 suggestion and 09:00 to 18:00 AI window as before. Plans saved before this existed load with no hours.

## A trap found before it bit

The AI is checked twice: while planning (against the day narrowed by journeys) and again at the publish and accept boundary, which used its own hard-coded 09:00 to 18:00. Widening only the planner would have let it propose a 20:00 block that the last step then rejected, so a late rider's perfectly valid proposal would have failed at the end. The publish check now uses the traveler's day as its outer limit. A test breaks if either place goes back to the fixed day (I put the fixed day back in each place on purpose; both were caught).

## A mistake of mine, caught immediately

I first named the new module `lib/trips/day-hours.ts`, which already existed (the opening-hours check) and overwrote it. The type checker flagged it within seconds, I restored both files from git (they show clean) and renamed mine `traveler-day.ts`. The lesson is to check for an existing file before creating one.

## Not done, on purpose

- **No warning for an activity outside the traveler's hours.** A traveler who sets 07:00 to 22:00 and then plans a 23:00 night market probably means it, so it is drawn (the day stretches to show it) but not flagged as a conflict. If you want a soft note, that is a small follow-up.
- Chat, journeys' buffers and the remaining-day check do not read the hours; only the AI day planner, the day view and the grid do.

## Checks

- Backend: 23 new tests (694 pass in all): validation (both or neither, bad formats, wrap-around, exactly four hours), the window with and without journeys and buffers, a late rider's 20:00 block accepted first time versus repaired for the default day, a short day rejecting a block that would run past its end, a day left with no usable time still skipping the model, and the publish check agreeing with the planner.
- Frontend: 6 new tests for the validation and day helper, 1 for the timeline window (mutation-checked) and 1 for the grid axis; 319 pass.
- Live on the local page with a dated draft whose hours are 10:00 to 23:00: the form shows the saved hours and a reset button; an end of 12:00 shows the plain message with `aria-invalid` and clearing it removes the message; axe is clean (after darkening the help text from 4.45:1 to pass 4.5:1); the day view says "within your 10:00–23:00 day", shows no open time before 10:00, and "Add activity" starts at 11:30, the first free hour.
- **Not checked:** the hosted site (not deployed), and running the real AI against hours (the fake-model tests cover the logic; a live Groq run with custom hours was not done).

## Deploying

No database migration (hours live inside the trip's preferences, which are stored as JSON). The same rollback hazard as earlier features: a plan saved with hours contains keys an older backend's strict model would reject, so roll forward rather than back once hours have been saved.
