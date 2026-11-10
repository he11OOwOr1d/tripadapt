# From Elsewhere's first commit to a conversational planner

Recorded retrospectively on 10 November 2026 from the repository, implementation notes and development conversation. This preserves decisions and feedback, rather than presenting every experiment as a finished feature.

## 1. Establish the product and its boundaries

**Work.** Named the public product Elsewhere while retaining TripAdapt as the repository/specification name. Created the monorepo scaffold, PRD, system/database/API designs, user flows, wireframes and design references. Selected Next.js/React/TypeScript for presentation and FastAPI/Python for authoritative planning operations, with PostgreSQL, SQLAlchemy and Alembic.

**Decision and why.** Use a modular monolith with API and worker processes. A trip's destinations, stays, transfers, activities and costs have shared constraints; independent microservices would complicate changes before there is evidence they are needed. AI proposes options; deterministic code enforces arithmetic, ownership and acceptance. The planner is not a booking engine.

**Lesson.** Adaptive travel planning is a consistency problem as much as a generation problem. A plausible paragraph is not a feasible itinerary. Distinguishing drafts, proposals, accepted plans and reservations must shape the data model before adding a model call.

**Tradeoff.** Explicit versioning and contracts take more work up front, but make manual editing and eventual replanning share the same rules. No extra vector database, Redis deployment or agent per travel domain is required initially.

**Evidence.** [PRD](../../tripadapt-prd.md), [architecture](../../tripadapt-system-architecture-v1.md), [database](../../tripadapt-database-design-v1.md), [API](../../tripadapt-api-design-v1.md). The first published commit, `5d55bcd`, already contains the accumulated scaffold and approved design work; it was not a series of separately published design milestones.

## 2. Find a visual direction, then protect it

**Work.** Explored multiple landing compositions, landscapes and palettes. Approved the code-drawn animated mountain meadow, beige paper surfaces and green typography, the “A feeling worth following” postcard introduction and Alpine's compact sample planner. Refined desktop placement and phone layouts.

**Decision and why.** Lock the approved Fieldtrip landing. Product screens inherit type, color and spacing, while the workspace favors reading and manipulation over repeated landscape illustrations. The landing's example must never silently become the traveler's own trip.

**Lesson.** A memorable invitation and an efficient planning workspace serve different tasks. Brand continuity does not require copying the same composition everywhere. A sample is useful only when it is clearly separate from personal state.

**Tradeoff.** Code-drawn scenery provides precise motion/responsiveness and a consistent look, but requires ongoing care for performance and reduced motion. Older scenic/photo/3D/postcard alternatives remain explorations, not additional approved production directions.

**Evidence.** [Visual direction](../visual-direction.md), [storyboard](../landing-storyboard.md), [direction/layout history](../landing-direction-layouts.md), [mobile behavior](../mobile-responsive.md), and `apps/web/app/design/fieldtrip/`.

## 3. Choose Unfolding for trip creation

**Work.** Produced fresh planner studies and selected Unfolding. Built the real journey through origin/travelers, dates or flexible duration, ordered destinations, time allocation, stay/transport preferences and a complete route review. Allowed repeated destination occurrences and trips longer than seven days.

**Decision and why.** One expanded decision at a time reduces initial load; collapsed sections retain visible answers. Keep a nearby desktop summary and an accessible phone summary. Preserve data while navigating backward. Unknown amounts remain unknown, and selecting a stay or transport style makes no reservation.

**Lesson.** Travel order is part of the trip model, not merely a list of city names. A revisit needs a stable destination-occurrence ID. Stay nights, travel nights and inclusive trip days are different quantities, and same-day transfers must not create an extra full day.

**Tradeoff.** Flexible dates and long trips need relative days and explicit uncertainty. Exact dates can support provisional labels, but real timezone-aware arrival schedules still require provider evidence.

**Evidence.** [Creation journey](../trip-creation-journey.md), `TripCreation.tsx`, the planning helpers and the earlier planner studies. The user selected Unfolding; the other studies are retained for learning, not reused as competing production flows.

## 4. Connect GitHub and the frontend review deployment

**Work.** Created the initial published scaffold, documented the GitHub-backed Unfolding release, then verified the persistent GitHub–Vercel connection and required environment setup. The project root is `apps/web` and production follows `main`.

