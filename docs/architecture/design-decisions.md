# Design decisions and rationale

9 November 2026. Current decisions for Elsewhere (repository: TripAdapt). “Approved” describes product/design direction, not a claim that the feature or vendor is operational.

| Decision | Status | Why / consequence |
| --- | --- | --- |
| Elsewhere for the product; TripAdapt for the repository | Current naming | Preserves the expressive public identity and established engineering/specification names. |
| Preserve the approved Fieldtrip landing | Approved and locked | Its code-drawn mountain meadow, beige/green treatment, postcard introduction and compact Alpine sample planner were selected. Avoid restarting visual exploration whenever another screen is built. |
| Keep landing demonstration and personal-trip state separate | Required | A traveler must knowingly create their own trip. The landing illustrates connected planning; it must not silently choose destinations, dates or spending for them. |
| Unfolding for actual trip creation | User-selected | One expanded decision reduces initial load; collapsed sections retain visible answers. Better suited to a growing multi-destination form and phone screens than a large all-at-once form. |
| Six real sections: beginning, dates, places, time, stay/transport, review | Current implementation | Origin/people and dates need separate short sections. Route and time remain distinct decisions; the last section has a dedicated overview instead of another accordion body. |
| Summary beside the form on desktop; sticky disclosure on phone | Implemented | Users can inspect route, duration, travelers and incomplete costs without crowding every field. |
| Keep days open until the itinerary workspace | Current slice | A route outline is useful before activities exist. Do not fabricate an AI itinerary or block planning on unimplemented generation. |
| Ordered destination occurrences, including repeats; no seven-day cap | Approved requirement | Real trips revisit cities, finish elsewhere and may be long. Each visit needs its own identity; changes preserve its nights and associated activities. |
| Inclusive trip days, stay nights and overnight travel nights are distinct | Approved requirement | Prevents double-counting same-day travel or treating every transfer as an additional whole day. Scheduled timezone-aware arrivals still need backend validation. |
| Suggestions are proposals, never silently applied changes | Approved requirement | Users control consequential decisions. The current equal split is explicitly illustrative and requires acceptance. It is not a researched recommendation. |
| Room/bed and person/vehicle units; unknown costs remain unknown | Approved requirement | Occupancy and fare basis change group totals. A partial allowance must not look like a full quote, paid amount or reservation. |
| No in-app supplier booking/payment execution in V1 | Approved boundary | Selection and planning are separate from external reservations. Locks protect itinerary details; booked state is a separate fact. |
| Native controls, keyboard reorder, visible focus, reduced motion | Required | The journey must work without dragging, animation or a precision pointer. Scenery belongs to the invitation; planning prioritizes readability. |
| Next.js/React/TypeScript presentation; FastAPI domain API | Approved stack | Keeps interaction in the web client and authoritative ownership/validation/provider operations in one backend boundary. |
| Modular monolith with future separate API/worker processes | Approved architecture | Connected travel constraints benefit from one coherent model. Initial scale does not justify independently deployed microservices. |
| PostgreSQL, SQLAlchemy and explicit Alembic migrations | Selected foundation | Relational constraints support ownership, stop ordering and same-trip version integrity; migrations make changes reviewable and repeatable. |
| Version-owned normalized records; immutable accepted plans | Approved architecture | One coherent accepted snapshot supports review/history and atomic acceptance. Direct editing changes a draft, not the accepted trip. |
| Typed draft commands, ETags/edit sequences and idempotency | Approved API design | Prevents accidental overwrite, stale acceptance and duplicated expensive operations. A local snapshot save must not become an invented server PUT. |
| Deterministic arithmetic/validation; AI proposes and explains | Approved boundary | Money, time, locks and acceptance need predictable rules. AI must use sourced candidates and cannot invent offers or accept its own changes. |
| Provider adapters expose source, freshness, coverage and status | Approved requirement | Missing inventory, unknown hours and outages are meaningful information. Simulation must not masquerade as a live response. |
| Explicit mock adapter while live dependencies are incomplete | Current implementation | Keeps the UI useful and testable without faking private API access. Saves are local to this browser, not a private cloud account. |
| Verified identity mapping fails closed | Current backend foundation | Email text, arbitrary bearer tokens and browser-supplied verification flags must not establish ownership. Production identity-provider selection is still pending. |
| Vercel hosts the frontend review; backend/database remain separate | Current deployment | Publishing the planner does not provision authentication, PostgreSQL, workers or suppliers. |

## What remains open

Identity provider and final production auth transport, production API/database hosting, supplier selection and geographic coverage, review processing rights, API-spending ceilings, notification delivery channel and operational quotas. The approved architecture includes opt-in monitoring; it is not implemented or automatically enabled. LangGraph, LangSmith and Sentry are architectural selections/plans rather than proof of installed, running integrations in the current scaffold.

Next implementation priorities: verified identity → real adapter and draft command endpoints → places/stays/transport data with provenance → timezone-aware scheduling → generation/proposal review/atomic acceptance. Continue checking the complete browser-to-API-to-data flow as each dependency becomes real.

## Reading history correctly

The four root specifications are the product/technical baseline; the API design refines older architecture endpoint sketches. Later dated approval notes supersede exploratory wording. `docs/landing-direction-layouts.md`, `docs/mobile-responsive.md` and the Unfolding implementation note in `docs/trip-creation-journey.md` record the accepted UI progression. Older 3D/Stillwater/photo/ticket/postcard alternatives and the six planner studies preserve exploration, not additional approved directions.

No original reference image or old prototype should be treated as approved production art solely because it exists in the repository. The current landscape is drawn in frontend code. Local fonts retain their licenses; third-party asset provenance remains relevant before broader release.
