# Authentication and account saving

Implemented locally on 10 November 2026. Approved design: Little lookout. The landing is unchanged; the design-study route stays a no-network preview. Actual routes are `/sign-in`, `/sign-up`, `/auth/callback`, and `/reset-password`.

## Runtime and responsibilities

Next.js uses `@supabase/supabase-js` and `@supabase/ssr`, the Framework / Next.js / App Router integration shown in Supabase. Browser helpers manage the PKCE session; Next's proxy refreshes/validates claims on relevant routes and returns private, non-cacheable responses. The callback exchanges an auth code into cookies; development request logging excludes that code-bearing route. Only allowlisted internal trip return paths are accepted. Password recovery updates the current authenticated user, then signs out and asks for a fresh sign-in.

FastAPI verifies ES256/RS256 access tokens against this project's fixed JWKS endpoint, pinned issuer and `authenticated` audience; expiry, issued-at, subject, role and email are required. Anonymous tokens, privileged roles, invalid signatures and wrong-project tokens are rejected. It never trusts browser-supplied owner IDs or user_metadata verification flags. The existing internal identity mapping keys on issuer plus subject; email alone never links accounts. Access tokens may remain usable until expiry after logout, as is normal with offline JWT verification. Provider email-verification timestamps are not currently synchronized into AppUser.

The database is **hosted PostgreSQL on Supabase**, not a required local PostgreSQL installation. SQLAlchemy + psycopg connect the Python domain API to it. The framework SDK does not replace a transactional database driver. All application table grants remain revoked from PUBLIC, anon and authenticated roles; browsers cannot bypass API ownership rules through Supabase's Data API. Never add a service-role/secret key to the frontend.

## Save and return behavior

The existing browser adapter remains available explicitly. A separate `lib/trips/account-adapter.ts` maps UI view models to the published API. Clicking Save to my account preserves a browser copy first. If sign-in is required, a per-tab pending snapshot stores the particular trip, account reference/ETags, active form step, workspace view and selection. No credentials are stored with that snapshot. Sign-in success or cancellation returns to that draft. The user then confirms account saving; there is no silent merge with another account trip.

Account trips can be listed (cursor pagination), opened, updated, or left behind to start a new trip. No sample trip is uploaded. Loading another account trip asks before replacing unsaved work. Signing out clears the in-memory account reference/list and explicitly states that the local trip copy remains on the device. Unknown/unowned trips return 404. Saves never accept a plan, reserve a stay, book a journey or claim live supplier coverage.

Trip basics, ordered stops, duration/date mode, user-entered stay/transport allowances and manually edited activities round-trip. Ungeocoded origins/finish locations preserve their labels with null coordinates, not invented coordinates. Preference maps are typed, bounded inputs rather than opaque UI snapshots. Activities use relational version-owned rows with same-version stop FKs and immutable accepted-snapshot guards. Activity booking flags are user-entered records, never reservation operations.

Create requests use an owner-scoped idempotency key, persisted server-side with a request fingerprint and response trip ID. The tab keeps the retry key until it has reopened the saved trip. An uncertain retry cannot silently create the same trip twice. Editing uses draft ETags; stale draft edits return 412 and preserve local work. Metadata title updates use trip ETags; schedule and title are separate API requests, so a title conflict can occur after the schedule was saved. The UI does not report total success in that case; reopen the account draft to reconcile it.

## Local configuration

`apps/web/.env.local` (ignored):

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000/api/v1
```

`services/backend/.env` (ignored): existing encrypted Supabase `DATABASE_URL`, explicit `CORS_ORIGINS`, plus the same project `SUPABASE_URL`. `AUTH_AUDIENCE` defaults to authenticated. No JWT signing secret is needed for the asymmetric signing keys verified in this project. Restart the API after changing backend environment values; restart/rebuild Next after changing public environment values.

In Supabase Authentication → URL Configuration, allow the local callback and its recovery/return-query variants. For local development the documented `http://localhost:3000/**` allowlist pattern covers these; production should use precise approved callback paths. Configure the production Site URL and production callbacks only when deploying. The application validates internal return paths independently of this provider allowlist.

Commands from repository root:

```sh
make migrate-supabase
make api
make web
```

