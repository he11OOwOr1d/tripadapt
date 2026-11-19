# Learning: a driving estimate between destinations

20 November 2026. The arrival and departure cards in the day view said "Transport to decide" and nothing more, which left the biggest travel question of a multi-destination trip unaddressed. Each card between two mapped destinations now has an **Estimate the drive from X to Y** button that shows, for example, "About 3 h 23 min by road, 269 km" (Jaipur to Agra, live). It is a single, explicit lookup that changes nothing.

## What it is and is not

It is a **driving estimate between the two destination centres**, from the same Geoapify routing used by the other journey checks, without live traffic. It is **not** a train, bus or flight schedule, a mode recommendation, a fare, or a booking. The card says so, shows the Geoapify and OpenStreetMap credit and the time it was checked, and does not fill in or alter the traveler's own "travel time" entry, so the estimate and the traveler's plan cannot silently disagree.

## Decisions and tradeoffs

- **Retained references, not coordinates from the browser.** `POST /api/v1/journeys/intercity` takes two destination reference ids and reads the coordinates server-side from the retained place records, so the request cannot be used to route arbitrary points. It rejects the same place twice (422), unknown ids (404) and unknown fields or modes (422, the mode is fixed to drive), needs sign-in (401), returns `Cache-Control: private, no-store`, reuses the per-user route rate limit and writes nothing. A provider failure is returned as an error, never as zero minutes.
- **Only between two mapped destinations.** The trip's starting point is stored as a name with no coordinates, so the first leg (start to the first destination) and the finish leg (last destination back to the start) show no button rather than a guess from the name. Geocoding the starting point would unlock those legs; it was not done here.
- **Drive only.** Free route data has no timetables. Walking between cities is not meaningful, so the mode is not offered.
- **No total, no side effects.** The result lives in the component and is discarded when either destination or its map link changes (the card is keyed on both).

## Verification

- **Automated:** 3 new backend tests (the two references' coordinates reach the route call and the response carries minutes, distance and warnings, with the place table unchanged; the rejection and authentication cases; a provider failure is an error) and 3 new frontend tests (time formatting such as "4 h 30 min" and "45 min", the endpoint rules, the headline). Full runs: 585 backend and 213 frontend tests, `ruff`, typecheck and build pass; the OpenAPI snapshot was regenerated and its contract test passes.
- **Live, signed in** (local web and API against the hosted database, the dedicated QA trip): I added Agra as a second destination, opened Jaipur's last day, and the "Moving on" card showed the new button; the estimate returned "About 3 h 23 min by road, 269 km" with the credit and the caveats. Axe (WCAG 2.0 to 2.2 A and AA plus best-practice) reported no violations on the whole page, and at 390 px there was no horizontal overflow and no control under 44 px. I then removed Agra, and a reload showed Jaipur back at 2 nights with the "Moving on" card returning to Delhi with no button and the session still signed in.
- **Not verified:** the hosted app, a screenshot (the window was hidden), a trip with three or more destinations (the arrival card of the second stop uses the same code path but was not opened), and very long routes (the route parser accepts up to 7 days and 20,000 km, covered by the existing parser tests, not run live).
- **Not done:** the start and finish legs, other travel modes, and offering the estimate as a suggestion for the traveler's travel-time field.
