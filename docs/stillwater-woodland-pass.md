# Stillwater — woodland, river source and cottage pass

## Brief

The user identifies a disconnected river source, weak vegetation and a house that does not fit the landscape. The reference is atmosphere guidance: overlapping forest masses, dark shaded foliage, bright fine meadow texture and clear atmospheric depth. Keep all scenery manually constructed in frontend code.

## Plan before implementation

Palette: sky #B9D9EA, ridge #8FAFBA, shaded woodland #284F43, sunlit foliage #86A65D, meadow #AABD74, river #8EBABF. Keep the existing calm Tenor Sans/Hanken interface. Spend the extra detail in the natural world, with a quieter, smaller building.

Composition: a continuous stream tapers into a distant wooded ravine; thick forested slopes overlap its headwaters. It widens gradually past the bridge and into the foreground. A low, oblique cottage sits on a planted right bank, with a slate roof, shaded veranda and contact shadows. Connected crown shapes and irregular conifer silhouettes replace the repeated striped trees; grass reads as a textured meadow with rooted moving clumps rather than scattered strokes.

Pre-build critique: simply adding more branches to the current tree stamp will repeat the same silhouette. Redraw conifers as irregular whole crowns and use a connected woodland mass behind them. The current river path and moving reflections disagree; derive both banks and flow locations from one shared course. Replace the cottage's dominant front-facing gable and square wall with a low roof and consistent three-quarter perspective. Keep the reference image out of the render.

Motion: keep the existing wind field and pause behavior. The new vegetation should stay rooted and retain clear foreground sway. The house stays stable; a small curtain, smoke and surrounding leaves supply motion.

## Implemented

- Replaced the hand-approximated, disconnected bank/flow definitions with one sampled river course. Both banks, the thin headwater stream, bank edges, moving reflections and vegetation exclusion use the same geometry. Trees overlap the headwater end so it reads as emerging from a wooded valley.
- Replaced striped conifer tiers with irregular complete crowns, shaded needle texture and varied heights. Broadleaf crowns use connected contours and smaller foliage marks. More trees form layered woodland, with clustered growth at the edges rather than evenly scattered lawn trees.
- Added a connected overhead crown and a foreground trunk, with small light gaps and bark texture. These provide shaded framing inspired by the reference; the reference image itself is not rendered.
- Reworked grass into rooted clumps over a denser fine-grass ground layer, using richer greens, smaller flowers, dappled light and foreground shade. Existing wind motion remains.
- Replaced the dominant front-facing gable with a lower, wider, three-quarter cottage. Slate roof courses, eaves, shutters, wood cladding, a shaded veranda, steps, contact shadow and an entrance path establish scale and grounding. Planting is asymmetrical and leaves the entrance clear. The curtain/smoke coordinates use the same cottage transform.

## Review scope

Desktop only for this pass, at the user's explicit request. Do not spend subsequent design effort optimizing phone layouts until that preference changes. Reviewed at 1440×1000; the page reports zero image elements. Production build and TypeScript pass. Motion/pause and existing planning interactions remain available. Captures are in `docs/references/stillwater-woodland/`; the design gallery uses `public/images/stillwater/preview-woodland.png`.
