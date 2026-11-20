# Learning: taking the plan out of the app as a calendar file

20 November 2026. A plan is only useful on the trip if it can leave the app, so "See the whole trip" now ends with **Take your plan with you**: a button that downloads a calendar file (.ics) for any calendar app. It is made entirely in the browser from the traveler's plan; nothing is uploaded and nothing in the plan changes.

## What goes in

- **Activities** as timed events (skipped ones are left out), with the place name or the destination as the location and a note that this is the plan, not a confirmed booking.
- **Stays** as all-day events from check-in to check-out, one per stay (several stays in one destination each get their own), with the stay's address, check-in and check-out times, the traveler's own confirmation reference and whether they marked it as booked.
- **Journeys between two destinations** that have a recorded departure and arrival, as one event from the departure (in the origin's time zone) to the arrival (in the destination's), rolling to the next day when the arrival time is earlier (an overnight train); with only one time, a 15-minute marker ("Departs:" or "Arrives:").
- It needs **exact trip dates**; otherwise the section says so instead of guessing dates. Journeys to and from the starting point are not written, because the starting point has no known time zone.

## Decisions

- **Times in UTC.** Wall-clock times are converted with the destination's own time zone and written as UTC instants, so no calendar needs the zone's rules and daylight-saving changes are handled where the date is known. The conversion is a pure function checked at the daylight-saving edges (New York on 8 March 2026, 01:30 and 03:30, and Paris in July).
- **Standard text rules.** Values are escaped (backslash, semicolon, comma, newline) and lines are folded at 75 octets without splitting a multi-byte character, with CRLF line endings.
- **Honest wording.** Every description says the times and places are the traveler's plan and not confirmed bookings, and the button text says nothing is uploaded.

## Verification

- **Automated:** 6 frontend tests (UTC conversion across zones and daylight saving; escaping and folding with accents and symbols; no calendar without exact dates or content; activities on the right date and skipped ones omitted; stays, several of them, with their notes; journeys with both times, overnight, one time and the excluded start journey); 258 frontend tests pass; typecheck and build.
- **A bug the tests had hidden.** I checked a generated sample against a small independent validator (CRLF, 75-octet lines, balanced events, and no unescaped comma, semicolon or backslash in any text field). It showed semicolons were not escaped: the code and its own test both wrote `"\;"`, which JavaScript reads as a plain `;`, so the test agreed with the bug. Both now use `"\;"`, and the validator reports nothing wrong on a sample with commas, semicolons, backslashes, accents and a snowman in every text field. Lesson recorded: a test written from the same belief as the code can pass on a bug; check output against something independent.
- **Live, signed in, on the disposable trip** (exact dates 4 to 7 December): with a booked stay (reference and times) and a booked journey Jaipur to Agra (departs 09:00, arrives 12:30), the button reported "Downloaded 2 events" and the file, intercepted from the page, held the stay (4 to 6 December, all-day) and the journey (03:30 to 07:00 UTC, which is 09:00 to 12:30 India time). Axe found no violations and the button is 44 px tall. I removed the stay and journey details afterwards.
- **Not verified:** that Google Calendar, Apple Calendar or Outlook accept the file (none was available; the independent check is structural, not a real import), a real browser download to disk (the file was captured before saving), and a screenshot.
