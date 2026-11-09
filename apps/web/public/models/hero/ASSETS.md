# Hero asset manifest

## alpine-terrain-v1.glb

Status: pass-one custom terrain asset, pending visual review against `docs/references/hero-concept-v1.png`. Not final production art.

Creator: custom code-authored mesh profiles/material masks produced in this repository. No downloaded meshes, external textures, or projected concept image.

Editable source: `apps/web/lib/landing/terrain-spec.mjs`; export script: `apps/web/scripts/generate-hero-terrain.mjs` (uses existing Three.js GLTFExporter tooling). Regenerate from repo root with `node apps/web/scripts/generate-hero-terrain.mjs`.

Contains two continuous meadow banks, seven separately authored ridge profiles, vertex-normal/slope/height masks for meadow, exposed rock and snow. Real mesh geometry, PBR roughness and vertex color. No texture atlas, baked lightmap or external art license is embedded. Repository ownership/license policy applies to the custom source; Three.js tooling retains its own MIT license.

Runtime path `/models/hero/alpine-terrain-v1.glb`; GLTFLoader loads actual meshes that receive scene lighting/shadows. Uncompressed first-pass asset; compression and detailed normal/AO maps remain later work.

## Existing proxies (not in this GLB)

Cottage: runtime boxes/extruded roof. Traveler/backpack: runtime spheres/capsules. Clouds: runtime marching-cubes masses. Grass: uniformly scattered runtime instanced blade. Water: illustrative ripple shader. These are explicit temporary assets pending their assigned passes; they do not match the approved concept's final quality.

## Sources under consideration, not imported

Poly Haven PBR sources: https://polyhaven.com/license (CC0 assets). Quaternius humanoid base: https://quaternius.com/packs/universalbasecharacters.html (official page lists CC0; inspect chosen archive before use). Kenney buildings: https://kenney.nl/assets/fantasy-town-kit (CC0; not a close style match). None currently contributes geometry or artwork to this runtime.

## Mobile variant and measured export sizes

`alpine-terrain-v1-mobile.glb` uses the same authored profiles and masks at lower grid resolution. Regenerate with `node apps/web/scripts/generate-hero-terrain.mjs --mobile`.

Desktop: 9 meshes, 261,008 triangles, 7,419,268 bytes. Mobile: 9 meshes, 77,760 triangles, 2,243,876 bytes. Both are uncompressed; these are raw asset sizes, not production network-compression claims. Meshes are validated by parsing through GLTFLoader and checking finite positions and valid triangle indices.

`terrainMaterial.ts` adds a custom, low-amplitude procedural rock surface normal/color treatment at runtime; it is not a sourced texture or a finished baked detail set. Low foothills do not receive summit snow. Final detailed slope masks/materials still need art review.

## Pass 1B

Current runtime uses `alpine-terrain-v1b.glb` (desktop: 276,368 triangles, 7,863,436 bytes) or `alpine-terrain-v1b-mobile.glb` (83,904 triangles, 2,425,768 bytes). Eleven meshes: two meadow banks, seven retained ridge profiles, two valley foothills. Both use custom geometry/material-region source; no external textures, sculpt or baked lighting are present. Original v1 assets are preserved and selectable with `?review=terrain&baseline=1` for comparison.

Regeneration commands now write the v1b filenames. See `docs/terrain-pass-1b-review.md` for exact comparison conditions, unchanged proxy assets, remaining limitations and the proposed sculpt/texture/bake handoff. These exports are not approved production artwork.
