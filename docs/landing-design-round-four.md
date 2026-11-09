# Five longer landing experiences

Local design exploration, 8 November 2026. Existing nine samples stay available.

## Intent

Length should earn its place. Each new page moves from an emotional invitation to discovery, connected destinations, stays and travel, an adaptive change, a cost explanation, practical questions and a clear next step. No invented reviews, metrics or live offers. Examples use local React state and reset on reload.

## Design plans

| Direction | Palette | Type | Characteristic layout and motion |
| --- | --- | --- | --- |
| Switchback | Ice #EEF3F7; slate #243D50; sky #BED6E9; blue #355D8E; snow #FFFFFF | Manrope and Cormorant Garamond | Panoramic alpine opening; left-aligned oversized text; a route winds through the page; sticky scroll story connects the imagined trip to practical planning. |
| Postcards | Petal #FFF0F1; cherry #A62947; coral #E68D87; paper #FFFFFF; lilac #DCD4EC | DM Sans and Fraunces | Centered invitation above a fanned postcard deck; clicking turns a card over; photos turn into a collected trip. Softer margins, tactile asymmetry. |
| Current | Foam #EFFAF8; teal #125B60; water #BFE4DE; blue #356F9F; white #FFFFFF | Urbanist | A circular ocean aperture against very large left-aligned type; tide lines connect open, calm sections; pointer-driven aperture, scene choice and budget sliders. |
| Layover | Navy #243954; tangerine #EF9861; pale blue #E9F0F6; white #FFFFFF; steel #91A4BA | Sora and DM Sans | A station departure board leads into a journey; tab changes animate board content; route planning and logistics are the visual language. Large type stays quiet around the board. |
| Daybreak | Peach #FBE2CC; indigo #414E79; sky #D6E8F5; sun #F5C761; mist #F9F6F2 | Outfit and Lora | A sun-disc and photographic horizon; time-of-day control transforms the atmosphere and itinerary; scroll moves from an imagined morning into the actual trip. |

Composition sketches:

Switchback: [wide alpine hero] / [long sticky imagine-to-plan story] / [route studio] / [stays + travel] / [disruption] / [cost control] / [FAQ] / [closing landscape].
Postcards: [headline + fan deck] / [collect places] / [route ribbon] / [open postcard story] / [stays + travel] / [change preview] / [cost control] / [FAQ + closing].
Current: [type + circular sea] / [large spacious statement] / [inspiration] / [cost/pace tide controls] / [route] / [change preview] / [stays] / [FAQ + closing].
Layover: [headline + departure board] / [three-part trip explanation] / [route studio] / [travel + stays] / [sticky journey story] / [change preview] / [cost control] / [FAQ + closing].
Daybreak: [time-sensitive sky + sun + horizon] / [day controller] / [inspiration] / [route] / [sticky story] / [stays] / [change preview] / [cost control] / [FAQ + closing].

## Review before build

Avoid five recolored copies: each hero, section order and signature interaction differ; reusable demo tools retain understandable behavior across concepts. The route and cost sections add substance missing in earlier rounds. Photos supply detail instead of generic icon cards. A pause-motion control and reduced-motion support accompany the richer effects. Avoid compulsory scroll hijacking, artificial wait screens, fake review endorsements and misleading provider availability.

## Assets

Existing licensed inspiration photos are retained. Additional Pexels inspiration images:
- https://www.pexels.com/photo/landscape-photography-of-cabin-near-forest-976919/
- https://www.pexels.com/photo/colorful-italian-coastal-town-overlooking-the-sea-36803728/

Landscape photos are visual inspiration, not evidence of a specific itinerary location or an accommodation offer.

## Validation and critique after implementation

- Production build and TypeScript checks pass for all five new routes.
- Reviewed all five at 1440px desktop and 390px mobile; also checked Postcards and Current at 320px.
- Browser checks: route reordering, a fourth stop, extra nights and updated allowance; stay/transfer selectors; disruption preview, acceptance and protected dinner; budget style and over-budget response; native FAQ; shortlist save; pause motion; postcard flip; coastal scene change; departure-board mood; day/night selector; sticky story chapter navigation.
- Fixed a CSS filter that flattened the postcard's 3D flip. Removed filter from the transforming element so the reverse remains readable.
- Checked layout widths and images: no page-level horizontal overflow or broken loaded images in reviewed views. Browser error log was empty at the final interaction check.
- New pages are roughly 8,400–9,740px tall at a 1440×1000 viewport, with distinct substance in each chapter. These are intentionally fuller exploratory pages; the final chosen page can be edited down once the preferred narrative is known.
- Shared demos deliberately use sample data, with estimate and source limitations visible. No API, database or booking behavior was changed.
- Screenshots: `docs/references/design-round-four/`.
