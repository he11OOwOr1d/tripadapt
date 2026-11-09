# TripAdapt — Product Requirements Document

**Version:** 2.1 draft · **Date:** 1 November 2026 · **Release described:** V1

**Status:** For scope review. This is the second PRD draft for the first product release, not a second product release. TripAdapt is a working name.

## 1. Problem statement

Travelers assemble destinations, accommodation, transport, and activities across multiple sources. Turning those choices into a practical itinerary requires reconciling geography, time, budget, and preferences. Weather changes, delays, or changes in energy and interests can invalidate several connected parts of that itinerary.

The product brings available travel information and traveler content into one workspace, creates a flexible multi-destination plan, and proposes understandable changes while preserving important commitments.

**Product promise:** Plan a connected trip, understand what to expect, and adapt the plan when circumstances change.

## 2. Users and supported trip structure

Primary user: a traveler organizing a leisure trip for themselves or companions who share an itinerary. Collaborative editing is not required in V1.

- Support multiple destinations, repeated visits to a destination, and different accommodations within a destination.
- Support exact dates, a tentative date window, or a desired duration without exact dates.
- Allow adding, removing, and reordering destinations and changing stay lengths.
- Allow free days, unscheduled ideas, and partially planned trips.
- Do not impose the previous single-destination or seven-day restriction.
- Handle long trips incrementally by destination or day. Technical processing limits must not silently truncate a trip.
- Support destination timezones and overnight transfers.
- Represent companion count and room count explicitly for cost estimates.

A draft without dates supports research, route outlines, suggested durations, and indicative costs. Date-dependent offers and forecasts require sufficient date information. An open-ended trip can be saved, but full-trip cost and completion estimates remain incomplete until its scope is defined.

## 3. Goals and boundaries

### Goals

1. Connect research, stays, transport, and activities into one editable itinerary.
2. Use live APIs wherever feasible and disclose data coverage and freshness.
3. Support changes within a day and across later trip stages.
4. Preserve completed activities and locked commitments.
5. Explain trade-offs and conflicts before applying revisions.
6. Make the complete planning and replanning workflow reliable and usable at a small initial scale.

### Non-goals for V1

- In-app booking, payments, refunds, or cancellation execution.
- Automatically changing supplier reservations.
- Continuous background location tracking or autonomous itinerary changes.
- Native social-network publishing, comments, followers, and moderation.
- Collaborative editing, group voting, or expense settlement.
- Guaranteed global supplier coverage, real-time inventory for every mode, or globally optimal schedules.

External reviews and a destination discovery feed ARE included in V1. Native social-network features remain a proposed exclusion pending confirmation.

## 4. Feature scope and rationale

| Feature | Why it belongs in V1 | Required outcome |
|---|---|---|
| Flexible trip setup | Establishes real travel constraints without forcing premature decisions | Editable destinations, dates/duration, travelers, budget, interests, and pace |
| Destination research | Helps users choose suitable places | Search, inspect, filter, and shortlist attractions and restaurants |
| Reviews and discovery content | Helps users understand what to expect | Attributed ratings, available reviews, photos, and external travel content |
| Accommodation planning | Connects location and overnight cost to the schedule | Stays associated with destinations and relevant nights |
| Transport planning | Makes the itinerary geographically feasible | Local travel segments and intercity connections |
| Itinerary generation and editing | Combines planning inputs into a usable plan | Editable timeline with activities, transfers, stays, and free time |
| Adaptive replanning | Resolves the central problem | Validated alternatives for weather, delay, fatigue, and trip changes |
| Locks and booking references | Protects commitments | Explicit fixed items and visible reservation-change requirements |
| Budget summary | Makes trade-offs understandable | Itemized estimates with unknown costs and overruns visible |
| Save and revision history | Preserves planning work and user control | Reopen accepted plans and restore a previous version |
| Map view | Helps inspect a multi-destination route | Destination and activity markers synchronized with the selected itinerary |
| Data transparency | Prevents estimates being mistaken for facts | Source, retrieval time, and data status where relevant |

## 5. End-to-end user journey

