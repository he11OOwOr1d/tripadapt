# Date-by-date view (the agenda): learning note

21 November 2026. Step 2 of the in-app calendar plan: a read-only view of the plan date by date, in the whole-trip view ("See the whole trip"), above the road-time and calendar-file panels. A time-grid view (days as columns on a wide screen) is built on the same lines; see the last section.

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

## The grid view (21 November 2026)

A "List | Grid" switch appears on the date-by-date section when the window is at least 1200 px wide; the list stays the default and the only view below that. Narrowing the window while in the grid brings the list back. The choice is not remembered between visits.

- **Layout.** Five days to a page (Earlier days / Later days), the axis shared by every column on the page (always 08:00 to 20:00, stretched to cover anything earlier or later), a band above the hours for the stay lines (check-in, staying, check-out), and blocks placed against each day's own clock. A short event is drawn at least half an hour tall so it can be read and pressed.
- **Overlaps.** `packLanes` puts events that overlap, directly or through a chain, side by side in equal lanes; an event with nothing beside it gets the whole width, and one that ends exactly when the next starts does not count as overlapping.
- **Journeys.** A journey is drawn from its departure for as long as it really takes (the difference between the two instants), so a flight across time zones is not drawn with the false length its two clock times suggest. One that crosses midnight is drawn up to midnight and carries on from midnight in the next day's column. Each day is drawn against its own clock, so a flight crossing midnight in two zones is drawn in two parts.
- **Model.** `lib/trips/trip-grid.ts` (`packLanes`, `gridPages`) is pure, with 8 tests, including the cases that decide lane widths and a realistic trip with a flight from India to Paris. I broke it four ways on purpose; the first attempt missed one (a touching span widening its neighbours' lane count), so I added that case and it is now caught.
- **Read-only, and accessible.** The DOM order is day by day, then by time, each column a labelled section with lists; the gridlines and hour labels are decorative. A block is a button with its visible text plus hidden text saying which day it opens, so it reads the same as in the list. Pressing Enter on a block opens that day.
- **Crowded days.** With three events at once each lane is about 40 px wide, which cannot hold a title. Hovering or focusing a block shows its full text in a small pop-up. My first version widened the focused block over its neighbours; axe correctly flagged that it left the covered neighbour too small to hit (WCAG 2.2 target size), so the pop-up is now text only: it never takes clicks, never resizes anything, and is hidden from assistive technology (the content is already in the button). The list view shows every event at full size.
- **Sizes.** The all-day chips are 44 px tall; time blocks follow the time scale and are never under 30 px, above the 24 px WCAG 2.2 minimum but below this project's usual 44 px, which a time scale cannot give a short event. The list view is the full-size alternative.
- **Checks.** 301 frontend tests pass; on the local page with a 3-destination trip (overlapping activities, a skipped one, a night market, a bus and an overnight flight to Paris): 5 columns, 11 blocks and no two blocks overlapping on screen, no control under 24 px, axe clean (also while a block is focused), no page overflow, paging to the second page works, Enter on a focused block opens the right day, and the switch appears only at 1200 px and wider.
- **Not checked:** the hosted app and signed-in trips (not deployed), a screen reader, a phone or touch device (the grid is not offered there), trips with very many events in a day, and remembering the chosen view.

## Remembering the view, and 3 or 5 days per page (21 November 2026)

- **The List / Grid choice is remembered** in this browser, and so is the page size. Both are per-viewer conveniences stored in local storage (`elsewhere.agenda-view.v1`, `elsewhere.agenda-grid-days.v1`), read after the page loads so the first render matches the server's. They are never sent anywhere and never decide anything about the plan.
- **The helper never throws.** `readPref` returns a value only if it is one of the allowed ones, so a stale, edited or unrelated stored value falls back to the default; with storage blocked, missing or failing (private windows, blocked site data, a full store) it falls back too, and `writePref` just reports false. 3 tests cover junk values, blocked and throwing storage, and the round trip.
- **3 or 5 days per page.** Three days gives a crowded day about 70% more width per lane on the local test (a block 43 px wide became 74 px), which is where the grid was weakest; five days shows more of the trip at once. Seven was left out: at the width this section has, seven columns would be about as cramped as the crowded lanes.
- **Changing the size keeps your place.** `pageAfterResize` makes the first day on screen stay on screen (page 2 of 3-day pages, starting 7 December, becomes page 1 of 5-day pages, which contains it). A test checks that for every starting point both ways, not just examples.
- **Checks.** 305 frontend tests pass. On the local page: a fresh visit shows the list and stores nothing; choosing Grid stores it and a reload returns to the grid; choosing 3 days stores that and a reload keeps both; choosing List again is remembered; axe is clean; the new controls are 44 px tall. Blocked storage was checked by the unit tests only, not on a live page.
