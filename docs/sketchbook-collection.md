# Six new sketchbook directions

## Brief and design plan

Fresh takes on a pencil/cartoon travel planner. Keep the pleasure of a handmade sketch, but change the composition, drawing, type hierarchy, navigation and interaction in every direction. No dimensional renders, photo heroes, folded-map hero reuse or matching feature-card grids. Keep destination discovery, a connected journey, stays/transport and adapting a plan understandable. Travel examples are illustrative.

### Margin

Paper #FAFAF3, graphite #384436, fern #64794B, note pink #E8B6B4, ochre #C99E50. Kalam large headings, DM Sans utility. A giant open, ring-bound travel journal is the hero itself. Left page = invitation; right page = pencilled trip. Below, margin annotations, a journal spread and a weather edit explain the features. Left-aligned, spacious and quietly tactile. Interaction: turn journal pages and edit nights.

### Airmail

Pale peach #FBE4D9, ink #583E43, cherry #B64253, postal blue #557DAB, letter white #FFFCF5. Patrick Hand for letter copy, DM Sans for controls. A big illustrated envelope with a partially extracted letter is the opening. A letter-to-a-future-self turns into a destination selection, route ribbon and handwritten itinerary. Interaction: choose the letter's destination and turn it over. Preserve legibility; no cursive paragraphs.

### Doodle Club

Lavender #E8DFF2, ink #34304C, violet #72549C, orange #EB9468, sticker lime #D7E68C. Rubik bold for headlines, Patrick Hand for scribbles. A dense, joyful sticker sheet around a backpack replaces the scenic hero. Airy product explanation follows in a sticker ledger, then a suitcase inventory and travel-plan tear-off. Interaction: pack destination stickers into the bag and unpack them into a route.

### Blue Hour

Blueprint blue #294C79, chalk #EFF4F6, ice #AFD4E1, yellow #EED585, graphite blue #1A365A. Kalam headings, DM Sans utility. An expansive, hand-drawn celestial atlas, with white pencil marks and star routes. Content alternates between dark sky and pale atlas paper. Interaction: chart up to three destinations, then inspect the resulting route. No neon, glass or fake live data.

### Sidequest

Pale yellow #FFF5CB, pencil black #353B38, tomato #C65345, seafoam #A9CDB8, paper #FFFEF7. Rubik heavy headings, Patrick Hand speech bubbles. Asymmetric comic panels form the first screen, then the user chooses the next scene in a small story. A station-to-stay route and rainy-afternoon comic show the actual product. Interaction: choose mountain/sea/city story and a rainy-day branch; original dinner remains fixed.

### Sunday

Sunflower #F3CE61, chocolate #4C4631, sky #B3D9E1, leaf #8BAA72, paper #FFFDF1. Kalam display, DM Sans functional copy. Oversized sun drawn as a lounging cartoon, an unhurried circular afternoon clock, and wide horizontal strips. Editorial asymmetry, huge whitespace, no notebook/spread hero. Interaction: pace dial and picnic checklist; show what is left open rather than inventing a busy itinerary.

## Wireframes

Margin: [book title / left paper | ring spine | itinerary right] → [margin research notes] → [journal tabs] → [weather correction] → [close the journal]
Airmail: [letter headline | open envelope] → [choose destination on reply slip] → [continuous postal route] → [flip itinerary letter] → [postmark CTA]
Doodle Club: [bold club invitation / scattered sticker sheet] → [pack stickers] → [bag becomes route] → [stays + travel inventory] → [rainproof sticker / CTA]
Blue Hour: [white pencil title / star atlas] → [chart destinations] → [daylight route manifest] → [weather alternative] → [night-sky closing]
Sidequest: [comic title / three uneven story panels] → [choose a chapter] → [travel strip] → [rain decision comic] → [final speech bubble]
Sunday: [huge sun / left title / horizontal horizon] → [afternoon clock] → [picnic checklist] → [stays + costs folded receipt] → [sunset invitation]

## Pre-build critique

Six warm paper themes with the same hero map would fail the brief. Revised Blue Hour to a cool nocturnal atlas, Doodle Club to a lilac sticker sheet, Sunday to a yellow clock, and Sidequest to narrative comic panels. Only Margin uses the journal spread. Airmail is correspondence rather than a scrapbook. Do not add route numbering unless it represents an ordered journey. Keep useful destinations, times and plan decisions in the actual content.

## Implementation scope

Six independent public routes, shared lightweight SVG drawing primitives, local fonts, CSS motion tied to clicks, keyboard-accessible controls, mobile layouts and reduced-motion support. Illustrations are code-native vector drawings. These are design studies; no provider calls, purchases or actual itinerary persistence are implied.

## Delivery and verification

Comparison gallery: `/design/sketches`. Individual routes: `/design/margin`, `/design/airmail`, `/design/doodle-club`, `/design/blue-hour`, `/design/sidequest`, `/design/sunday`. All six are also listed first in `/design/options`; older samples remain available.

Reviewed all six heroes at 1440×1000 and 390×844. Checked every route and the gallery at 320×780: no horizontal overflow or clipped links, buttons or inputs. Tightened phone headlines so their illustrations enter the opening experience sooner. Each desktop page contains approximately 4,000–4,800 pixels of content at the checked width, with distinct feature sections beyond the hero.

Verified page turns, night-count changes and stay subtotal in Margin (4 + 2 nights × ₹1,800 = ₹10,800); destination selection, postcard reverse and rain alternative in Airmail; packing two stickers and unpacking the selected sequence in Doodle Club; destination charting, an alternative afternoon and explicit acceptance in Blue Hour; chapter selection and accepted café branch in Sidequest; pace slider, checklist, stay choice and allowance arithmetic in Sunday (4 × ₹2,400 + ₹2,000 = ₹11,600). Fixed dinner times remain in every sample weather revision. Also checked the native FAQ disclosures on a narrow phone.

Fixed cross-runtime floating-point precision in the sun-ray SVG coordinates. The final six-page browser pass reported no new errors or warnings. `npm run build --prefix apps/web` passes, including TypeScript and static generation. Drawings use scoped React IDs for SVG filters; there is no 3D runtime or animation dependency in these samples. Reduced-motion users receive immediate state changes without transitions.

Final desktop previews are in `docs/references/sketches/` and `apps/web/public/images/sketches/`. These are interactive design studies with illustrative travel data; the sketches do not book anything or persist an itinerary.
