# Release plan: stay features and accessibility fixes (not yet deployed)

20 November 2026. A checklist for pushing and deploying the local commits on `main` after `568a6b7` (the stay record deployment). Nothing here has been pushed. `AGENTS.md` says to push or deploy only when the owner asks, so this is a plan to follow on request, not a record of a release. Replace it with a real release note afterwards.

## What is in the batch

- **Backend:** four new optional fields on each journey's travel preference (`departure`, `arrival`, `reference`, `booked`); `POST /journeys/from-stay`, `/journeys/to-stay` and `/journeys/intercity` (a driving estimate between two mapped places, including a starting point chosen from the map search); an optional `place_id` on a stay record; the AI day planner and chat read the stay; the readiness context offers a searched stay as a known location. OpenAPI snapshot regenerated.
- **Frontend:** the stay journey section with check-in and check-out notes, an intercity drive-estimate button on the arrival and departure cards, linked costs in the stay panel, the stay in the restore review, keyboard focus fixes in the stay form and the chat log, journey booking details with day-view flags, a unique label on the map section, h2 transfer-card headings, and darker muted text in the trip stylesheets (`app/trips/*.css` only; the locked landing and `app/design/` are untouched).
- **No migration, no new environment variable, no new dependency.** The intercity endpoint has a per-process in-memory cache (six hours), lost on restart; on Render's free tier a cold start clears it. The AI features use the existing Groq key; route checks use the existing Geoapify backend key.

## Order

1. Push to `main` (no new branch or PR, as instructed earlier). CI should run the same steps that passed locally on Python 3.14.4 and Node 22.23 (see journal entry 177).
2. Wait for CI, then confirm Render serves the new backend (a request to `/api/v1/journeys/from-stay` unauthenticated should return 401 rather than 404; the API publishes no `/openapi.json`).
3. Then confirm both Vercel projects deployed the same commit. The frontend must not go first: it sends `place_id`, which an older backend rejects (the stay model forbids unknown fields).

## Rollback hazard (read before rolling back)

Once a stay with a `place_id`, or a journey with booking details (`departure`, `arrival`, `reference`, `booked`), has been saved, rolling **either** half back to the previous release can make that plan unreadable: the older backend's stay model forbids unknown fields, and the older frontend's validator rejects unknown stay keys too. If a rollback is ever needed after the release has been used, first remove stays that were saved from a search, or prefer rolling forward with a fix. Stays saved before this release have no `place_id` and are unaffected.

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
13. Look at the page once on a visible window: the darker muted text and the stay pin have only been checked by numbers and DOM so far.

## Known gaps carried into the release

No screenshot of any of this has been seen; the hosted app has not been checked; the restore-review stay line is type-checked only; whether the AI prefers nearer places is unmeasured; a first visit before 00:30 and states needing more data than the QA trip were not exercised.
