# Approved concept → real-time hero

7 November 2026. Target: `references/hero-concept-v1.png`, explicitly approved. Runtime passes still require review. The concept is generated art, not geometry or an approved model package. Do not use a background image to claim completion.

## Target measurements and first pass

At the target's 1672×941 composition: sky occupies roughly the upper fifth; broad main ridges fill left/right upper quadrants, a layered distant range remains lower in the center. An expansive meadow stretches through the middle, the river opens from the central distance toward the foreground, traveler rests lower-left and cottage sits lower-right. Preserve geography while lowering/widening the blockout's tower-like mountains. Warm directional sunlight, cool shadows, blue distance, exposed warm gray rock, green shelves and irregular summit snow are the pass-one targets. Trees, flowers, riverbed, cottage and traveler richness require subsequent dedicated passes.

Baseline source is archived under `docs/baselines/`; previous captures remain in `docs/references/sunny-review`. No shared configuration changes are needed for pass one.

## Retain versus replace

Retain Next.js client boundary/dynamic loading, Three.js renderer lifecycle, accessible scene description, pause/reduced-motion behavior, view toggle, responsive framing concept, river corridor and scene landmark logic. Split asset construction out of the monolithic component.

Replace old radial/Gaussian mountain geometry with custom authored ridge/terrain meshes exported as GLB. Mesh source/generator must remain editable; actual loaded 3D geometry participates in lighting/shadows, not a raster background. Broad skyline profiles, secondary shoulders and glacial shelves come first. Slope/height masks separate rock, grass and snow; detailed baked normal/AO/roughness atlases follow silhouette review. Current vertex zoning is a first material pass, not final texturing. Terrain should have a common height sampler for grounding grass, cottage and traveler, with future walkable collision mesh and riverbed.

Replace uniform grass with authored tufts, broadleaf plants, daisies, yellow flowers, purple spikes, shrub clusters and conifers. Use habitat masks, negative space, seeded clusters and several size/color variants; LOD/billboard transition only at distance. Prioritize foreground silhouettes rather than millions of blades. Existing instancing technique is reusable; current blade assets/scatter are not final.

Replace the water shader with a shallow riverbed, depth-dependent absorption, foam only around obstacles, restrained Fresnel/reflection and flow-aligned normal maps. Start with one low-resolution planar reflection on desktop, environment reflection on mobile. Avoid full-scene refraction/SSR until profiling. Shared river spline remains useful.

Clouds require distinct authored cumulus masses/soft-shaded meshes or baked volume impostors for the fixed hero camera; existing marching-cubes shapes are placeholders. Avoid expensive runtime volume raymarching as a default.

