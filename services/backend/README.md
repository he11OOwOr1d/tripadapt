# Backend foundation

FastAPI owns `/api/v1`; SQLAlchemy and Alembic own PostgreSQL persistence.
The four root design documents are the baseline; API design refines the older architecture endpoint sketches.
No backend-specific AGENTS.md is present.

Implemented slice:
- Trusted issuer/subject mapping to internal users; email text never links accounts.
- Atomic trip + initial editable version + normalized ordered stops creation.
- Owned trip listing with keyset pagination, metadata retrieval and ETag-protected updates.
- Reopening saved version settings and stops; retrieving the existing initial draft.
- Same-trip version foreign keys, pointer status checks and accepted snapshot write guards.
- Strict request/response schemas, problem responses, request correlation and explicit CORS.

`POST /trips` persists immediately. Reopen with `GET /trips/{id}`, then the
referenced `/versions/{version_id}` and `/versions/{version_id}/stops`.
Initial versions are unchecked drafts; saving does not accept a plan or imply feasibility.
Stops are fetched separately; the version overview's `stops` field defaults to an empty list.
Metadata PATCH requires the trip ETag in `If-Match`; it cannot edit plan settings.
The draft route returns the existing draft (200). Cloning accepted plans, draft
commands, submission/acceptance/history, deletion/purge, agents, monitoring and
travel integrations are subsequent slices; no placeholder success is returned for them.

## Decisions required before integrations

Authentication provider remains unselected. `verified_identity` intentionally fails
closed with 401, including arbitrary bearer tokens. There is no HTTP test-user
header or unsigned JWT mode. Integration tests override the dependency in-process
with synthetic trusted identities. Production browser sign-in is not yet available.

Before implementing a provider adapter, select the managed identity vendor,
bearer-token transport (the baseline), issuer, audience, allowed algorithms,
JWKS discovery/rotation and timeout policy, required email claims and
provider-compatible email normalization. The adapter must verify signature,
issuer, audience and expiry before constructing TrustedIdentity. If secured cookies
are selected instead, add CSRF protection. Profile synchronization, email changes,
linking, account deletion and signed webhooks need provider-specific policy.
The initial mapper deliberately does not update contact details on every request;
existing verified contact data cannot be overwritten with pending email claims.
One verified normalized email per account is enforced; collisions never merge users.

PostgreSQL is selected by the design. Local PostgreSQL 17 is the verification target.
A hosted vendor is not selected or provisioned. Before hosted integration choose
vendor/region, TLS requirements, direct migration versus pooled runtime URLs,
connection limits, backup/restore policy, migration role and retention. No hosted
credentials or RLS protection are assumed. Ownership is enforced by application queries.

## Run and verify

From `services/backend`, with PostgreSQL running:

```sh
uv sync --locked --group dev
uv run alembic upgrade head
uv run alembic check
uv run ruff check app migrations tests
uv run pytest
uv run uvicorn app.main:app --reload
```

Migrations run explicitly; startup never changes the schema. Foundation integration
tests use real PostgreSQL with an outer rolled-back transaction and savepoints;
health tests read the configured migrated database. Tests cover identity separation,
atomic creation, long and repeated stops, exact money, reopening, cross-owner and
cross-trip access, pagination, schema errors, ETag conflicts and immutable snapshots.
The generated API contract is `openapi.json`.

### Supabase development database

The backend can use Supabase PostgreSQL through its ignored `services/backend/.env`. Use a Session pooler URL on port 5432 when IPv4 is needed, the SQLAlchemy `postgresql+psycopg://` driver prefix and `sslmode=require`. Keep the database password server-side; Supabase browser API keys are not database credentials.

From `services/backend`, apply migrations with the Supabase-specific helper:

```sh
uv run python -m scripts.migrate_supabase
uv run pytest -q
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000
```

The helper runs migrations and removes `PUBLIC`, `anon` and `authenticated` grants from this application's tables in one transaction. It preserves Supabase-managed schemas and project-wide defaults. The application accesses these tables through FastAPI, not directly through Supabase's browser Data API. Re-run this helper when adding application tables. A supplied-connection option in Alembic permits the atomic migration/grant transaction.

The local Supabase connection and readiness screen were verified on 9 November 2026: PostgreSQL 17.11, schema `4b1db6085c26`, encrypted client connection, 8 backend tests passed. This does not deploy the backend or replace the planner's browser-local trip adapter. Keep local database tests on a dedicated development project.

The helper targets only modeled application tables plus the migration/readiness tables; Supabase auth/storage schemas and global default privileges are unchanged. It does not assume RLS is enabled. Runtime least-privilege database roles remain a production setup task.

## Supabase Auth and account drafts

Set `SUPABASE_URL` to the same project used by the frontend. The API verifies asymmetric JWTs through that project’s JWKS and checks ownership on every trip/version/command. Run `uv run python -m scripts.migrate_supabase` from this directory to apply migrations and revoke browser-role grants atomically. Current head is `0011_create_receipts`. No local PostgreSQL process is needed for the hosted DATABASE_URL. See [full setup and verification](../../docs/authentication-and-account-saving.md).

### Local fixture planning worker

Set `PLANNING_FIXTURES_ENABLED=true` only for local test planning, then run `uv run python -m app.jobs.worker` separately from the API (`--once` processes at most one claim). The web test control also requires `NEXT_PUBLIC_PLANNING_FIXTURES_ENABLED=true` and a restarted web process. No model/provider key is needed. The worker uses the same PostgreSQL database, bounded attempts and leased claims. It creates clearly labeled meal/break fixtures for a selected day; it does not run AI generation. See `../../docs/durable-planning-jobs.md`.

### Groq one-day agent

Configure server-only `GROQ_API_KEY`, `GROQ_MODEL` and `PLANNING_AI_ENABLED=true`, and enable `NEXT_PUBLIC_PLANNING_AI_ENABLED=true` in the web app. Restart the API, worker and web processes. Groq + LangGraph now supports selected-day AI proposals using a clearly labeled sample catalog. The key stays in the backend. Live provider data and full-trip replanning are not connected yet. See `../../docs/groq-agent.md` for limits, verification and remaining work.

### Trip conversation

The existing Groq-enabled worker also processes private trip messages. No extra key is needed. Apply migration head and run API, worker and web as above. See `../../docs/trip-conversation.md` for the message contract, idempotency, bounded context, supported actions and verification.
