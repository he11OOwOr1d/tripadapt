# Fresh landing sample

7 November 2026. New visual proposal following the user's reset of the 3D work. Not a revival of the previous character/storyboard direction.

## Design plan

- Palette: mist white #FAFBF9, alpine ink #203735, moss-gray #65726C, pale sage #EDF1EB, citron #E2EDC8.
- Type: Manrope, medium large display with compact tracking; restrained body weights. System sans-serif fallback. One family throughout.
- Composition: generous left-aligned headline opposite concise copy; expansive mountain image with one itinerary slip. Unequal photographic discovery columns; a functional change preview; quiet route overview and closing invitation.

```text
brand                  navigation          plan
large headline                       introduction
[             expansive landscape              ]
[                               itinerary slip ]
planning essentials
large discovery image          smaller image
replanning explanation         interactive afternoon
connected journey and clear final action
```

## Brief review

Avoided the earlier cream/serif/berry system, 3D complexity, repeated feature cards, statistics, and invented testimonials. The boldness is concentrated in scale and landscape photography. Source landscape colors supply visual interest. Subject-specific substance comes from multi-destination journeys, preserved dinner commitments, free time, and estimated replanning costs.

## Implementation and scope

Route /design; also rendered at /. Existing application routes and backend are unchanged. Prior home source saved at work/home-before-design.tsx. All styling is scoped to .escape and e-* classes. Existing global CSS still serves other application screens.

Sample interactions: save/unsave inspiration within the current visit; select original/rain/slower itinerary; apply illustrative revision. These are explicitly examples, not server persistence, live provider calls, or actual reservations. Planning links go to existing /trips/new and /trips/demo routes.

Photography: downloaded Unsplash source images, served locally to avoid preview dependency on remote image delivery. Original URLs:
- https://images.unsplash.com/photo-1464822759023-fed622ff2c3b
- https://images.unsplash.com/photo-1519681393784-d120267933ba
- https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1

Review asset licensing and attribution requirements before public release. Current work is a local design sample, not a published Site.

## Verification

Visually reviewed at desktop 1440px and mobile 390px. All three images loaded. Verified save/unsave state, itinerary mode switching, and apply confirmation. No browser console errors observed. Reduced-motion CSS disables entrance effects; keyboard focus styles and native controls are provided. Build/type checking performed separately. Screenshot: references/landing-sample/desktop.png.
