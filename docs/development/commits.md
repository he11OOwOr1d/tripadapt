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
