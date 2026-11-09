# Landing design alternatives

7 November 2026. Three additional proposals, not replacements for the original /design sample. Comparison index: /design/options. Root page unchanged.

## Plans and brief critique

### Atlas — /design/atlas

Tokens: porcelain blue #F8F9FC, nautical ink #172C3C, glacier gray #E9EEF5, slate blue #ADBFE1, white #FFFFFF. DM Sans handles display and reading. Left-aligned spacious title/opposite invitation, wide landscape, one feature reveal, photographic closing. Feature navigation updates the same visual stage so the page does not become a stack of unrelated cards.

```text
headline                         invitation
wide landscape + route ticket
benefit bridge
feature choices / changing scene
photo                      closing
```

Closest to the original hero by design; the main difference is the quieter connected content below. No automatic carousel.

### Roam — /design/roam

Tokens: paper #F7F4F0, walnut #3E322E, sand #E8DCCF, kraft #DAC5A8, white #FFFFFF. Space Grotesk supplies the typography. Photo overlap establishes the travel-desk idea; selection, notebook and understated feature interaction extend it.

```text
invitation                 overlapping photographs
selectable photographic possibilities
copy                       journey notebook
feature choices / changing scene
large closing invitation
```

Although warmer, it avoids the earlier high-contrast-serif/terracotta default. No fake reviews, numbers or social proof. A physical-photo metaphor is the one expressive device; surrounding layout is quiet.

### Tide — /design/tide

Tokens: sea ink #204952, frost #F6FAFB, water gray #E5F0F3, mist #A9CDD4, white #FFFFFF. Outfit supplies soft geometric type. Edge-to-edge landscape changes only on user selection. One sample-day window reveals morning, open afternoon and adaptation. Functional preview combines features instead of repeating a grid.

```text
full-view landscape / headline / scene selection
centered statement
day controls               changing itinerary window
route introduction         connected destinations
night landscape + closing
```

The cool palette is justified by the sea-led direction, with photographs rather than decorative gradients doing the work. Localized image shading improves contrast; no parallax or heavy graphics runtime.

## Interaction and verification

All samples link to existing trip setup/sample workspace. Atlas/Roam feature buttons update copy, image and small travel preview. Roam tracks selected possibilities in component state only. Tide changes landscapes and sample-day content; its change application is explicitly illustrative. No supplier data, bookings or server saves are fabricated.

Subtle animation accompanies a changed preview or selected landscape. No scrolling hijack, timers, motion library or repeated section entrances. Reduced-motion rules suppress transitions. Native buttons, pressed states, live preview announcements and visible focus styles support access.

Reviewed all three at desktop and 390px mobile. Verified feature switching, postcard selection, landscape changes, example acceptance, loaded photography and no document horizontal overflow. Browser console reported no errors during checks. Production build and TypeScript passed before the small semantic/copy/contrast fixes; final typecheck run afterward. React review checked stable keys, simple derived data, functional state updates, no effect-driven state, and native interaction semantics.

Coast photo source: https://images.unsplash.com/photo-1507525428034-b723cf961d3e . Other sources recorded in landing-design-sample.md. All are local preview assets; release licensing review remains relevant.

Screenshots: references/design-options/atlas.png, tide.png, roam-features.png.