**Lesson.** A Vercel frontend deployment does not provision the API, database, authentication callbacks, worker or travel suppliers. A successful frontend build is not end-to-end integration evidence.

**Tradeoff.** Separate frontend/API/worker processes keep responsibilities clear, but production operation requires explicit hosting and environment work. Publishing this retrospective branch does not claim a new deployment.

**Evidence.** Published commits `62249e1` and `3d48475`; [deployment notes](../deployments/unfolding-planner.md).

## 5. Evolve authentication from studies to a usable flow

**Work.** Explored sign-in/sign-up directions and an interactive travel companion. Feedback found the backpack/coat changes too subtle and obscured. Refined the idea into the minimal Little Lookout form with immediately legible reactions and a restrained privacy response. Added real Supabase Next.js SDK/SSR sessions, callbacks, sign-out and password-recovery UI.

**Decision and why.** Keep the approved visual character, but delegate identity credentials/session handling to Supabase. FastAPI verifies signed tokens and maps the trusted identity subject to an internal owner. A typed email or arbitrary bearer string never establishes ownership.

**Lesson.** An animation can be polished yet fail its communication task. Visible, small state changes were more effective than moving the backpack forward or adding more decorative activity. Validation also needs the form's actual submitted/autofilled values, not an assumption that React state captured every browser autofill event.

**Tradeoff.** We gain established credential/session management but depend on provider callback configuration, signing keys and email delivery. Recovery UI alone is not evidence that a recovery email was delivered.

**Evidence.** [Auth studies](../auth-studies.md), [integration and dated corrections](../authentication-and-account-saving.md). Earlier bag/coat/scenic companion designs remain labeled previews; Little Lookout is the approved direction.

## 6. Resolve the “two databases” confusion and signup failures

**Work.** Connected the Python API to Supabase-hosted PostgreSQL, using the existing normalized application schema and migrations. Kept Supabase's frontend SDK for authentication. Diagnosed invalid-email and email-send-rate-limit responses, and made errors specific without exposing credentials.

**Decision and why.** Use the same hosted PostgreSQL service, with different responsibilities: the frontend obtains identity/session tokens; FastAPI owns private application data and transactions through SQLAlchemy/psycopg. A Python PostgreSQL driver is a connection mechanism, not a second database. The optional local PostgreSQL helper is an alternative development setup, not an additional required datastore.

**Lesson.** “Connected to Supabase” can refer to Auth, the browser Data API or a database connection. Those are different interfaces and need explicit status checks. A generic “check your connection” error obscured a precise provider error and sent debugging in the wrong direction.

**Tradeoff.** Keeping FastAPI as the domain boundary avoids rebuilding ownership/versioning around browser table access, but requires a running backend and JWT configuration. Browser API roles have no application-table privileges.

**Email decision.** The project owner later disabled email confirmation and successfully signed up. This supersedes the earlier SMTP-blocked state; we did not replace the identity system. It reduces signup friction and email-send dependence, while an entered address alone no longer proves inbox ownership. JWT subject-based ownership remains authoritative. Recovery delivery, production SMTP and future account policy are separate outstanding work. Historical advice that confirmation remained enabled is not the final setting.

## 7. Fix saved trips and improve account error boundaries

**Work.** Reproduced the saved-trip loading failure in a signed-in browser. The backend lacked its Supabase issuer URL; after correcting that locally, JWKS retrieval exposed missing certificate trust. Added certifi and an explicit trusted SSL context while retaining certificate/hostname verification. Distinguished unavailable server auth configuration (503) from an invalid/expired session (401). Refreshed the library after saves and verified save/list/open/update/reload.

**Lesson.** A successful sign-in does not prove the domain API can verify its token. Trace browser → API → identity verification → database → response rather than treating every failure as “sign in again.”

**Tradeoff.** Specific, safe failure codes are more work than a catch-all toast, but preserve the user's draft and point to the correct recovery. No verification bypass or insecure TLS workaround was introduced.

**Evidence.** The dated saved-trip fix in [authentication/account saving](../authentication-and-account-saving.md). Screenshots exposing the traveler's real trip library are retained locally rather than published.

## 8. Let the trip save itself and make duration understandable

