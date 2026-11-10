# Current implementation status

Snapshot: 10 November 2026. Local implementation status, not a production-readiness certificate. This page supersedes earlier “pending” or “blocked” descriptions where the later work resolved them; the journal preserves the sequence.

| Section | Working locally | Remaining boundary |
| --- | --- | --- |
| Landing | Approved Fieldtrip meadow/postcard/Alpine composition and responsive layouts | Locked; later product work preserves it |
| Trip creation | Unfolding, multiple/repeated destinations, flexible/long duration, preferences, review | Provider-backed suggestions/availability are not connected |
| Identity | Supabase SDK/SSR, backend JWT verification and owned application records | Owner disabled email confirmation; recovery delivery/production SMTP remain separate checks |
| Database | Application schema in Supabase-hosted PostgreSQL through FastAPI/SQLAlchemy; browser table grants revoked | Production operational setup, retention/deletion and migration procedures need further work |
| Saving/library | Serial coalesced account autosave, local backup, list/reopen and stale-write feedback | Title/schedule writes are separate; reconcile partial failures explicitly |
| Manual workspace | Activities/meals/rest/free time, move/edit, completion, undo and timing feedback | Exact travel schedules/timezone feasibility are not verified |
| Proposals | Frozen candidates, validation, advisory acknowledgment, protected acceptance/discard | History/restoration and async provider revalidation are incomplete |
| Jobs | PostgreSQL leases, fencing, cancellation, retries, progress and bounded admission | Node checkpoints, production hosting, daily quotas and multi-process operational testing remain |
| Groq agent | Real one-day LangGraph generation with scoped tools, strict output, repair and reasons | Uses a sample catalog; live places/routes/weather/prices and full-trip replanning remain |
| Conversation | Persistent private messages, selected facts, clarification, additions-only proposals, responsive chat and stage-driven progress | Existing-item edits, richer reasoning retrieval, long-term summaries and streaming remain |

## Verification evidence

The final local slice was checked with 55 backend tests, 13 frontend regression tests, Ruff, TypeScript and a production frontend build. Browser checks covered desktop and phone layouts, account save/reload, proposal acceptance, live Groq generation, persistent conversation, clarification and one requested rest-break proposal. Historical notes retain the smaller test counts observed at those earlier milestones; they are not additional independent proof of today's state.

Tests use transactional rollback and mock providers for repeatable automated checks. Separately observed live Groq calls and signed-in browser runs are documented in their implementation notes. The traveler's original trip was not used as disposable test data.

## Deployment status

The previously approved frontend review is linked to GitHub/Vercel with production following `main`. These later local API/worker/auth/chat changes have not been released through this retrospective publication. The branch-specific Vercel rule prevents auto-deploying `codex/development-history`. No API, worker, supplier integration or production environment is provisioned by pushing these source commits.

## CI correction after publication

GitHub Actions exposed an environment-dependent assertion in `test_auth_is_closed`: a configured developer machine returned 401 for an invented token, whereas clean CI correctly returned 503 when Supabase was unconfigured. The test now explicitly covers configured/unconfigured authentication with and without credentials. Runtime authentication behavior is unchanged; CI needs no Supabase credentials. Rechecked fresh PostgreSQL 17 migrations, Alembic drift detection and all 58 backend tests with `SUPABASE_URL` empty, plus 13 frontend tests, TypeScript and the production build.