Cottage: custom Blender model with timber frame, plaster walls, individual slate silhouette, stone foundation, door/windows, chimney and flowerboxes; bevels, UVs, baked AO/normal/roughness; one coherent atlas and 2–3 materials. Existing box/extrusion house is only a placement proxy. Kenney Fantasy Town Kit is a CC0 source option (https://kenney.nl/assets/fantasy-town-kit), but its simple modular appearance does not match this target without extensive remodeling; not selected.

Traveler: custom stylized sculpt → retopology → UVs → baked detail → humanoid skin rig. Match approved teal top, tan trousers, boots, brown hair/beard and relaxed silhouette. No permanent name/history. Separate backpack/bedroll stay on the bank. Existing capsules/spheres are only a scale proxy. Quaternius Universal Base Characters (https://quaternius.com/packs/universalbasecharacters.html) is a candidate rig/topology base; official page describes humanoid rigs, animation topology, glTF/FBX and currently lists CC0. Verify the included license and edition of the actual download before importing. Base proportions, clothes, face and rig export still need matching; not selected or imported.

## Asset sources and provenance

- Concept image: built-in image-generation output; art direction only, not a texture projection.
- First terrain assets: custom code-authored mesh profiles and masks in this repository, exported to GLB by a reproducible local generator. No third-party artwork embedded.
- Source texture candidate: Poly Haven rock, grass/soil, timber and slate PBR materials (https://polyhaven.com/license, CC0 for assets). Stylize color/contrast and bake consistent atlases; raw photoreal textures alone will not match the target. Do not use their live API in production. No texture downloaded in pass one.
- Candidate base meshes: Quaternius and Kenney as above; exact files not selected or downloaded. Retain creator, source URL, archive license, modifications and export settings for each actual import in `public/models/hero/ASSETS.md`.
- Three.js GLTFLoader and exporter are implementation tooling under the existing Three.js package license. Existing code dependency; no new production dependency needed.

## Rig and animation contract (deferred implementation)

One skeleton/identity across all poses. Humanoid hips/spine/chest/neck/head, clavicles/arms/hands, legs/feet/toes; hand/finger controls for later props, foot/hand IK and pole controls in authoring rig; facial/eyelid/eye-direction blendshapes, hair/scarf secondary bones where justified. Export deform bones and baked clips, not Blender constraints. Keep ≤70 deform bones and ≤4 influences/vertex as starting budgets; test supported glTF skinning. Author recline, weight-shift, hand plant, rise, stand, walk, stop, gesture and return to rest with continuity, root-motion strategy, terrain contacts and transition poses. No generic walk clip substitutes for the rise. Root motion and IK evaluation approach will be selected when those stages are authorized. Backpack never teleports. No animation/scroll/weather implementation in pass one.

## Proposed performance budgets (not measured guarantees)

Desktop: ≤600k visible triangles, ≤120 draw calls, pixel ratio ≤1.5, target 60 fps. Mobile: ≤250k triangles, ≤75 calls, pixel ratio 1–1.25, sustained ≥30 fps on a representative mid-range device. Budget ≤12 MB compressed initial scene download, optional foreground/character detail streamed afterward; GPU texture allocation target ≤128 MB desktop / ≤64 MB mobile. Use shared 1K/2K atlases; KTX2 GPU compression plus Meshopt/Draco only when assets and decoder measurements justify them (GLTFLoader supports decoder integration: https://threejs.org/docs/pages/GLTFLoader.html). First custom meshes remain uncompressed for inspectability; report actual sizes instead of claiming these delivery goals are met.

One sun/shadow map (2048 desktop, 1024 mobile), baked static AO/indirect lighting where useful, no dynamic lights per prop. Vegetation batched by species/material; cull by patch/LOD, alpha-tested minimal transparent overlap, no shadows from every distant blade. Avoid continuous rendering in still/reduced-motion mode. Profile draw calls, triangles, texture count, CPU build/load times and frame times with animation enabled later. Real device thermal/driver behavior remains a release gate. Accessibility includes equivalent text/actions and explicit fallback disclosure; a fallback is resilience, not completion.

## Reviewed passes

1. Terrain, mountain silhouettes/material zones, camera calibration and sunlight/atmosphere. Capture still without UI, then same frame with UI. Stop for review.
2. Rock/ground material detail, vegetation patches/conifers/flowers and river geometry/materials. Review sunny still.
3. Authored cottage and rigged traveler, grounded contact/props and cloud treatment. Review sunny still at desktop/mobile.
4. Ambient vegetation/cloud/water motion and runtime optimization; reduced-motion parity.
5. Only after sunny visual quality approval: character approach, then opening weather and later scroll choreography.

Do not present intermediate passes as a full visual match. The approved frame is materially more detailed than the first-pass runtime assets; exact equivalence is not guaranteed.

## Pass-one implementation and review evidence

Implemented custom mesh generation/export with shared terrain coordinates, a desktop GLB and a lower-resolution mobile GLB. Runtime now loads those models through GLTFLoader, uses slope/altitude rock/grass/snow zones and a restrained custom rock-normal shader. Sun/sky/fog balance is revised; foreground objects share the new terrain sampler. A visible loading state covers the incomplete scene until terrain loads. Previous runtime source/CSS and stills remain available for comparison.

Runtime proxies deliberately remain: uniform grass (reduced by device class for budget), flat illustrative river, simplified clouds, box cottage, capsule traveler/backpack. No sourced art/model was imported. Snow is excluded from low foothills. No weather, scroll choreography, rig, character approach or new ambient animation was added. Existing pause/reduced-motion behavior remains.

Validated both exported GLBs through GLTFLoader: 9 meshes each, finite positions, valid indices. Desktop export: 7,419,268 bytes and 261,008 terrain triangles. Mobile export: 2,243,876 bytes and 77,760 terrain triangles. Renderer counters at 1440×810: 579,376 triangles / 67 calls. At 390×844 after mobile camera correction: 172,472 triangles / 67 calls. Counters describe the current renderer including proxies; they are not fps, GPU-memory, or thermal benchmarks. The mobile model is selected at scene initialization. No compressed-delivery claim yet.

TypeScript check and production build pass. Browser console had no errors/warnings for the loaded scene. Desktop scene-only/UI captures preserve one frozen frame; mobile landmarks were checked and camera widened to retain both traveler and cottage. Captures: `references/terrain-pass-1/landscape.jpg`, `with-ui.jpg`, `mobile.jpg`. The approved target is not replaced or altered. No package/configuration, backend, workspace-route or shared style changes in this pass.

Review boundary: this is an intermediate shape/material-zone/light study, not a finished reproduction of the rich approved concept. The mountains still need art review and authored cliff/normal detail; foreground vegetation, shallow riverbed, realistic stylized cottage/traveler and cumulus detail remain conspicuously below target. Do not interpret asset-based loading or a screenshot as visual approval. Stop here for terrain/lighting feedback before pass two.