**Work.** Responded to feedback that “Room for each place,” “Stay and travel,” and a toolbar full of save/new/sign-out actions were tedious and confusing. Simplified time allocation, separated optional stay/transport allowances, moved the library into its own dialog, and put account/recovery actions in a quieter menu. Replaced manual account-save buttons with debounced device/account autosave and visible sync status.

**Decision and why.** Serialize saves and coalesce intervening edits. Use returned draft ETags for the next write. Pause on conflicts instead of silently overwriting; retain a local backup and allow explicit recovery.

**Lesson.** More explanatory text did not solve a confusing mental model. The UI needed a clearer distinction between total days, accommodation nights and overnight journeys, and fewer competing controls.

**Tradeoff.** Autosave removes routine work but introduces concurrency and recovery obligations. Schedule and title writes remain separate API requests; a partial save or stale title must not be reported as complete success. Device storage is a backup, not a substitute for account sync.

**Evidence.** [Planner UX refinement](../planner-ux-refinement.md), autosave queue/hook and regression tests. This supersedes earlier manual-save instructions.

## 9. Build a manual itinerary before asking AI to plan

**Work.** Added readable day timelines, unplanned gaps, activities, meals, rest/free-time blocks, editing/moving across destination occurrences and days, completion flags, removal/undo and conflict feedback. Preserved selected day/workspace in reload URLs. Added typed activity kinds to the API/database and kept UI logic separate from the account adapter.

**Decision and why.** A working manual workspace establishes the output model and editing contract for the agent. Existing items outside a shortened stay remain visible for reassignment. A native editor dialog supports focus, Escape and touch controls.

**Lesson.** Browser time-input changes did not always synchronize React preview state as expected; FormData submission and input/blur handling fixed the observed issue. Overlapping activities must not create false “free” gaps: the timeline uses the union of occupied time.

**Tradeoff.** Arrival/departure days share route boundaries, and date labels are provisional until real schedules are known. The display window can expand around early/late entries. Structural midnight/day errors are blocked, while an overlapping manual draft remains visible for correction.

**Evidence.** [Manual workspace](../itinerary-workspace.md) and screenshot/test records.

## 10. Establish proposals and immutable acceptance

**Work.** Added frozen manual proposal snapshots, validation, acknowledgment of advisory unknowns, accept/discard and retry-safe acceptance. Acceptance checks both the draft edit sequence and accepted base under a trip lock. Later draft edits do not mutate the accepted snapshot.

**Decision and why.** Validate the acceptance boundary with a real manual itinerary before introducing model behavior. Hard conflicts cannot be acknowledged away. Unknown travel evidence can remain explicitly provisional; strict-budget acceptance is blocked without complete cost evidence.

**Lesson.** “Saved draft” and “accepted plan” must not become interchangeable. A newer user edit must win over an older proposal. Discard must leave the accepted trip unchanged.

**Tradeoff.** Snapshots and revision checks add storage and UI steps, but prevent silent consequential changes. History browsing, restoration and provider revalidation are not automatically finished by introducing the version tables.

**Evidence.** [Planning foundation](../planning-foundation.md), proposal tests and migration `0013_plan_proposals`.

## 11. Prove durability with an honest fixture planner

**Work.** Added durable PostgreSQL planning jobs, a separate worker, owner-scoped status/cancel endpoints, selected-day requests, admission limits, leases/heartbeats, bounded retries and fenced atomic publication. A deterministic fixture runner added labeled meal/break blocks and reused proposal review.

**Decision and why.** Start with PostgreSQL jobs rather than introduce Redis solely for a small queue. Treat execution as at least once; stable item IDs and idempotent publication prevent duplicate results. Expired lease tokens cannot overwrite a recovered attempt. Changes to the base trip supersede stale results.

**Lesson.** Durability and feasibility are separate: a successful job may return a conflicted or unchanged candidate. Closing a progress dialog is not cancellation. Tests also needed owner-scoped claims so they could not consume unrelated development jobs.

**Tradeoff.** A separate worker must be operated and hosted. Whole-attempt recovery may repeat external calls; fences do not guarantee exactly-once billing. Initial limits are one active job/trip, two/owner and twenty globally, not a finished production usage-quota system.

