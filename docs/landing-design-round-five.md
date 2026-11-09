# Six independent directions — round five

The brief is a creative reset. New pages do not import earlier experience components, planning sandboxes, headers or section templates. Existing routes remain in the archive for comparison; their visual treatments are not design constraints.

## Plan before implementation

| Direction | Palette | Typography | Composition and signature interaction |
|---|---|---|---|
| Meridian | Chart #DFE9F4, ink #173F74, cobalt #2859A5, peach #FFC8A3, white #FFFFFF | Space Grotesk, IBM Plex Sans | A large imagined atlas, plotted destinations and an inspector. Asymmetric map-led opening; location selection changes the inspector and route idea. |
| Outbound | Sun #F5DA42, charcoal #302D25, milk #FCFBF5, blue #3C659C | Anton, Barlow | Loud condensed typography beside a numbered photographic accordion. Sections become a graphic trip directory, route receipt and decision grid. |
| Cutaway | Cinema #292A2E, chalk #F4F3EE, signal #E79979, muted #B7B6B5 | Bodoni Moda, DM Sans | A travel film told in stills, with letterboxing and a filmstrip. Scrub the visual story; edit an afternoon as a scene change. No fake playable video. |
| Pocket | Mint #D8F0DD, grape #553274, luggage #7460A7, tangerine #F2A06A, white #FCFCF6 | Rubik, Syne | A ribbed suitcase and collectible destination tags. Pack ideas into the suitcase; a trip list and plan preview respond. Graphic and buoyant rather than another photo arch. |
| Unbusy | Chalk #FBFCF8, olive #58624B, moss #D4DACB, graphite #353C32 | Tenor Sans, Hanken Grotesk | Near-silent typography, narrow atmospheric photography and a large blank-space dial. Adjust the balance of planned and unplanned hours. A vertical rhythm, not a card grid. |
| Parallel | Indigo #514382, violet #DCD9EE, peach #F2CCAD, snow #FBFAFE | Archivo, Instrument Serif | A full-height split-screen reveal between city and wilderness. A slider reveals another week; paired planning rails show what remains fixed and what changes. |

Layout sketches:
- Meridian: [heading + atlas inspector] / [route ribbon] / [exploration layers] / [timeline and constraints] / [source drawer] / [begin].
- Outbound: [condensed title | expanding photo directory] / [giant statement] / [route receipt] / [change-of-plan decision grid] / [budget pockets] / [questions + begin].
- Cutaway: [cinematic still + title] / [filmstrip scrub] / [three visual acts] / [edit the scene] / [credits for information] / [end title].
- Pocket: [copy | suitcase] / [pack ideas] / [unpack the itinerary] / [stays + connections foldouts] / [weather adjustment] / [closing tag].
- Unbusy: [quiet title | narrow fog photograph] / [space/pace dial] / [long landscape] / [minimal day strips] / [stay/transport reading room] / [questions + invitation].
- Parallel: [city ↔ wilderness reveal] / [two versions of a week] / [connected journey rails] / [before/after change] / [source notes] / [split closing].

## Brief critique

Avoid another photo arch, boarding pass, postcard fan, common two-column itinerary card or shared feature-section sequence. Each concept earns its own interaction and reading order. Retain product meaning: flexible destinations, stays, transfers, budget context and user-approved adaptations. Labels disclose sample data. Never invent traveler reviews, live inventory, bookings or endorsements. All controls work by keyboard; reduced motion and a pause control are available.

## New photo sources

Pexels inspiration photos, not factual images of itinerary destinations or property offers:
- https://www.pexels.com/photo/aerial-view-of-desert-sand-dunes-at-sunset-28902496/
- https://www.pexels.com/photo/train-high-in-mountains-18620990/
- https://www.pexels.com/photo/downtown-city-street-in-rain-13283697/
- https://www.pexels.com/photo/aerial-view-of-tropical-island-coastline-34109832/
- https://www.pexels.com/photo/person-hiking-in-fog-shrouded-mountains-14912325/

## Implementation notes

- The new concepts use only the new `_new-worlds` component/CSS files. They share small accessibility/footer helpers within this round, while each page owns its layout, content progression and interactive state.
- The twelve Google Fonts families used in these concepts are self-hosted under `public/fonts/new-worlds`, with their OFL license files. This fixes CSS-import font loading that would otherwise fall back to generic typography.
- No animation packages, WebGL scenes, backend endpoints or data-model changes were introduced.
- Live reviews, prices and availability are not fabricated. Examples remain labeled; photos are credited and treated as inspiration.

## Visual QA

Reviewed all six concepts at 1440×1000 and 390×844. Checked loaded images and document widths; no broken loaded images or page-level horizontal overflow in those views. Each new page has its own sequence and is approximately 3,600–4,700px tall on desktop.

Exercised: atlas pin/inspector and layer selection, adding an open stop, photographic accordion, duration and stay allowance, filmstrip selection and script revision acceptance, suitcase open/close and packing choices, unplanned-time dial, reading-room tabs, split-screen reveal, alternate-week tabs and revision acceptance. Motion control applies the static class; OS reduced motion is handled in CSS.

Fonts are served locally and captured previews reflect the intended display faces. Adjusted the quiet and cinematic headlines for smaller screens. Actual screenshots of the six concepts now appear in the comparison gallery. Screenshots are also retained at `docs/references/design-round-five/`.
