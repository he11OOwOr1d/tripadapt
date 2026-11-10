# Current implementation status

Snapshot: 11 November 2026. Local implementation status, not a production-readiness certificate. This page supersedes earlier “pending” or “blocked” descriptions where the later work resolved them; the journal preserves the sequence.

| Section | Working locally | Remaining boundary |
| --- | --- | --- |
| Landing | Approved Fieldtrip meadow/postcard/Alpine composition and responsive layouts | Locked; later product work preserves it |
| Trip creation | Unfolding, multiple/repeated destinations, flexible/long duration, preferences, review | Live destination lookup now fills label/timezone; activity suggestions/availability remain unconnected |
| Identity | Supabase SDK/SSR, backend JWT verification and owned application records | Owner disabled email confirmation; recovery delivery/production SMTP remain separate checks |
| Database | Application schema in Supabase-hosted PostgreSQL through FastAPI/SQLAlchemy; browser table grants revoked | Production operational setup, retention/deletion and migration procedures need further work |
| Saving/library | Serial coalesced account autosave, local backup, list/reopen and stale-write feedback | Title/schedule writes are separate; reconcile partial failures explicitly |
| Manual workspace | Activities/meals/rest/free time, move/edit, completion, undo and timing feedback | Exact travel schedules/timezone feasibility are not verified |
| Proposals | Frozen candidates, validation, advisory acknowledgment, protected acceptance/discard | Item-level recovery, provenance inheritance and async provider revalidation remain |
| Jobs | PostgreSQL leases, fencing, cancellation, retries, progress and bounded admission | Node checkpoints, production hosting, daily quotas and multi-process operational testing remain |
| Groq agent | Real one-day LangGraph generation with scoped tools, strict output, repair and reasons | Uses a sample catalog; live places/routes/weather/prices and full-trip replanning remain |
| Conversation | Persistent private messages, selected facts, clarification, additions and single-activity time-change proposals, responsive chat and stage-driven progress | Richer reasoning retrieval, long-term summaries and streaming remain |

## Verification evidence

The current local implementation was checked with 119 backend tests, 17 frontend regression tests, Ruff, TypeScript and a production frontend build. Browser checks covered desktop and phone layouts, account save/reload, proposal acceptance, live Groq generation, persistent conversation, clarification and one requested rest-break proposal. Historical notes retain the smaller test counts observed at those earlier milestones; they are not additional independent proof of today's state.

Tests use transactional rollback and mock providers for repeatable automated checks. Separately observed live Groq calls and signed-in browser runs are documented in their implementation notes. The traveler's original trip was not used as disposable test data.

## Deployment status

GitHub main includes merged PR #1 (`8d1f379`). The subsequent reviewed-edit, recovery and destination-discovery work is being published on `codex/planning-recovery-discovery`. Vercel deployment is disabled explicitly for this branch and the earlier `codex/development-history` branch. No deployment is initiated by this publication. The public runtime was not re-verified during publication; frontend source publication does not provision API/worker hosting, production identity configuration or travel suppliers.

## CI correction after publication

GitHub Actions exposed an environment-dependent assertion in `test_auth_is_closed`: a configured developer machine returned 401 for an invented token, whereas clean CI correctly returned 503 when Supabase was unconfigured. The test now explicitly covers configured/unconfigured authentication with and without credentials. Runtime authentication behavior is unchanged; CI needs no Supabase credentials. Rechecked fresh PostgreSQL 17 migrations, Alembic drift detection and all 58 backend tests with `SUPABASE_URL` empty, plus 13 frontend tests, TypeScript and the production build.

## Conversational edit slice

Single-activity local start-time proposals now use explicit review and the existing ownership/staleness protections. See [implementation and verification](../conversational-edits.md). Backend suite: 70 tests. No new provider credentials, database migration or deployment.

## 11 November: cross-day moves

Chat can propose moving one unprotected activity from the selected day to another day within the same destination stay, with both days/times shown in review. Target-day conflicts block the proposal. See [conversational edits](../conversational-edits.md). 76 backend tests and frontend checks pass. No migration, new key or deployment.

## 11 November: duration editing

Chat now supports an exact duration change for one unprotected activity, with before/after minutes and unchanged start time in review. Full-plan conflicts block it. Automated checks pass with 87 backend tests and 13 frontend tests, Ruff, TypeScript and build. See [conversational edits](../conversational-edits.md). No migration, new key or deployment.

## 11 November: reviewed removal

Chat can propose removing one named unprotected activity from the selected day, with explicit item review and acceptance. No supplier reservation is cancelled. Immutable snapshots remain; user-facing restoration is still outstanding. 96 backend tests and 13 frontend tests, Ruff, TypeScript and build pass. See [conversational edits](../conversational-edits.md).

## 11 November: accepted history and restore

Accepted snapshots are now listed and can be restored through a reviewed new proposal, including complete supported plan settings. Protected current records and their date/destination context cannot be silently rewound. History recovery does not revalidate reservations or providers. 106 backend tests, 13 frontend tests, TypeScript, build and Alembic drift checks pass. See [plan history](../plan-history.md).

## 11 November: first live discovery adapter

Explicit destination lookup now uses Open-Meteo/GeoNames, with user selection, timezone fill, attribution/cache timestamps and manual fallback. Stop coordinate/provenance persistence and live AI activity evidence are not connected. 119 backend tests, 17 frontend tests, Ruff, TypeScript and build pass. See [destination search](../destination-search.md).
