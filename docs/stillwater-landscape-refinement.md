# Stillwater — landscape and wind refinement

## Brief

The user rejects the coarse mountain facets, repeated tree symbols and barely visible grass motion. Continue building scenery directly in frontend code. Improve the actual geometry and perceived movement; do not return to generated background images.

## Design plan

- Palette: sky #BBD9EA, distant slate #A1BCCC, mountain blue #7197AA, pine #244E43, meadow #B0BF79, water #8DBDC1. Preserve Tenor Sans/Hanken UI and short, left-aligned invitation.
- Composition: irregular ridgelines soften into atmospheric layers around the river; wooded slopes frame the valley; a smaller stone/timber cottage and a proper perspective footbridge provide scale. Foreground plants make the breeze unmistakable.
- Implementation: native 2D canvas with cached sky, terrain and structures. No scene images, WebGL or animation dependency. Curved grass blades bend independently using a coherent travelling wind field; trunks and roots remain planted. A dynamic curtain, chimney smoke, nearby flowers and water under the bridge provide life around stable architecture.
- Detail: asymmetrical conifer branches and clustered broadleaf crowns replace repeated triangles; native brush marks and directional strokes break up large terrain shapes. Wood joints, stonework, roof courses and window depth improve the house and bridge.

Wireframe: [quiet sky + invitation] / [six irregular ridge layers] / [wooded slopes and narrowing river] / [small cottage, perspective bridge] / [long foreground grasses bending through a passing gust].

## Pre-build critique

The previous design confused CSS transform activity with visible movement. This revision should be judged from separated animation frames as well as code state. Grass near the visitor needs 20–50 pixel tip travel, while far grasses remain quieter. Mountains need believable masses, not softened versions of the same pyramids. The house and bridge should not wobble like rubber: animation belongs in the curtain, smoke, foliage and water around them. Keep the UI readable and allow pausing/reduced motion.

## Implementation and visual checks

Current renderer: `apps/web/app/design/stillwater/LandscapePainter.ts`. React lifecycle and motion controls: `NatureScene.tsx`. The previous scene-group CSS is replaced by a small canvas container stylesheet. Terrain and building layers are cached in memory, then native paths draw the animated water, individual grass blades, moving curtain, steam/smoke, clouds and canopy. No external scene images or 3D runtime are used. Decorative scenes render only when near the viewport; pause and OS reduced-motion stop their clocks.

Mountain silhouettes use irregular interpolated ridge profiles with low-contrast directional texture. Conifers have asymmetric branch tiers and foliage dabs; broadleaf crowns use clustered leaves with varied lighting. The cottage has masonry, roof courses, shutters, window depth, porch grain, moving curtain and chimney smoke. The bridge has perspective planks, joints, posts and water moving underneath. Stable architecture is not animated as rubber.

Corrected the Canvas hit-test coordinates for the cached terrain transform: grass roots now stay out of river water. The grass generator samples up to 4,500 candidate positions, rejects water/buildings, and draws curved blades rooted in place. A travelling wind field creates a wave across the grass, with independent small variations. The stronger breeze eases toward 1.9 rather than jumping instantly.

Desktop frame comparison: in selected foreground-grass regions, about 7.2–7.5% of pixels changed significantly between running frames. The river changed too; the selected mountain region was identical. Two paused captures had no changed pixels in the tested scene area. The animation clock advanced about 15.28 seconds over 15.24 seconds of elapsed desktop wall time (diagnostics update every 400 ms), so the desktop check did not show artificial slow motion from the frame-delta cap. These are local observations, not a performance guarantee for all devices.

Reviewed the phone composition at 390×844. New captures and motion-comparison frames are in `docs/references/stillwater-refined/`. Production build and TypeScript pass. Existing planning behavior is preserved; sample travel information remains illustrative.

Final narrow-screen check at 320×780: no clipped links/buttons, no horizontal overflow and zero HTML image elements. The night-count budget still updates to ₹17,300 and the rain proposal is accepted without moving dinner at 20:00. Off-screen frames are cancelled through the intersection observer; scene state diagnostics explicitly report offscreen on exit.
