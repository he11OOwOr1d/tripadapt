# Repository structure and module boundaries

The tables below preserve the 9 November 2026 scaffold baseline. Their “planned”/“not connected” statuses are historical. The 11 November module update at the end and [current status](../development/status.md) supersede them.

## Frontend — `apps/web`

| Path | Responsibility | Current state |
| --- | --- | --- |
| `app/page.tsx` | Product entry | Serves the approved Fieldtrip landing |
| `app/design/fieldtrip/` | Landing, code-drawn meadow, shared sample experience | Approved landing; locked |
| `app/trips/TripCreation.tsx` | Personal creation sections and review | Working Unfolding journey |
| `app/trips/TripWorkbench.tsx` | Shared trip state, browser saves and activity workspace | Working local draft UI |
| `app/trips/{creation,unfolding,workspace}.css` | Scoped application styling | Responsive; landing unaffected |
| `lib/trips/adapter.ts` | UI view model and replaceable persistence port | Explicit mock adapter; isolated sample slot |
| `lib/trips/planning.ts` | Pure outline calculations and allowance totals | Provisional frontend logic, not server feasibility |
| `app/system/`, `lib/api.ts` | Browser/API diagnostic boundary | See implemented files; not the trip persistence integration |
| `app/design/planner-studies/` | Six planner concepts | Historical exploration; Unfolding selected |
| Other `app/design/*` | Earlier visual investigations | Preserve as history; not approved current UI |
| `tests/` | Focused frontend logic coverage | Node test runner |
| `public/fonts/` | Local font files and their licenses | Archivo/Barlow used in the approved direction |

Do not use a frontend `Trip` object as a server request schema. A real adapter must map to generated OpenAPI types and typed commands, preserving ownership, logical identifiers, conditional writes and idempotency. An unspecified UI duration uses an internal sentinel; it must become the appropriate API open-ended representation, not `desired_days: 0`.

## Backend — `services/backend`

| Module | Responsibility | Current state |
| --- | --- | --- |
| `app/main.py`, `app/config.py` | Lifespan, health/readiness, configuration and CORS | Foundation implemented |
| `app/api/identity.py` | Trusted identity → internal user mapping | Verification intentionally fails closed until provider selection |
| `app/api/trips.py`, `app/trips/schemas.py` | Owned create/list/reopen and conditional metadata writes | Foundation implemented |
| `app/persistence/` | SQLAlchemy models, PostgreSQL connections and integrity | Foundation implemented |
| `migrations/` | Explicit Alembic migration history | Implemented; never run implicitly on app startup |
| `app/planning/` | Deterministic schedule/cost constraints and dependency analysis | Planned module boundary |
| `app/agents/` | Bounded LangGraph planning orchestration | Planned; no running agent |
| `app/providers/` | Normalize live provider data, coverage and provenance | Planned; no live supplier integration |
| `app/discovery/` | Places, reviews and permitted external content | Planned module boundary |
| `app/jobs/` | Durable jobs, leases, retries and cancellation | Planned module boundary |
| `app/monitoring/` | Explicitly enabled periodic checks | Planned; not a background service |
| `app/notifications/` | In-app inbox and external-delivery adapter/outbox | Planned; external channel unselected |
| `tests/` | Database-backed contract/integrity checks | Requires migrated local test database |

These are modules of a modular monolith, not independently provisioned microservices. Future API and worker processes can share the same backend codebase. PostgreSQL is authoritative; graph checkpoints and UI state are not the trip history.

## Supporting structure

- `.github/workflows/ci.yml`: existing scaffold checks; inspect the actual workflow filename in `.github/workflows/` before editing. CI provisions PostgreSQL, installs locked dependencies and checks migrations/lint/tests/build.
- `scripts/local-db.sh`, `compose.yaml`: alternative local database runtimes; run one on the configured port.
- `docs/architecture/`: current concise rationale/module guides.
- `docs/deployments/`: deployment target, source provenance and verification.
- `docs/references/`, `design/`: supporting design history and asset provenance.
- Root `tripadapt-*.md`: approved behavioral/technical baselines.

Generated build output, dependencies, real environment files, local database clusters, deployment credentials and scratch exports are ignored. Keep future modules small and domain-owned; do not add another competing trip state or a generic snapshot server PUT.

## 11 November module update

| Module | Implemented responsibility |
| --- | --- |
| `app/trips/TripWorkbench.tsx` | Compose browser/account autosave, library, itinerary, chat, proposals and history |
| `app/trips/PlaceLookup.tsx`, `lib/trips/place-search.ts` | Explicit credential-free destination discovery and manual fallback |
| `app/trips/PlanHistory.tsx`, `lib/trips/revisions.ts` | Accepted-version listing and reviewed full-plan restore |
| `app/trips/TripChat.tsx`, `ProposalReview.tsx` | Conversation and explicit review of additions, moves, durations and removals |
| `app/api/identity.py` | Verified Supabase JWT identity and owner mapping |
| `app/api/{trips,proposals,revisions}.py` | Owned persistence, frozen review, acceptance and immutable restoration |
| `app/api/{planning_jobs,conversation}.py`, `app/jobs/worker.py` | Leased jobs, persistent messages, fencing/cancellation and atomic publication |
| `app/agents/` | Bounded Groq/LangGraph generation and typed conversational routing |
| `app/planning/` | Deterministic validation, scoped edits, recovery checks and explicit fixture generation |
| `app/api/destinations.py`, `app/providers/geocoding.py` | Bounded Open-Meteo/GeoNames location lookup; no live activity/price/weather adapter yet |

The frontend view model and typed API adapters remain separate. One Supabase-hosted PostgreSQL database backs identity/application responsibilities through their respective interfaces. History restores the complete supported PlanInput, not account credentials or supplier reservations. Current configuration and verification are linked in the feature guides; no table here implies production deployment.
