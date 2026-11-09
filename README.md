# TripAdapt · Elsewhere

**An adaptive travel planner for places, stays and journeys that belong together.**

TripAdapt is the repository and engineering name. **Elsewhere** is the product name. Travelers can build an ordered, multi-destination trip, allocate stay and travel time, keep costs visible, and eventually review proposed changes when circumstances change.

[Live UI review](https://elsewhere-ui-review.vercel.app) · [Trip planner](https://elsewhere-ui-review.vercel.app/trips/new) · [Design decisions](docs/architecture/design-decisions.md) · [Repository structure](docs/architecture/repository-structure.md)

> **Current stage — 9 November 2026:** working frontend journey and backend persistence foundation. The public review deployment is a frontend prototype. Its trip saves are browser-local; authentication, live travel providers, itinerary generation and accepted-plan revisions are not connected. Selecting stay or transport preferences makes no reservation.

## What works now

- Approved, code-drawn mountain-meadow landing with interactive, clearly labeled sample planning and weather examples.
- Personal trip creation in the approved **Unfolding** design: beginning → date flexibility → destinations → time allocation → stay/transport preferences → complete review.
- Multiple destinations and repeated visits, keyboard reordering, manual timezone entry, zero-night visits and trips longer than seven days.
- Separate stay nights, overnight travel nights and inclusive trip days; visible duration conflicts and an explicitly accepted illustrative allocation suggestion.
- Room/bed and person/vehicle allowance bases, group/per-traveler subtotals and visible unknown expenses. No invented live offers.
- Existing itinerary workspace with editable activities, local overlap checks and separate fixed/completed/booking states.
- Explicit browser-local draft save/reopen, error feedback and isolation between personal and demonstration storage.
- Responsive layouts, visible keyboard focus, native controls and reduced-motion support.

The FastAPI backend separately implements health/readiness checks, owned trip creation/listing/reopening and conditional metadata updates. Its authentication dependency deliberately returns 401 until a verified identity-provider adapter is implemented. The planner uses the explicit mock adapter rather than pretending those protected endpoints are connected.

## Quick start: frontend

Requirements: **Node.js 22.6+** and npm (also supports the TypeScript-stripping test command below).

```sh
cd apps/web
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000). The frontend planning journey needs no provider credentials or running backend.

| Route | Purpose |
| --- | --- |
| `/` or `/design/fieldtrip` | Approved, locked Elsewhere landing |
| `/trips/new` | Empty personal trip journey; no landing-sample import |
| `/trips/demo` | Separate, editable Rajasthan demonstration |
| `/design/planner-studies` | Six historical planner explorations; Unfolding was selected |
| `/system` | Local API/database connection diagnostic |

Other `/design/*` routes preserve earlier explorations. Their presence does not mean they are current product decisions.

## Frontend checks

From the repository root:

```sh
npm --prefix apps/web run typecheck
npm --prefix apps/web run build
node --experimental-strip-types --test apps/web/tests/trip-draft.test.mjs apps/web/tests/trip-planning.test.mjs
```

The current focused suite has 12 tests covering activity conflicts, dates, route allocation, cost bases, decimal totals, persistence isolation and storage failures. Browser reviews cover desktop and 390px/320px phone layouts. [Journey implementation and verification](docs/trip-creation-journey.md).

## Full-stack local development

Additional requirements: **Python 3.12+**, **uv**, and **PostgreSQL 17** (Docker Compose or the local macOS helper).

```sh
make setup
# Choose one database runtime:
make db                    # Docker Compose
# OR: make db-local        # macOS, Homebrew PostgreSQL 17
make migrate
```

Run in separate terminals:

```sh
make api                   # http://127.0.0.1:8000
make web                   # http://127.0.0.1:3000
```

- `GET /api/v1/health/live`: API process liveness.
- `GET /api/v1/health/ready`: migrated PostgreSQL readiness; fails honestly when unavailable.
- [Local API documentation](http://127.0.0.1:8000/docs).
- With the database running, use `make check` for backend lint/tests and frontend checks. CI provisions a fresh database, applies migrations and checks schema drift.

Local development defaults are configured. For overrides, copy the appropriate `.env.example` into `services/backend/.env` or `apps/web/.env.local`. Never commit real environment files, API keys or booking references. The example database credentials are for local development only. See [backend setup/readiness](services/backend/README.md).

## Repository scaffold

```text
apps/web/                  Next.js / React / TypeScript frontend
  app/design/fieldtrip/    Approved landing and original code-drawn scenery
  app/trips/              Unfolding creation UI and itinerary workspace
  lib/trips/              Frontend view model, mock adapter and calculations
  tests/                  Focused browser-draft logic tests
  public/                 Local fonts, artwork and historical exploration assets
services/backend/         FastAPI modular-monolith foundation
  app/                    API, persistence and domain module boundaries
  migrations/             Alembic schema history
  tests/                  Health, ownership, schema and persistence tests
  openapi.json            Generated implemented API contract
  uv.lock                 Locked Python dependency resolution
docs/                     Current decisions, implementation notes and design history
  architecture/           Decision log and repository/module guide
  deployments/            Release provenance and verification notes
  references/             Design references and browser captures
scripts/                  Local infrastructure helpers
.github/workflows/        Scaffold CI checks
compose.yaml              Local PostgreSQL runtime
Makefile                  Shared development/check commands
tripadapt-*.md            Approved product and technical design baselines
```

[Detailed module status and intended boundaries](docs/architecture/repository-structure.md). Some backend directories are deliberate placeholders; a folder does not imply a running service or completed feature.

## Architecture and design decisions

The web app owns presentation and draft interaction; FastAPI owns the future authoritative domain operations. PostgreSQL stores normalized version-owned records. Accepted versions are immutable; changes must be reviewed as proposals. Deterministic logic owns arithmetic and constraints; AI will rank sourced candidates and propose changes, not silently accept them.

The approved landing combines an animated code-drawn meadow, beige paper and green typography, a postcard introduction and compact sample planner. The selected application direction is **Unfolding**, with readable expanding sections and a dedicated review. It preserves the landing’s brand while giving real planning tasks space to work.

Read the [decision log and rationale](docs/architecture/design-decisions.md) for what is settled, why it was chosen, and what remains open.

## Specifications and source of truth

- [Product requirements](tripadapt-prd.md)
- [System architecture](tripadapt-system-architecture-v1.md)
- [Database design](tripadapt-database-design-v1.md)
- [API design baseline](tripadapt-api-design-v1.md)
- [Current visual direction and chronology](docs/visual-direction.md)
- [Approved landing combination](docs/landing-direction-layouts.md)
- [Current trip journey](docs/trip-creation-journey.md)

The approved API design refines older architecture endpoint sketches. The generated OpenAPI snapshot describes what is actually implemented. Historical documents and design studies are context, not automatic approval to change the locked landing.

## Deployment and remaining work

[Latest release and verification record](docs/deployments/unfolding-planner.md).

The web review is hosted on Vercel at [elsewhere-ui-review.vercel.app](https://elsewhere-ui-review.vercel.app). The FastAPI/PostgreSQL backend is not part of that frontend deployment. For a Git-based Vercel import, select **Next.js** and root directory **`apps/web`**; use the committed npm lockfile. Backend hosting and production identity/database provisioning remain separate decisions. Do not add secret-bearing CI deployment workflows merely to publish the frontend.

Next integration work: verified authentication, real trip adapter and draft command mapping, provider-backed place search, dated stay/transport information with provenance, timezone-aware scheduled transfers, activity generation and atomic proposal acceptance/history. Keep manual/provisional paths and unknown data visible throughout.

No open-source license is selected for the application yet. Local font licenses and asset provenance remain with their respective files; repository publication does not grant new rights to third-party assets.
