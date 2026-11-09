# Landing palette studies

> Historical record of the initial colour-only exploration. Alpine and Peach now have distinct layouts; see [Landing direction layouts](landing-direction-layouts.md). The base route now opens the beige-and-green Field notes reference.

Three colour studies on identical layout, typography, content, artwork and interactions. The approved hero renderer remains unchanged. Palette selection is a design-review control, not a proposed product feature.

- Alpine daylight: cloud page #eef5f7, white sheet #fbfdff, pine ink #294d48, blue action #3b5d84, cool sage selection #dce8e5.
- Lavender dusk: mist page #f1eef8, lavender-white sheet #fcfaff, indigo ink #393b65, dusk action #565b98, lavender selection #e2def1.
- Peach horizon: peach-white page #fff2ed, white sheet #fffaf8, slate ink #3c4e65, blue action #576c8f, blush selection #f3ddda.

Colour follows roles (page, sheet, secondary surfaces, selection, ink, muted text, borders and actions), not a different saturated block for each section. Canvas art and hero colours must not be filtered/recoloured to fake a variation. Shared live sample state stays intact while switching the palette. Separate entry routes provide direct comparisons.

## Review entries and verification

- `/design/fieldtrip/alpine#about`
- `/design/fieldtrip/dusk#about`
- `/design/fieldtrip/peach#about`

The base Fieldtrip route currently opens the Alpine preview, not a finalized brand choice. The on-page Colour studies selector switches without remounting the connected sample. Direct routes start a fresh sample. Hero and chapter canvases, layout and typography are unchanged. The selector sits below the hero and is explicitly a review control.

Extracted `FieldtripDesign.tsx` as the common client component; pages are lightweight route wrappers. Replaced hardcoded below-hero CSS colours with inherited role tokens, including translucent borders/shadows, actions, selected states, journal, footer and native dialog. Hero-facing colours remain as approved.

Production build passed with 42 routes. Visually compared the same introduction in all three palettes at 1440×1000 and the Dusk planner. Switching from Peach to Dusk retained the ₹16,100 three-stop sample. The dialog inherited the Dusk sheet colour. No horizontally clipped controls at 1280×900 and no browser errors. Saved matching `alpine.png`, `dusk.png`, `peach.png`, their `*-full.png` captures and `dusk-planner.png` under `docs/references/palettes/`. Local only; the Vercel site is unchanged.
