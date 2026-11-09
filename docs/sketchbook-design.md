# Elsewhere / The little travel sketchbook

## New brief

The user requests a fresh cartoon/pencil-stroke treatment and rejects the rendered scenery and dimensional character. This page deliberately establishes a new visual direction. The old valley composition and raster assets are not constraints on this sample.

## Plan

- Palette: paper #F8F8F0, pencil ink #293B53, blue pencil #315CAC, leaf #97AF86, mustard #E5BC50, coral #D58368. Colour is applied like a light pencil fill, with visible white space.
- Type: Kalam for expressive large headings; Patrick Hand for handwritten asides; locally served DM Sans for functional UI. Fonts remain readable rather than making all product information handwriting.
- Layout: left-aligned hand-lettered invitation beside a large folded imaginary map; a trail connects a landscape chooser, practical lined notebook, crossed-out rainy afternoon, room-for-nothing pace preview, questions and a resting cartoon closing.
- Principles: directly authored vector illustration with irregular paired strokes and pencil hatching. Same simple cartoon traveler, ochre hoodie, blue trousers and orange hat. No 3D rendering, generated character sprites or photographic backgrounds. Controls feel like marks in a real planning notebook.

Composition:
[handwritten invitation | folded doodle map + reclining traveler]
             dotted pencil trail
[wide illustrated strip: mountains / sea / streets]
[editable lined route notebook + stays, travel and budget tabs]
[umbrella traveler | original afternoon → pencilled alternative]
[free-time ruler + a day with room to do nothing]
[questions] → [resting traveler, final invitation]

## Review before building

Avoid merely adding handwriting over the previous scenery. The new map, figure, illustration, paper surfaces, border language and content order are authored for this brief. Avoid fake torn-paper shadow stacks, identical cards, full-page wiggling or decorative paragraph labels. One primary illustration opens the page; smaller drawings explain actual actions. Keep source/estimate limitations explicit, never invent reviews, and preserve user acceptance of plan changes.

## Assets and motion

Illustrations are repo-native SVG paths in `SketchArt.tsx`. They are authored for this design and do not require raster generation. Display font files and OFL licenses live in `public/fonts/sketchbook`. A subtle paper-grain filter and irregular duplicate outlines create the pencil feel. Motion responds to choices, saving ideas, changing nights and proposing a revision. Ambient motion can be paused; reduced-motion preferences are respected.

## Implementation and review

Page: `/design/sketchbook`, linked first in `/design/options`.

The entire scene artwork is code-native SVG. The illustration uses light pencil hatching, irregular double outlines, a low-strength displacement filter and a restrained paper grain. No previous scenic bitmap, generated character sprite, 3D asset, WebGL canvas or animation package is used.

Checked at 1440×1000, 390×844 and 320×780. Reviewed hero composition, handwritten text, notebook spacing, cartoon expressions and phone layout. Adjusted the umbrella handle to meet the character's hand and the closing heading to avoid an orphaned line.

Verified mood choice and pinning, route changes, extra nights, stay/transport allowances feeding the budget, proposed and accepted rainy-day revision with dinner fixed, the free-time ruler, FAQ expansion, cartoon note and pause control. Production build and TypeScript checks pass. Browser error log was empty at the interaction check.

Example arithmetic checked: six nights at ₹1,800, ₹2,400 travel and ₹2,100 activities gives ₹15,300. Food, taxes and fees remain explicitly unpriced.

Captures live in `docs/references/sketchbook/`. This is a new concept for user review, not an approved replacement for the application UI.