**Evidence.** [Durable jobs](../durable-planning-jobs.md), migration `0014_planning_jobs`. Fixture mode is a test capability, not AI generation.

## 12. Add Groq with bounded LangGraph orchestration

**Work.** The user chose Groq and configured `openai/gpt-oss-120b`. Added the official backend SDK adapter and a LangGraph flow: scoped read tools → separate strict structured-output call → deterministic validation → at most one repair → proposal. Persisted user-facing reasons, model/catalog provenance and call/token counts.

**Decision and why.** One planning agent uses ordinary typed tools; there is no need for a weather, budget and hotel agent each. Groq's separate structured-output mode has tool-use limitations, so evidence gathering and final JSON output use separate calls. This is a workflow design choice, not a reason to replace the provider or database.

**Lesson.** Schema-valid JSON is not schedule correctness. Candidate IDs, labels, durations, scope, locks and overlaps must still be checked. The server derives records from permitted evidence and checks them again at publication/acceptance. The observed account test used three model calls; that is evidence for one run, not a universal latency/quality guarantee.

**Tradeoff.** Separate calls increase latency/token use but isolate evidence gathering from final serialization and repair. Calls, tools, time and retries are bounded. Authentication and invalid-candidate errors stop; rate limits and transient failures follow a safe retry policy. Persistent LangGraph node checkpoints and comprehensive quality evaluations remain outstanding.

**Current limit.** This is real Groq execution against a sample activity catalog. It does not research real places, routing, hours, forecasts, prices or inventory. Every proposal says so; selecting or accepting one makes no reservation. Groq is the provider; Grok is a different model family and was not the configured integration.

**Evidence.** [Groq implementation and live verification](../groq-agent.md), migration `0015_ai_job_results`.

## 13. Make planning conversational without giving chat database authority

**Work.** Added private persistent trip messages, bounded recent context, clarification choices and a chat panel beside the itinerary. Phones use a focused view with Back to plan. Chat answers selected saved-trip facts or produces an additions-only proposal for the selected day. Draft text survives close/reopen, keyboard sending is supported and messages survive reload.

**Decision and why.** Conversation is another interface to the same owned snapshots, job limits and proposal acceptance rules. The model routes free-text intent; factual answers are assembled from saved records. Canonical quick actions are explicit typed intents. A request for a rest break narrows the sample catalog to rest, rather than creating an unsolicited whole-day schedule.

**Lesson.** Live testing caught “Explain this day” returning a route summary; explicit quick intents and a more precise routing prompt corrected it. Phone testing caught four-button navigation overflow; the layout was changed and rechecked at 390px and 320px. Initial focus and return-to-plan behavior matter as much as the message bubble design.

**Progress decision.** Show short, varied summaries tied to real stages, such as reading the note or checking timing, with a restrained three-dot trail. Do not cycle arbitrary “thinking” words, imply live provider searches, expose private chain-of-thought or fabricate percentage progress. Respect reduced motion and show honest longer-wait/cancellation states.

**Tradeoff.** A bounded facts-and-additions companion is less flexible than a general chatbot, but cannot silently move reservations, accept its own plans or invent evidence. Six prior completed turns provide recent context; full persisted history is paginated and is not permanent model memory. Replies currently appear on completion rather than token streaming.

**Evidence.** [Trip conversation](../trip-conversation.md), migration `0016_trip_conversation`, live clarification → one-break proposal → review/accept → reload checks. Broader conversational editing and downstream replanning remain future work.

## What this history should prevent us from forgetting

Protect the approved landing. Keep examples separate from personal data. Explain time/cost units. Treat unknown provider facts as unknown. Debug the full user story, not just one layer. Preserve local work when sync fails. Keep accepted plans immutable. Use one database service with clear interfaces and ownership boundaries. Keep agents bounded, proposals explicit and bookings separate. Record observed verification and remaining gaps without relabeling a prototype or local success as a production launch.

## 14. Let conversation propose a precise time change

**Work.** Added one-activity rescheduling on the selected day, typed extraction, deterministic candidate reconstruction, protected-item/conflict explanations and before/after review.

**Decision and why.** Reuse the existing durable job and acceptance boundaries. A narrow time command needs no new agent framework, graph or database service. Keep all other fields unchanged and require explicit acceptance.

