# Release: stay features and accessibility fixes (pushed and deployed 21 November 2026)

20 November 2026. A checklist for pushing and deploying the local commits on `main` after `568a6b7` (66 commits: stay route checks, intercity and whole-route estimates, journeys booked elsewhere, booked-stay nights, AI and chat awareness, a cache, and accessibility fixes; see `git log 568a6b7..main`) (the stay record deployment). The owner asked for the deploy on 21 November 2026; see the release record below. The signed-in checks further down are still to be run on the hosted app.

## What is in the batch

- **Backend:** four new optional fields on each journey's travel preference (`departure`, `arrival`, `reference`, `booked`, `arrival_buffer`, `departure_buffer`, `locked`); `POST /journeys/from-stay`, `/journeys/to-stay` and `/journeys/intercity` (a driving estimate between two mapped places, including a starting point chosen from the map search); an optional `place_id`, `booked_nights`, `first_night`, `last_night`, `locked` and `reference` on a stay record, and `extra_lodgings` (up to four more stays per destination); the AI day planner and chat read the stay; the readiness context offers a searched stay as a known location. OpenAPI snapshot regenerated.
- **Frontend:** the stay journey section with check-in and check-out notes, an intercity drive-estimate button on the arrival and departure cards, a calendar (.ics) download in the whole-trip view, linked costs in the stay panel, the stay in the restore review, keyboard focus fixes in the stay form and the chat log, journey booking details with day-view flags, a unique label on the map section, h2 transfer-card headings, and darker muted text in the trip stylesheets (`app/trips/*.css` only; the locked landing and `app/design/` are untouched).
- **No migration, no new environment variable, no new dependency.** The intercity endpoint has a per-process in-memory cache (six hours), lost on restart; on Render's free tier a cold start clears it. The AI features use the existing Groq key; route checks use the existing Geoapify backend key.

## Release record (21 November 2026)

