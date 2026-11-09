# Unfolding planner release — 9 November 2026

## Release provenance

- Public site: https://elsewhere-ui-review.vercel.app
- Personal planner: https://elsewhere-ui-review.vercel.app/trips/new
- GitHub: https://github.com/he11OOwOr1d/tripadapt
- Source commit: `5d55bcd16d88a152657946c9729852362626408b` on GitHub `main`.
- Vercel project: `elsewhere-ui-review` (`prj_KRehkRCZYVAhi5eJgfWv6uXAbUTD`).
- Team: `forchatgptnik-gmailcoms-projects`.
- Deployment: `dpl_8kcsJTyArCJgvUwehTPZR45KgJwW`.
- Deployment hostname: `elsewhere-ui-review-c3hv7fpo5-forchatgptnik-gmailcoms-projects.vercel.app`.
- Target/status: production, READY, no alias error. Existing public alias assigned to this release.
- Framework/root: Next.js, `apps/web`. Project root directory also set to `apps/web` for subsequent builds.
- Build reported 33 seconds; production ready approximately 41 seconds after build start.

This is the first release built from the GitHub repository commit rather than a manually curated source snapshot. The local initial branch is `codex/initial-scaffold`, tracking GitHub `main`. Root now serves the approved Fieldtrip landing, and the design-direction selector is opt-in rather than visible in the product entry. No hero art, composition or accepted landing copy was redesigned.

## What shipped

Approved landing → personal Unfolding journey → existing itinerary workspace. The repository includes the actual frontend, backend foundation, CI scaffold, specifications, design history, README, repository/module guide and design-decision log. The approved Unfolding sequence keeps origin/people, dates, ordered destinations, time allocation, stay/transport preferences and final review connected to one draft.

Backend, auth, suppliers, itinerary generation and accepted-plan operations are not deployed/connected by this web release. Personal saves remain explicit browser-local mock-adapter operations; there are no live prices, offers, forecasts or reservations. Git source deployment does not by itself establish a verified automatic CI/CD release policy.

## Verification

- Local production build and TypeScript passed; all 12 draft/planning tests passed.
- GitHub remote `main` verified at the source commit; new README links checked against repository paths.
- Initial commit candidate files scanned for common credential signatures; real env files, dependency/build folders, local databases and scratch exports excluded. No detected credential signatures were committed. Font licenses retained.
- Vercel returned READY and the public alias for the exact commit above. Build logs reported deployment completion.
- Public browser: approved landing and direct “Plan my escape” handoff verified.
- Created an empty personal draft with Delhi origin, two travelers, 14 desired days, manually entered Kyoto/Asia-Tokyo and ten stay nights. Review showed ten stay nights, zero travel nights, 14 trip days, three unallocated nights and unknown costs. Opened the itinerary workspace with that same route. No save was required or live service fabricated.
- Phone browser at 390×844: folded sections and summary access rendered without horizontal document overflow.
- Saved desktop/phone captures in `docs/references/deployed-unfolding/`.

The documentation-only follow-up commit records this release; it does not change the deployed source provenance.

## Persistent Git integration — 9 November 2026

Connected `he11OOwOr1d/tripadapt` to the existing `elsewhere-ui-review` Vercel project through Project Settings → Git. Verified the connected repository and Disconnect control, then reloaded the Production environment settings: branch tracking is `main`, and custom production domains auto-assign. Future pushes to `main` create production deployments; unassigned branches use Preview. Root directory remains `apps/web`. This supersedes the earlier statement that only a commit-source deployment had been verified.

### Environment requirements now

The current landing and browser-local mock planner require **no custom environment variables or API keys**. Do not put backend/provider secrets in the frontend environment.

The existing optional frontend setting is `NEXT_PUBLIC_API_BASE_URL`. When an HTTPS backend is deployed, its value should be the public API base ending in `/api/v1`. It currently feeds the `/system` health diagnostic; setting it alone does not connect trip persistence or make the mock adapter live. The localhost value in `.env.example` is for local development and must not be used as a production backend URL.

Backend deployment will separately need its database configuration and explicit frontend CORS origins. Identity-provider, map/provider and AI credentials must be selected and configured with their actual integrations; they are not required to keep this UI deployment working. Configure future secret values directly in the appropriate hosting environment rather than sharing them in chat or committing real `.env` files.
