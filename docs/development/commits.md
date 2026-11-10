# Commit map

## Original published history — preserved

| Commit | What it records |
| --- | --- |
| [`5d55bcd`](https://github.com/he11OOwOr1d/tripadapt/commit/5d55bcd) | Initial scaffold, baseline specifications, accumulated design explorations, approved Elsewhere landing and Unfolding planner |
| [`62249e1`](https://github.com/he11OOwOr1d/tripadapt/commit/62249e1) | GitHub-backed Unfolding release record |
| [`3d48475`](https://github.com/he11OOwOr1d/tripadapt/commit/3d48475) | Persistent Vercel Git integration and environment requirements |

## Retrospective section commits

These group the subsequent local work by responsibility. Cross-cutting schema foundations are introduced before their API/worker/UI consumers. The application composition is integrated after its dependencies. Individual slices are review steps, not claimed historical standalone releases. The verified final snapshot and its limitations are documented in [status](status.md).

| Commit | Section |
| --- | --- |
| `d22b6c7` | Development journal, privacy exclusions and deployment guard |
| `f9cf8bb` | Shared backend, identity, persistence, reviewed proposals and agent orchestration |
| `01ebbf7` | Authentication UI, visual studies and account adapters |
| `45466c5` | Autosave, saved-trip library and UX refinement |
| `f51b6b2` | Editable itinerary workspace |
| `bfde0d9` | Conversational assistant, job progress and proposal review |
| `8487140` | Integrated creation and planning workbench |

The documentation publication commit follows these sections. Backend routes, migrations and shared schemas stay together because splitting their registration would produce incomplete imports. This is a retrospective review structure, not a reconstruction of exact implementation dates.

## Follow-up publication — 11 November 2026

PR #1 was merged as `8d1f379`. The following commits are based on that merged main, on `codex/planning-recovery-discovery`:

| Commit | Section |
| --- | --- |
| [`6cc5109`](https://github.com/he11OOwOr1d/tripadapt/commit/6cc5109) | Earlier CI correction: authentication tests explicitly configure their provider state |
| [`56fb9ac`](https://github.com/he11OOwOr1d/tripadapt/commit/56fb9ac) | Backend typed edits, consistent message polling, immutable whole-plan recovery and bounded live destination lookup |
| [`15e1727`](https://github.com/he11OOwOr1d/tripadapt/commit/15e1727) | Frontend review/history/search interactions, adapters, regression tests and deployment guard |

The documentation commit follows these code sections and updates the README, module guide, decisions, journal, current status and feature verification notes with QA captures. Shared route/schema dependencies stay in the backend commit; shared review/composition UI stays in the frontend commit. This preserves coherent review boundaries without inventing original per-feature commit dates.

Verification recorded for this exact code snapshot: 119 backend tests, 17 frontend tests, Ruff, TypeScript and production frontend build passed. Browser evidence covers reviewed edits, recovery, live destination lookup, persistence and desktop/phone layouts. No production deployment or runtime verification is implied.