- Pushed `568a6b7..02a1cec` to `main` (no branch or PR). Before pushing, the CI steps passed locally on this exact commit: ruff, 645 backend tests, 261 web tests, typecheck and production build.
- GitHub CI (`verify`) passed. The commit status shows Vercel `elsewhere-ui-review` and `elsewhere-api` both succeeded.
- Hosted backend (Render, redeployed from `main` automatically): `/journeys/from-stay`, `/to-stay` and `/intercity` answer 401 unauthenticated (404 before); `/api/v1/health/ready` is ok with the database connected at schema `0026_drop_google_place_id`. No migration was needed.
- Hosted frontend: the production JavaScript contains the new strings ("Download a calendar file", "Estimate the drive", "Add another stay in", "Road time across your route", "Check from my stay", `extra_lodgings`).
- One push triggered Render and Vercel at the same time, so the "frontend must not go first" order could not be enforced. Render was already serving the new backend by the time it was checked; any request in the short gap that sent a searched stay to the old backend would have been refused, not saved wrongly.
- **Signed-in checks on the hosted app** (dedicated QA trip, owner's session, baseline empty day 1, no stay, Jaipur 2 nights; restored and confirmed after a reload): checklist 1 passed (live stay search, choose, save, reload shows it, remove, reload shows none); 4 passed (hosted chat says "You are staying at Swagatam RTDC Hotel; your own record, not confirmed with the stay"); 5 passed (the hosted AI planner completed with the stay recorded; proposal discarded); the map renders with the stay pin. Not run on the hosted app: 2, 3, 6 to 14 (they need mapped visits, a second destination, linked costs or an exact-date trip). The phone-width check and the signed-in screenshots were not done (the preview window cannot take screenshots).
- **Not yet done:** the remaining signed-in checks, and importing the calendar file into a real calendar app.

## Order

1. Push to `main` (no new branch or PR, as instructed earlier). CI should run the same steps that passed locally on Python 3.14.4 and Node 22.23 (see journal entry 177).
2. Wait for CI, then confirm Render serves the new backend (a request to `/api/v1/journeys/from-stay` unauthenticated should return 401 rather than 404; the API publishes no `/openapi.json`).
3. Then confirm both Vercel projects deployed the same commit. The frontend must not go first: it sends `place_id`, which an older backend rejects (the stay model forbids unknown fields).

## Rollback hazard (read before rolling back)

Once a stay with a `place_id`, `booked_nights`, `locked`, a night range or another stay, or a journey with booking details (`departure`, `arrival`, `reference`, `booked`, `arrival_buffer`, `departure_buffer`), has been saved, rolling **either** half back to the previous release can make that plan unreadable: the older backend's stay model forbids unknown fields, and the older frontend's validator rejects unknown stay keys too. If a rollback is ever needed after the release has been used, first remove stays that were saved from a search, or prefer rolling forward with a fix. Stays saved before this release have no `place_id` and are unaffected.

## Signed-in checks after deploying (hosted app)

Use a dedicated QA trip, record its baseline, restore it afterwards, and do not sign out of the owner's session.

1. Stay panel: search nearby stays, choose one, set check-in and check-out, save, reload, remove, reload.
2. With a stay and two visits on a day: "Check from my stay" and "Check the way back" (walk and drive); change a visit's length and confirm the old result disappears; confirm the check-in note on the arrival day and the check-out note on the departure day.
3. "Check a fresh start for today" with the saved draft: the stay is listed under the mapped places.
4. Chat: "Summarize my route" and "Explain this day" mention the stay as the traveler's own record.
5. "Plan this day with AI" with a stay recorded: the job completes; discard the proposal.
6. Link a temporary cost to the stay in the trip form and confirm it is listed in the stay panel, then remove it.
7. At 390 px: no horizontal overflow and no control under 44 px in the stay section.
8. With a second destination on the QA trip (remove it afterwards): open the first destination's last day and press "Estimate the drive" on the "Moving on" card; expect a plausible road time and distance and the Geoapify credit. The first and finish legs (the trip origin) must show no button.
9. Starting location: in the trip form choose a starting location from the map search; the first destination's first day and last day (when returning to the start) each show an estimate. Then retype the plain name to restore the trip, and confirm the buttons are gone.
10. After an estimate, press "Use … hours as my travel time": the card shows the hours; clear them in the trip form afterwards (the journey keeps an empty default preference entry, which is harmless).
11. "See the whole trip" on a trip with two or more mapped destinations: press "Estimate all … mapped journeys"; each journey gets a time and distance and the total equals their sum.
12. On a disposable trip, open a destination's day, add a 09:00 visit, record an arrival of 10:00 on its arrival card and a departure of 09:30 on its moving-on card: the visit shows both flags; remove the details afterwards.
13. A booked stay with "Nights you booked" different from the destination's nights shows the mismatch note, and the trip dates show on a trip with exact dates; set the nights equal and the note disappears.
14. On a trip with exact dates and a stay or a recorded journey: "See the whole trip", "Download a calendar file", open the file in a real calendar app (Google, Apple or Outlook) and confirm the stay (all-day) and journey land on the right dates and times.
15. Look at the page once on a visible window: the darker muted text and the stay pin have only been checked by numbers and DOM so far.

## Known gaps carried into the release

Screenshots of the day view (days 1 and 3), the whole-trip view and the two-stay day were looked at on the local app (desktop and 390 px, guest draft, no network lookups), which found and fixed one layout bug; the two stay pins on a real map were seen at desktop and 390 px (pins identical in look, told apart by hover text, click and the status line; no overflow, no control under 44 px); the chat panel was seen at desktop and 390 px but only as the real chat markup copied from the signed-in page into a guest page (the signed-in browser could not produce screenshots), and the signed-in day view itself has not been seen in a screenshot; the hosted app has not been checked; the restore-review stay line is type-checked only; whether the AI prefers nearer places is not shown: three real runs with a stay recorded gave mean distances of 1.0 km (all within 1.2 km) and 1.7 km (0.6 to 3.2 km, a museum 3.2 km away), and one run without a stay gave 2.2 km (0.6 to 3.2 km); place categories differed, so this is not a controlled test and does not show the AI prefers nearer places; a first visit before 00:30 and states needing more data than the QA trip were not exercised.
