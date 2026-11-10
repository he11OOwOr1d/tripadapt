# Design decisions and rationale

This document preserves the 9 November baseline. For subsequent finalized decisions, implementation lessons and tradeoffs, see the [development journal](../development/journal.md) and [current status](../development/status.md).

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

## 10 November 2026 — Supabase identity, API-owned account drafts

Use the approved Little lookout form with Supabase’s Next.js framework SDK/SSR integration. Keep Python/FastAPI as the domain authority and use SQLAlchemy/psycopg against Supabase-hosted PostgreSQL. This preserves transactional edits, immutable snapshots and ownership checks without reimplementing passwords or exposing application tables through the browser Data API. Store structured planning preferences as typed JSONB metadata and actual activities as relational version-owned rows. Browser-local saves remain explicit; account saves use a separate adapter, owner-scoped create receipts and optimistic draft ETags. The landing stays locked. Email confirmation remains enabled; SMTP/rate-limit failures are surfaced, not bypassed. See `docs/authentication-and-account-saving.md` for the incomplete live email verification step.

## 10 November 2026 — Simplify planning and save automatically

Replace the manual-save toolbar with debounced device/account autosave and explicit sync status. Serialize writes and coalesce edits so newly returned draft ETags are used before the next write. Keep stale-version conflicts paused, preserve a local copy and provide recovery instead of overwriting another tab. Give time allocation and travel preferences different responsibilities: the former divides accommodation nights visually, the latter owns transport and its optional overnight timing. Move the library into a native dialog and secondary account actions into a compact menu. See `docs/planner-ux-refinement.md` for the design rationale and browser verification; this refinement is local and awaiting user review.

## 10 November 2026 — manual itinerary slice

The next implemented workflow step is a day-by-day manual workspace, documented in `docs/itinerary-workspace.md`. A quiet paper timeline carries the landing's color and type treatment while keeping route navigation separate from activity editing. Native dialogs provide focused editing with keyboard support. Overlap warnings permit an unfinished draft; invalid day assignments and midnight-crossing entries require correction. Explicit meals, breaks and free time share the existing user-activity record with a backward-compatible kind field. Real account autosave continues through the backend into the same Supabase PostgreSQL database. AI generation and verified schedules remain future integrations.

## 10 November 2026 — proposal foundation

Manual draft review now exercises the same frozen-candidate acceptance boundary planned for AI output. Accepted versions remain separate from the editable draft; acceptance checks both the draft edit sequence and accepted base under a trip-row lock. Unknown external information remains provisional and requires an explicit acknowledgment. Hard conflicts cannot be acknowledged away. This step introduces no model/provider dependency. See `docs/planning-foundation.md` for scope and remaining generation safeguards.

## 10 November 2026 — durable one-day planning rehearsal

A PostgreSQL-backed worker now processes an explicitly gated fixture planning mode. The queue captures the exact draft and selected day, uses leased claims with fenced publication, and persists progress/cancellation/result references. It reuses the proposal boundary and preserves all pre-existing activities. This validates durability and user review before introducing model behavior. LangGraph and provider integration are intentionally still pending; fixture results are labeled and require a separate acknowledgment. See `docs/durable-planning-jobs.md`.

## 10 November 2026 — Groq and LangGraph

The user chose Groq. The existing Python worker now runs LangGraph with read-only scoped day/catalog tools and a separate strict structured-output request. It permits one repair, enforces provider/tool/time limits, and reuses the durable proposal lifecycle. This first live-model slice uses sample activity evidence, clearly labeled in review, rather than fabricating provider-backed recommendations. Catalog IDs and derived item details are checked again at publication and acceptance. Node checkpoint persistence and live travel evidence remain pending. See `docs/groq-agent.md`.

## 10 November 2026 — trip conversation foundation

Conversation is an additional interface to the existing job/proposal boundary, not a separate agent with database authority. Persisted messages use exact saved-draft context; typed routing distinguishes factual answers, clarification, supported additions and unsupported edits. Read-only answers are assembled from saved records. Canonical quick choices avoid unnecessary intent-model calls, and rest requests narrow the generator to rest candidates. Stage-driven progress replaces arbitrary thinking-word animations. A paper conversation panel shares the itinerary's typography/colors; phones switch to a focused chat view. See `docs/trip-conversation.md` for verification and limits.
