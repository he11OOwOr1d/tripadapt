# Elsewhere trip creation — 9 November 2026

Local implementation at `/trips/new`. No deployment performed. The locked Fieldtrip landing and its sample state were not edited.

## Authority and scope

Read the four root product/technical baselines, the visual-direction/storyboard/layout/mobile documents, `landing-and-planning-wireflow-v1.md`, `visual-wireframes-v1.md`, `application-workspace.md`, the connected Fieldtrip brief and approved-landing release notes. All requested files exist. The API and database documents explicitly record approval of the product/technical baseline on 3 November; older “draft” labels and older architecture endpoint sketches do not override that approval or the refined API contracts. The locked landing combination and later phone guidance supersede earlier 3D/Stillwater explorations and desktop-only notes. Planning wireframes remain UX proposals, not an independently approved visual system.

The implementation follows the proposed Basics → Places → Time → Stay & travel → Review sequence, then opens the existing itinerary editor with the same Trip state. Activities remain open until entered in that editor. It does not simulate account authentication or itinerary generation.

Visual tokens: paper #f3eddf, light paper #fffaf0, forest #294d3d, action green #2e5946, meadow paper #e4e9d3, keyboard focus #4264ae. Reuse local Archivo and Barlow. A numbered route links the form and summary; no repeated landscape artwork or animation. Desktop uses a sticky summary beside the form; phones have a sticky native disclosure. The design uses existing visual decisions deliberately rather than introducing a new style.

## Implemented behavior

- Empty personal route, independent of landing and Rajasthan demonstration data. `/trips/demo` uses its own browser-storage key and identifies itself as an editable sample.
- Origin, traveler and room counts, exact inclusive dates, flexible window plus optional desired days, or undated/unsized duration. Optional name, budget target, currency, pace and interests.
- Manual destination entry with region/country guidance and valid IANA timezone. Any number of stops, repeated visits with distinct UUIDs, keyboard reorder controls, confirmed cascade removal, return to origin or another finish.
- Direct stay-night allocation, including zero-night day visits. An explicit “Suggest a split” proposal distributes available nights (or a disclosed illustrative rule for unsized trips); acceptance is separate.
- Per-leg user-entered journey hours and overnight travel nights. Stays + overnight travel are compared against elapsed nights, with remaining time left open. Same-day hours do not automatically add whole days. Over-allocation blocks progression and offers editing dates/duration, shortening stays, or explicitly saving an unresolved browser draft.
- Stay style and room/bed rate basis per stop; transport preference and person/vehicle rate basis per leg. Blank rates remain unknown. Allowances multiply by rooms/beds, nights and travelers as appropriate. Calculations aggregate integer minor units. They are never presented as inventory, paid amounts, complete trip totals or bookings.
- Reordering retains stop durations, activities and stay preferences. Leg keys use ordered endpoint IDs; changed connections do not reuse old leg assumptions or allowances. Origin/finish changes similarly create different leg keys. A route-change notice asks for review. Returning to an unchanged connection restores its prior provisional inputs; no offer freshness claim is made.
- Final route/time/cost review with edit links and handoff into the existing activity workspace. Back/visited-step navigation retains Trip state. Previously unvisited steps remain disabled; final progression rechecks prerequisites and duration conflicts.
- Explicit mock-adapter save/open with visible success/failure, replacement confirmation, unsaved-page-exit warning and separate personal/sample slots. Loading replaces transient step/proposal state to avoid applying an old suggestion to a different draft. Data does not sync across devices; browser clearing removes it. Save is not account persistence or acceptance.
- Existing modal focus containment, Escape and focus restoration remain intact. Touch controls are at least 44px, inputs use 16px type, keyboard focus is visible, and scoped reduced-motion rules disable transitions/animation.

## Files and integration boundary

- `apps/web/app/trips/TripCreation.tsx`: guided form and summary.
- `apps/web/app/trips/creation.css`: scoped visual/responsive treatment, also harmonizing the existing workspace.
- `apps/web/app/trips/TripWorkbench.tsx`: owns the shared draft, persistence and existing itinerary editor.
- `apps/web/lib/trips/planning.ts`: pure browser-outline arithmetic, route-leg identity, allocation suggestions, conflicts and allowances.
- `apps/web/lib/trips/adapter.ts`: frontend view model and explicit mock persistence port; validates stored extensions and isolates sample saves.
- `apps/web/tests/trip-planning.test.mjs`: focused arithmetic/persistence coverage alongside existing trip tests.

These are frontend view models, not API payloads. `days: 0` is a UI sentinel for unspecified duration, never a valid API desired_days value; a future real adapter must map that case to open_ended and omit/null desired_days, according to generated schemas. No whole-snapshot server PUT or anonymous private-API access was invented. A real implementation must map location objects, exact/window dates, ordered stops, preferences, stays, transport and cost commands to the actual contract, preserving ownership, logical IDs, ETags and edit sequences.

## Backend readiness and remaining gaps

Reviewed backend README, identity dependency, health routes and trip schemas. The foundation has owned trip creation/reopening and conditional metadata writes. `verified_identity` intentionally returns 401 until an identity provider is selected. Draft commands, planning/acceptance, discovery, supplier integrations and browser sign-in are not complete. A request to `http://localhost:8000/api/v1/health/live` could not connect. This UI therefore deliberately uses `mockTripAdapter` / `mockSampleAdapter`, with no backend or provider calls.

