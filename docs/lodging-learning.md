# Learning: recording where you stay, honestly

19 November 2026. Each destination with at least one night now has a **Where you're staying** panel in the day view. The traveler records a name, an optional address or note, check-in and check-out times, and whether they have booked it themselves. They can type a name or use **Find stays nearby**, which lists up to 12 mapped hotels, guesthouses, hostels, apartments, motels and chalets within 5 km of the destination centre. A stay with a location shows as a blue house-shaped pin on the day map.

## What it is and is not

It is the traveler's own record. It is **not** a booking, a price, an availability check or a review, and nothing contacts a supplier. The wording says so: "marked as booked by you", "Prices, availability and booking status are not checked". A name-only stay is valid; it just has no map pin. The map search is a partial OpenStreetMap category search, not a list of every hotel, and many OSM names are short or generic (the live Jaipur search returned names such as "Fly" and "Jaipur").

## Decisions and tradeoffs

- **No migration.** The record is an optional `lodging` object inside the existing per-stay entry in `preferences.stay_preferences`, keyed by the stop's logical id. That path is already validated, copied between plan versions, frozen in reviews and returned by the API, so the feature inherits version, ownership and autosave behaviour without a new table. The cost: it is not queryable by SQL and not a normalized ledger. If stays later need dates per night, several stays in one destination or linked costs, that is the point to promote it to a table.
- **Reuse the place search.** `lodging` is a sixth category in the existing activity discovery (Geoapify `accommodation`, or OSM `tourism=hotel|guest_house|hostel|apartment|motel|chalet` for the Overpass fallback), so it keeps the same caching, rate limits, retention and attribution. The activity pickers list their categories explicitly, so lodging never appears as an activity.
- **A searched place keeps its source.** The stay stores the provider id, coordinates and source text. Editing the name of a searched stay drops the location unless the name is unchanged, so a renamed place never keeps the old pin.
- **Validation twice.** The backend `Lodging` model and the frontend `isLodging` agree: name 1-120 plain characters, address up to 200, `HH:MM` times, both coordinates or neither, (0, 0) rejected, a provider id requires coordinates, unknown fields rejected. The frontend also accepts the `null`s the server returns for unset fields.
- **Not part of the visit line.** The stay pin is unnumbered and is never joined by the dashed line; the numbered line stays the visits. It does widen the map bounds so it is never off screen.
- **An import cycle.** `day-map.ts` takes only a type from `lodging.ts`, because `lodging.ts` imports `validCoordinates` from it and the unit-test loader resolves imports recursively.

## Verification

- **Automated:** 18 backend tests for the model, search filter and round trip (full targeted suite of 81 passes); 9 frontend tests (201 in total); typecheck and production build pass; the OpenAPI snapshot was regenerated and its contract test passes.
- **Live:** the lodging search through the local API against Geoapify returned 12 real Jaipur stays with provider ids. In the local demo trip the panel was filled and saved, the Save button was disabled for an empty name, focus returned to the Edit button, and the layout had no overflow at 390 px with no control under 44 px. Computed pin colors: stay rgb(58,79,122) with cream text, selected stay orange with white text.
- **Not verified live:** saving a stay to an account trip and reloading it, the pin on the real basemap (the signed-in preview browser was unavailable), the hosted app, and the sample demo trip has no destination reference so it could not exercise **Find stays nearby** in the browser. The account round trip is covered only by backend schema tests.
- **Not done:** using the stay as the start or end of a day's journey checks, stay costs linked to the record, and a stay per night within one destination.
