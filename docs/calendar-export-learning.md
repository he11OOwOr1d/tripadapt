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

## Review follow-up (20 November 2026)

A review of the calendar commit found, and I fixed:

- **One bad item could break the whole download.** An activity with an empty or malformed start time, a zero or non-numeric length, or a journey with a half-typed time produced an invalid date and the export threw with no message. Such items are now skipped, the rest of the file is still made, and if anything else goes wrong the page says "The calendar file could not be made from this plan. Nothing was changed." instead of failing silently.
- **Journey ids were positional.** A journey's id was its position in the route, so adding a stop earlier would hand its id to a different journey and a re-import into a calendar app would overwrite the wrong event. It is now built from the two stops' ids (`journey-<from>-<to>`), checked by adding a stop elsewhere.
- **A lone carriage return** in a title or note was not escaped and would break a line; line breaks of every kind are now escaped. A test of this found a second hole the review did not name: the event id used the raw activity id, so a control character there reached the file. Ids are now reduced to letters, digits, dot, dash and underscore.
- **An unnamed stay** reads "Stay: where you are staying" instead of a blank title, and a stay whose first night is beyond the destination's nights is left out instead of being given dates outside it.
- **A stale notice.** "Downloaded 5 events." stayed on screen after the plan changed; it is now cleared whenever the plan changes.

260 frontend tests pass (2 new for these cases); typecheck and build pass. Not re-run live (pure-function changes covered by tests and the independent validator).


## A layout bug only a screenshot showed (20 November 2026)

The whole-trip view lays its destination rows out as flex rows. The new "Road time across your route" and "Take your plan with you" panels were put in the same container, so their text and buttons were squeezed side by side. Tests, axe and DOM checks all passed; it showed up only when I took real screenshots of the page. Both panels are now stacked bordered blocks (CSS override scoped to `.day-overview`). Lesson: a passing DOM check does not tell you how a page looks. Checked on desktop and 390 px screenshots (no horizontal overflow).

## Hardening the file (21 November 2026)

What changed, and why each piece is shaped the way it is:

- **Updating instead of duplicating.** Event ids were already stable (`activity-<id>`, `stay-<stop>-<night>`, `journey-<from>-<to>`). Calendar apps decide "same event, newer version" from the id plus `SEQUENCE` (and `LAST-MODIFIED`/`DTSTAMP`), so each event now carries `LAST-MODIFIED` and a `SEQUENCE` equal to the minutes since 1 January 2020 at export time. It rises with every export without the app having to remember anything, and stays far below the 32-bit limit. A wrong clock before 2020 writes 0, never a negative number. The catch: every export outranks the last one even when nothing changed. That is harmless, and it means an edited event always wins. Whether Google, Apple and Outlook really update in place is **not verified**; the page says so.
- **Reminders** (`VALARM`, `ACTION:DISPLAY`) are off by default, offered as 15 minutes, 1 hour or 1 day before, and written only on timed events. An all-day stay has no start time to count back from, so it gets none. The page and the code accept only whole minutes from 1 to 10080. Durations use `-P1D`, `-PT1H` or `-PT15M`, the forms every parser reads.
- **Map positions** (`GEO:lat;lon`) for activities with a chosen map place and stays with a map location, only for real coordinates (finite, within range, six decimals). Google Calendar ignores `GEO`; Apple and Thunderbird use it.
- **A link back to the plan** (`URL`) for a saved trip on an https address. A guest draft has no trip id and a local address leads nowhere, so neither gets one. The link only opens for the signed-in owner. Any address with a space or control character is refused outright rather than repaired; a first version let the URL parser quietly strip a smuggled line break, which was safe but wrote a mangled link, and my first test of it counted the text inside the link as an extra event, so the test was wrong, not the code.
- **Checks.** 267 frontend tests pass (6 new, including hostile addresses, bad reminder values, bad coordinates, the property order inside an event, and the id staying the same across exports). An independent parser (`icalendar`) read a file with every feature on: four events, rising sequence, reminders only on timed events, positions and links, and a plain export with none of them. Live on the local page: choosing "1 hour before" and downloading gave 7 events, 4 reminders (the 3 stays got none), one sequence number, and no link (guest draft on localhost); axe found nothing on the panel at desktop width; the panel has no overflow at 390 px and the select is 48 px high.
- **Not verified:** importing into Google, Apple or Outlook; a signed-in trip on the hosted site (the link and positions on real data); whether a second import updates in place.
