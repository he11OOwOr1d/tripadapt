# Six fresh planner studies — 9 November 2026

Design exploration, not a replacement of the working creation journey. Keep `/trips/new` and the locked landing unchanged. Build new markup and scoped styles; do not import previous design components, art, planner panels, passes or wireframes. Share only brand fonts and palette with the landing. Each study uses its own local fictional design draft, with no saved-trip or landing-state access.

## Shared tokens and principles

Forest #294d3d, deep foliage #214536, meadow #c5d5a3, paper #f4eddc, chalk #fffaf0, sky #b8cad6. Local Archivo for display and Barlow for labels/body. Left-align readable form copy; reserve centered composition for the sentence and circular concepts. Controls remain native, touch sized and keyboard operable. Use motion only to answer a selection; reduced motion suppresses it. No prices, forecasts, reservations or real geographic-route claims.

## Directions, reviewed before implementation

1. **In a sentence**: oversized editable prose replaces conventional form boxes. Origin, people and date flexibility become the grammar of the page. A narrow bottom shelf holds the route. `[small identity] [large live sentence with inline fields] [route shelf / continue]`. Centered main statement, left-aligned practical inputs.
2. **Contour desk**: an unboxed, left-aligned work surface, with a deep-green contour margin identifying the current topic. Full-width horizontal field rows rather than a card beside a summary. `[contour margin | large field rows / route / bottom actions]`. Contours are original abstract linework, not a geographic map.
3. **Day loom**: time is the primary spatial object. Wide vertical ribbons represent stay nights, with travel woven between them. Basics live in a compact top bar; the route expands into editable time columns. `[trip basics bar] [night ribbons across the width] [open time / action]`. No itinerary-board or ticket reuse.
4. **Round trip**: companion controls surround a circular trip center; ordered destinations remain a grounded horizontal rail beneath it. `[title] [traveler orbit around origin] [date controls] [route rail]`. The ring is a group composition, not a clock, compass or geographic map. Mobile unfolds into a readable vertical form.
5. **Three horizons**: three edge-to-edge horizontal planes collect who/where, when and the route. Large field typography is aligned across bands; no enclosing form panel, floating card or landscape illustration. `[forest origin + people] [paper time] [meadow ordered places]`. The landing connection comes from horizontal landscape rhythm and color.
6. **Unfolding**: broad overlapping accordion leaves open one planning topic at a time. The next leaf becomes the action; closed leaves display the user's actual choices. `[wide identity] [origins leaf] [dates leaf] [places leaf] [time leaf] [review leaf]`. A sequence of functional planes rather than notebook pages, postcard stacks or a standard progress wizard.

Critique: removed postcard/photo metaphors, dashboard sidebars, scenic heroes, decorative numbering and identical card shells. All six use the same fictional Lisbon/Porto draft so changes in composition can be compared fairly. Each has distinct DOM structure and primary interaction; common field atoms and state arithmetic do not import an earlier UI. These are visual studies, not six production onboarding flows.

## Implemented review

Open `/design/planner-studies` for the six-link visual gallery. All study code is new under `apps/web/app/design/planner-studies/`. No existing landing, production trip journey, adapter, previous sample component or asset was changed or imported. Shared native field atoms and deterministic preview arithmetic are local to this new study collection. The samples are deliberately not full API-connected journeys: accommodations, provider searches, pricing and booking operations remain outside the design preview.

Reviewed all six at 1440×1000, 390×844 and 320×780. No horizontal document overflow at either phone width; Day loom has intentional horizontal ribbon scrolling inside its own region. Tested adding a place (including blank-entry feedback), route reordering, stay nights, overnight travel nights, traveler count, unfolding progression, duration conflict display, native trip-outline modal and Escape dismissal. A 12-day outline with 18 stay nights and one travel night correctly showed an eight-night over-allocation. Existing landing/working planner remained separate.

Self-critique fixes: separated the sentence composition's CSS class from its page root after spotting a selector collision; removed inherited scenic heading shadows; enlarged route action hit areas to 44px. No scenery, postcard artwork, ticket, notebook or older sample markup was repurposed. All controls are native HTML with visible focus; reduced-motion rules suppress transitions. No new dependencies or deployment.

Production build and TypeScript passed. Screenshots: `docs/references/planner-studies/gallery.jpg` plus each concept's `-desktop.jpg` and `-phone.jpg`.