1. Create a trip with destinations, exact or flexible dates, preferences, and a budget.
2. Research places using descriptions, photos, ratings, reviews, and travel content.
3. Save places to destination shortlists.
4. Select accommodation and transport options or enter existing arrangements.
5. Generate a connected itinerary, including transfer days and free time.
6. Edit the plan and lock fixed commitments.
7. Report a disruption or change trip preferences.
8. Review the proposed revision, conflicts, cost differences, and booking actions.
9. Accept or discard the proposal; save and revisit the accepted plan.

## 6. Functional requirements

### FR-01 — Trip setup and flexibility

Capture origin and optional return location, ordered destinations, date mode, traveler/room counts, budget and display currency, interests, preferred modes, pace, and optional daily hours. Let users edit these throughout planning.

**Acceptance:** A trip with more than seven days and multiple destinations can be created and saved. Reordering a destination identifies affected stays, transfers, and activities. Exact-date conflicts are shown. Undated trips can be saved without fabricated date-specific information. No unrequested four-traveler restriction applies.

### FR-02 — Destination research

Search API-backed places and display available description, categories, coordinates, opening hours, photos, ratings, source links, and cost information. Distinguish sourced facts from inferred attributes such as typical duration or indoor/outdoor suitability. Support filters and destination-specific shortlists.

**Acceptance:** A place can be saved and added to an itinerary. Missing fields remain unknown. Must-visit items that cannot fit appear in the unscheduled list with a reason. API coverage gaps do not prevent manual place entry.

### FR-03 — Reviews and discovery feed

Show provider-available ratings, review counts, review excerpts, author/date/source attribution, and links to the original source. Provide destination-specific cards containing places, photos, and permitted external articles or video embeds. Connect relevant cards to save-to-trip actions.

**Acceptance:** Label selected review samples accurately; do not imply a complete review history. Display required attribution. Unavailable embeds retain a source link. External content does not need a native posting system. AI review summaries are optional and must not infer consensus from a small sample or violate provider terms. Every summary must display: “AI-generated summary of available reviews. AI can make mistakes; check the original reviews before deciding.” Show the source links and number of reviews summarized. Keep the summary visually separate from original traveler reviews; never invent a review or rating. A disclaimer does not replace source checks or permission to process provider content.

**Candidate sources:** Google Places API (New) for ratings, review counts, photos, and up to five returned reviews per place; Tripadvisor Content API as a candidate additional source subject to access and terms. External articles/videos are discovery content, not traveler reviews. Prefer official APIs and permitted embeds/links. Confirm summarization rights before sending review text to an AI provider; otherwise show attributed originals or an authorized provider summary.

### FR-04 — Accommodation

Search supported accommodation providers using destination, dates, occupancy, and budget. Show available prices, currency, rate basis, location, amenities, and external links. Allow multiple stays and manually entered booked accommodation. Associate each stay with its own check-in/check-out dates and location.

**Acceptance:** Hotel changes update relevant route origins and costs. Display known taxes/fees and flag unknown inclusions. Missing inventory is not represented as sold out. Tentative dates do not yield falsely confirmed offers. Selecting an offer does not reserve it. Booked stays are treated as commitments and changes are flagged for user action.

### FR-05 — Local and intercity transport

Provide local route estimates and intercity connection options for integrated modes/providers. Include mode, origin/destination, departure/arrival where available, duration, price status, source, and retrieval time. Offer an optional “Add existing transport booking” form, including when API search cannot find it. This lets users include tickets purchased elsewhere, private transfers, or services missing from an integration, so the itinerary reserves their travel time. Collect mode, endpoints, departure/arrival times and timezones, and optional cost/reference. Mark these details as user-entered; they are not independently verified live status. Live search remains the primary discovery flow.

**Acceptance:** Transfers occupy time in the itinerary, including overnight travel and timezone changes. Configurable boarding/check-in buffers are visible assumptions. Differentiate a routing estimate, scheduled service, and purchasable offer. Unsupported coverage is explicit; it must not be presented as no available service.

### FR-06 — Itinerary generation

Generate a route-level overview followed by daily schedules. Include accommodation anchors, activities, meals/rest slots, local travel, intercity transfers, and free time. Generate long trips in sections while maintaining shared constraints across boundaries.

