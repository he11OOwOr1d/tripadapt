# Date-by-date view (the agenda): learning note

21 November 2026. Step 2 of the in-app calendar plan: a read-only view of the plan date by date, in the whole-trip view ("See the whole trip"), above the road-time and calendar-file panels. The time-grid view (days as columns on a wide screen) is not built yet.

## What it shows

- **Every day of the trip, empty or not**, with where the traveler is that day ("Jaipur", or "Jaipur → Agra" on a travel day) and a "Plan this day" button on empty days, so gaps are visible.
- **Each line is one thing on the plan**, sorted by local time: activities (with the place name when it differs from the title), journeys (departs and arrives, naming a time zone only when the two ends differ), and stays. A stay appears on every day it covers as "Check in", "Staying at" and "Check out", placed by the times the traveler recorded (check-out first thing and check-in last when no time was recorded). On a day the stay changes, the old one checks out before the new one checks in.
- **An overnight journey also appears on the day it arrives.** An activity that runs past midnight stays on its own day and says "(next day)". Skipped activities are shown, struck through and labelled "skipped", not hidden. A date outside the trip's own days is kept under "Outside your trip days" instead of being dropped.
- **Only for trips with exact dates**, like the calendar file; otherwise a hint says so. It is the traveler's own plan, not a booking.

## How it is built

- `lib/trips/trip-agenda.ts` (`agendaDays`) is a pure function over `tripEvents` (the shared event list also behind the calendar file). It builds the list of days from the route schedule, puts each event on its date, and decides which day view each line opens. `app/trips/TripAgenda.tsx` only renders it.
- **Read-only by design.** A line is a button that opens that day in the existing day view (the same code path as "Open these days"), where all the editing, locking, rebalancing and AI-review rules already live. A drag-and-drop calendar would have had to re-implement or bypass those.
- **Which day opens.** An activity or stay line opens its own destination and the day within it; a journey, or an empty day, opens whichever destination the day belongs to, preferring the one being arrived at on a travel day.
- **Accessibility.** A real ordered list of dates (`ol`), each with a heading (`h3` with a `time` element) and a list of lines; every line is a full-width button of at least 44 px with hidden text saying which day it opens; kinds differ by edge style (solid, double, dashed) and by wording, not by colour alone; skipped is text as well as strike-through.

## Checks

- 12 tests for the model (293 frontend tests pass in all), worked out by hand from the route (Jaipur 2 nights then Agra 1 night is 4 to 7 December) rather than copied from output: empty days and the day each opens, time order, stay lines and untimed ordering, stay changes, same-zone and cross-zone journeys, overnight arrival, markers, past-midnight activities, skipped and outside-the-trip dates, no change to the plan, a time zone that does not exist throwing, and a month and year boundary. I broke the model four ways on purpose (untimed check-out sorting last, a wrong day number, the overnight arrival line removed, the departure stop opening on travel days) and each was caught.
- Live on the local page with a dated guest draft (2 destinations, 3 stays, a journey): 9 days and 15 lines; axe clean on the section; no control under 44 px and no horizontal overflow at 1280 or 390 px; pressing Enter on a focused line opens the right day; clicking a line from the second destination opens that destination's day 1.
- **Not checked:** the hosted app and a signed-in trip (not deployed), a screen reader, and trips with many events a day.

## Limits worth knowing

- A trip whose route covers fewer days than its dates (the "3 nights still open" case) lists only the route's days; the open nights are noted below it as before.
- Times use the zone typed or found for each destination; a destination with a zone that is not real makes the view say it could not be built, as the calendar file does.