No Docker or local PostgreSQL server is necessary when DATABASE_URL points to Supabase. The legacy local PostgreSQL helper remains an optional alternative.

## Verification and current external blocker

- Supabase public Auth settings reachable: email enabled, signup enabled, email confirmation required.
- Project JWKS publishes ES256 keys. API/database readiness passed at migration `0011_create_receipts`.
- 18 backend tests passed against Supabase-hosted PostgreSQL, with database writes rolled back. JWT tests use ephemeral signing keys and a mocked key resolver, without a production auth bypass. API tests cover identity isolation, ordered route/settings/activity reload, idempotent creation, mismatched retry payloads, draft preconditions/stale edits, atomic rollback and cross-account denial.
- Three frontend adapter contract tests also passed: a 45-day route/preferences/activity round-trip (including Active UI pace → fast API pace), unauthenticated early exit and repeated failed-create key reuse. Run `npm --prefix apps/web test`.
- TypeScript and production build passed during implementation. Browser-tested guest save → sign-in → cancellation → same inputs and active step, long duration input, native/confirmation validation, and phone form layout. Captures are in `docs/references/auth-integration/`.
- User-led live signup exposed a generic error. Added code-specific, credential-safe feedback and FormData submission to handle autofill correctly. Subsequent Supabase responses were `email_address_invalid` (400), then `over_email_send_rate_limit` (429). The latter is the current external blocker. Do not keep retrying or turn off confirmation as a workaround. Use an already delivered confirmation email or configure custom SMTP in Supabase. The default sender has strict rate/recipient limits.
- Successful real-inbox confirmation, real-session account save/reopen, and delivered recovery email still need the user-led check once email delivery is available. Do not claim that live end-to-end flow has passed yet. SMTP configuration belongs in the Supabase dashboard, never NEXT_PUBLIC variables.

No deployment, push or new identity-provider account was performed. Hosted backend deployment, production callback/CORS values, SMTP, account deletion/provider-event synchronization, generated proposals/acceptance and supplier integrations remain separate work.

Official references: [Supabase Next.js SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [JWT signing keys](https://supabase.com/docs/guides/auth/signing-keys), [redirect allowlists](https://supabase.com/docs/guides/auth/redirect-urls), [SMTP limitations](https://supabase.com/docs/guides/auth/auth-smtp).

Final local checks: `make check` passed (backend Ruff + 18 tests, 3 frontend adapter tests, TypeScript, production build). The restarted local API reports ready at `0011_create_receipts`, and an unauthenticated trip request returns 401. Browser captures contain only empty/fictional test inputs, not the user’s sign-up credentials.

## Saved-trip loading fix — 10 November 2026

Live sign-up is now working with email confirmation disabled by the project owner. That supersedes the earlier SMTP-blocked sign-up status; email recovery delivery remains a separate check.

User-reported saved-trip failure reproduced with a real signed-in browser session. The current backend environment was missing SUPABASE_URL, so requests were incorrectly presented as a sign-in problem. Restored the matching project URL locally. The next request exposed Python's missing issuer certificate trust for the public JWKS fetch. Added a pinned certifi dependency and an explicit default SSL context using its trusted CA bundle; certificate and hostname verification remain enabled. Live JWKS retrieval now succeeds.

A configured bearer request against a server missing provider configuration now returns 503 AUTH_NOT_CONFIGURED instead of 401 AUTH_REQUIRED; the adapter explains that configuration failure without telling a signed-in user to sign in again. Also invalidated the visible cached trip list after saving and corrected the review's obsolete account-saving-unavailable copy.

Verified in the actual signed-in browser: save the user's existing draft, list it, open it, update-save it and reload it from its account URL. The originally unnamed draft is saved as My untitled escape. No trip contents were replaced with sample data. Regression suite: 20 backend tests, 5 frontend adapter tests; TypeScript and production build passed. Backend coverage still includes multi-destination route/preferences/activity round trips and cross-account denial. No deployment or push.

## Planner UX update

The later local refinement replaces explicit Save to my account / Save account draft buttons with automatic saving and a sync-status indicator. The trip library is a separate dialog; account/device-copy recovery actions live in an account menu. This supersedes the manual-save interaction described earlier above. See [planner refinement](planner-ux-refinement.md) for the serial queue, recovery behavior and current verification.