**Acceptance:** No overlaps in validated schedules. Known hours, visit durations, travel times, fixed commitments, and daily windows are checked. Requested items that do not fit remain visible. Uncertain hours or route durations produce a provisional status rather than a claim of full validation. Return partial progress if one destination's data fails.

### FR-07 — Editing and commitment control

Allow adding, deleting, moving, and resizing activities; changing stay lengths; reordering destinations; marking completion; and locking activity times, stays, or transfers. Store booking state separately from lock state. Include optional external confirmation references, without requiring document uploads.

**Acceptance:** Editing triggers validation and identifies dependent changes. Completed items are preserved during replanning. Conflicting manual edits can be saved as an explicitly conflicted draft. An item marked “Keep fixed” must not be moved, resized, replaced, or removed by automatic replanning unless the user explicitly changes that setting. For example, keep a 3 p.m. museum reservation at 3 p.m. and arrange flexible activities around it. Users can explicitly unlock or edit it. The lock protects itinerary details; it does not make an activity a confirmed booking. A planned item and a booked item are visibly distinct.

### FR-08 — Adaptive replanning

Triggers: unsuitable weather, running late, fatigue, user preference changes, changed destination order, and changed stay length. Users confirm current time/location for on-trip replanning; continuous tracking is not required.

Scopes: (a) remaining day, (b) trip from a selected point onward. Suggest a primary feasible revision and additional alternatives when useful. Prefer smaller changes where they satisfy the user's intent.

**Acceptance:** Preserve completed items and locks. Recheck affected routes and date-sensitive offers when available. Recalculate downstream stays, transfers, and estimated costs. Show moved/removed/added items and any reservation actions. If no plan can meet all fixed requirements, explain exactly which requirements conflict and offer explicit choices. For example: “Your museum entry is fixed at 3 p.m., but the earliest estimated arrival is 3:30 p.m. Choose another ticket time, remove the visit, or change the preceding plan.” Do not change the ticket time, exceed a strict budget, or invent a shorter journey without the user choosing the relevant change. Keep the current accepted plan unchanged until the user accepts a feasible revision. Apply changes only after acceptance.

Forecast-based suggestions can appear when a trip is opened or refreshed. Scheduled background monitoring is outside V1. Simulated disruption inputs may be used for internal testing and must be clearly labeled if exposed.

### FR-09 — Preview, acceptance, and history

Show the old and proposed plans, reasons, warnings, estimated cost differences, and affected bookings. Support accept, discard, and restoration of the previous accepted revision.

**Acceptance:** Discard leaves the accepted plan unchanged. Acceptance persists atomically. A proposal based on an older trip revision cannot overwrite newer edits without revalidation. Restoring a previous plan does not claim to restore supplier inventory or bookings.

### FR-10 — Budget

Aggregate accommodation, activities, local transport, and intercity transport. Allow estimated meal costs and a miscellaneous allowance. Record per-person, per-room, per-night, and per-group units. Keep paid/booked amounts separate from proposed spending.

**Acceptance:** No double counting of stays or transfer legs. Unknown amounts are visible. Removing a paid activity does not imply a refund. Display original currency and timestamped conversion when supported; otherwise report incomplete totals. Offer an explicit strict-budget setting; otherwise budget is a target with warnings.

### FR-11 — Persistence and access

Save trip inputs, stop order, shortlists, stays, transfers, activities, commitments, and revisions. Support reopening and deleting trips. Proposed default: account-based private trips. A sample trip is optional onboarding content.

**Acceptance:** Refresh preserves saved state. Private trips enforce ownership if accounts are implemented. Save failures are visible. External content is stored only as allowed by provider terms; durable provider identifiers can be separated from refreshable data.

### FR-12 — Map

Show route-level destinations and day-level activities/accommodation. Selecting a timeline item highlights its marker and vice versa. Draw actual routes only where supported; label illustrative connections distinctly.

**Proposed integration:** Google Maps JavaScript API for the interactive map, Routes API for supported travel routes/durations, and Places API for place details. Map display and route computation are separately metered. Request reviews/photos only when needed, restrict browser keys by website and API, protect server credentials, configure quotas and budget alerts, and avoid recomputing unchanged routes. Budget alerts notify; they do not automatically stop spending. Confirm account pricing eligibility and requested feature tiers before implementation.