Still required for live use: destination search/geocoding; provider occupancy rules; multiple actual accommodations per stop; manual existing-booking records; scheduled departure/arrival instants with timezone and boarding buffers; date-specific connection feasibility; forecast/availability provenance; full budget categories; account persistence and accepted revision workflows. The per-leg hours/night fields are provisional planning assumptions, not a timezone-aware transport scheduler. Suggested nights are illustrative arithmetic, not researched or AI recommendations. No geographic map/route computation is claimed. There was no screen-reader audit.

## Verification

- `npm --prefix apps/web run build`: passed; TypeScript and all 43 static routes built.
- `npm --prefix apps/web run typecheck`: passed during implementation; final build also ran TypeScript.
- `node --experimental-strip-types --test apps/web/tests/trip-draft.test.mjs apps/web/tests/trip-planning.test.mjs`: 12 passed. Covers existing activity conflicts, date/window capacity, long/repeated stops, zero-night visits, explicit split acceptance, active-leg invalidation, cost bases and decimal totals, adapter isolation, malformed storage, and storage failures.
- Chrome visual/interaction review at 1440×1000, 390×844 and 320×780. No horizontal page overflow at those widths. Initial IAB inspection also checked existing new/demo routes and the approved live landing.
- Empty route progression blocked; manual repeated destinations remained distinct; up/down controls worked. Exact 1–8 December produced 8 inclusive days and 7 nights. Nine stay nights + one travel night blocked progression; the accepted split produced six stay nights + one travel night.
- Undated 20-day test route: Jibhi 9 nights + Sainj 8 nights + one overnight transfer, one night open. Three travelers: 9 room-nights × INR 1,800 + 24 bed-nights × INR 700 + 3 bus allowances × INR 1,200 = INR 36,600, with two other legs and other expense categories explicitly unknown. Workspace received the same draft; save/reload/open restored it.
- On phone, reordered Sainj before Jibhi: 8/9 stay nights and stay rates followed their stop IDs; the old inbound bus/overnight assumption was excluded, producing INR 33,000 and three unknown legs. Final flexible-window entry 1–31 December retained 20 desired days and the route. Native date fill worked after adding input/blur handling, consistent with the landing's existing date-control approach.
- Opened/closed phone summary; keyboard Tab remained inside removal dialog and wrapped; Escape retained the destination and closed the dialog.
- Browser logs contained a hydration attribute warning for `cz-shortcut-listen` injected on `<body>` by a browser extension. No planner exception was observed; the warning was not suppressed in app code. Node tests print an existing module-type inference warning and pass.

Captures in `docs/references/trip-creation/`: desktop review (full and viewport), desktop workspace, phone basics, time, review and summary. Captures document successive test states; the final viewport/phone review use the reordered flexible-window route.

## Approved Unfolding implementation — 9 November 2026

The user selected the Unfolding study for the working journey and authorized refinements. `/trips/new` now uses it; the study collection remains available and the locked landing is unchanged.

The real form uses six sections: A beginning → When you go → Places to follow → Room for each place → Stay & travel → All together. Dates are separated from origin/travelers to keep the opening short. Previous/populated sections display actual current answers and reopen without resetting input. The active section can collapse and reopen with pointer or keyboard. New empty trips begin with only the first section available; explicitly reopened populated browser drafts expose their sections directly. This access does not declare the draft feasible or accepted.

The final review has its own light-paper view rather than another accordion body. Edit links return to the corresponding section, and Return to review rechecks prerequisites and time conflicts. A quiet route/cost summary stays beside the unfolding sections on desktop and in a sticky disclosure on phones. Scoped `unfolding.css` adapts the approved broad green/paper planes to the existing form. No sample trip/state, new provider, auth flow or API write was added. Persistence and calculations continue through the existing mock adapter and pure planning utilities.

Browser verification: 1440×1000, 390×844 and 320×780. Empty route blocked; 1–13 December produced 13 inclusive days/12 nights; 10 + 6 stay nights and one travel night correctly conflicted. Accepting the split produced 6 + 5 stay nights while preserving one travel night. Three travelers with 6 room-nights × INR 2,000, 15 bed-nights × INR 800 and 3 inbound allowances × INR 1,500 produced INR 28,500. Changing to four travelers through a reopened section recalculated to INR 34,000; returning to review preserved all details. Reordering Osaka ahead of Kyoto preserved 5/6 stay nights and their stay allowances, excluded the obsolete inbound transport/night assumption and produced INR 28,000 with three transport allowances unknown. Explicit save/reload/open recovered that state, and the workspace received the same name/route. Populated section access after reopening was verified. Native mobile summary and Enter-based section collapse/expand worked. No horizontal page overflow was observed at either phone width.

Production build (50 routes including the separate study routes), TypeScript and all 12 existing/focused draft tests passed. The Chrome environment still reports the previously documented extension-injected body-attribute hydration warning; it was not suppressed. No live API claim or deployment was made.

Current captures: `docs/references/unfolding-journey/desktop-beginning.jpg`, `desktop-folded.jpg`, `desktop-route.jpg`, `desktop-review.jpg`, `phone-beginning.jpg`, `phone-folded.jpg`, `phone-route.jpg` and `phone-review.jpg`. They document successive verification states.