**Lesson.** Browser testing exposed message/job polling across different READ COMMITTED statement snapshots; a joined read prevents a successful job appearing without its reply. Local unit tests alone did not reveal this timing issue.

**Tradeoff.** Exact local times and one unprotected activity limit flexibility but make the proposal easy to inspect. Cross-day moves, removal and downstream feasibility remain future work. Travel times and opening hours stay unverified.

**Evidence.** [Conversational edits](../conversational-edits.md), 70 backend tests, frontend checks and a live QA-trip move accepted and reloaded on phone.

## 15. Extend reviewed moves across local days

11 November 2026. **Work:** a one-activity move to another day within the same destination, with explicit before/after day and time. **Decision:** use destination-local day numbers and the current selected source day, keeping the same deterministic candidate/acceptance boundary. **Lesson:** a day number needs context; whole-trip days and days within a stay must not be silently interchanged. **Tradeoff:** no cross-destination moves or automatic reshuffling yet, but receiving-day conflicts and protected items remain enforced. **Evidence:** [conversational edits](../conversational-edits.md), 76 backend tests and frontend checks.

## 16. Let travelers adjust time spent at an activity

11 November 2026. **Work:** a typed duration-only chat proposal with explicit minutes and unchanged start time. **Decision:** preserve every other field and reconstruct the expected candidate at publication and acceptance. **Lesson:** shorter/longer must resolve to an exact total duration before review; longer activities must not silently push other items later. **Tradeoff:** one precise edit at a time, with ambiguity and conflicts returned as explanations, rather than automatic reshuffling. **Evidence:** [conversational edits](../conversational-edits.md), 87 backend tests and frontend checks.

## 17. Make removals explicit and reviewable

11 November 2026. **Work:** typed one-item removal through chat, an item-focused review and explicit acceptance. **Decision:** never treat itinerary removal as supplier cancellation, and refuse protected/bulk/ambiguous edits. **Lesson:** destructive intent needs a named object and visible consequences, even when previous immutable snapshots remain. **Tradeoff:** one activity on the selected day and no history/restore UI yet, with manual resolution of outstanding blocking conflicts. **Evidence:** [conversational edits](../conversational-edits.md), 96 backend tests and frontend checks.

## 18. Recover through accepted-plan history

11 November 2026. **Work:** accepted history, pagination, whole-plan restore proposals, conflict review and explicit acceptance. **Decision:** clone an immutable snapshot into a new version and preserve current protected records; restore settings and activities together. **Lesson:** activity-only recovery can combine old schedules with new dates/preferences and produce an inconsistent trip. **Tradeoff:** whole-plan review and manual conflict reconciliation instead of automatic merging; supplier facts and booking status remain unverified. **Evidence:** [plan history](../plan-history.md), 106 backend tests and frontend/build/drift checks.

## 19. Begin live discovery with destination lookup

11 November 2026. **Work:** explicit provider-backed destination search in the existing form, disambiguated labels, timezone fill, attribution and honest fallback. **Decision:** use the `/destinations/search` contract, keeping attraction discovery separate, and require user choice before adding to the route. **Lesson:** a matching label must still close the result list, and changing a place name must clear its old timezone. **Tradeoff:** a bounded non-commercial evaluation adapter and process-local cache; commercial licensing/shared quotas and persisted geocoded references remain ahead. This does not make sample AI activities or prices/weather live. **Evidence:** [destination search](../destination-search.md), provider documentation, 119 backend tests and 17 frontend tests/build checks.

## 20. Publish recovery and discovery as reviewable sections

11 November 2026. **Work:** refreshed README/setup instructions, corrected stale scaffold/auth/integration statuses, linked the current module boundaries and feature guides, and published backend/frontend/documentation sections from the merged main baseline. **Decision:** use a new review branch after PR #1 was merged and disable its Vercel Git deployment. **Lesson:** published source, a frontend release and operational API/worker/provider integrations are distinct states; documentation must not collapse them. **Tradeoff:** shared dependencies are grouped by backend/frontend responsibility rather than reconstructing imaginary per-feature original commits. Private environment files and the three personal-trip captures remain excluded. See the [commit map](commits.md).