**Acceptance:** Missing map data does not block timeline use. Users can inspect long trips by destination/day without loading every detail at once.

## 7. Live data requirements

Use live integrations as the primary factual source wherever feasible. Google Maps Platform is the proposed map/routes/places provider; final adoption depends on access, coverage, terms, and cost checks. Other providers remain unselected.

| Data | Refresh trigger | Required limitation handling |
|---|---|---|
| Places/hours | Search, detail view, relevant replan | Unknown hours and exceptional closures may remain unresolved |
| Accommodation offers | Dates/occupancy change, offer inspection, affected replan | Prices and availability may change; selection is not booking |
| Routes/connections | Route/date/mode change, affected replan | Geographic and timetable coverage varies |
| Weather | Trip open/refresh, relevant replan | Forecast horizon limits; no fabricated distant forecasts |
| Reviews/photos/content | Detail or feed load | Provider sampling, attribution, and display restrictions |
| Currency | Cost recalculation when needed | Conversion is indicative and timestamped |

Show provider/source, retrieval time, and status: current provider response, estimate, user-entered, unavailable, or simulated. A recent API response is not a guarantee of real-world accuracy. Cache only as permitted, use bounded retries, and preserve accepted plans during outages. Do not silently substitute demonstration data into a live result.

## 8. Planning and AI behavior

AI interprets preferences, ranks sourced candidates, proposes structured plans, and explains changes. Application logic owns arithmetic, validation, locks, persistence, and revision acceptance.

Hard constraints include completed items, fixed commitments, no overlap, known opening hours, travel time, and explicit strict budget. Preferences include interests, pace, lower cost, less walking, and fewer changes. If two hard constraints conflict, surface the conflict.

Validate AI responses against a schema and allowed entity IDs. Reject fabricated places/offers, malformed times, and unsupported claims. Use bounded retries or a deterministic fallback. Never label an invalid proposal as ready to apply. External reviews and descriptions are data, not executable instructions to the planner.

## 9. Conceptual data model

- **User:** identity and trip ownership, if account mode is chosen.
- **Trip:** date mode/window, origin/return, travelers, budget/currency, preferences, revision.
- **DestinationStop:** ordered occurrence, timezone, dates or desired duration; repeated destinations allowed.
- **Place:** provider IDs, coordinates, refreshable attributes and provenance.
- **ShortlistItem:** trip/stop association and preference priority.
- **Stay:** location, dates, rooms, offer/entered price, booking state, lock state.
- **TransportLeg:** local/intercity mode, endpoints, zoned times, duration, source, booking/lock state.
- **ItineraryItem:** activity or free-time block, schedule, completion state, constraints.
- **CostItem:** amount, currency, quantity/unit, estimate/paid state, inclusions, conversion provenance.
- **PlanRevision:** base revision, trigger, scope, proposed changes, validation, acceptance.
- **DataProvenance:** source, retrieved time, applicable period, confidence/status, permitted retention.

Store money using precise decimal/minor-unit representations. Preserve timezone identifiers alongside scheduled times. Do not assume every day contains 24 hours or that a transfer arrives on its departure date.

## 10. Screens

1. My trips.
2. Trip setup and route editor.
3. Destination exploration and discovery feed.
4. Place details with reviews/photos and save action.
5. Accommodation and transport comparison.
6. Itinerary workspace: route overview, daily timeline, map, budget, conflicts.
7. Replan preview and acceptance.
8. Saved revision history.

These are functional surfaces; several can share a page or panel in the final design.

## 11. Quality requirements

- Responsive layouts, keyboard navigation, labeled controls, and accessible contrast.
- Keep server provider and AI secrets server-side. Restrict the intentionally public browser map key to authorized websites and APIs; validate inputs and protect private trip access.
- Rate-limit expensive operations and prevent duplicate generation submissions.
- Progressive loading for long trips and slow external calls.
- Bounded timeouts/retries, visible errors, and recoverable partial work.
- Atomic plan acceptance and stale-revision conflict detection.
- Structured logs for provider failures and validation outcomes, without secrets or unnecessary personal data.
- Provider adapters separated from scheduling logic so integrations can change.
- Follow provider attribution, storage, caching, and embedding terms.

