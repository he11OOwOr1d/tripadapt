# Connected landing experience

The hero is approved. Preserve its composition, copy, scenery and controls. Rebuild only the page below it.

## Plan

- Colours: meadow paper #edf0dd, forest #2b5546, grass #b5ce8d, earth #ad8463, warm paper #fff1cb, restrained cobalt #173b9a for actions. Stop alternating saturated full-width colour blocks.
- Type: keep local Archivo and Barlow. Shorter headings, one short instruction per interaction; show results visually.
- Layout: a continuous walking trail through an open illustrated landscape, a trip-making stop, a weather moment, and a small departure invitation. Align controls to the scene or object they affect.
- Artwork: native SVG and CSS, with grain, layered hills, small houses/trees, water and clouds that share the hero's palette. No stock backgrounds or generated images.

```
[APPROVED HERO — unchanged]
       ↓ meadow gives way to a quieter ground
[Pick a feeling / explore landscape hotspots → collect a stop]
       · · · continuous trail · · ·
[Arrange the journey / route, nights, stay window, indicative costs]
       · · · continuous trail · · ·
[Bring the rain / same world / inspect the new morning / keep transfer]
       · · · continuous trail · · ·
[Your small trip summary / begin / compact practical questions]
```

## Review against the request

The previous page was mostly large copy and differently coloured sections. This version makes exploration, route changes and weather the main content. Reuse one trip state across sections so the connection is functional as well as visual. Avoid repeating three card grids, decorative floating text, section-by-section reveal animations or a second hero. Motion must show breeze, travel, selection, weather and a clear result. Provide reduced motion, visible focus, keyboard controls and a pause control for the new scenes. Desktop remains the current review target.

## Implemented

The approved hero renderer and composition remain unchanged. `page.tsx` now hands off to `Journey.tsx`. Removed the old manifesto, coloured planning block, peach weather block and gold closing. The new below-hero design uses one meadow-paper ground, a continuous trail, short prompts and three connected illustrated moments.

- Explore mountain, coast and town landscapes via HTML buttons over native SVG artwork. Destination pins and the clipped paper note are synchronized; added places appear in the route and final trip summary.
- The road geometry, stop markers and travelling dot share one path. Stops can be reversed or removed down to one; nights have a one-night minimum without an upper UI cap. A bus changes to a car when private transfers are selected. The stay view has a moving curtain, steam and the selected landscape outside the window.
- Rain changes the illustrated sky, adds falling rain and chimney smoke, and reveals an indoor proposal. Acceptance adds ₹450 to the sample allowance. The 18:10 fixed transfer remains unchanged. Changing the first destination or direction clears the previous weather proposal.
- The final invitation reflects the actual sample route and night count. Questions use native disclosure controls. All prices, forecasts and route depictions are labelled illustrative.

No scene images, animation packages or new dependencies were added. `TravelWorld` is memoized; SVG IDs use `useId`. All interactive controls are native links/buttons with focus styles, selection states and labels. Derived estimates are calculated directly from trip state. The observer is cleaned up on unmount; looping animation pauses offscreen. The existing hero pause and new scene pause share a state, with reduced-motion overrides. Desktop is the current design scope.

## Verification

Production build and TypeScript checks passed. Reviewed 1440×1000 and 1280×900 desktop layouts, with no horizontally clipped controls. Browser error log was empty.

Exercised all three landscape choices, destination notes, adding Shangarh, reversing/removing stops, one-night minimum, stay/travel choices, rain proposal/acceptance, native questions and global motion pause. Eight nights with comfort and private transfers produced ₹27,300; accepting the rain alternative produced ₹27,750 while preserving 18:10. A one-stop, one-night simple/local sample produced ₹5,300. Route changes preserved each stop's nights and the final summary updated accordingly.

Review captures: `docs/references/fieldtrip/connected-discovery.png`, `connected-route.png`, `connected-weather.png`, `stay-interaction.png`, `rain-interaction.png` and `connected-full-page.png`. The current `full-page.png` was refreshed too.

## Art continuity revision

Keep the approved hero. Replace the flat secondary SVG scenery and CSS umbrella with distinct native-canvas compositions using the hero's actual tree and texture brushes. Palette: cobalt #4665bf, apricot #efa083, soil #ad8463, foliage #37634b, meadow #b7d78c, paper #fff1cb. Existing Archivo/Barlow stay. Discovery becomes a wooded valley, stays a close-up porch, weather a sheltered tree scene; do not repeat the hero composition. Art occupies the main area, with concise readable controls beside it. Remove the large empty pale background impression with tighter section spacing and warmer paper. This addresses a rendering-language mismatch, not simply a colour mismatch.

Implemented `ChapterArt.tsx` using the hero's exported oak/mountain/texture helpers. Existing hero defaults are preserved. Discovery, porch and sheltered picnic have separate compositions; the SVG umbrella and repeated cottage maps are removed from these sections. Browser-reviewed the three compositions, tested comfort and rain acceptance (₹16,500 → ₹16,950 with 18:10 fixed), and saved `art-continuity.png`, `porch-continuity.png`, `shelter-continuity.png` and refreshed `full-page.png`. New canvas scenes cache static brushwork, suspend offscreen, respect reduced motion and the shared pause state.

## Purposeful selection revision

Discovery is now a three-place illustrated collection with direct add/remove buttons, replacing the invented geographic map and separate text-heavy note. Woodland framing, valley and open meadow views distinguish the place illustrations. Replaced oval clouds with a continuous irregular cloud silhouette and shaded fill. Removed all scenery behind the route and changed the ambient moving dot into an explicit, replayable vehicle journey preview. Removed the redundant parked bus. Stay selection visibly adds a cushion and tea set, while updating the indicative allowance; removed redundant labels and paragraphs. Reviewed in desktop browser and exercised adding Shangarh, route preview and the comfort choice (seven nights/three stops → ₹21,700). Production build passed before final small scene/parked-bus adjustments; final TypeScript check passed. Captures: `place-collection.png` and `stay-choice.png`.
