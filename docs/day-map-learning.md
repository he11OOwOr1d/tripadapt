# Learning: an itinerary map that never blocks the timeline

19 November 2026. The day view has a **Show on map** control. It draws the selected day's mapped visits as numbered markers (the destination centre as a diamond), joined by dashed straight lines, with a **Whole route** view of every destination. Selecting a marker highlights its timeline row and scrolls it into view; a row's **Show on map** button highlights its marker. It replaces the Google Maps design in PRD FR-12, which is superseded here without editing the finalized PRD.

## Decisions and tradeoffs

- **MapLibre GL with Geoapify tiles.** MapLibre is open source (BSD-3) and independent of any one provider. Geoapify tiles use the existing free account with no card; a tile costs 0.25 credit, so the 3,000 daily credits allow roughly 12,000 tile requests shared with other Geoapify use. The owner chose this over a plain schematic map or OpenStreetMap's public tiles.
- **A separate browser key.** `NEXT_PUBLIC_GEOAPIFY_MAP_KEY` is visible in the browser by design, so it must not be the backend key. The docs I read did not say whether a key can be restricted to a domain, so a leak could spend shared credits. This is the main accepted risk.
- **Fails soft.** With no key, an unusable key, an exhausted quota or no WebGL, the map falls back to positions over a plain background or a short message. The fallback is explicit, labeled "No basemap loaded", and makes no Geoapify requests. The timeline never depends on the map.
- **Lazy loading.** MapLibre is large, so it loads only after someone opens the map; closed, it costs nothing.
- **A pure, tested model.** `lib/trips/day-map.ts` turns the itinerary into markers, links, bounds and a text summary with no map code, so ordering, missing coordinates, skipped visits and single-marker cases are unit tested. Coordinates that are not finite, out of range, or exactly (0, 0) are treated as missing; meals, rests and free time are never reported as "missing a map location".
- **Straight lines are illustrative.** They connect visits in order and are labeled "not routes"; travel time still comes from the journey check. No route geometry is stored or fetched.
- **Accessibility.** Markers are real buttons with descriptive labels, `aria-pressed` and 44 px targets; a live status line announces the selection and the count; touch uses two-finger panning so the page can still scroll; the selected pin does not rely on motion when reduced motion is requested.
- **One extra build step.** MapLibre 6 needs its worker as a real file, and Next's bundler does not locate it ("Worker failed to load"). `scripts/copy-maplibre-worker.mjs` copies the worker from the installed package into `public/maplibre/` at dev and build time (git-ignored), so it always matches the version.

## Lessons

- **Look at it.** DOM counts and computed values said the map worked while it looked wrong; only a screenshot showed the style override and the duplicate credit. A visual check belongs in the verification of any UI change.
- Do not infer the cause from the symptom. The plain-map fallback fired because the **worker** failed, not the key or style; direct requests to the style returned 200. Recording the first error's details found it in one step.
- A GPU canvas cannot be read back for a check, so the component exposes `data-idle` and `data-rendered`, the count of features the map actually drew, which lets a test prove the basemap rendered.

## Verification

- **Automated.** 192 frontend tests (9 new for the model), typecheck, and the production build.
- **Live browser, local app against the hosted data, on the QA trip `452b84e7-4ca4-4f1c-b3bd-9dbce366c2c9`.** With a key: the map reached idle and rendered about 6,400 features at 539 px and 4,400 at 390 px, with three pins, the dashed link and the Geoapify, OpenMapTiles and OpenStreetMap credits. A pin click highlighted its row and a row button highlighted its pin, in both directions, with a status announcement. The Whole route view showed the one destination. Pins are keyboard-focusable 44 px buttons; there was no horizontal overflow at 539 or 390 px; touch uses cooperative gestures. Without a key: the plain map, three pins, an honest caption and zero Geoapify requests.
- **Hosted app, after the owner added the separate browser key and redeployed.** The production map rendered about 9,700 features with three pins, selection worked, and the style request carried the separate browser key (fingerprint compared, never the backend key). A real screenshot then showed what the structural checks had not: a global `button` style was overriding the pin colors (one pin pale beige, every numeral dark green, and dark green on orange for the selected pin, which is poor contrast), and the Geoapify credit appeared twice. Fixed by scoping the pin styles under the panel, using a darker orange (#a8480d, about 5.8:1 with white), removing the duplicate credit, and adding bottom padding so pins clear the attribution bar; a second screenshot confirmed it.
- **Not verified.** A trip with many destinations or very long days, and two-finger gestures on a real touch device.

## To use it on the hosted app

Create a second Geoapify key for the browser (and restrict its allowed origins if the dashboard offers it), add it to Vercel as `NEXT_PUBLIC_GEOAPIFY_MAP_KEY`, and redeploy the frontend. Done on 19 November. Without the key the hosted map shows the plain fallback.
