# Stillwater v2 — an original illustrated journey

> Superseded by [code-built scenery](stillwater-code-scenery.md). The user clarified that generated bitmap scenes were not the intended implementation. Current scenery is native SVG/CSS.


## Corrected brief

The user wants a new illustrated world inspired by the reference's atmosphere, not direct reuse of that reference image. The current page replaces all uses of the supplied bitmap. Five project-specific generated illustrations establish the visual world: a panoramic mountain railway halt, a separately composed phone version, a garden guesthouse, a coastal path and a rainy café. The style is painterly 2D animation background art with a restrained anime influence. No claim is made that the images are human-painted.

## Design plan before implementation

- Palette: clear sky #B8D8EC; deep spruce #214B48; meadow paper #F5F6ED; linen #DFE7CD; coast blue #648EAC; ochre #B79345. Light sky carries dark, quiet typography, while rich foreground scenery supplies colour.
- Typography: Tenor Sans for broad, gentle display lines; Hanken Grotesk for functional UI. No handwriting or character mascot. Meaningful type hierarchy and short sentences.
- Layout: a full-bleed panoramic illustrated journey, rather than the former dark split-screen. Left-aligned text in the sky. The image retains a right-hand shelter, a small backpack and a winding railway/river, so it implies travel without a search widget. Destination discovery changes between separate settings; an intimate guesthouse image introduces accommodation; the route workspace connects the practical details; the rain painting gives the adaptation story its own scene.
- Motion: an optional very slight light-opacity shift and two leaves; changes of image and UI respond to deliberate choices. No fake swaying of flattened trees or camera flying through a bitmap. Pause and OS reduced motion remain supported.

Composition:

```text
[quiet navigation / pale blue sky]
[large invitation             original valley + mountain halt]
[river and meadows / railway / small shelter + backpack]

[feeling selector | separate coastal / mountain / garden image]
[garden guesthouse | the usefulness of a good place to stay]
[connected route | nights / transport / stay / cost detail]
[rainy café + story | a proposed afternoon, then acceptance]
[practical questions]
[coastal closing / invitation]
```

## Pre-build critique

The first version relied on one reference bitmap for every scene and inherited its composition. This version needs genuinely separate visual jobs, not repeated crops. The hero is an original bright panoramic valley; the guesthouse is a close architectural scene; the coast is geographically and compositionally different; the café is an interior looking out through rain. Each has a grounded human-scale detail. A portrait companion prevents mobile from losing the railway halt through arbitrary cropping.

The interface continues to explain actual product behavior: saving inspiration, multi-stop planning, variable stay lengths, unknown costs and accepted revisions. Existing validated plan controls are retained while the art direction and scene sequence change. Illustrations are fictional mood studies, not factual destination or supplier photographs.

## Asset provenance

Generated with the built-in image-generation tool. Exact prompts: [stillwater-v2-image-prompts.md](stillwater-v2-image-prompts.md). Originals and WebP encodings: `apps/web/public/images/stillwater/original/`. Only format conversion/compression is applied locally; no generated scenery is constructed through Python drawing.

The user reference remains historical context only. Previous screenshots are preserved in `docs/references/stillwater/`; new captures use `docs/references/stillwater-v2/`.

## Implementation and verification

The revision is live locally at `/design/stillwater`; the design gallery links to `preview-v2.png`. All images rendered by the current page come from the new `original/` asset directory. The old reference file is preserved as historical material but is not used by this page. WebP versions are served by the page; lossless generated PNG originals are also retained in the workspace. The hero's WebP is about 327 KB; supporting images load lazily. A `<picture>` source selects the independently composed portrait at phone widths.

Reviewed at 1440×1000, 390×844 and 320×780. Corrected the discovery image's intrinsic grid sizing, a low-contrast header link over foliage, the discovery headline scale, and the phone crop. Narrow-phone checks found no clipped controls or overwide images. The portrait keeps the river, bridge, tracks, shelter and backpack in view, with headline space in the sky.

Verified all three mood sources, local saving, both destinations, night-count updates, stay/travel/budget views, an accepted rain alternative with dinner still fixed at 20:00, the scene pause/resume and quiet-view return, and native FAQ expansion. The edited seven-night stay/travel subtotal remains ₹17,300; food, activities, taxes and fees remain explicitly unpriced. All five page images reported loaded during the final lower-page review; only the generated project artwork was present in the rendered page.

Production build and TypeScript checks pass. Screenshots use `docs/references/stillwater-v2/`; the versioned gallery thumbnail is `apps/web/public/images/stillwater/preview-v2.png`. The existing application flows and prior samples remain accessible. No backend, booking provider or persistent trip data is changed by this design study.
