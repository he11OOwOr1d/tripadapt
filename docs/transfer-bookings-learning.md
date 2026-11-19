# Learning: recording a journey you already booked

20 November 2026. The PRD (FR-05) asks for an "Add existing transport booking" form: the traveler enters the mode, endpoints, departure and arrival times and an optional reference for a journey booked elsewhere, so the itinerary reserves that time. Until now the arrival and departure cards only held a mode, an approximate number of hours and an allowance. Each card now has **Add a journey I already booked**, and the day view flags activities that clash with the times entered.

## What it is and is not

It records what the traveler tells the app: an optional departure time (local to the journey's start), an optional arrival time (local to its end), an optional reference or note up to 100 plain characters, and an "I have booked this myself" checkbox. It is **not** a booking, a ticket check or a live status, and the text says so in three places: the form, the card summary ("As you entered it; not checked with the supplier") and the flags ("your recorded arrival"). Nothing contacts a supplier.

## What changes in the day view

- **Arrival counts on the first day at a stop.** An activity that starts before the recorded arrival is flagged: "Starts before your recorded arrival at 10:00."
- **Departure counts on the last day.** An activity that ends after the recorded departure is flagged: "Runs past your recorded departure at 09:30." A stop with no nights has one day, so both checks apply to it.
- **Existing behavior is untouched.** The flags use the same highlight and the same "Open a highlighted item" flow as overlaps; skipped activities never clash; no times means no flag. The banner now says "Some timings need a look" because overlaps are no longer its only cause.
- **No buffer is added.** The traveler's own times are taken as they are, and the form says so. The PRD's configurable boarding and check-in buffers are not built.

## Decisions and tradeoffs

- **Extend the existing per-journey entry.** The journey's preference already carries the mode, hours and allowance, keyed by the route leg, so the booking fields (`departure`, `arrival`, `reference`, `booked`) are four new optional fields on it, not a new table or a migration. Older plans without them stay valid (a backend test loads one), and saving a booking changes only those four fields.
- **Validation twice.** The backend model and the frontend validator agree: times are `HH:MM` or blank, the reference has no control characters and at most 100 characters, unknown fields are rejected by the backend.
- **A journey's two ends are separate local times.** The departure is local to the origin and the arrival to the destination, so a journey that crosses time zones needs no conversion in the app. The cost is that an arrival on a different calendar day than the departure (an overnight train) is not modelled: arrival is a time of day on the stop's first day, and the journey's "nights on the move" stay as the traveler set them.
- **Where it shows.** The card summarizes the entry. The activity flags come from a pure function (`transferConflicts`) that finds each stop's inbound and outbound journeys through the same route legs as the rest of the app.

## Verification

- **Automated:** 4 backend test groups (defaults, a valid booking, ten invalid cases including bad times and control characters, a plan round trip and an older plan still loading) and 7 frontend tests (validation, the update touching only the booking fields, the summary, arrival and departure days, a one-day stop, a second stop using the legs between stops, and merging); 607 backend and 232 frontend tests, ruff, typecheck and build pass; OpenAPI regenerated.
- **Live, signed in** (the disposable three-destination QA trip): I added a 09:00 visit to Jaipur's day, recorded an arrival of 10:00 with a reference and "booked by me" on the arrival card and a departure of 09:30 on the moving-on card. Focus moved into the form's first field; the cards summarized the entries; the visit was flagged with both "Starts before your recorded arrival at 10:00." and "Runs past your recorded departure at 09:30."; the banner appeared; a reload kept everything. I then removed both entries and the visit. Axe found one existing color (the conflict message at 4.41:1, never visible before because no conflicts had been on screen), now darkened to #87602f, after which it reports nothing with the form open; at 390 px there was no overflow and no control under 44 px other than the checkbox inside its 44 px label.
- **Not verified:** the hosted app, a screenshot, a booking on the main QA trip, and a second time zone (no check across time zones, since none is converted).
- **Not done:** buffers, overnight arrivals, using the recorded times in the chat or the journey checks, and a transfer as a block in the day timeline. The AI planner now uses them: see the next section.

## The AI day planner respects them

Without this the AI planner would happily propose a 09:00 museum on a day the traveler arrives at 10:00. The planner now narrows its planning window with the traveler's own recorded times: on the first day at a stop the window starts at the recorded arrival (if later than 09:00), and on the last day it ends at the recorded departure (if earlier than 18:00). The narrowed window is passed to the model as `planning_window`, with the raw entries as `traveler_recorded_arrival` and `traveler_recorded_departure` (the prompt says they are the traveler's entries, not verified), and **it is enforced after the model answers**: an addition that starts before the window or ends after it is rejected with "keep added blocks inside 11:00-18:00" and the model gets its normal repair attempt, so the guarantee does not depend on the model following the prompt. The window logic is one pure function (`planning_window`) that reuses the same route-leg keys as the web client. A middle day, or a day with no recorded times, keeps 09:00-18:00.

- **Verification:** 3 backend tests (arrival narrows the first day and a clash is repaired on the second attempt, departure narrows only the last day and the context carries the entry only there, and no recorded times means no new context) with 610 backend tests passing. Live, signed in, with a real Groq call and a local worker on the disposable three-destination trip: with a recorded arrival of 11:00 on the first day, the AI proposal's blocks started at 11:15, 12:30, 13:45, 15:00 and 15:45 and its explanation said "fitting the 11:00-18:00 planning window". I discarded the proposal and removed the arrival.
- **Not verified:** the departure case live, whether the model's choices improve (the enforcement, not the model, is what the tests and this run establish), the hosted worker, and the chat's "add a break" path (it shares the day graph but I did not run it).

