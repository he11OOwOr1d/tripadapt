# Learning: a driving estimate between destinations and from the start

20 November 2026. The arrival and departure cards in the day view said "Transport to decide" and nothing more, which left the biggest travel question of a multi-destination trip unaddressed. Each card between two mapped destinations now has an **Estimate the drive from X to Y** button that shows, for example, "About 3 h 23 min by road, 269 km" (Jaipur to Agra, live). It is a single, explicit lookup that changes nothing.

## What it is and is not

It is a **driving estimate between the two destination centres**, from the same Geoapify routing used by the other journey checks, without live traffic. It is **not** a train, bus or flight schedule, a mode recommendation, a fare, or a booking. The card says so, shows the Geoapify and OpenStreetMap credit and the time it was checked, and does not fill in or alter the traveler's own "travel time" entry, so the estimate and the traveler's plan cannot silently disagree.

## Decisions and tradeoffs

- **Retained references, not coordinates from the browser.** `POST /api/v1/journeys/intercity` takes two destination reference ids and reads the coordinates server-side from the retained place records, so the request cannot be used to route arbitrary points. It rejects the same place twice (422), unknown ids (404) and unknown fields or modes (422, the mode is fixed to drive), needs sign-in (401), returns `Cache-Control: private, no-store`, reuses the per-user route rate limit and writes nothing. A provider failure is returned as an error, never as zero minutes.
- **Mapped ends only.** A button appears only when both ends are mapped. A destination is mapped when it has a retained location reference. The trip's starting point used to be only a name, so the first and last journeys had no button; see the starting-point section below.
- **Drive only.** Free route data has no timetables. Walking between cities is not meaningful, so the mode is not offered.
- **No total, no side effects.** The result lives in the component and is discarded when either destination or its map link changes (the card is keyed on both).

## Verification

- **Automated:** 3 new backend tests (the two references' coordinates reach the route call and the response carries minutes, distance and warnings, with the place table unchanged; the rejection and authentication cases; a provider failure is an error) and 3 new frontend tests (time formatting such as "4 h 30 min" and "45 min", the endpoint rules, the headline). Full runs: 585 backend and 213 frontend tests, `ruff`, typecheck and build pass; the OpenAPI snapshot was regenerated and its contract test passes.
- **Live, signed in** (local web and API against the hosted database, the dedicated QA trip): I added Agra as a second destination, opened Jaipur's last day, and the "Moving on" card showed the new button; the estimate returned "About 3 h 23 min by road, 269 km" with the credit and the caveats. Axe (WCAG 2.0 to 2.2 A and AA plus best-practice) reported no violations on the whole page, and at 390 px there was no horizontal overflow and no control under 44 px. I then removed Agra, and a reload showed Jaipur back at 2 nights with the "Moving on" card returning to Delhi with no button and the session still signed in.
- **Not verified:** the hosted app, a screenshot (the window was hidden), a trip with three or more destinations (the arrival card of the second stop uses the same code path but was not opened), and very long routes (the route parser accepts up to 7 days and 20,000 km, covered by the existing parser tests, not run live).
- **Not done:** other travel modes, and offering the estimate as a suggestion for the traveler's travel-time field.

## The starting point, later the same day

The first journey (start to the first destination) and the finish journey (last destination back to the start, when "return to my starting location" is on) were the likeliest ones a traveler wants a time for, and they had no button because the starting location was a plain text field. It now uses the same map search as destinations ("Starting location", with "Search places"). Choosing a match stores the name and a map point; **typing in the field clears the point**, so a name the traveler typed is never matched to coordinates it did not come from, and a typed-only start behaves exactly as before.

- **Where the point lives.** The backend already allowed optional latitude and longitude on the trip origin (`Location`), so no schema, migration or finalized design document changed. The frontend keeps `originPoint` (latitude and longitude) beside the origin name, sends it with the origin, and reads it back; the server returns decimals as strings, which a small pure function (`originPointFrom`) turns into numbers and rejects when missing, partial, out of range, or 0, 0.
- **Endpoint change.** `POST /journeys/intercity` now takes `origin` and `destination`, each either a retained `reference_id` or a pair of coordinates (never both, never one coordinate, never 0, 0). Coordinates are accepted because the starting point is not a retained reference. They are the traveler's own saved start; the endpoint is rate limited and signed-in like the others, and the same-place check also compares resolved coordinates.
- **Finish legs.** Only "return to my starting location" is covered. A separately typed finish location is still only a name.
- **Compatibility.** An older backend and frontend ignore or already accept the optional origin coordinates, so this adds no rollback hazard beyond the endpoint itself (it simply would not exist on an older backend).

### Verification of the starting point

- **Automated:** 586 backend tests (the endpoint accepts a coordinate end on either side, rejects both forms together, one coordinate, none, 0, 0, NaN, the same reference, the same point, a point equal to a reference's coordinates, unknown ids, extra fields, a mode and anonymous callers, and a provider failure is an error) and 217 frontend tests (7 of them new: the ends and their rules, and the decimal-string parsing). Ruff, typecheck, build pass; OpenAPI regenerated.
- **Live, signed in** (QA trip, local web and API against the hosted database): I changed the starting location to "Delhi, National Capital Territory of Delhi, India" through the map search and it saved; Jaipur's first day then showed "Estimate the drive from Delhi, National Capital Territory of Delhi, India to Jaipur, Rajasthan, India" and returned **3 h 7 min, 304 km**, and its last day's "Moving on" card back to Delhi returned **3 h 9 min, 306 km**. Axe (WCAG 2.0 to 2.2 plus best-practice) found nothing on the day view or on the creation form with search results open at 390 px, with no overflow and no control under 44 px. I then typed "Delhi" back into the field, which cleared the point, waited for "Saved to your account", and a reload showed the arrival card with no button again, 2 nights, and the session still signed in.
- **Not verified:** the hosted app, a screenshot (hidden window), a start chosen on a trip with three or more destinations, and a finish location other than the start.

