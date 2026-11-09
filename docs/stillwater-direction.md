# Stillwater / an illustrated place to pause

> Historical first concept. Superseded by [Stillwater v2](stillwater-v2-direction.md), which replaces the supplied image with an original multi-scene illustrated world.


## Brief

The user rejects the overt cartoon/doodle collection and asks for a subtler anime-influenced illustrated direction. Their supplied forest, lake, mountain and bench reference establishes the visual atmosphere. The source image is used directly in this concept, not presented as newly authored artwork. Source: `/Users/nikhilraj/Downloads/_ (2).jpeg`; local sample asset: `public/images/stillwater/forest-lookout.jpeg`.

## Plan before implementation

Palette: canopy #183C3A; deep shade #102D2D; leaf light #DDE6CF; paper #F4F6EE; lake #A6C9CF; summer yellow #E4D99C. Restrained editorial type: locally served Tenor Sans for large, calm headings and Hanken Grotesk for functional text. No handwriting, sticker language, manga lettering or fabricated Japanese text.

Layout:
[quiet navigation over canopy]
[left invitation on deep green | tall illustrated lookout, sky, water and bench]
[small discovery invitation | three illustrated crops with distinct proportions]
[large pale route workspace | selectable destination notes / stay / transfer / spending]
[weather revision shown as a before-and-after afternoon, with explicit acceptance]
[wide letter / questions / final quiet scenic vignette]

Left-aligned text; keep paragraphs short. Preserve the drawing's tree canopy, distant blue mountains, lake and bench. The hero art is a tall, carefully cropped picture, not stretched or extended by synthetic fill. Phone layout gives the picture the whole viewport; text sits in the upper shaded canopy, leaving the foreground bench visible.

## Pre-build critique

A generic image with a central headline would lose the framing and human scale. Revise to a wide split composition, with a dark left reading area and the full tall scene on the right. Do not animate painted objects as if separable layers, and do not claim the bitmap is a live environment. Motion is limited to optional drifting leaf overlays, a very slight light shift and user-triggered interface changes. No pointer parallax or WebGL. The practical route section should make the actual adaptive planner legible; avoid turning every feature into a glossy card.

## Interaction scope

A quiet-view toggle hides the hero copy so the user can linger in the artwork; a pause control stops ambient leaf/light motion, and reduced-motion preferences are respected. Destination research samples can be saved. The route workbench has destination and detail views, adjustable nights and a transparent allowance subtotal. A rain scenario proposes an alternate afternoon, preserves dinner, and requires acceptance before showing an accepted revision. All travel data is illustrative. Changes here are local to the design sample and do not change bookings or persist a real trip.

## Verification

Route: `/design/stillwater`, also linked first in `/design/options`. The existing application and earlier concepts remain available.

Reviewed at 1440×1000, 390×844 and 320×780. The small-screen layout keeps the bench visible and places the introduction in the shaded upper part of the artwork. No horizontal overflow or clipped links/buttons was found at either phone width.

Checked quiet-view toggle and return, scene pause/resume, mood selection and local saving, both destinations, stay/travel/spending views, night-count edits, rain preview and explicit acceptance, and native FAQ expansion. Dinner remains fixed at 20:00 after the sample change. Arithmetic checked: Bir 4×₹1,800 + Tirthan 3×₹2,200 + ₹3,500 travel = ₹17,300. On a fresh phone session, Bir 3×₹1,800 + Tirthan 2×₹2,200 + ₹3,500 = ₹13,300. Unknown food, taxes, activities and fees remain explicit.

Production build passes, including TypeScript and 37 generated routes. Final browser pass had no new errors or warnings. Motion is limited to two CSS leaves, a soft light-opacity shift and short interaction transitions; a pause control and OS reduced-motion support are included. No 3D package, generated scene or external animation library is used by this page. The supplied illustration remains a single bitmap; painted clouds, water and trees are not falsely presented as independent animated layers.

Desktop and phone captures live in `docs/references/stillwater/`. The gallery preview lives in `public/images/stillwater/preview.png`. This is a design sample, with reference artwork supplied by the user and illustrative travel information.
