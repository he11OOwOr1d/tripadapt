# Stillwater — scenery built in the frontend

> The initial SVG implementation is superseded by [the landscape refinement](stillwater-landscape-refinement.md), which uses manually coded Canvas 2D drawing for more organic detail and visible wind.


## Current brief

The user explicitly wants manually constructed frontend scenery, not generated image backgrounds. River water should flow, clouds should move, and a light breeze should move grass. This supersedes the image-based Stillwater versions. Keep the existing useful planner interactions while replacing all decorative scene images with editable SVG/CSS scenes.

## Plan

Palette: sky #C2DEEC; mist #A6BFCD; ridge #71979A; forest #28584C; meadow #B7C982; water #91C3C7. Keep the current locally served Tenor Sans/Hanken typography and restrained interface. A landscape built from designed mountain silhouettes, individually coloured ridge facets, reusable tree symbols, field paths, grass clumps, a small timber shelter and a flowing river carries the hero. The character is omitted.

Each scene is native SVG with local definitions and deterministic geometry. No raster backgrounds, generated textures, image filters from external files, 3D renderer or animation package. Variants for coast, garden stay and rain window use their own geometry rather than a bitmap or a screenshot of the hero.

Composition: a light sky carries the main invitation; layered ridges recede toward a river; meadow banks widen toward the viewer; detailed grass/flowers and a right-hand shelter establish foreground scale. The mobile camera has more sky and a narrower scene window. Motion is limited to things that actually move: the river surface, clouds, vegetation, a curtain and raindrops.

## Motion design

- River: repeated light ripple paths move downstream inside a river-shaped clip, with a second slower reflection layer. Banks stay still.
- Grass: modest grouped rotations/skews around patch roots, varied durations and phases; nearby patches move more than distant patches.
- Clouds: long alternating horizontal drifts with no visible jump or reset across the sky.
- Canopy: slight branch-group movement, with hanging leaves following the same breeze.
- Weather: rain streaks move inside the window/sky clip; the indoor table and frame stay still.
- A breeze control switches between gentle/fresher movement. The existing pause stops all scene animations. Reduced-motion settings disable them. Off-screen scenes pause through IntersectionObserver.

## Pre-build critique

Avoid a low-detail geometric toy landscape: no pyramids for mountains or repeated stone circles lining the river. Use broken ridge contours, directional rock faces, many small tree silhouettes, asymmetric meadows, irregular banks and restrained light gradients. This remains a graphic 2D illustration; it does not claim painterly bitmap fidelity. Avoid animating the entire background or using excessive turbulence as an imitation of water. Native SVG vectors should stay crisp on phones, and plant density should stay bounded.

## Implementation and verification

Implemented in `apps/web/app/design/stillwater/NatureScene.tsx` and `nature-scene.css`. The page renders five native SVG scene instances; the hero has separate wide and portrait cameras. All IDs are scoped through React useId, geometry is deterministic, and no scene loads an image, an SVG image element or an external texture. A very light native SVG turbulence grain is static; all moving objects are actual vector groups.

Added varied broadleaf/pine forest silhouettes, foreground wildflowers, layered mountain faces and a smaller shelter. Vegetation is clipped away from the river so grass does not appear in the water. Reused symbols and grouped vegetation keep geometry bounded. Off-screen scenes pause through IntersectionObserver.

Browser checks at 1440×1000, 390×844 and 320×780 found no clipped controls or horizontal overflow. The rendered page reported zero HTML images and zero SVG image elements. Inspected running computed transforms for the river, clouds and grass. A fresh breeze changes the wind multiplier to 2.1 and river animation duration to 5.6 seconds. Pause sets water, clouds, grass, canopy, flowers, curtain and rain animations to paused. Off-screen scenes reported inactive; reduced-motion overrides are in CSS.

Verified existing night-count/budget and accepted rain-revision controls. Bir four nights × ₹1,800 + Tirthan three nights × ₹2,200 + ₹3,500 travel remains ₹17,300; dinner stays fixed at 20:00. The illustrations remain fictional atmosphere; data remains illustrative.

Production build passes, including TypeScript. Screenshots live in `docs/references/stillwater-code/`; the gallery uses `public/images/stillwater/preview-code.png`. Previous image-based captures and assets are historical and are not referenced by the current scenery.
