# Elsewhere landing refinement — connected product story

9 November 2026. Implement the accepted landing-first approach; preserve the approved hero renderer, framing and headline. Update only its explanation and entry actions.

## Plan and review

Palette: forest #365643, warm paper #f3ecd7, light paper #fff8e6, meadow #bdcf9b, earth #ad8463, cobalt #4163a0. Keep local Archivo for display and Barlow for interfaces. Use readable controls, not a dashboard pasted onto the scenery.

Layout: emotional hero → short product explanation with miniature trip pass → one large shared sample planner → change-of-weather demonstration → trip overview and concise questions → designed footer. Illustrations carry context where useful; no extra scene behind the route. The sample uses one state for destinations, duration, date, stay/transport allowances and revision acceptance.

```
[Approved hero / accurate supporting copy / personal-trip CTA]
[What Elsewhere does             | glimpse of a connected trip]
[Sample planner: places / time / stay & travel | live trip preview]
[Weather moment                 | proposed change / fixed transfer]
[Current trip pass              | open the same sample itinerary]
[Questions / footer]
```

The old landing page asked for similar choices in disconnected scenic sections. This revision groups them into a bounded product demonstration, with consistent derived data and clear sample/personal boundaries. Do not implement the entire onboarding form on the homepage. Reusable route, date and pass components should provide the starting visual language for the planner later. No booking, live-price or forecast claims. Do not redeploy without a deployment request.

## Implemented and reviewed

`page.tsx` now uses `LandingExperience.tsx` in place of the previous Journey section composition. The hero's Meadow renderer, framing and headline are unchanged; supporting copy, personal-trip CTA and direct sample-viewer action are updated. Personal-trip links point to the existing `/trips/new` entry without copying sample data. The redesigned guided planner remains a separate wireframe until its visual implementation is undertaken.

Reusable pieces live in `product/TripPieces.tsx`: RoutePreview, DatePreview and TripPass. A single typed sample state and `sampleSummary` calculation drive all three passes, the planner, costs, date allocation and itinerary dialog. Bed allowances multiply by two travelers; room allowances by one room. Shared transfers contribute one illustrative overnight; private transfers do not. The example return date follows the allocation. This is explicitly a demonstration rather than a fixed-date planning constraint for personal trips.

Tests in the desktop browser: added Shangarh, lengthened Jibhi, selected hostel beds and private transfers. Eight stay nights produced ₹16,900 and a 16 December finish from an 8 December start; accepting the two-entry studio alternative produced ₹17,800, with the same date/total in all passes and the itinerary. The 18:10 return transfer was preserved. Date text entry changed the shared departure/return allocation (11–17 December for the default five-stay-night/one-transfer-night example). Input and blur handlers accommodate native date-control editing.

Also verified: protect the final destination from removal; arrow-key tabs; modal Escape and focus return; hero sample action opens the same dialog directly; native question disclosure; no horizontally clipped controls at 1280×900; 1440×1000 visual review. Browser error log empty. Production build passed; final TypeScript check passed after date-input refinement. Reduced-motion styles and the shared canvas pause control remain in place.

Saved review artifacts in `docs/references/landing-v3/`: introduction.png, sample-planner.png, adaptation.png, sample-itinerary.png, hero.png and full-page.png. This revision is local only; the Vercel review site has not been redeployed.

## Presentation variety follow-up

Removed the repeated trip-pass presentation from the introduction and outcome. Introduction now uses three illustrated feature links to the relevant sample-planner tabs. Outcome uses a two-page travel journal: route/durations on one page, the current morning and preserved return transfer on the other. The detailed trip pass appears only inside the sample itinerary dialog. Verified one TripPass instance in the DOM, feature-link tab selection, accepted weather revision reflected in the journal, and opening/closing the full itinerary from the journal. Build passed. Saved `introduction-variety.png` and `journal.png`. Local-only revision; not redeployed.
