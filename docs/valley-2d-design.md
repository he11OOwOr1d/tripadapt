# Return to the valley — a layered 2D landing design

## Current request and precedence

The user explicitly asks to reproduce the original agreed world without building it in 3D. This supersedes the old briefs' technical requirement for real-time 3D. The approved composition, coherent dimensional illustration, character identity and narrative remain the targets. This is an intentional 2D art-and-interface implementation, not a claimed 3D renderer or a replacement for the prior source assets. No WebGL, Three.js, GLB, rig or runtime 3D model is loaded by this page.

## Visual plan

Palette: sky #71A9DC, meadow #427649, pine #173E34, river #6CC7CF, sunlight #F6D998, map paper #F8F7E9. Typography: locally hosted DM Sans for all UI and headings; space and restrained weight keep the vista dominant. One coherent illustrated scene fills the desktop viewport; UI lives in the upper sky and quiet foreground margins. A responsive framed landscape preserves both banks and landmarks on narrow screens.

Layout: [living valley + reclining traveler] → [traveler rises and welcomes visitor] → [collect possibilities beside same world] → [his map expands into a readable workspace] → [pace and free time] → [proposed weather revision] → [workspace folds away, traveler returns to rest].

Critique before implementation: do not replace the composition with text-left/photo-right; do not use flat primitive mountains, repeated feature cards, a floating island or a search-form hero. Use the approved rich raster art as the visual basis. Character pose transitions are 2D choreography rather than a promise of skeletal walking animation. Keep essential controls available throughout the weather introduction; respect reduced motion.

## Detail inventory

- Broad mountain masses on left/right, overlapping smaller peaks, atmospheric depth and high-ridge snow.
- Sun upper-left of center; asymmetrical moving clouds; occasional shade.
- Lush grass on both banks, warm tips, flowers, rocks and sparse trees.
- River starts between mountains and widens into the foreground; flowing highlights are restrained.
- Cottage lower-right with timber, plaster, slate roof, chimney, door, recessed windows and flowerbox.
- Same adult traveler reclines lower-left, teal shirt, tan trousers, brown boots/hair/beard. Separate backpack stays at that bank.
- Rain clears over approximately 12 seconds with one restrained distant lightning cue; skip/replay/pause controls, no automatic sound.
- Friendly optional click joke; no permanent bubble, invented name or fixed biography.
- Greeting, discovery, unfolded-map planning, free time, weather proposal and tired return-to-grass ending.
- Dates are flexible; multiple destinations; stays/transport/cost context; estimates and unavailable facts labeled; no fake reviews or booking execution.

## Art provenance

Built-in image generation was used, with `docs/references/hero-concept-v1.png` as the approved reference:
- `public/images/valley/landscape.png`: edited background plate retaining composition/materials, removing the baked traveler/backpack/clouds/sun so those layers can move independently.
- `public/images/valley/traveler-poses.png`: transparent 3×2 sheet, same character in reclining, rising, walking, greeting, map-holding and umbrella poses.
- `public/images/valley/clouds.png`: transparent cloud overlay in the same art style.
- `public/images/valley/backpack.png`: detailed matching backpack and rolled mat, left on the original bank.

Generation prompts are retained in this chat. Assets are copied into the repository; original generated outputs and approved frame remain untouched. Grass and flowing-water details use code-native vector layers; the backpack uses its own matching generated cutout.

## Delivery and scope

- Page: `/design/valley`, featured first in `/design/options`.
- Production files: `apps/web/app/design/valley/page.tsx` and `valley.css`.
- Delivery uses WebP copies of the generated PNG artwork, preserving transparent alpha. The four web assets total approximately 1.29 MB; PNG source copies are retained. No responsive/network speed benchmark is implied by this byte total.
- Exact prompt set: [asset-prompts.md](references/valley-2d/asset-prompts.md).
- Backpack now uses its matching generated cutout rather than the initial vector sketch.
- Mobile keeps the full mountain range and cottage in a panorama, continuing the near bank and water with the same painted texture. It is an adapted composition rather than a cropped-out cottage.
- The earlier 3D source, old prototypes, root landing page and API/database contracts are unchanged.

## Validation

- Production build and TypeScript checks pass.
- Browser review at 1440×1000 and 390×844, with no horizontal document overflow or broken loaded images in checked views. Zero canvas elements are present; this page does not instantiate a 3D renderer.
- Checked rain on entry, skip to sunshine, automatic settled sunshine, pause/resume, landscape-only toggle and return, cottage interaction and traveler joke.
- Checked chapter navigation and coherent final poses, discovery choice/save carried into the map, night edits and route swap updating the estimated subtotal, slower afternoon with intentional free time, revision preview/acceptance preserving the 20:00 dinner, and return to the reclining pose.
- Browser error log was empty at the final check.
- Captures: `references/valley-2d/hero.png`, `rain.png`, `welcome.png`, `workspace.png`, `landscape-only.png`, and `mobile.png`.
- Limitation by design: character movement uses 2D pose changes and CSS translation rather than skeletal animation. The map is an illustrative route sketch; it does not claim geographic accuracy or live provider validation.
