# Sunny hero composition prototype

7 November 2026. This is a reviewable stage-one study, not approved final artwork.

## Assessment and rendering choice

Read `visual-direction.md`, `landing-storyboard.md`, the drawing, frontend instructions, and relevant product/architecture boundaries. The existing Next.js shell, route structure, and client-side interaction conventions are reusable. The original dialog UI represents unavailable product features and is not needed for this scene review. `/system`, API code, backend and root layout remain untouched.

`public/images/elsewhere-valley.png` is a 512×286 flattened generated/Stitch landscape. It broadly matches the drawing but has no separable character, grass, river or cloud data. Retained unchanged as an explicitly provisional WebGL fallback and visual reference, not promoted to final art. Its external source/licensing provenance still needs confirmation before release. `design/stitch/elsewhere-original.html` remains unchanged and is reference only. No existing models, textures, rigs, HDR environments or animation clips were found.

Selected for this small prototype: directly authored Three.js geometry, one shared camera/light environment, continuous banks, atmospheric mountain separation, a world-space river ripple shader and instanced wind-responsive grass. A raster animation would offer stronger baked art but could not support later physical character approach without additional rendering/compositing. Procedural geometry makes composition and motion review possible now; it does not settle final production asset selection.

## Scope and asset status

- Mountain meshes, banks, stones, cloud clusters, cottage, grass and reclining human are authored procedurally in `apps/web/app/landing/SunnyScene.tsx`; no downloaded third-party art.
- Human is a fixed capsule/sphere pose blockout, not a rig or finalized character design. Backpack stays beside him. No standing/walking or weather sequence.
- Mountains and cottage remain simplified prototype forms. They need sculpting/material refinement; clouds need softer treatment; water uses illustrative highlights, not true scene reflections. No claim of production animated-film quality.
- Approximate drawing relationships preserved: dominant left/right peaks, intermediate range, sun near left peak, continuous meadows, river source center opening toward foreground, traveler left, house right. Narrow screens use a wider elevated camera rather than cropping landmarks away.
- Copy, Elsewhere mark and wardrobe are provisional. This review surface offers scene-only and pause controls; planning navigation/CTA integration is deferred until the scene is reviewed. No later sections or simulated backend actions.

## Configuration coordination

Only `apps/web/package.json` and its lock add `three` / `@types/three`. No Next.js, TypeScript, environment, backend, global stylesheet or root-layout changes. CSS is imported by the home route and scoped under `sunny-*` / `scene-only`. Three.js is dynamically loaded. No new font/network assets.

Modified/added paths: `apps/web/app/page.tsx`, `apps/web/app/landing/SunnyScene.tsx`, `apps/web/app/landing/landing.css`, frontend package manifests, this note. Existing briefs remain authoritative and unchanged.

## Behavior and verification

Grass and river use a shared elapsed animation time; cloud drift is bounded; sunlight changes subtly. Pause freezes all ambient time. Reduced motion freezes the same composition automatically; hidden tabs stop drawing and paused scenes redraw only on resize. Renderer caps device pixel ratio at 1.6; grass uses one instanced draw. Resources and resize observers are disposed on unmount. WebGL failure/context loss shows the retained still with a visible disclosure.

Browser review at 1440×900 and a narrow 496×735 viewport checked the landmark composition and usable controls. Pause state and scene-only toggle verified through the rendered UI. Browser testing found and fixed a GLSL include-line error and removed an obsolete shadow-map constant. TypeScript and production build checks performed; no backend data flow is introduced by this standalone scene.

Outstanding review: composition, art fidelity, grass density/material, cloud softness, river highlights and final character asset/rig. Mobile-device performance, reduced-motion emulation and forced context loss have not been measured. Approve/refine the sunny scene before rise-and-approach or storm work.

## Revised sunny still — 7 November 2026

The first geometry was a blockout, and its visual quality was not approved. This revision preserves the camera/layout and remains pending visual approval.

Custom procedural models now replace the radial mountain cones with asymmetric heightfields: displaced summits, secondary shoulders, branching ridge detail and altitude tinting. Both banks use rolling heightfields with denser sampling at the irregular water edge. The repeated stone edging is removed entirely. Grass uses curved instanced blades. Clouds are connected marching-cubes surfaces rather than rows of separate spheres. A gradient sky, warm directional sun and cool sky fill provide greater depth. The river shader removes glitter/glints in favor of restrained broad reflection and fine ripples; these remain illustrative rather than physically accurate reflections. No image-generated or downloaded landscape art was added.

Review starts paused at time zero and without headline, brand or footer overlays. A small “Show UI” review control reveals the same frame, preserving elapsed time and camera. The paired desktop captures are `references/sunny-review/landscape.jpg` and `references/sunny-review/with-ui.jpg`. No new motion choreography, storm, scroll transitions or later sections were implemented. Existing ambient-motion code remains available only through the resume control. No shared configuration or application-workspace files changed in this revision.

### House assessment

The current house is boxes plus an extruded triangular roof. It has no authored production topology, UVs or texture set. Retain it only as a composition/scale placeholder; adding individual trim boxes will not produce the intended asset quality.

Recommended: custom model in Blender with a gently asymmetric silhouette, coherent roof/wall thickness, rounded edges, authored wood/plaster materials and one glTF export. Alternative to evaluate: [Kenney Fantasy Town Kit](https://kenney.nl/assets/fantasy-town-kit), whose official page lists 160 3D assets and CC0. Its simplified modular aesthetic would require matching material/proportion work and is not approved or imported.

### Character assessment

The reclining human is assembled from capsules and spheres, with no skeleton, facial rig, UVs or animation clips. Backpack is also a capsule placeholder. Neither is a final custom character asset.

Recommended: a custom stylized traveler model and humanoid rig in Blender, with consistent face/clothes and poses authored for this terrain. Lower-cost base option: [Quaternius Universal Base Characters](https://quaternius.com/packs/universalbasecharacters). The official page describes six base bodies, humanoid rigs, animation-friendly topology and glTF/FBX exports. The page currently labels the pack CC0; verify the actual selected archive's included license and free/paid edition contents before importing. A base still requires wardrobe, proportions/material matching and a custom recline-to-stand sequence. No claim that the pack supplies that sequence. No sourced house/character asset is present in the scene yet.

### Revised checks and limitations

TypeScript check passes. Production build passes. Browser review checked narrow and desktop composition; both paired captures use 1440×900 and the same frozen time-zero scene. Browser console reported no errors/warnings in the revised scene. Headline toggle verified. Mobile performance is not measured. This is a custom procedural landscape study, with simplified materials and temporary house/character. It is not approved final artwork, and further art review comes before any new stages.
