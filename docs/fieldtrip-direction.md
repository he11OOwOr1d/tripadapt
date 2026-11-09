# Fieldtrip — fresh desktop direction

## Reset

The user rejects incremental edits to Stillwater and explicitly requests a fresh website using the latest benchmark: richly textured sunset scenery, small animals, dense flowers, layered bushes and strong blue/gold print colours. The reference guides quality and detail, not composition copying. All scenery remains frontend code. Desktop is the review target; mobile optimization is deferred.

## Design plan

Palette: ultramarine #1743B4, midnight ink #173383, apricot #F3A17F, field gold #F5CD70, lavender #A89BD5, paper #FFF1CB. Local Archivo display in large confident sentence-case type; local Barlow for direct functional copy. Move away from pale-green Tenor Sans, the left-hand headline, cottage/river hero, identical feature blocks and the old planning workbench.

New composition:

```
[small invitation | centred wordmark | trip action]
        [large centred two-line invitation]
      [cobalt → lilac → apricot printed sky]
 [gold mountain pasture / blue oak shadows / grazing goats]
 [dense moving violet/gold flower meadow / discoverable detail]

[large typographic statement + short product introduction]
[feeling index | typographic collection of saved possibilities]
[full blue section / editable horizontal journey ribbon]
[apricot disruption section / horizontal afternoon alternatives]
[oversized closing invitation / compact questions]
```

Hero scenery: new highland pasture; no house, bridge or river. Paint sky halftone and mountain/foliage textures in cached native canvas buffers; draw flowers, animal poses and small distant birds as live frontend geometry. Animals remain small landscape details. A discreet keyboard-accessible animal hotspot reveals a short observation. Pause is available; reduced motion and offscreen suspension apply.

UI interactions: choose a feeling and save specific ideas; adapt a multi-stop journey with nights and indicative allowances; review and accept a rainy-afternoon alternative without moving a fixed evening commitment. Meaningful planning content stays present, but its layout, palette, content order and visual language are new. Travel data is illustrative.

## Review before building

Reusing Stillwater with different tree colours would fail the request. This route imports no Stillwater components, scenery renderer, fonts or stylesheet. The new scenery uses a deliberately printed illustration language where colour, tiny brush marks and scale carry detail. Keep desktop typography in the sky and the animals in the landscape. Avoid generic feature-card grids, house-shaped clip art, decorative fake ratings and long paragraphs of atmospheric filler.

## Implementation and desktop verification

Implemented at `/design/fieldtrip`, with a gallery preview at `/design/options`. The scenery is native Canvas2D drawing; the landing page contains no image elements or background scenery assets. Archivo is a local variable font distributed with its OFL licence. Motion supports pause, reduced motion and offscreen suspension.

Reviewed the new desktop composition at 1440×1000 and 1280×900. Checked saving an idea, changing feelings, adjusting nights, stay and transport allowances, opening the animal note, and accepting a weather alternative. Four Jibhi nights plus two Sainj nights, comfort allowance and private transfers produce ₹22,100; accepting the ₹450 alternative produces ₹22,550 while retaining the 18:10 transfer. These remain illustrative allowances, with excluded expenses identified in the interface. Production build and TypeScript checks passed. Mobile optimization is deferred per the requested scope.

Saved `docs/references/fieldtrip/hero.png` and `full-page.png` for review. This is a fresh direction for visual review, not a claim of matching the supplied illustration's artistic fidelity.

## Landscape refinement — 8 November 2026

Changed oak foliage to layered forest greens with warm leaf highlights and brown branches. Mountain ridges use muted brown stone tones and small broken snowfields on the highest visible peaks. Four textured clouds drift slowly at different speeds with a subtle vertical breeze; their movement uses the existing pause, reduced-motion and offscreen lifecycle. Cached cloud artwork is only 370×125 pixels. Desktop preview and gallery thumbnail refreshed. Verified pause freezes scene time and resume continues it; production build and TypeScript checks passed.

Follow-up palette adjustment: meadow slopes, grass underpainting and moving stems now use layered light greens; flower accents remain subtle. Grazing animals now have white and black coats with neutral shading. Desktop preview refreshed and TypeScript check passed.

Ground refinement: exposed soil and the base beneath the meadow are now warm brown with darker earth shadows. Individual grass strokes and moving stems retain light greens, distinguishing vegetation from soil. Desktop preview updated; TypeScript check passed.

Wooded slope refinement: added irregular light-green groundcover patches and fine grass blades beneath and between the trees, clipped to the hill profile. Exposed brown soil remains visible. Grass uses its own deterministic seed so the established tree arrangement is preserved. Desktop hero and gallery preview refreshed; TypeScript check passed.

## Approved hero and connected page

The hero was approved by the user. Keep it stable. The original below-hero layouts have now been superseded by the connected landscape journey described in `docs/fieldtrip-connected-journey.md`: one muted ground, a continuous trail, interactive discovery, route/stay controls and weather replanning. Use that document for the current section design and verification notes.