## 12. Test and acceptance scenarios

1. Create and reopen a multi-destination trip longer than seven days.
2. Save an undated trip, then assign dates and refresh affected offers.
3. Revisit the same city as a distinct stop.
4. Change destination order and inspect dependent changes.
5. Handle multiple stays within one destination.
6. Schedule overnight and cross-timezone transfers correctly.
7. Discover a place through reviews/content and add it to the plan.
8. Replan for rain while preserving a reachable locked activity.
9. Report an unreachable fixed commitment after a delay.
10. Extend a stay and preview downstream hotel/transport impacts.
11. Apply fatigue preferences and reduce activity load.
12. Verify costs for rooms, nights, travelers, paid items, and unknown prices.
13. Handle weather outside the forecast horizon and missing provider coverage.
14. Reject malformed AI responses and fabricated entity IDs.
15. Discard, accept, and restore revisions; reject stale proposals.
16. Keep the current plan intact during provider or save failure.
17. Verify private-trip access boundaries if accounts are enabled.

Use unit tests for time/cost/constraint logic, integration tests for provider normalization and persistence, and end-to-end tests for creation and replanning. Seeded provider fixtures make core checks reproducible; separately verify live integrations.

## 13. Implementation sequence

1. Confirm scope and validate candidate API access, coverage, and cost.
2. Build trip/stop data structures, persistence, and route editing.
3. Integrate places, reviews/content, stays, and transport progressively.
4. Build the itinerary timeline, map, budget, and deterministic validator.
5. Add AI-assisted generation and structured output handling.
6. Add local and downstream replanning, previews, and history.
7. Complete responsive UX, failure handling, tests, deployment, and documentation.

These are implementation milestones within the same V1 scope, not proposals to remove multi-destination or flexible-date support.

## 14. Definition of done

- All confirmed V1 requirements have passing acceptance checks.
- The deployed application supports research → planning → disruption → accepted revision.
- Multi-destination and long-trip behavior passes acceptance checks.
- Live integrations work for the documented supported coverage.
- Simulated and estimated information is clearly labeled.
- Reviews/discovery content includes working attribution and save-to-trip behavior.
- An infeasible replan is explained correctly.
- The README documents architecture, setup, providers, limits, and design decisions.
- Setup and operating instructions are available; a recorded walkthrough is optional.

## 15. Decisions to confirm before implementation

| Decision | Proposed position | Status |
|---|---|---|
| Multiple destinations and flexible duration | Required; no arbitrary seven-day limit | Explicit user requirement |
| Live API use | Default wherever feasible; disclose limitations | Explicit user requirement |
| Reviews and travel content | Included in discovery | User intent interpreted as inclusion |
| Social feed meaning | External discovery content; no native posting/following | Confirm |
| Initial geographic coverage | Geography-flexible data model; test initial providers against India-focused trips unless another region is preferred | Confirm; not a geography restriction |
| Transport depth | Local routing plus intercity options where providers support them; manual booked legs for gaps | Confirm coverage expectations |
| Accounts | Private saved trips with sign-in | Confirm |
| Background monitoring | Refresh-time suggestions and user-triggered replanning in V1 | Confirm |
| API spending | Set a development and operating monthly ceiling before provider selection | Amount needed |
| Technology stack | Decide after scope/API access check | Open |
| Working product name | TripAdapt | Provisional |

## 16. Reference notes

These references informed the earlier discussion; provider access and current details must be checked during integration selection:

- Google Places data fields: https://developers.google.com/maps/documentation/places/web-service/reference/rest/v1/places
- Google transit routing and schedule limits: https://developers.google.com/maps/documentation/routes/transit-route
- Open-Meteo forecast documentation: https://open-meteo.com/en/docs

This PRD specifies behavior and data-quality requirements rather than promising unverified supplier integrations.

## Revision notes — 2.1

Removed the Purpose section and portfolio-specific deliverables. Added mandatory AI-summary disclosure and candidate review sources. Explained optional existing-booking entry, “Keep fixed” controls, and conflict handling. Proposed Google Maps Platform with cost controls; provider choice remains subject to confirmation.
