# Terrain pass 1B — fixed-camera review

7 November 2026. Pass one terrain and lighting were explicitly not approved. This is a focused comparison, not a claim that the concept art has been reproduced.

## Before editing: how pass one was made

`terrain-spec.mjs` defines two sampled riverbanks and seven ridge heightfields. The generator samples those functions into triangle grids, computes vertex normals, assigns colors from local slope/height plus trigonometric noise, and exports GLB with MeshStandard materials. `terrainMaterial.ts` supplied procedural noise color/normal perturbation. No sculpt, UV texture atlas, hand-painted material mask, normal/AO bake, or indirect-light bake existed. GLB is a transport format and supplied no extra art quality.

Geometry is needed for silhouette, shoulders, terraces, cut faces and overhangs. Texture/material masks are needed for designed rock/grass/snow placement and consistent surface scale, with baked normals supplying smaller fractures. Lighting bakes or a more complete indirect-lighting solution are needed for the concept's soft local occlusion and environmental bounce. Those are distinct requirements; shader noise is not a substitute.

## Focused changes

- Replaced high-frequency erosion and green/gray slope speckling with two authored shelf levels interrupted by per-massif opening regions and broad ridge buttresses. Exposed face regions remain connected. A first check produced overly continuous stripes; the bounded correction broke the shelves into regions rather than adding fine noise.
- Removed the noisy normal perturbation. Only very subtle broad rock coloration remains in the shader; cliff surface detail is deliberately unresolved pending modeled assets.
- Snow uses an uneven elevation boundary with longer gully tongues and no snow on low foothills.
- Added west/east intermediate valley spurs, leaving the central river corridor open. Distant ridge tint and fog separation distinguish depth layers.
- Reduced foreground undulation and blended level resting patches around the existing traveler and cottage anchors. Their original world elevations/positions are retained using `passOneHeight`. Backpack placement is also frozen to pass one.
- Adjusted directional sun angle/warmth, reduced diffuse fill, cooled sky illumination and shadows, and adjusted exposure/fog. These are real-time direct/fill lights, not a GI bake.

## Protected elements and comparison method

Water geometry/shader, cloud construction, grass blade geometry/materials/count/horizontal seeded scatter, cottage geometry/materials, traveler/pack geometry/materials and camera framing remain unchanged. Grass blade bases follow the changed ground height so they do not float; no vegetation art/distribution pass was made. Lighting changes naturally affect the appearance of all lit objects. No animation, weather, scroll or later section work.

Pass one source, generator, material code and both terrain GLBs are archived in `docs/baselines/terrain-pass-1/`. Original runtime v1 GLBs remain untouched in public assets. A baseline material module and conditional lighting/height selection reproduce pass one in the same current renderer.

Capture at 1440×810; camera position `(0,12,27)`, FOV 43°, target `(0,7,-15)`, time zero, paused. Main camera source is unchanged. No product UI or developer badge: captures use a production preview on port 3002 with `?review=terrain`. Add `&baseline=1` for pass one. On the regular dev server the same query hides product UI but the development badge can still be present. No shared Next.js configuration changed.

Comparison images under `references/terrain-pass-1b/`:
- `pass-one-baseline.jpg`: re-rendered pass one, same camera and production viewport, no UI.
- `landscape.jpg`: pass 1B under identical camera/viewport/time conditions.
- `mountain-closeup.jpg`: unretouched viewport crop `(90,125,610,305)` from the 1B camera, not a different lens/render.
- `meadow-closeup.jpg`: unretouched viewport crop `(180,465,385,290)` from the same 1B frame.

## Checks and limits

Production build and TypeScript passed. Both new GLBs parsed through GLTFLoader with finite vertices and valid indices: 11 meshes each. Desktop terrain: 276,368 triangles / 7,863,436 bytes. Mobile: 83,904 triangles / 2,425,768 bytes. Browser console had no errors/warnings. Source comparison verified unchanged camera, water, cloud and vegetation-construction blocks, and numerical checks verified unchanged traveler/cottage resting-anchor elevations.

Renderer counters: pass one 579,376 triangles / 67 calls; 1B 610,096 triangles / 71 calls at the fixed desktop view. The extra foothills put this comparison about 1.7% above the earlier proposed 600k triangle budget; geometry LOD optimization remains outstanding. Vegetation was not reduced to hide this cost. These counts are not a measured frame-rate or thermal guarantee. This pass did not re-benchmark mobile.

The material regions are more deliberate, but the close-up still reads as smooth simplified cliffs. The meadow is gentler, but its vegetation remains the existing repetitive proxy. Snow boundaries are authored approximations, not sculpted ledges. Do not mark this visual target achieved, and do not continue adding procedural mountain detail without a new production asset approach.

## Concrete asset-production alternative

The current heightfield method has one surface height per X/Z coordinate: it cannot describe undercuts, overhanging strata or genuinely broken vertical cliff topology. No sculpted source mesh, UV atlas, bake scene or Blender installation is currently present in this workspace. The remaining requirement is a modeled asset-production task, not another GLB export or shader adjustment.

Recommended next production package, after this review:

1. Two hero massif sculpts with approved skyline/valley silhouette locked to the supplied camera. Model buttresses, fracture planes, ledge thickness and occasional undercuts as actual forms; create lower-relief foothill meshes separately. Use the concept as visual guidance, not image projection. Keep the existing corridor/landmark coordinates.
2. Retopologize to roughly 50–70k triangles per near massif, 10–20k per intermediate group; prepare 50% and 20% LODs. Preserve visible skyline cuts and shelf edges before decimating internal faces.
3. UV unwrap and bake high-to-low tangent normal and AO maps. Author rock/grass/snow masks by painting continuous regions across the sculpt. Use a shared stylized rock material with broad planes and sparse fractures, not stochastic green spots or raw photoreal scan textures.
4. Deliver 2K base color/normal/mask atlas sets for the near massifs, 1K for intermediate terrain; pack roughness/AO/masks, retain linear/sRGB metadata and verify seams in the actual browser. Snow is a shallow modeled layer or blended material with manually shaped boundaries, not a uniform white cap.
5. Sculpt a continuous meadow mesh with broad groundcover shapes and gentle asset resting pads, while keeping the current grass proxies during terrain review. Supply a common placement/collision surface to prevent floating props when vegetation/character are later replaced.
6. Author a warm-sun/cool-sky bake scene matching the fixed camera. Bake static AO/indirect illumination into a second-UV lightmap or vertex irradiance, retaining direct sun/shadows separately. Test tone mapping in Three.js before accepting the bake; avoid baking two contradictory sun directions. Defer weather relighting strategy until sunny quality approval.
7. Deliver editable `.blend` sources, high/low meshes, maps, a source/license manifest, desktop/mobile GLBs and browser captures from this exact camera. A modeler can use Blender, ZBrush or an equivalent sculpt/bake pipeline; no asset vendor is selected or imported by this pass.

Review the 1B shape/light separation and production handoff before proceeding. No further art pass is automatically authorized by these notes.
