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
