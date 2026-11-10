# TripAdapt · Elsewhere

Development history: [section-by-section journal](docs/development/journal.md), [commit map](docs/development/commits.md), and [current status and integration gaps](docs/development/status.md). Earlier explorations are preserved and distinguished from finalized decisions.

**An adaptive travel planner for places, stays and journeys that belong together.**

TripAdapt is the repository and engineering name. **Elsewhere** is the product name. Travelers can build an ordered, multi-destination trip, allocate stay and travel time, keep costs visible, and eventually review proposed changes when circumstances change.

[Live UI review](https://elsewhere-ui-review.vercel.app) · [Trip planner](https://elsewhere-ui-review.vercel.app/trips/new) · [Design decisions](docs/architecture/design-decisions.md) · [Repository structure](docs/architecture/repository-structure.md)

> **Current stage — 10 November 2026:** approved landing, Unfolding creation and Little lookout authentication. Local development includes Supabase account saving, an editable itinerary, reviewed proposals, durable Groq planning and conversational assistance. The public deployment remains the earlier prototype. Live travel providers and production API/worker hosting remain integration gaps. Selecting preferences makes no reservation. See [current status](docs/development/status.md).

## What works now

- Approved, code-drawn mountain-meadow landing with interactive, clearly labeled sample planning and weather examples.
- Personal trip creation in the approved **Unfolding** design: beginning → date flexibility → destinations → time allocation → stay/transport preferences → complete review.
- Multiple destinations and repeated visits, keyboard reordering, manual timezone entry, zero-night visits and trips longer than seven days.
- Separate stay nights, overnight travel nights and inclusive trip days; visible duration conflicts and an explicitly accepted illustrative allocation suggestion.
- Room/bed and person/vehicle allowance bases, group/per-traveler subtotals and visible unknown expenses. No invented live offers.
- Existing itinerary workspace with editable activities, local overlap checks and separate fixed/completed/booking states.
- Explicit browser-local draft save/reopen, error feedback and isolation between personal and demonstration storage.
- Responsive layouts, visible keyboard focus, native controls and reduced-motion support.

The FastAPI backend implements health/readiness, verified Supabase bearer identity, owned trip creation/listing/reopening, optimistic draft edits and conditional metadata updates. The local planner offers explicit browser saving and a separate account adapter. See [account setup and verification](docs/authentication-and-account-saving.md); a successful real-inbox end-to-end check is still pending email delivery.

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
  lib/trips/              Frontend view model, browser/account adapters and calculations
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

The web app owns presentation and draft interaction; FastAPI owns authorized trip persistence, proposal acceptance and planning jobs. PostgreSQL stores normalized version-owned records. Accepted versions are immutable; changes must be reviewed as proposals. Deterministic logic owns arithmetic and constraints; The one-day Groq/LangGraph agent proposes additions using explicitly labeled sample evidence; live provider-backed recommendations remain pending. AI cannot accept its own changes.

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

The web review is hosted on Vercel at [elsewhere-ui-review.vercel.app](https://elsewhere-ui-review.vercel.app). The FastAPI/PostgreSQL backend is not part of that frontend deployment. The existing Vercel project is connected to this GitHub repository: pushes to `main` create production deployments; other branches create previews. The framework is **Next.js**, root directory **`apps/web`**, using the committed npm lockfile. The approved landing requires no keys. The new local account flow needs Supabase public configuration and an API base URL; see [authentication setup](docs/authentication-and-account-saving.md). Backend hosting and production auth configuration remain separate deployment steps. Do not add secret-bearing CI deployment workflows merely to publish the frontend.

Next integration work: complete the user-led real-inbox auth/save check after SMTP is available, then provider-backed place search, dated stay/transport information with provenance, timezone-aware scheduled transfers, activity generation and atomic proposal acceptance/history. Keep manual/provisional paths and unknown data visible throughout.

No open-source license is selected for the application yet. Local font licenses and asset provenance remain with their respective files; repository publication does not grant new rights to third-party assets.

Supabase local development is now verified. See [backend Supabase setup](services/backend/README.md#supabase-development-database) for the encrypted connection and atomic migration/access-grant helper. The existing deployed frontend still uses the explicit mock adapter. Local development now includes a separate authenticated API adapter; see [authentication and account saving](docs/authentication-and-account-saving.md) for setup and verification history.

The Next.js Supabase framework SDK handles authentication; the Python API uses psycopg to connect to Supabase-hosted PostgreSQL. A local PostgreSQL server is optional. Use `make migrate-supabase` for the hosted database, then `make api` and `make web`.

### Groq one-day planning (local)

The local app now has **Plan this day with AI**, backed by a separate durable worker and Groq/LangGraph. It uses a sample activity catalog, not live places/weather/routes. User review and explicit acceptance remain required. See [Groq agent setup and verification](docs/groq-agent.md) for server-only key configuration, execution bounds, screenshots and remaining integrations. This does not imply the deployed preview has these local changes.

### Trip conversation (local)

**Chat with Elsewhere** now opens a persistent trip conversation beside the plan, or a focused chat view on phones. Ask about the saved itinerary, answer clarification choices, or request additions to the selected day. Changes still require proposal review and acceptance. Stage-driven progress supports reduced motion. See [conversation scope and verification](docs/trip-conversation.md); live travel evidence and broader conversational edits remain future work.
