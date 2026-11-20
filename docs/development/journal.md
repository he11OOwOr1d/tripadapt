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

## 21. Compare schedule records by identity, not retrieval order

11 November 2026. **Work:** corrected scoped-edit and restored-source comparison after PR #2 exposed two failing tests. **Decision:** activity row order is not a schedule change; canonicalize by logical ID while keeping route order and all field values exact and rejecting duplicates. **Lesson:** passing on one PostgreSQL planner/runtime combination is insufficient evidence for an implicit ordering assumption. Regression tests now force the reordered case. **Tradeoff:** a shared semantic comparator adds one explicit boundary instead of depending on incidental SQL ordering or weakening candidate validation. **Verification:** 123 backend tests on Python 3.12 and 3.14.4, 17 frontend tests/build checks. Supabase Preview was separately skipped because per-PR previews are disabled, and was left unchanged.

## 22. Retain selected destination evidence

11 November 2026. **Work:** persist provider geography and attach nullable references to route stops, preserving them through account drafts, candidates, acceptance and recovery. **Decision:** server-created immutable snapshots; clients submit only IDs, with exact label/timezone validation. Keep manual destinations supported and source detail collapsed by default. **Lesson:** saving a city label alone loses the geographical identity needed for later activity/routing work. **Tradeoff:** additive table/migration and retained snapshot growth in exchange for historical consistency; shared quota/retention policies still need production work. No new provider key or second database. AI activities remain sample evidence. **Evidence:** 129 backend tests, 18 frontend tests, Ruff, TypeScript, build, Alembic drift checks and [reference contracts](../destination-search.md).

## 23. Explicit place research before grounding the agent

11 November 2026. **Work:** add an attributed OSM/Overpass adapter, destination/category search, manual-stop location attachment, user-controlled activity editor handoff, and immutable source snapshots through saving/recovery. **Decision:** establish a source-preserving human-selected path before feeding live places to Groq. **Lesson:** discovery and scheduling are separate; a mapped museum is not verified opening hours or a feasible journey. Batching snapshot writes/reads avoids per-result WAN round trips. **Tradeoff:** no new key for local evaluation, but partial map coverage, no ratings/reviews and public-instance availability limits. Actual requests returned 502/timeouts; successful live results remain unverified. Production must use dedicated/hosted capacity or another provider. **Evidence:** 144 backend tests on Python 3.12/3.14.4, 23 frontend tests, type/build/schema checks and [activity discovery notes](../activity-discovery.md). This does not replace sample AI evidence or deploy the application.

## 24. Replace the blocked discovery path and ground new proposals

11 November 2026. **Problem:** public Overpass endpoints timed out, returned 502 or rejected requests with 406; smaller queries and documented alternatives did not restore access. **Decision:** add a server-only hosted Geoapify option using the existing OSM-backed data boundary, selected when configured, without endpoint retry loops or silent sample fallback. New generation/chat requests explicitly request retained map evidence; legacy sample jobs retain their old behavior and labels. **Work:** dynamic candidate-ID schemas, server-derived labels/durations/source IDs, destination/freshness checks at publication and acceptance, safe source links/attribution and failure feedback. **Lesson:** a model successfully generating a plan proves little about source truth; the same immutable evidence must survive selection, persistence, publication and review. **Tradeoffs:** hosted key/quota dependency, partial POI coverage and estimated durations; hours/prices/routes remain unverified. **Evidence:** real browser search (11 Jaipur museums), source-preserving save/reload and a real Groq Albert Hall Museum proposal preserving existing commitments. QA entry removed and proposal discarded. 155 backend / 23 frontend tests, CI-matching Python 3.14.4 and build/schema checks pass. [Guide/screenshots](../activity-discovery.md). No migration or deployment.

## 25. Google Places details without permanent content snapshots

11 November 2026. **Work:** Google listing selection, reported-hours comparison, optional reported price fields, source attribution, explicit refresh and saved Google Place IDs. **Decision:** keep Google content transient and outside Groq, with identifiers as the durable link; retain the current independent discovery source and existing planner flow. **Lesson:** a known name is not a confirmed listing, and checking a start time alone misses closing/split-hour conflicts. Native date inputs also need verification against the value actually displayed. **Tradeoffs:** key/billing/IP restrictions, per-request quotas and a seven-day current-hours window; far-future visits remain indicative, without limiting trip duration. A brief independent discovery outage led to explicitly labeled retained Geoapify/OSM batch fallback. **Evidence:** real Google match/hours check, account ID save/reload, desktop/phone layouts, 179 backend / 27 frontend tests, build/type/schema checks. [Implementation](../google-place-checks.md). Migration0019 is additive; no source push or deployment.

## 26. Route relaxation discovery to a useful next question

11 November 2026. **Problem:** “Can you find a good place to relax?” returned a long capabilities paragraph because discovery was not an explicit add request. **Decision:** introduce a scoped relaxation intent, ask park proposal versus rest block, and route the park choice to mapped evidence. **Lesson:** conversational intent and mutation intent differ; a place question should not require planner command wording. **Tradeoff:** one clarification before a proposal; parks are supported, while quietness and other relaxation venue categories are not asserted. **Evidence:** exact live Groq/browser question, an attributed Collectorate Circle Park proposal preserving existing items, discarded without acceptance; 185 backend tests and Ruff pass. [Details/screenshots](../trip-conversation.md#relaxation-discovery-routing-correction--11-november-2026). No migration, key or deployment.

## 27. Check the time between activities

11 November 2026. **Work:** on-demand Google Routes walking/driving estimate, user-chosen arrival buffer and gap/shortfall display in the existing day workspace. **Decision:** one adjacent pair per explicit request; transient Google content outside saved plans and Groq, separate Routes key supported. **Lesson:** non-overlapping activities can still be impossible to reach, while mapped coordinates do not prove access (the real provider returned a private-road warning). **Tradeoff:** an extra check per pair and no live-traffic prediction, in exchange for clear cost control and avoiding an unsupported “verified itinerary” claim. **Evidence:** live walking/driving calls, preserved activity times, stale-result invalidation, responsive browser checks, 199 backend / 28 frontend tests and build/type checks. [Details](../journey-checks.md). No migration, push or deployment.

## 28. Make day timing understandable across journeys

11 November 2026. **Work:** day-wide timing coverage, retained per-pair route checks, nested activity overlaps, shortfall/edit handoff and explicit missing-location/provider-warning states. **Decision:** reuse the current route endpoint with one explicit check per pair; keep aggregate logic separate from data adapters and never store Google facts or mark an entire trip verified. **Lesson:** a successful route lookup covers only one gap; completeness and unknown evidence must be visible independently. **Tradeoff:** users check each pair and shared mode/buffer changes clear coverage, avoiding paid fan-out and stale confidence. **Evidence:** 34 frontend tests, TypeScript/build and browser checks; backend unchanged from 199-test baseline. [Scope](../day-feasibility.md). No migration, push or deployment.

## 29. Bring venue hours into the day review

11 November 2026. **Work:** shared-date opening-hours coverage and a combined summary with journey gaps/overlaps, using the existing confirmed Google listing checks. **Decision:** transient per-venue evidence; unknown dates/hours remain incomplete, and new listing choices in the review are not saved automatically. **Lesson:** a fitting route is insufficient when a venue is closed; generic breaks and sourced venue meals also need different coverage rules. **Tradeoff:** explicit individual checks rather than paid bulk requests, with no claim about tickets/accessibility/weather. **Evidence:** five domain regression cases, 39 frontend tests and type/build checks; backend unchanged from 199-test baseline. [Scope and browser verification](../day-opening-hours.md). No migration, push or deployment.

## 30. Offer one bounded timing adjustment

11 November 2026. **Work:** convert a journey shortfall into a deterministic later-start suggestion with before/after times and an explicit editor handoff. **Decision:** protect fixed/booked/completed targets, preserve duration and all other items, reject overlaps/order changes/midnight rather than cascade. **Lesson:** evidence for an incoming journey does not validate opening hours or the onward journey at a new time. **Tradeoff:** explicit review/save and rechecking instead of autonomous rearrangement; no Google content sent to Groq or saved in proposals. **Evidence:** six regressions, 45 frontend tests, type/build and QA browser flow. [Details](../timing-adjustments.md). No migration, push or deployment.

## 31. Check a suggestion's consequences before Save

11 November 2026. **Work:** proposed-time venue hours and onward-journey checks inside the adjustment preview, with conflict/unknown/warning verdicts. **Decision:** reuse existing authenticated adapters, retain Google data only transiently and keep current-day evidence separate. **Lesson:** fixing an incoming journey can reduce the next gap; source results must describe the proposed time, not the old one. **Tradeoff:** explicit individual calls and advisory evidence instead of automatic cascade or durable acceptance guarantees. **Evidence:** five regression cases, 50 frontend tests, type/build and live QA browser checks. [Boundaries](../adjustment-preview-checks.md). No migration, push or deployment.

## 32. Freeze suggested time changes behind the saved-plan boundary

11 November 2026. **Work:** owned deterministic time-change command endpoint and existing proposal review/acceptance handoff from journey suggestions. **Decision:** derive scope from the saved activity; reuse source=user, candidate snapshots and draft/current-version fences; rebuild the entire allowed change at acceptance. **Lesson:** a helpful preview does not protect against concurrent edits or unauthorized candidate changes. **Tradeoff:** an explicit saved review and immutable QA history, without pretending transient Google checks are acceptance evidence. **Evidence:** 210 backend / 51 frontend tests, Ruff/type/build, CI Python and QA browser flow. [Details](../saved-time-change-proposals.md). No migration, push or deployment.

## 33. Recheck providers at the acceptance boundary

11 November 2026. **Work:** explicit live acceptance choice for saved requested moves, candidate-derived venue/neighbor checks and fail-closed unknown/error handling. **Decision:** transient Google facts inside the locked acceptance transaction; preserve provisional acceptance as an explicit opt-out, with no silent fallback. **Lesson:** preview freshness is insufficient at commit, and a retry after a successful commit must not call paid providers again. **Tradeoff:** synchronous bounded provider work while holding the trip lock; distributed operations remain future work. **Evidence:** 225 backend / 52 frontend tests, Ruff/type/build, CI Python and live-warning browser checks. [Scope](../live-time-change-acceptance.md). No migration, push or deployment.

## 34. Make pending decisions recoverable

12 November 2026. **Work:** owned pending-review listing, cursor paging, reload/resume and up-to-date stale warnings in the existing review entry. **Decision:** reuse Review plan rather than add top-level navigation; inspect old snapshots without silently merging, deleting or applying them. **Lesson:** a failed live check leaves a valid pending proposal, so in-memory links alone are insufficient recovery. **Tradeoff:** older rows remain visible and require an explicit fresh review, preserving user control and the existing acceptance fences. **Evidence:** 230 backend / 53 frontend tests, Ruff/type/build, CI Python and QA browser recovery. [Details](../pending-reviews.md). No migration, push or deployment.

## 35. Publish the completed integration and review work

12 November 2026. **Work:** organize the changes into backend, frontend and documentation commits on `codex/planning-recovery-discovery`, based on merged PR #2. **Decision:** publish the tested branch while keeping its Vercel Git deployment disabled; keep real environment files and transient Google-content captures out of Git. **Lesson:** local credentials can hide clean-CI failures, so verification also ran on a fresh PostgreSQL database with provider credentials and optional features disabled. **Tradeoff:** source publication is reviewable independently of API/worker deployment and production configuration. **Evidence:** all migrations apply from empty, Alembic finds no schema drift, Ruff passes and 230 backend tests pass without credentials. Existing frontend verification passes 53 tests, TypeScript and production build. Configured-secret and credential-pattern scans found no matches in publishable files. Backend commit `3f19fe5`; frontend commit `97e24e2`; documentation records decisions, limitations and browser verification. No production deployment.

## 36. Review a conservative same-day delay

12 November 2026. **Work:** explicit readiness/location input, deterministic flexible-suffix adjustment and saved multi-item before/after review. **Decision:** preserve durations and gaps, protect commitments, reject midnight overflow and reconstruct the allowed candidate at acceptance. **Lesson:** explain the limits of a conservative algorithm without claiming every alternative is impossible. **Tradeoff:** no automatic gap compression, cross-day moves or provider revalidation. **Evidence:** 240 backend / 54 frontend tests, CI Python, Ruff and production build; desktop/phone acceptance and reload verified, temporary QA activities cleaned up. [Details and remaining scope](../day-delay-learning.md). Only learning documentation updated; no push or deployment.

## 37. Guard day-delay acceptance with explicit provider checks

13 November 2026. **Work:** optional affected-visit hours and unique connecting-route checks in saved day-delay reviews, with listing/date/mode/buffer selection. **Decision:** derive scope on the server; reject unknowns, conflicts and provider failures without applying changes or silently accepting provisionally. **Lesson:** validating only the first changed visit cannot cover a shifted schedule. **Tradeoff:** synchronous checks are bounded to six affected visits per action, with no trip-length limit; partial coverage is not approval. **Evidence:** 252 backend / 55 frontend tests, Ruff, TypeScript and production build; desktop/phone missing-location and explicit-opt-out checks. Successful all-mapped live browser acceptance remains unverified. [Details](../day-delay-live-checks-learning.md). Core design documents unchanged; no push or deployment.

## 38. Name the visit or journey blocking acceptance

13 November 2026. **Work:** typed transient failure context, named next-step feedback and a preflight list of missing map locations. **Decision:** resolve labels from the owned review and expose only safe reason enums; stop at the first failure and disclose unchecked remainder. **Lesson:** “hours not confirmed” is insufficient when several visits moved, and a preceding unmapped activity can block an incoming journey. **Tradeoff:** actionable first-failure feedback without retaining provider evidence or inventing automatic repairs. **Evidence:** 262 backend / 62 frontend tests, CI Python, Ruff and production build; desktop/phone named-coverage check, QA review discarded with timeline unchanged. [Details and limits](../day-check-feedback-learning.md). Learning docs only; no push or deployment.

## 39. Attach a location to the activity the traveler already made

13 November 2026. **Work:** existing-activity map attachment/change/removal inside the editor, with attributed discovery and explicit save/cancel. **Decision:** separate personal title from source identity; retain place/destination checks and clear outdated Google IDs when location changes. **Lesson:** requiring exact title/source-name equality turns a missing-location fix into destructive replacement work. **Tradeoff:** bounded nearby category search, without arbitrary-address coverage or automatic live verification. **Evidence:** 264 backend / 67 frontend tests, CI Python, Ruff, TypeScript and build; live 11-result discovery, desktop/phone cancel/save/reload/destination-change checks, temporary QA link removed. [Details](../activity-map-links-learning.md). Learning docs only; no push or deployment.

## 40. Return from a review warning without losing the delay inputs

13 November 2026. **Work:** direct missing-location actions from new and saved day-delay reviews, focused map editing and a scoped return reminder. **Decision:** edit current-draft records, preserve only the delay seed, wait for autosave and require fresh readiness/preview. **Lesson:** copying a candidate into the editor could accidentally apply proposed times while fixing a location. **Tradeoff:** in-session return state; frozen reviews remain independently pending/stale rather than being silently rewritten. **Evidence:** 72 frontend tests, TypeScript/build and desktop/phone cancel/save/continue flows; fresh review recognized the saved map link, QA data/reviews cleaned up. [Details](../delay-edit-handoff-learning.md). Backend/contracts unchanged; learning docs only; no push or deployment.

## 41. Rehearse live day acceptance without manufacturing a passing result

13 November 2026. **Work:** real Google venue/route checks on temporary mapped QA activities; fix the check-only date disappearing after form updates. **Decision:** keep access warnings and closed/unknown venues blocking; preserve explicit mode choice and pending candidates. **Lesson:** fitting hours and travel time do not establish route access, and a discovery record may have no current nearby Google match. **Tradeoff:** successful live acceptance remains unverified after bounded real-data attempts. **Evidence:** live 200 discovery/match responses, 201 proposals, structured 409 route/venue rejections; date persistence, 72 frontend tests, TypeScript/build and desktop/phone checks; QA day and prior pending list restored. [Full outcomes](../live-day-verification-learning.md). Learning docs only; no push or deployment.

## 42. Refine venue identity before assuming no match exists

13 November 2026. **Work:** destination-qualified Google queries, a ten-result bound, explicit alternate-name/address input, nearby distances and one shared picker across checks/reviews. **Decision:** retain the one-kilometre server identity guard and require explicit selection; keep queries/results out of saved plans. **Lesson:** filtering a three-result name-only search can discard the right nearby record; location bias itself is not a boundary. **Tradeoff:** better refinement within the existing map point, without silently moving venues or pretending discovery is exhaustive. **Evidence:** 273 backend / 73 frontend tests, CI Python, Ruff, TypeScript/build, live default/empty/refined matching and details handoff on desktop/phone; Cancel/reload preserved the QA activity. [Details](../place-matching-learning.md). Generated OpenAPI updated; core design docs unchanged; no push or deployment.

## 43. Add weather evidence before proposing weather-driven changes

14 November 2026. **Work:** bounded Open-Meteo adapter, public reference/date forecast endpoint and a read-only day-weather panel. **Decision:** use destination-local dates, keep distant/missing forecasts unknown, distinguish zero values, and expose source/retrieval/cache metadata. **Lesson:** a daily outlook is neither a forecast for an exact activity hour nor an itinerary feasibility verdict. **Tradeoff:** explicit checks and transient 15-minute caching before adding agent tools or automatic proposals. **Evidence:** 290 backend / 78 frontend tests, CI Python, Ruff, TypeScript/build; live and cached Jaipur forecasts, undated/out-of-window/unmapped states and desktop/phone navigation checks; itinerary unchanged. [Details and next scope](../day-weather-learning.md). Generated OpenAPI updated; main design docs untouched; no push or deployment.

### 44. Weather check to an explicit change request — 2026-11-14

Connected a usable day forecast to a traveler-selected removal request in chat. Preserved existing chat drafts and excluded protected, completed, unnamed and ambiguously named activities. No automatic sending or plan edits. This is the first UI bridge toward weather revisions; weather-aware proposal orchestration is still pending. Live forecast and desktop/phone handoff verified; 78 frontend tests, TypeScript and production build passed. No proposal was submitted during this QA. Decisions, limits and next checks: [weather change handoff learning](../weather-change-handoff-learning.md).

## 45. Bind a requested weather change to server-retrieved evidence

14 November 2026. **Work:** direct weather-related removal previews, typed server-retrieved forecast context, immutable review and acceptance-time validation. **Decision:** use an exact UUID command instead of a model for this explicit selection; preserve every other activity and trip setting; require planning lifecycle and a forecast younger than 15 minutes. **Lesson:** forecast evidence and the traveler's choice are distinct, and flexible check dates must not become schedule dates. **Trade-off:** opens time rather than inventing an indoor alternative; affected journeys remain provisional pending separate checks. **Evidence:** 309 backend tests on local/CI Python, Ruff, 79 frontend tests, TypeScript/build; live desktop/phone discard, acceptance, reload and history verified with temporary QA data. [Decisions, gaps and next slice](../weather-revision-learning.md). Supersedes entry 44's chat handoff. Generated OpenAPI updated; finalized design docs and landing untouched. No push or deployment.

## 46. Choose a replacement without inventing indoor suitability

14 November 2026. **Work:** museum/gallery discovery in the weather panel, typed single-place replacement proposals and optional Google hours/adjacent-journey guards. **Decision:** preserve the selected time slot, require a recent same-destination record, clear stale listing identity and keep indoor suitability unknown. **Lesson:** a category is not proof of shelter; explicit choices can use deterministic commands before conversational orchestration. **Trade-off:** provisional acceptance is explicit; complete remaining-day feasibility and successful real adjacent-route acceptance remain outstanding. **Evidence:** 320 backend tests on local/CI Python, Ruff, 80 frontend tests, TypeScript/build; live discovery, guarded single-visit acceptance, reload, desktop/phone checks and restoration of original QA snapshot. Also fixed retired-pool test connection cleanup and weather styles leaking into the review modal. [Details and next slice](../weather-replacement-learning.md). Learning docs/generated OpenAPI only; locked landing and finalized design docs unchanged. No push or deployment.

## 47. Let chat open the existing replacement chooser

14 November 2026. **Work:** structured replacement-intent/activity extraction, a persisted draft-bound chooser action, scope/staleness guards and focused handoff with explicit date/category. **Decision:** keep place choice and proposal acceptance in the existing validated flow; no second model-written edit path. **Lesson:** a useful conversational action can guide a traveler without inventing a venue or applying an edit. **Trade-off:** the chooser still handles forecast and place selection; duplicate labels and non-ISO dates need clarification. **Evidence:** 335 backend tests on local/CI Python, Ruff, 85 frontend tests, TypeScript/build; real Groq request, date/activity/category handoff, live discovery, preview/discard, reload recovery, wrong-day guard, unsent-note preservation and desktop/phone verification. [Details and remaining scope](../weather-chat-learning.md). Generated OpenAPI and learning docs updated; finalized design docs and locked landing untouched. No push or deployment.

## 48. Keep real replacement research inside the conversation

14 November 2026. **Work:** owned draft-bound research endpoint, forecast-first lookup, three-place proximity shortlist and inline chat selection using the shared weather proposal. **Decision:** show actual sources and distance basis; keep venue suitability unknown and preserve explicit review/acceptance. **Lesson:** chat can become more useful without asking a model to invent ranking facts or creating a second edit boundary. **Trade-off:** simple distance/name-diversity ordering; free-text “choose the first one”, richer preference evidence and active-trip scope remain future work. **Evidence:** 349 backend tests on local/CI Python, Ruff, 90 frontend tests, TypeScript/build; real gallery/museum results, forecast-window empty state, shared review recovery/discard, unchanged QA itinerary and desktop/phone/focus checks. [Details and next sequence](../chat-replacement-options-learning.md). Learning docs/generated OpenAPI updated; finalized design docs/locked landing untouched. No push or deployment.

## 49. Verify both connecting journeys before accepting a replacement

14 November 2026. **Work:** shared live-evidence checker, named single-change diagnostics, explicit visit/edge scope, missing-map feedback and bounded live-success confirmation. **Decision:** retain every provider warning/blocker and reuse the same preview/accept boundary. **Lesson:** scope-specific acceptance evidence is stronger than an enabled form; neighbor hours and complete-trip feasibility remain separate. **Trade-off:** live success covers one venue and two driving estimates, not walking or multi-visit day adjustment. **Evidence:** 352 backend tests on local/CI Python, Ruff, 93 frontend tests, TypeScript/build; real Amrapali replacement with both mapped adjacent journeys accepted as version 41, persisted on reload, then original snapshot 37 restored with exactly three temporary items removed. Also corrected a test's database row-order assumption without weakening field checks. [Full rehearsal, limits and next scope](../adjacent-journey-acceptance-learning.md). Learning docs only; locked landing/finalized design docs untouched; no push or deployment.

## 50. Confirm the starting context for remaining-day replanning

14 November 2026. **Work:** explicit accepted/draft readiness panel, owned read-only context/check endpoints, destination-local clock/offset and mapped current-location confirmation, preserved/protected/flexible/unresolved activity groups. **Decision:** do not infer completion, activate the trip or create a proposal from a readiness check; require fresh scoped context and base tokens. **Lesson:** native time-input changes needed input-event handling to keep submitted state aligned with the displayed value. **Trade-off:** bounded map discovery and conservative status/conflict gates; generation and current-location route checks are the next slice. **Evidence:** 362 backend tests on both Python environments, Ruff, 95 frontend tests, TypeScript/build; real accepted/draft browser reads, attributed Geoapify locations, stale-time rejection/recovery, unchanged QA itinerary and desktop/phone/keyboard checks. Positive readiness verified through API integration tests. [Details and limits](../remaining-day-readiness-learning.md). Learning docs/generated OpenAPI only; finalized design docs and locked landing untouched. No push or deployment.

## 51. Preview the remaining day with its initial journey

14 November 2026. **Work:** owned read-only timing endpoint, typed adapter and walk/drive preview from confirmed context. **Decision:** deterministic scheduling preserves order, durations and commitments; stop on warnings, stale bases, missing maps, midnight and clock-change dates. **Lesson:** provider lookup time must count by recalculating from the completion clock. **Trade-off:** six remaining visits per action, no hours/weather verification or proposal acceptance yet. **Evidence:** 371 backend tests on local/CI Python, 96 frontend tests, TypeScript/build, Ruff; live Google initial drive estimate of 9 minutes plus 10-minute buffer, desktop/phone preview and temporary QA draft cleanup verified after reload. [Details and next scope](../remaining-day-preview-learning.md). Learning docs/generated OpenAPI only; finalized documents/landing untouched. No push or deployment.

## 52. Freeze and explicitly accept remaining-day timing changes

14 November 2026. **Work:** idempotent save-proposal endpoint, existing review/history integration, frozen-candidate integrity validation and mandatory fresh-route acceptance including the first journey. **Decision:** no silent accepted/draft merge; pin both current pointers and draft sequence, retain reported context only on explicit save, acknowledge unverified hours/weather and current location. **Lesson:** rechecking routes is insufficient unless the resulting estimates fit the frozen candidate's actual gaps; never replace the proposal during acceptance. **Trade-off:** context and route timing can expire quickly; venue hours remain provisional. **Evidence:** 379 backend tests on local/CI Python, 97 frontend tests, TypeScript/build, Ruff; live 21:08→21:25 proposal accepted as version 43, reload/phone verified, then snapshot 42 restored with one temporary item removed and no route/settings changes. [Full decisions, limits and next slice](../remaining-day-proposal-learning.md). Learning docs/generated OpenAPI only; finalized documents/landing unchanged. No push or deployment.

## 53. Check every remaining visit's reported hours while keeping routes mandatory

14 November 2026. **Work:** optional all-remaining-visit Google hours checks, explicit starting-context display, scope-bound controls and named failure feedback. **Decision:** shared venue policy; check hours before mandatory initial/connecting routes, revalidate freshness and never fall back automatically. **Lesson:** a reopened acknowledgement needs the actual reported place/time, and near-midnight test conditions must be reported honestly. **Trade-off:** manual listing choice and transient provider facts; provisional hours remain an explicit choice. **Evidence:** 389 backend / 98 frontend tests, CI Python, Ruff, TypeScript/build; real Google match/hours/routes acceptance under a temporary fixed 13:30 clock, not a live midday traveler check. Normal clock restored and observed at 23:58; QA snapshot 44 restored as current 46, 11 accepted/draft activities verified. [Full verification and limits](../remaining-day-hours-learning.md). Learning docs/generated OpenAPI only; finalized documents/landing untouched. No push or deployment.

## 54. Hand conversational remaining-day requests to explicit confirmation

15 November 2026. **Work:** new typed intent, worker-persisted scope/token pointer, stale-message checks, guarded chat-to-planner action and one-time modal signal/focus return. **Decision:** chat never supplies a current time/location, infers completion or creates a proposal; the existing confirmation/preview/review path remains authoritative. **Lesson:** removing the originating chat button requires an explicit accessible focus destination, and old messages need both server and client scope checks. **Trade-off:** intent routing rather than autonomous replanning; existing conversation lifecycle/engine limits unchanged. **Evidence:** 394 backend / 100 frontend tests, CI Python, Ruff, TypeScript/build; real natural-language provider/worker handoff, reload/wrong-day/blank-input/phone/keyboard checks, accepted version 46 and both 11-activity plans unchanged, no proposal created. [Details and next sequence](../remaining-day-chat-learning.md). Learning docs/generated OpenAPI only; finalized documents/landing untouched. No push or deployment.

## 55. Resolve unresolved readiness items without inferring completion

15 November 2026. **Work:** guarded draft-only status/timing editor actions, status focus, autosave-aware return reminder and explicit accepted-to-draft switch. **Decision:** resolve only current matching draft records; preserve flags, never copy snapshot fields or retain an old clock/location report. **Lesson:** cancel/save needs a focused return path, and a short visible action still needs an activity-specific accessible name. **Trade-off:** explicit manual status/timing decisions rather than bulk completion or new progress states; accepted snapshots still change through review. **Evidence:** 105 frontend tests, TypeScript/build; live cancel/no-change, explicit completion/autosave/fresh check, accepted guard, phone/keyboard verification; QA cleanup confirmed accepted version 46 and both 11-activity plans unchanged. [Full evidence and next scope](../readiness-status-recovery-learning.md). Frontend and learning docs only; backend/contracts, finalized documents and landing unchanged. No push or deployment.

## 56. Define active-trip conversation permissions explicitly

15 November 2026. **Work:** read-only active chat/handoff, planning-only agent generation, closed-trip admission, lifecycle/revision fences and stale agent review guards. **Correction:** earlier learning notes incorrectly described a general planning-only chat gate as existing; inspection found it absent, and this slice adds the policy. **Decision:** preserve guarded user remaining-day proposals while active, with no broad model-generated edits. **Trade-off:** conservative revision invalidation and intentionally limited active chat. **Evidence:** 416 backend tests on local/CI Python, 22 new policy cases, 105 frontend tests, TypeScript/build; real model handoff, edit refusal and direct generation guard verified at desktop/phone widths. QA trip restored to planning with accepted version 46 and 11/11 activities unchanged. [Policy, lessons and next slice](../active-trip-chat-policy-learning.md). Finalized docs/locked landing unchanged; no push or deployment.

## 57. Show the trip mode before offering planning actions

15 November 2026. **Work:** server lifecycle carried through account load/autosave, workspace status strip, planning-only generation entry, active fresh-day emphasis and lifecycle-aware chat prompts/composer. **Decision:** derive capabilities from account metadata; unknown values fail closed; retain history and unsent messages. **Lesson:** server restrictions need visible navigation cues, and autosave must preserve non-editable account metadata. **Trade-off:** no automatic transition or cross-tab lifecycle push; manual editing remains outside this slice. **Evidence:** 108 frontend tests, TypeScript/build and real API desktop/390×844 checks for planning, active and completed states. QA restored to planning with 11/11 activities unchanged. [Details and next step](../lifecycle-workspace-learning.md). Backend/finalized docs/locked landing unchanged. No push or deployment.

## 58. Start, finish and resume a trip deliberately

15 November 2026. **Work:** explicit lifecycle confirmations, metadata-only conditional updates/refresh, accepted-plan start prerequisite and editor/saving safeguards. **Decision:** status changes never accept drafts or complete activities; require refresh after stale or uncertain requests. **Lesson:** metadata refresh can resolve cross-tab conflict without replacing a traveler’s local draft. **Trade-off:** limited start/finish/resume UI rather than archive management or a full transition state machine. **Evidence:** 419 backend tests on local/CI Python, 109 frontend tests, TypeScript/build, real two-tab conflict recovery and desktop/phone start/finish/resume/cancel/focus checks. QA restored to planning with accepted version 46 and 11/11 activities unchanged. [Details and next sequence](../trip-lifecycle-controls-learning.md). Finalized docs/locked landing untouched. No push or deployment.

## 59. Guide missed and ongoing activities without false completion

15 November 2026. **Work:** unresolved draft activity recovery choices, intent-specific editor focus/guidance and reuse of the fresh-check return flow. **Decision:** answers navigate to explicit edits, never persist invented skipped/ongoing states or silently mark completion. **Lesson:** ongoing duration is total time from the original start; a missed item needs deliberate rescheduling/removal. **Trade-off:** this is guided draft correction, not an execution-history model. **Evidence:** 109 frontend tests, TypeScript/build; real active-trip API/browser checks for all three focus paths, unchecked completion, keyboard radios, phone layout, cancellation and expired-context rejection. QA restored with all 22 accepted/draft activity rows exactly unchanged. [Details and next sequence](../activity-recovery-learning.md). Backend/finalized docs/locked landing unchanged. No push or deployment.

## 60. Review saved recovery corrections and recheck the accepted day

15 November 2026. **Work:** draft-versus-accepted reminder states, direct full-draft review, exact accepted-proposal recognition and fresh accepted-day confirmation. **Decision:** no inferred acceptance from closing/discarding or unrelated proposals; no old traveler report carries forward. **Lesson:** live testing exposed a stale autosave reference after lifecycle changes; load-generation refresh now rebuilds that queue with current metadata. **Trade-off:** the reminder remains session-local and full-draft review can include other saved edits. **Evidence:** 112 frontend tests, TypeScript/build; real active-trip save/review/discard/accept and desktop/phone checks. QA restored to planning and accepted version 49 with 11/11 baseline-matching activities; test review history retained. [Details and next sequence](../recovery-review-handoff-learning.md). Backend/finalized docs/locked landing unchanged. No push or deployment.

## 61. Restore version-bound recovery navigation after reload

15 November 2026. **Work:** tab-scoped allowlisted recovery pointers bound after autosave, verified-account restore, revision/scope/age guards and sign-out/new-trip cleanup. **Decision:** persist no time, location, report or activity content, and never auto-open a dialog. **Lesson:** a reload during acceptance must not infer success from a changed accepted pointer. **Trade-off:** interrupted acceptance can lose the reminder while the server plan/history remain available. **Evidence:** 118 frontend tests, TypeScript/build, real saved/accepted reminder reload and phone fresh-context/consumption checks. QA restored to planning and accepted version 52 with 11/11 baseline-matching activities. [Details and next sequence](../recovery-reload-learning.md). Backend/finalized docs/locked landing unchanged. No push or deployment.

## 62. Reconcile interrupted reviews with server receipts

15 November 2026. **Work:** capture exact draft-review IDs, resume pending proposals by GET, recognize accepted receipts after interrupted client handoff and bound trip-refresh reconciliation. **Decision:** reload never submits or accepts; mismatched or unavailable evidence cannot imply success. **Lesson:** an acceptance can commit between the trip and proposal reads, requiring one consistent trip refresh. **Trade-off:** an uncaptured creation response still needs pending-review history, and outages can fall back to normal navigation. **Evidence:** 124 frontend tests, TypeScript/build; live pending reload/resume with unchanged proposal count, immediate acceptance reload, phone fresh-context check and baseline restoration. QA remains planning with accepted version 55 and 11/11 baseline-matching activities. [Details and next sequence](../recovery-receipt-learning.md). Backend/finalized docs/locked landing unchanged. No push or deployment.

## 63. Retry receipt reads and clear discarded navigation immediately

15 November 2026. **Work:** explicit read-only review-status check/retry, cancellation timeouts, late-response guards and matching discard cleanup. **Decision:** never resubmit/accept through retry; preserve draft corrections when discarding their proposal. **Lesson:** disabling the loading button drops focus, so restore it only when the user has not moved elsewhere. **Trade-off:** unknown proposal IDs still need history; live outage/account-switch testing remains outside this QA. **Evidence:** 128 frontend tests, TypeScript/build; real pending-status check with unchanged proposal count, focus restoration, immediate phone discard cleanup and reload. QA accepted version 55 unchanged, 11/11 baseline-matching activities, test review discarded. [Details and next sequence](../recovery-status-retry-learning.md). Backend/finalized docs/locked landing unchanged. No push or deployment.

## 64. Audit core gaps and preserve strict budget intent

15 November 2026. **Work:** core-workflow gap audit, explicit target/strict budget UI and adapter round-trip preservation, honest estimate-versus-budget summaries. **Decision:** retain the backend's strict-cost blocker until complete cost evidence exists. **Lesson:** the previous adapter silently converted strict budgets to target during unrelated saves. **Trade-off:** strict drafts are saveable but currently not acceptable; this does not deliver a complete expense ledger. **Evidence:** 420 backend tests on local/CI Python, 131 frontend tests, TypeScript/build and real desktop/phone strict reload/blocker/explicit-target checks. Entire QA draft restored against baseline; accepted version 55 unchanged. [Budget learning](../budget-policy-learning.md), [workflow audit and next functional slice](../core-workflow-audit-learning.md). Finalized docs/locked landing unchanged. No push or deployment.

## 65. Expose snapshot cost coverage without inventing a complete ledger

15 November 2026. **Work:** owned version budget endpoint, exact allowance projection and shared creation/proposal coverage disclosure. **Decision:** unit-aware stay/leg estimates only; complete total and paid amounts remain unknown. **Lesson:** zero rates and absent quantities are different, and frozen review costs must not follow later draft edits. **Trade-off:** editable cost items and paid commitments remain future ledger work; strict acceptance stays blocked. **Evidence:** 427 backend tests on local/CI Python, 135 frontend tests, TypeScript/build, real saved/frozen allowance checks and desktop/phone layout verification. Entire QA draft restored to baseline; accepted version 55 unchanged. [Details and next slice](../cost-coverage-learning.md). Generated OpenAPI/learning notes updated; finalized docs/locked landing unchanged. No push or deployment.

## 66. Record meals, other costs and payments without claiming a complete ledger

15 November 2026. **Work:** typed version-owned meal/other cost records (unit amount, per-person/group basis, quantity, estimate/paid), creation-step editor, coverage records with a separate recorded-paid subtotal. **Decision:** store unlinked records in validated plan preferences so they freeze into reviews and copy across revisions through the existing plan path; defer the normalized `cost_item` table to linked costs. **Lesson:** a half-typed record must never reach autosave; commit only validated records from a separate form. **Trade-off:** no linked costs, taxes or conversion; complete total/paid remain unknown; strict acceptance stays blocked. **Evidence:** backend coverage tests (4 new) and Ruff; 141 frontend tests, TypeScript/build; on-device browser checks of validation, exact totals, paid-removal warning, focus return and desktop/phone layout (fixed a stacked-radio phone defect). The signed-in account path is covered by API/adapter tests rather than a browser session. Also fixed an import-order Ruff failure in `app/main.py`; regenerated OpenAPI paths reorder accordingly. [Details](../cost-records-learning.md). Finalized docs/locked landing untouched. No push or deployment.

## 67. Link costs to activities and stays without losing payments

15 November 2026. **Work:** `cost_item` table (migration 0020, applied to Supabase with browser-role grants revoked), top-level plan `costs`, explicit `cost.replace_records` command, activity/stay links, coverage link labels and an editor link picker. **Decision:** when a linked item leaves the plan, its estimate goes but a paid cost stays unlinked and flagged; one pure rule runs in plan validation and on every version write path. Links use logical IDs because schedule rows are rewritten on each sync. **Lesson:** a write path that omits costs must reuse and reconcile the existing ones, or a route edit silently drops payments. **Trade-off:** no leg-level links, per-item currency, conversion or taxes; strict acceptance stays blocked. **Evidence:** 13 cost tests on Supabase, 142 frontend tests, TypeScript/build, on-device link/removal browser check. [Details](../linked-costs-learning.md). The learning note records the deviation from the finalized design; finalized docs untouched. No push or deployment.

## 68. Link costs to intercity journeys

15 November 2026. **Work:** journey (leg) links on costs using the existing travel-budget keys, one shared server key builder, migration 0021 (applied to Supabase, no browser grants), a "Journeys" group in the editor and coverage labels. **Decision:** draft commands apply settings first and always resync, so a settings-only change of starting point or return reconciles journey-linked costs on the server. **Lesson:** keys built in two places must come from one function; the coverage refactor kept every existing key test green. **Trade-off:** renaming the starting point creates new journey keys, as travel budgets already do; currency, conversion and taxes remain. **Evidence:** 15 cost tests on Supabase including a settings-only origin change; 143 frontend tests, TypeScript/build. [Details](../linked-costs-learning.md). No push or deployment.

## 69. Record costs in their own currency without guessing rates

15 November 2026. **Work:** per-cost currency, traveler-entered rate with source/date, migration 0022 (applied to Supabase, no browser grants), exact half-up conversion on server and client, original/converted display in editor and coverage. **Decision:** no rate provider; a foreign amount without a rate stays unknown in display totals even when paid. **Lesson:** "paid" and "known in display currency" are separate facts, so coverage reports the entered status apart from the display status. **Trade-off:** rates are manual and can go stale; taxes/fees and strict feasibility remain. **Evidence:** 17 cost tests on Supabase, 145 frontend tests, TypeScript/build, on-device browser check. [Details](../linked-costs-learning.md). No push or deployment.

## 70. Record taxes and fees without assuming zero

15 November 2026. **Work:** per-cost tax status (included / not included / unknown) with an optional percentage, a Taxes & fees category, migration 0023 (applied to Supabase, no browser grants), exact half-up tax on server and client, editor and coverage disclosure of unknown tax. **Decision:** tax is added in the cost's own currency before conversion; unknown tax flags the entry instead of counting as zero. **Trade-off:** a single percentage per cost, not compound or per-unit fees; strict feasibility still blocked. **Evidence:** 19 cost tests on Supabase, 146 frontend tests, TypeScript/build. [Details](../linked-costs-learning.md). No push or deployment.

## 71. Check strict budgets only against complete, confirmed entries

15 November 2026. **Work:** coverage completeness with a plain-language missing list, a never-inferred "every cost entered" confirmation, a complete total, and strict validation outcomes (unverified / exceeded / within limit as an acknowledgeable advisory). **Decision:** a passing strict check must be acknowledged as based on the traveler's own entries and rates, not live prices. **Lesson:** completeness needs both detectable facts and an explicit statement; the statement cannot override a detectable gap. **Trade-off:** no live price evidence; paid total still unknown. **Evidence:** pure boundary tests, end-to-end acceptance and exceeded refusal on Supabase, 148 frontend tests, TypeScript/build. [Details](../strict-budget-check-learning.md). No migration, push or deployment.

## 72. Lighten the remaining day for a tired traveler

15 November 2026. **Work:** explicit "rest here first" and "skip for today" choices in the remaining-day flow, frozen in the proposal and re-checked at acceptance, with a fatigue acknowledgement naming skipped items and stating that nothing is cancelled or refunded. **Decision:** extend the guarded remaining-day pipeline rather than add a new edit path; the app never chooses what to drop. **Lesson:** linked costs exposed that candidate builders removing activities by bare model copy skipped reconciliation; `apply_remaining` and `remove_activity` now re-validate. **Trade-off:** single day, traveler-chosen skips only, no automatic suggestions. **Evidence:** end-to-end rest/skip acceptance with cost survival on Supabase, guard and regression tests, 149 frontend tests, TypeScript/build. [Details](../tired-traveler-learning.md). No migration, push or deployment.

## 73. Move nights between stays without silent changes

15 November 2026. **Work:** draft-only previewed endpoint and route-panel control to move nights between stays or the trip length, with explicit drops for displaced flexible activities and blocks for protected ones. **Decision:** reuse draft precondition and the existing review/accept boundary; costs follow the existing removal rule. **Lesson:** an apply path must not abort its own request controller or the busy state never clears. **Trade-off:** dated stops refused; activities are dropped, not relocated. **Evidence:** pure and Supabase endpoint tests, 153 frontend tests, signed-in browser preview/block/apply/undo on a real trip restored exactly to baseline. Built alongside a concurrent Codex QA session; production build currently blocked by that session's in-progress ProposalReview changes. [Details](../stay-rebalance-learning.md). No migration, push or deployment.

## 74. Move displaced activities to a remaining day instead of dropping them

15 November 2026. **Work:** per-activity drop-or-move choices when a shorter stay removes days; moves stay within the same stay at the same time, and overlaps on the new day are blocked with the exact clash. **Decision:** same-stay moves only, so map places and linked costs stay valid. **Trade-off:** no re-timing or cross-stay moves yet. **Evidence:** pure and Supabase tests, 154 frontend tests, signed-in browser move/overlap preview on a real trip verified unchanged. [Details](../stay-rebalance-learning.md). No migration, push or deployment.

## 75. Let a moved activity take a new time

15 November 2026. **Work:** optional new start time when moving a displaced activity; overlap and past-midnight results come back as plain-language decisions. **Lesson:** the real trip caught a second clash (Free time) that a single-activity mental check missed, so the exact clash list matters. **Evidence:** 7 rebalance tests, 155 frontend tests, signed-in browser clash/success/midnight previews on a trip verified unchanged. [Details](../stay-rebalance-learning.md). No migration, push or deployment.

## 76. Move a displaced activity to another stay

15 November 2026. **Work:** cross-stay moves for displaced activities with a chosen day and time; the old destination's map links are cleared and stated in the preview, while linked costs stay attached. **Decision:** never carry a mapped place to another city. **Lesson:** labels must not claim a consequence that only sometimes applies. **Evidence:** 8 rebalance tests, 156 frontend tests, signed-in browser cross-stay preview on a trip verified unchanged. [Details](../stay-rebalance-learning.md). No migration, push or deployment.

## 77. Show and carry over journeys a route change removes

15 November 2026. **Work:** route-step panel listing journeys a reorder or removal orphaned, with their mode, budget, estimates and payments, and an explicit carry-over to a new journey that moves details and linked costs once. **Decision:** client-side and pure; the server's removal rule remains the fallback for anything left. **Lesson:** endpoint-keyed journeys make reorders silently orphan entered data; surfacing it at the moment of change is cheaper than inferring intent later. **Evidence:** 159 frontend tests and an incognito on-device browser swap/carry check; no account data touched. [Details](../journey-impact-learning.md). No backend change, migration, push or deployment.

## Independent review follow-up: concurrent T3 work

16 November 2026. Fixed four independently reproduced integration gaps: protected calendar dates after stay rebalancing (including overnight travel), skipped records in client remaining-day guards, free-time availability around skipped historical cards, and hours/overnight-only journey carry-over disclosure. Added regressions covering refusal without draft mutation and valid unchanged-date changes. See [review and fix details](../claude-t3-review-2026-11-16.md). No migrations, environment changes, push or deployment.

## 78. Reconcile parallel work and connect persistent missed outcomes to recovery

16 November 2026. **Audit:** current source includes cost ledger/currency/tax/strict-entry checks, fatigue/rest choices, stay rebalancing and cross-stay moves, journey carry-over, skipped outcomes and the independent integration fixes. Most work remains uncommitted; per-line authorship is not inferred. **Work:** missed recovery now focuses the explicit unchecked skipped outcome; guard rejects already skipped/mismatched outcomes. Also preserved trip URLs after failed loads and clarified signing-key-provider failures. **Decision:** reuse the editor and persistence boundary; no automatic outcome, cancellation or refund. **Evidence:** 477 backend tests on a separate migrated disposable DB, 167 frontend tests, TypeScript/build, Ruff, schema drift/whitespace checks. Isolated browser component checks passed at phone width; real account verification is blocked by Supabase JWKS TLS EOF, with no auth/TLS bypass. Temporary harness removed; no account writes. [Combined inventory, evidence and remaining steps](../parallel-work-reconciliation-2026-11-16.md). Finalized docs/locked landing unchanged. No push or deployment.

## 79. Choose a map location after a cross-stay move

16 November 2026. **Work:** structured rebalance callback and a multi-activity navigation panel opening the current editor at the new destination's map controls. **Decision:** no replacement place inference or snapshot copying; preview alone creates no handoff. **Lesson:** a long apply message needs a direct activity/day action, and actions must resolve current records after saving. **Trade-off:** reminder is session-local; saved links themselves persist normally. **Evidence:** 171 frontend tests, TypeScript/build and signed-in apply/cancel/relink at desktop/phone widths. Supabase signing-key access was available again. Entire dedicated QA draft restored exactly; accepted pointer unchanged. [Details and limits](../cross-stay-map-handoff-learning.md). Backend/finalized docs/locked landing unchanged. No push or deployment.

## 80. Show recorded activity outcomes after a trip

16 November 2026. Added a completed-trip recap counting completed, skipped and still-planned activities from the editable draft, explicitly labeled as draft data. Finishing does not infer outcomes or cancel reservations. Frontend tests, TypeScript and production build passed; a later signed-in browser check verified autosave, reload and distinction from the accepted plan. No backend or finalized-document changes, push or deployment.

## 81. Keep location reminders through later stay changes

16 November 2026. Verified the outcome recap and cross-stay reminder reload in a real signed-in browser. Preserved unresolved map reminders when a subsequent stay adjustment has no moved activities, and merged additional or repeatedly moved activities by ID. Corrected the displacement instruction to describe moves to any remaining route day. 174 frontend tests, typecheck/build, 14 stay-rebalance tests and Ruff passed. Browser checks covered an applied move, reload and editor handoff, then a second stay adjustment followed by reload; the dedicated QA draft was restored exactly. Reminders remain temporary and tab-scoped. [Details](../map-reminder-reload-learning.md). No push or deployment.

## 82. Preserve the chosen time in stay-change previews

16 November 2026. Reproduced a browser input mismatch where a displayed 12:00 move previewed the original 09:00. Synchronized the time field's input event and prevented empty values from silently falling back. Signed-in browser verification covered blank validation, a 12:00 preview and saved move, followed by exact QA baseline restoration. 174 frontend tests and typecheck passed; [details](../stay-move-time-learning.md). No backend or finalized-document changes, push or deployment.

## 83. Verify missed-activity recovery and clarify counts

16 November 2026. Signed-in saved-draft readiness → missed outcome → autosave → fresh readiness succeeded; a fictitious paid cost stayed linked. Found day, destination and trip summaries counted missed items as planned, so they now distinguish planned, completed and missed records. Browser verified mixed counts and the QA trip was restored exactly. The readiness walkthrough used a planning trip, not an active lifecycle. 175 frontend tests and typecheck passed; [details](../recovery-outcome-counts-learning.md). No push or deployment.

## 84. Verify active recovery and follow later same-stay moves

16 November 2026. Verified the missed-outcome recovery flow in a signed-in active QA trip with an accepted plan. Fresh readiness recognized the saved missed outcome; the accepted plan stayed unchanged. Removed test records and restored both plan baselines and completed status; lifecycle transitions can stale earlier agent work. Then updated map reminders to follow matching applied moves within a stay and clear explicitly dropped items. Automated checks cover the handoff; the full successive-move browser case remains unverified. [Recovery evidence](../recovery-outcome-counts-learning.md), [reminder details](../map-reminder-reload-learning.md). No push or deployment.

## 85. Keep map reminders aligned with saved manual edits

16 November 2026. Signed-in browser verification confirmed a cross-stay move followed by a same-stay move and reload kept the reminder on the new day. Added reconciliation after successful account autosave so later manual editor moves follow current activity records; deleted or resolved records clear their reminders. A second signed-in walkthrough verified editor move, save, reload and removal. QA records matched their original values by activity ID; returned ordering changed. The QA booking flag was temporarily cleared and restored to permit the first walkthrough; no reservation was cancelled. 177 frontend tests and typecheck passed. [Details](../map-reminder-reload-learning.md). No push or deployment.

## 86. Recover an interrupted draft review

16 November 2026. Added a 15-second bound covering session lookup and review submission, preventing a late request after session timeout. An interrupted review now offers same-request retry and a direct read-only pending-review list. Signed-in browser testing used a brief local backend shutdown and confirmed the connection message and pending-list recovery without changing the QA trip. 180 frontend tests, typecheck and production build passed. [Details and limits](../review-submission-recovery-learning.md). No push or deployment.

## 87. Reopen an interrupted review without a new request identity

16 November 2026. Kept the pending draft-review idempotency key in tab storage for the same trip and saved-draft version, with expiry and matching-response cleanup. This allows a reopened review to recover the original server result after an uncertain response. Also labeled missed activities in the review. Signed-in browser testing covered service interruption, reload, successful review and discard; the QA draft matched baseline by activity ID. 182 frontend tests and typecheck passed; [details and limitations](../review-retry-reopen-learning.md). No push or deployment.

## 88. Exercise a response lost after review saving

17 November 2026. Added an automated client integration scenario combining the submission adapter and retry-storage helper with simulated idempotent server receipts. Saving succeeds before the response fails; reopening recovers the same pending review with one receipt, then clears the matching retry key. All 183 frontend tests pass. This is simulated failure coverage, not a live browser/backend reproduction. No production code, trip data, push or deployment changed. [Details](../review-retry-reopen-learning.md).

## 89. Focus the timeline on remaining activities

17 November 2026. Added a presentation-only control to hide completed and missed cards while preserving calculated free-time gaps and all saved records. 184 frontend tests and production build pass. Browser and phone checks remain outstanding. [Details](../recorded-outcome-visibility-learning.md). No push or deployment.

## 90. Verify timeline outcome visibility on phones

17 November 2026. Verified hiding/restoring missed records in the signed-in workspace, preserving planned cards and gaps. Phone QA found inherited column layout on the checkbox; corrected to a 44px inline row, confirmed in the browser, and fixed singular record wording. No horizontal overflow or account writes. Production build passed; final adjustment was CSS-only. [Details](../recorded-outcome-visibility-learning.md). No push or deployment.

## 91. Verify rest and skip workflow in the live browser

17 November 2026. Recorded the user's standing browser/workflow verification preference in root AGENTS.md. Signed-in fatigue walkthrough covered fresh readiness, explicit rest, timing preview, saved review/acknowledgment, discard and explicit skip preview. QA activity restored and baseline matched by ID. Same-location context meant no external route call; acceptance was not performed. [Details](../tired-traveler-learning.md). No push or deployment.

## 92. Accept a fatigue proposal in the live app

17 November 2026. Resumed dedicated QA trip, explicitly skipped a disposable future activity with 30-minute rest, saved and acknowledged its review, accepted and reloaded. Empty day persisted. Full draft and accepted plan matched baseline by logical activity ID; completed lifecycle restored. New accepted version 7 remains in QA history. All-skipped case required no provider route call; linked-cost retention and different-location acceptance remain unverified live. [Evidence](../tired-traveler-learning.md). No push or deployment.

## 93. Rehearse fatigue with a real different-location route

17 November 2026. Retrieved a distinct starting place, previewed walking plus rest with Google route estimates, saved the review and attempted explicit acceptance. Fresh context/routes guard rejected it; exact cause was hidden by generic feedback. Review discarded, QA draft/accepted baseline values restored and completed lifecycle restored. Accepted version 7 unchanged. [Evidence and limits](../tired-traveler-learning.md). No push or deployment.

## 94. Explain remaining-day conflicts

18 November 2026. Readiness, preview, proposal saving and acceptance now share guidance for remaining-day errors. A signed-in browser check on desktop and at 390px confirmed the live scheduled-date conflict and its recovery instructions. The check did not mutate the QA trip. Automated tests cover distinct acceptance failure messages. Live acceptance with a different starting location remains open.

## 95. Accept a remaining-day review with a live walking route

18 November 2026. In the signed-in browser, used two distinct mapped San Francisco museums, a 30-minute rest and a live Google walking estimate. The draft visit moved from 13:20 to 13:46 after explicit acceptance and successful route recheck. Restored and verified both draft and latest accepted contents against the original QA plan. The trip remains in planning, with two new accepted snapshots in QA history. Venue hours and weather were outside this check.

## 96. Cover venue-hours gating in remaining-day acceptance

18 November 2026. Added a backend integration test with simulated provider responses. A reported closure keeps the review pending and prevents route rechecks or plan acceptance. When reported hours fit, the same review checks the candidate visit times and rechecks routes before accepting. The focused test and Ruff passed. Live browser coverage for the optional hours check remains open.

## 97. Verify the remaining-day hours check in the browser

18 November 2026. A signed-in QA walkthrough enabled optional venue hours and requested a matching listing for the Asian Art Museum. Google Places rejected the backend key. The UI explained the access error and required a matching listing before the checked acceptance could proceed. Discarded the review and restored the saved QA activity to day 1 at 18:00. Live hours acceptance still depends on Places access.

## 98. Isolate the Places access rejection

18 November 2026. Reproduced HTTP 403 directly from the backend host using the configured Places key and a minimal Text Search request. Google supplied a generic access-denied reason without a specific restriction. Documented the separate Places and Routes credentials and the Cloud configuration checks in the [learning notes](../tired-traveler-learning.md).

## 99. Reject a reviewed schedule when a fresh route no longer fits

18 November 2026. Added an acceptance regression case where the simulated route grows by one minute after the proposal is saved. The focused integration run confirmed the expiry response, pending review, unchanged draft times and no accepted snapshot. Ruff passed. A broader rerun could not start because the Supabase pooler hostname failed DNS resolution.

## 100. Verify the backend suite on isolated PostgreSQL

18 November 2026. A hosted database connection dropped during the acceptance suite. Initialized disposable PostgreSQL 17 clusters with private Unix sockets, applied the current migrations and ran the tests with a command-scoped database URL. All 12 remaining-day proposal tests and all 479 backend tests passed locally, as did all 185 frontend tests. This verifies application and database behavior under the fixtures. The live Places access rejection remains open.

## 101. Make isolated backend verification repeatable

18 November 2026. Added [scripts/test-backend-local.sh](../../scripts/test-backend-local.sh). It starts a fresh PostgreSQL instance on a private Unix socket, applies migrations, passes arguments through to pytest, and removes the temporary cluster on exit. The local database URL is scoped to the command, so the configured Supabase URL can stay in place. Run `scripts/test-backend-local.sh -q` from the repo root. It needs `uv` and PostgreSQL binaries on PATH, or `PG_BIN` set to the PostgreSQL bin directory. Verified all 479 backend tests through the script.

## 102. Check migration drift in the local test runner

18 November 2026. After applying migrations to the disposable PostgreSQL instance, the local runner now checks for missing migration operations before running tests, matching the schema check in GitHub Actions. Alembic detected no drift and all 479 backend tests passed.

## 103. Run the full local checks with one command

18 November 2026. Added `make check-local` for backend lint, migration verification and tests on disposable PostgreSQL, followed by the existing frontend checks. Verified all 479 backend tests, all 185 frontend tests, type checking and the production build. A deliberate invalid pytest path also confirmed that the runner preserves pytest's exit code and removes its temporary cluster on failure.

## 104. Keep the generated OpenAPI schema in sync

18 November 2026. Compared the checked-in API snapshot with FastAPI's generated schema. All routes matched, and the only difference was the Relocation schema description. Synced the description and added a test that detects future snapshot drift. The focused test and Ruff passed.

## 105. Verify the contract check in the full local workflow

18 November 2026. Ran `make check-local` after adding the OpenAPI snapshot assertion. All 480 backend and 185 frontend tests passed, along with lint, migration drift detection, type checking and the production build. The API snapshot check now runs as part of the existing backend test command in CI.

## 106. Verify hours checks stay tied to the reviewed route

18 November 2026. Extended coverage for optional hours acceptance. A request with a different arrival buffer than the reviewed route is rejected before either provider is called. The original review can still be accepted after the matching context and evidence are supplied. All 12 remaining-day proposal tests passed on disposable PostgreSQL, and Ruff passed.

## 107. Reject incomplete listing coverage

18 November 2026. The remaining-day integration test now verifies that enabling venue hours requires a matching listing for every remaining visit. A partial listing map is rejected before either provider is called. All 12 remaining-day proposal tests and Ruff passed.

## 108. Bind venue hours to the reviewed date

18 November 2026. Verified that remaining-day acceptance rejects an hours check for a different date before either provider is called. The original review remains available for the correct date. All 12 remaining-day proposal tests and Ruff passed.

## 109. Distinguish provider access failures from reported closures

18 November 2026. Added integration coverage for a Places access rejection during the optional remaining-day hours check. The API returns a provider error for the affected visit and stops before rechecking routes. The test also covers reported closure and successful retry. All 12 remaining-day proposal tests and Ruff passed.

## 110. Keep local verification on locked dependencies

18 November 2026. The isolated backend runner now uses the checked-in Python lockfile for migration, schema verification and tests. Alembic found no drift and all 480 backend tests passed.

## 111. Make API snapshot regeneration repeatable

18 November 2026. Added `make openapi` and pointed the snapshot regression test to it. Running the command reproduced the existing generated file byte for byte, and the snapshot test passed.

## 112. Cover a missing route at acceptance

18 November 2026. Simulated Google returning no route after a proposal was saved. Acceptance returned a route-unavailable error and kept the proposal pending without creating an accepted snapshot. The suite also checks the distinct codes for route warnings and stale time. All 13 remaining-day proposal tests and Ruff passed.

## 113. Preserve reviewed times when a renewed route still fits

18 November 2026. The acceptance test now simulates a route becoming one minute shorter after review. The reviewed start times still apply. Retrying the successful acceptance with the same request key returns the same result without another route request. All 13 remaining-day proposal tests passed.

## 114. Preserve an existing accepted plan when hours checks fail

18 November 2026. The hours-gating integration test now begins with an accepted itinerary. A closure leaves that accepted snapshot selected, keeps draft start times intact and preserves the pending review. The test checks the date, start and duration sent for each visit before allowing acceptance on a successful retry. All 13 remaining-day proposal tests passed.

## 115. Verify hours acceptance on an active trip

18 November 2026. The hours integration scenario now starts an already accepted trip through the lifecycle API. It verifies that failed hours checks preserve the accepted version and draft, and that successful acceptance leaves the trip active. All 13 remaining-day proposal tests passed with simulated provider responses.

## 116. Verify active-trip acceptance across the backend suite

18 November 2026. Verified that a successful hours-enabled retry writes the reviewed times to both the editable draft and accepted snapshot while keeping the trip active. The complete suite passed all 481 tests on disposable PostgreSQL. Alembic found no schema drift. The active-trip hours test uses simulated providers, and live hours acceptance remains open.

## 117. Check the upgrade from the committed schema

18 November 2026. Applied migrations through the committed revision `0019_google_place_ids` on disposable PostgreSQL, verified that revision, then upgraded to the worktree head `0024_activity_skipped`. Alembic found no schema drift. This was a schema-only rehearsal with an empty database. It did not exercise migration of existing rows or touch hosted data.

## 118. Rehearse the upgrade with existing activity data

18 November 2026. Seeded a synthetic trip and two legacy activity rows at revision `0019_google_place_ids`, then applied migrations through `0024_activity_skipped`. Both activity IDs, labels, start times, durations and completion states survived. Both rows defaulted to `skipped=false` and PostgreSQL rejected a completed-and-skipped update. Alembic found no drift. The rehearsal used a disposable database.

## 119. Preserve legacy costs on accepted plans

18 November 2026. Found that migration 0020's legacy JSON conversion updates plan preferences, which the accepted-plan trigger would reject. The migration now disables and reenables that specific trigger inside the migration transaction when rows need conversion. A disposable PostgreSQL rehearsal preserved an accepted plan, its pace preference and exact paid amount, verified the unknown-tax default, and confirmed the trigger was enabled after migration. All 481 backend tests passed.

## 120. Preserve explicit zero during legacy cost migration

18 November 2026. Migration 0020 now converts an empty amount to NULL while preserving numeric zero. A disposable PostgreSQL upgrade from revision 0019 verified that an accepted plan's zero paid record and unknown estimate survived as separate values. Ruff passed for the migration.

## 121. Automate the legacy cost upgrade regression check

18 November 2026. Added a PostgreSQL integration test that upgrades a synthetic accepted plan from revision 0019 to head in a temporary schema rolled back at the end. It checks logical cost IDs, paid zero, unknown estimate, preserved plan preferences and the reenabled snapshot guard. All 482 backend tests passed.

## 122. Verify the accepted-plan guard after migration

18 November 2026. The legacy cost migration regression test now attempts to update an accepted plan after upgrade and checks that PostgreSQL rejects the write. A savepoint isolates the expected failure. The focused test and Ruff passed.

## 123. Prevent concurrent plan writes during cost backfill

18 November 2026. Migration 0020 acquires the plan table's write-conflicting lock before creating the cost table and reading legacy preferences. This closes the window where a concurrent save could be overwritten by the backfill. The populated migration regression and Ruff passed. Apply the migration in a maintenance window because plan writes wait for the migration transaction.

## 124. Protect costs in accepted snapshots

18 November 2026. Added migration 0025 so accepted cost rows use the existing snapshot guard, like activities and stops. The populated migration regression confirms PostgreSQL rejects edits to the migrated accepted cost. All 482 backend tests passed, including draft editing and proposal acceptance. The migration was verified locally.

## 125. Verify the boundary between draft and accepted costs

18 November 2026. The migration regression now verifies that PostgreSQL rejects inserting, editing and deleting cost rows on an accepted plan. The cost coverage suite checks that draft edits and review acceptance still work.

## 126. Rehearse rollback of the accepted-cost guard

18 November 2026. Verified that downgrading migration 0025 removes the cost trigger while preserving every cost field, and upgrading restores the guard. The populated PostgreSQL regression and Ruff passed.

## 127. Verify costs survive historical itinerary restoration

18 November 2026. Extended the cost integration scenario to restore an accepted itinerary after removing a linked activity from the draft. Opening the restoration review leaves draft costs alone. Accepting it restores both linked costs in the draft and a new accepted snapshot, while the historical costs remain intact. All 28 cost coverage tests passed.

## 128. Verify paid ticket retention in fatigue acceptance

18 November 2026. Extended the automated skip-and-rest scenario to compare the retained ticket against its original ID, amount and paid status, and verify the resulting cost in both the draft and accepted snapshot. The focused test passed on disposable PostgreSQL.

## 129. Disclose paid cost changes before restoration

18 November 2026. A historical restoration can replace newer paid records. The review now names affected payments and requires explicit acknowledgment, with wording that makes clear no refund is issued. The acceptance endpoint recomputes the warning. The integration test verifies that omitting this acknowledgment preserves the newer payment. All 39 cost and revision tests passed. The new warning still needs a signed-in browser walkthrough.

## 130. Verify the payment warning in the signed-in browser

18 November 2026. Saved a synthetic paid cost on the dedicated QA trip and opened a restoration review of version 5. The review named the payment, clarified that no refund is issued, and showed acceptance disabled before acknowledgment. Discarded the review and removed the synthetic cost. The draft showed the account-save confirmation. Screenshot: `.local/qa/restoration-paid-warning.png`. Desktop walkthrough only.

## 131. Verify payment consent at phone width

18 November 2026. On the signed-in QA trip at 390 × 844, checked all other acknowledgments and confirmed that leaving the payment acknowledgment unchecked disables restoration. Checking it enabled the button. Discarded the review, removed the synthetic paid entry and confirmed account save. Screenshot: `.local/qa/restoration-paid-warning-phone.png`.

## 132. Invalidate restoration consent after a payment edit

19 November 2026. The restoration regression now verifies that editing a paid amount after opening the review makes the old review stale even with all acknowledgments supplied. The updated amount remains in the draft until a fresh review is accepted. All 39 cost and revision tests passed. The full local baseline passed 483 backend tests, 185 frontend tests, lint, migration drift detection, type checking and the production build.

## 133. Warn when restoration changes a payment’s inherited currency

19 November 2026. A payment without its own currency uses the trip display currency. A restoration that changes that currency now requires payment acknowledgment even when the cost record itself is identical. An unchanged payment with an explicit currency does not trigger this warning solely because the trip display currency changes. All 41 cost and revision tests and Ruff passed. The existing warning was previously verified on desktop and phone. This new trigger was verified with backend tests.

## 134. Warn when restoration changes a per-person payment total

19 November 2026. Restoration now requires acknowledgment when the historical plan changes the traveler count for an otherwise identical paid per-person record. A whole-group cost does not trigger this warning on traveler count alone. All 43 cost and revision tests and Ruff passed. Backend tests cover the new trigger, and prior desktop and phone checks cover the shared review control.

## 135. Include conversion rates in restoration payment checks

19 November 2026. Restoration now flags a paid record with a saved conversion rate when the historical plan changes the trip display currency. The rate expresses display-currency units, so preserving the foreign denomination alone does not preserve the converted amount. All 44 cost and revision tests and Ruff passed. This adds a backend condition to the previously browser-verified acknowledgment.

## 136. Verify the combined restoration safeguards

19 November 2026. `make check-local` passed 488 backend tests and 185 frontend tests, including lint, migration drift detection, TypeScript and the production build. Updated the development status to distinguish the browser-confirmed consent interaction from the automated currency, rate, traveler count and stale-review checks.

## 137. Verify browser-role grants after the cost migrations

19 November 2026. Ran the Supabase migration helper against disposable PostgreSQL with simulated Supabase browser roles and permissive default grants. The helper applied migrations and removed all table privileges for both roles from cost items, plan versions and migration metadata. A grant on a synthetic auth-schema table and the default grants on future tables remained intact. This verifies the helper locally; no hosted database migration was performed.

## 138. Detect inherited column access before committing migrations

19 November 2026. Expanded the Supabase migration helper’s final verification to check column privileges and additional table privileges. In disposable PostgreSQL, a synthetic inherited column grant caused the helper to roll back the upgrade from 0024. Revoking the grant allowed the same helper to reach 0025 on retry. Ruff passed. Hosted grants were outside this rehearsal.

## 139. Identify remaining browser grants at rollback

19 November 2026. The Supabase migration helper now names the affected browser role and application table when its access check rolls back a migration. Other failures keep the existing sanitized message. A disposable PostgreSQL rehearsal verified the diagnostic for an inherited column grant on cost items, the unchanged revision after rollback and omission of the connection URL. Ruff passed.

## 140. Recheck backend verification without provider credentials

19 November 2026. Ran the full backend suite on disposable PostgreSQL with command-local overrides clearing Supabase, Groq, Google and Geoapify credentials and disabling optional providers and worker startup. All 488 tests passed, and Alembic found no schema drift. This checks the current worktree under CI-style settings. Live provider behavior and the actual GitHub Actions run are separate.

## 141. Rehearse readiness before and after the schema upgrade

19 November 2026. Verified the configured deployment health path against disposable PostgreSQL at revision 0024. FastAPI remained live but returned `503 DATABASE_NOT_READY` until the Supabase migration helper applied 0025. Readiness then returned 200 with the expected revision without restarting the test app. The embedded planning worker was disabled for this database check. No hosted migration or deployment was run.

## 142. Rehearse API startup with the embedded worker

19 November 2026. Started a single Uvicorn process with the embedded worker enabled against disposable PostgreSQL at revision 0025. Both HTTP health endpoints returned 200; SIGTERM completed application shutdown. Used the fixture planning engine and an empty queue. This check covers startup and shutdown, not hosted execution, queue consumption or live Groq.

## 143. Publish the completed work in reviewable parts

19 November 2026. At the user's request, organized the combined work into backend behavior and migrations, frontend workflows and recovery, isolated verification/migration tooling, Render hosting configuration, and documentation commits. Shared API/workspace dependencies stay together rather than representing them as independently complete feature slices. Re-ran `make check-local`: 488 backend and 185 frontend tests, lint, migration drift detection, TypeScript and production build all passed. Publication targets the existing feature branch, not main. No new product behavior, hosted migration, browser mutation or deployment was performed; existing browser evidence and remaining live Places-access limits still apply. Local credentials and QA artifacts are excluded, and approved landing files are unchanged.

## 144. Reconcile the feature branch with main

19 November 2026. PR #5 reported conflicts after the Render-worker branch was merged into main. Merged origin/main into the feature branch and resolved the two worker conflicts: both were formatting-only differences in already equivalent code. Retained the feature branch's current API routes, migration-head readiness check and worker behavior, and deduplicated PLANNING_WORKER_EMBEDDED in the environment example. No user-facing behavior changed, so existing browser verification applies; no new browser mutations, hosted migration or deployment was requested. The feature branch is updated without merging PR #5 into main.

The previous GitHub check also exposed Python-version-dependent OpenAPI output: CI selected Python 3.14, whose default 422 phrase is “Unprocessable Content,” while the reviewed snapshot uses “Unprocessable Entity.” Made the documented acceptance-response descriptions explicit, preserving the snapshot and runtime behavior rather than weakening contract verification. Local full checks passed before this correction; the focused contract check is rerun and the pushed GitHub check is followed separately.

## 145. Find the hosted database ahead of the deployed API

19 November 2026. After PR #5 merged into `main` (`94bf8bb`, CI green), compared hosted state with the code. The Render dashboard showed a single deploy of `6a20c30` from 13 November on the `codex/render-web-worker` branch. That commit's readiness check requires migration `0019`, while the hosted Supabase database was at `0024` after local feature work, so the deployed API was probably unready since 15 November. This is inferred from the code; Render logs were not read. **Lesson:** a hardcoded expected revision is only safe if schema changes and deployments move together. **Tradeoff:** the strict check is what exposes drift, so the process, not the check, needs fixing.

## 146. Apply migration 0025 to the hosted database

19 November 2026. With the owner's go-ahead, ran `make migrate-supabase`. The database moved from `0024_activity_skipped` to `0025_immutable_cost_items`; `alembic check` found no drift and the helper confirmed browser API roles still have no table access. The migration takes a plan-table lock; the helper finished without error. Existing trips were not edited.

## 147. Verify the redeployed Render API from outside

19 November 2026. The owner added the Google Places and Routes keys on Render and redeployed. External checks: readiness 200 at `0025`, liveness 200, CORS preflight allowed for the Vercel origin, unauthenticated trips request 401, and 37 OpenAPI paths including day-delay proposals. This verifies that the new code is running against the migrated database. It does not verify provider behavior.

## 148. Signed-in production smoke test on a dedicated QA trip

19 November 2026. The one existing trip in the signed-in account was not clearly a QA trip, so it was left alone and a new QA trip (`3812a381-7407-48dc-bb39-2b71c0c024f9`) was created. Live, through Vercel, Render and Supabase: trip list and create, destination lookup, two saved activities, Geoapify nearby discovery (ten San Francisco museums), chat explanation, a Groq time-change proposal (10:00 to 11:00) with correct before/after review, and discard leaving the draft at 10:00. A 390px width check found no horizontal scrolling on the itinerary page only. **Found:** Google Maps matching returned "rejected this backend key… allowed public IP", consistent with Render's outbound IPs not being on the key allowlist. Google Routes and live venue-hours acceptance were not exercised. **Limits:** desktop-width browser except the one overflow check; the QA trip remains because the app has no delete or rename; the account's other trip was only opened read-only. **Next:** allowlist Render's outbound IPs, then re-test Places and Routes.

## 149. Correct the Google diagnosis: billing, not the IP allowlist

19 November 2026. The owner allowlisted Render's Singapore outbound ranges (74.220.52.0/24, 74.220.60.0/24) on both Google keys; the screenshots show both lists include them. Three retests on the QA trip still failed. Render's log showed `POST /api/v1/google-places/matches` returning 503, which the backend produces when Google answers 401 or 403. A direct Places request from an already-allowlisted local IP also returned 403, so the IP allowlist was not the cause. Google's Geocoding API on the same key then returned "You must enable Billing on the Google Cloud Project". **Correction:** entry 148 and the earlier status note attributed the failure to Render's IPs; that was a reasonable but wrong inference. **Lesson:** a generic "caller does not have permission" hides the cause, so test the key from a known-good location before changing network rules. My first Routes check used an empty key (no local `ROUTES_API_KEY`) and proved nothing. **Open:** restore billing, then re-test Places, Routes and live venue-hours acceptance.

## 150. Replace Google Places and Routes with Geoapify

19 November 2026. The owner chose not to enable Google billing, so the optional hours and journey checks moved to Geoapify and OpenStreetMap data. A live spike on 12 San Francisco museums showed 8 had opening hours, written in real OSM syntax with date ranges, nth-weekday closures, public-holiday tokens and overrides. **Decision:** evaluate them with the `opening-hours-py` library instead of a hand-written parser, and return "unknown" for anything uncertain; public-holiday rules need a valid country or the library silently ignores them. **Built:** a Geoapify route provider (same call budget and bounds as before), `POST /place-checks/hours` using the place already retained from discovery, live-acceptance requests without listings, and a single "Check opening hours" action in the editor. Google endpoints, adapter and settings were deleted; `google_place_id` stays unused until a later migration, because dropping it first would break the deployed frontend. **Evidence:** 528 backend and 183 frontend tests, plus live backend checks. **Not verified:** the signed-in browser flows and the hosted app. **Lesson:** a comma in an OSM rule adds a rule rather than limiting a date range; the library was right and my test expectation was wrong. See [the learning note](../geoapify-checks-learning.md).

## 151. Confirm the removed keys

19 November 2026. The owner removed the Google keys from local, Render and Vercel settings. Local `.env` has no Google variables, and no key material remains in the repository. One earlier repository-wide search printed the old Google key from the ignored local `.env`; the key was already unusable without billing and is now deleted. Production Render still answers readiness on the previous code, which no longer needs those keys.

## 152. Verify the Geoapify checks in a signed-in browser

19 November 2026. Ran the new frontend and backend locally against the hosted database (no migration) and signed in. The account had no trips, so a new dedicated QA trip (`452b84e7-4ca4-4f1c-b3bd-9dbce366c2c9`) was created. A device-only draft containing leftover test costs was cleared for a blank form and restored exactly afterward. Verified live: destination lookup, Geoapify discovery, two saved mapped activities, the hours check (fits on a Wednesday, outside on a Monday), the journey check, and acceptance of a suggested 11:35 start after a 25-minute shortfall **with fresh live hours and route checks**. All server responses were 200 with no errors. At 390 px there was no horizontal overflow on the hours panel or the journey result. **Gaps:** the live-acceptance panel at phone width, the remaining-day and day-delay live checks, and drive routes were not exercised in the browser. The QA trip remains in the account.

## 153. Merge and deploy the Geoapify checks

19 November 2026. At the owner's request the branch was merged to `main` as a fast-forward (no PR) and pushed. CI passed. Render redeployed from `main` within a minute: `/place-checks/hours` is present, `/google-places/*` is gone, readiness is 200 at schema `0025`, and no migration was needed. Both Vercel projects reported success, and the production frontend bundle contains the new hours call and no Google endpoint. Unauthenticated calls to the new routes return 401 and the Vercel origin is allowed by CORS. **Limit:** the preview browser could not reach one of Vercel's two IP addresses from this network (TLS reset), so no signed-in click-through of the hosted site was possible and the hosted routes were not exercised with a real session. **Still open:** that hosted smoke test, the `google_place_id` column drop, and deleting the Google Cloud project.

## 154. Verify the hosted app after the Google removal

19 November 2026. The owner deleted the Google Cloud project and the hosted site became reachable from the review browser. In the signed-in production app, on the existing QA trip, the hours check returned "outside the regular opening hours" for the Asian Art Museum at 10:00 on a Wednesday (the museum opens at 11:00) and the journey check between two mapped activities returned 25 minutes walking over 1.7 km, both with Geoapify credits. A temporary activity was added and removed; the trip is back to its two original activities. This closes the earlier hosted click-through gap for those two flows.

## 155. Drop the unused Google Place ID

19 November 2026. Done in two releases so no running instance ever depended on a missing column. First, the API stopped accepting and returning `google_place_id` and no code used it, while the nullable column stayed mapped, so the release worked with or without it. A read-only check of the hosted database showed 0 of 679 activity rows had a value. Second, migration `0026_drop_google_place_id` removed the column and its check; a populated regression test verifies the row is unchanged, the downgrade restores the column and its enforced check, and re-upgrading is clean. Because Render's readiness requires an exact schema match, the migration was applied while the new build waited; the hosted API then reported schema `0026` with a healthy readiness, the QA trip loaded, and a new activity was saved and removed. 529 backend tests pass and CI passed. **Not verified:** the remaining-day and day-delay live checks, drive routes, and the live-acceptance panel at phone width in a browser. Google Cloud and all Google keys are gone.

## 156. Run the remaining live flows on the hosted app

19 November 2026. A new dedicated QA trip (`7699e436-0c30-4c8e-afdd-258d81cf9c2f`) with three mapped museums covered the four flows that had unit-test coverage only. **Day-delay with Drive routes:** a live check dated 27 Nov failed closed with a named reason because Randall's listed rules close it the day after Thanksgiving (`Nov Th[4] +1 day off`); with 2 Dec it was accepted after fresh hours and drive-route checks. **Remaining-day:** readiness, a walking preview on live routes and a saved proposal that skipped one visit; acceptance hit the per-minute limit, then the five-minute freshness safeguard, then succeeded on a fast run, and a reload confirmed the result. **Live panels at 390 px:** no overflow or Google wording; the checkbox label is a 44 px tap target. **Finding:** the 6-calls-a-minute limit carried over from the Google adapter made live acceptance impossible (about 7 calls for three visits, 13 for six). Raised to 40 a minute, 300 a day per user and 1,000 a day overall, with tests for a six-visit volume and the daily cap; 531 backend tests pass and CI passed. **Lesson:** unit tests that mock the provider cannot find a capacity limit; only a full live run does. The QA trip remains with Diaspora 12:30 and Randall 16:00 (the app cannot delete trips).

## 157. Add an itinerary map

19 November 2026. Next gap from the product list: the PRD's map (FR-12). The Google Maps design no longer applies, so the owner chose MapLibre with Geoapify tiles. Built a pure, tested map model, a lazily loaded MapLibre component with numbered markers, dashed straight-line links labeled as not routes, a Whole route view, two-way selection with the timeline, and a plain fallback when no basemap key or WebGL is available. Found and fixed one real defect: the map fell back to the plain background because MapLibre 6's worker file was not located by Next's bundler (not because of the key); the worker is now copied into `public/` at dev and build time. Verified live (local app, hosted data, QA trip): basemap rendered, selection both ways, route view, keyboard focus, no overflow at 539 and 390 px, and the no-key fallback made zero provider requests. **Not verified:** a screenshot, the hosted app (needs a separate browser key in Vercel), and large trips. See [the learning note](../day-map-learning.md).

## 158. Verify the hosted map and fix what a screenshot showed

19 November 2026. The owner added a separate Geoapify browser key locally and in Vercel and redeployed. Confirmed the key is not the backend key (fingerprints compared, values never printed) and that production sends the browser key. The hosted map rendered about 9,700 features with pins, selection and the route view. A real screenshot then exposed two defects that DOM counts had missed: a global `button` style overrode the pin colors (a pale pin, and dark-green numerals including on the selected orange pin, which had poor contrast), and the Geoapify credit appeared twice. Fixed by scoping the pin styles, using a darker orange (about 5.8:1 with white), removing the duplicate credit and padding the fit so pins clear the attribution bar; a second screenshot confirmed it. **Lesson:** verify UI by looking at it, not only by measuring it.

## 159. Record where the traveler stays

19 November 2026. Next gap: accommodation. With no free source of prices or availability, the slice is an honest record, not a booking. Each destination stay gets an optional `lodging` (name, address, check-in/out, "booked by me", and an optional searched place) stored inside the existing per-stay preferences, so there is no migration and versioning, freezing and autosave are inherited. Added a `lodging` discovery category (Geoapify `accommodation`, OSM tags for the fallback), a stay panel in the day view, and a blue stay pin on the day map. Verified: 18 backend and 9 frontend tests, build, a live search returning 12 Jaipur stays, and the panel in the demo trip at 390 px. **Then verified signed in** (local app, hosted database, new QA trip `77d6c6b1-ec94-4653-ba83-2d4fa8d41101`, because the signed-in account was not the one that owned the older QA trip): search, save, reload from the account, pin on the real basemap, selection, rename dropping the location, removal restoring the baseline, and 390 px. **Not verified:** a screenshot (window hidden), the hosted app, and a stay beside numbered visits. A stay is not yet the origin of day journey checks, and has no linked costs. Hit one defect on the way: a circular import between the map model and the lodging module broke the test loader, fixed by a type-only import. See [the learning note](../lodging-learning.md).

## 160. Deploy the stay record

19 November 2026. Pushed `afca645` to `main` at the owner's request (no new branch or PR). CI passed and both Vercel projects succeeded. Render, which must accept the new field before the frontend sends it, answered a live lodging search; no migration was needed. The production bundle contains the stay panel and search. **Not verified:** a signed-in run on the hosted app. A background poll I started waited on an OpenAPI path that the API does not expose, and was stopped; the live search was the real check.

## 161. Check the trip from the stay to the first visit

20 November 2026. Next gap from the stay record: it fed only the map. Added `POST /journeys/from-stay` (stay coordinates plus a retained place, mode, start and buffer; returns a leave-by time or `needs_earlier_start`) rather than loosening the pair check, which needs two retained places and a gap. The UI is a disclosure under the stay panel, shown only when a stay and a day with visits exist, and needs coordinates at both ends. 12 backend and 3 frontend tests; full suites pass (561 backend, 204 frontend). Verified live and signed in on the QA trip (walk 09:24, drive 09:44 for a 10:00 visit, 390 px clean) and restored to baseline. Committed locally; not pushed or deployed. See [the learning note](../lodging-learning.md). A second live run with four visits (two tied at 10:00) confirmed the first-visit tie-break and the stay pin beside numbered visits 1-4, then restored the baseline.

## 162. Add the way back to the stay

20 November 2026. Mirrored the leave-by check: `POST /journeys/to-stay` gives an arrival time from the day's last visit back to the stay, with an after-midnight status, and the stay section now covers both legs. A live run showed that running the return check wiped the outbound result; each check now clears only its own result. 571 backend and 207 frontend tests pass; verified live and signed in, baseline restored. Committed locally; not pushed. See [the learning note](../lodging-learning.md).

## 163. Tell the AI planner where the traveler stays

20 November 2026. The AI day planner ignored the stay. It now gets the recorded stay as untrusted plain evidence (no coordinates) and, for a located stay, a straight-line `distance_from_stay_km` on each mapped candidate, with a prompt line to prefer nearer places and leave time to return. Validation is unchanged. 4 new backend tests (574 total). A live Groq run through a local worker on the QA trip completed and its proposal was discarded; baseline restored without signing out. Whether the model actually prefers nearer places is not measured. Committed locally; not pushed. See [the learning note](../lodging-learning.md).

## 164. Mention the stay in the chat's route and day answers

20 November 2026. The chat's deterministic answers now include the recorded stay, worded as the traveler's own record, built server-side so the model never sees the stay text. 2 backend tests (576 total); verified live and signed in, baseline restored, session kept. Committed locally; not pushed. See [the learning note](../lodging-learning.md).

## 165. Fix what the review of the stay commits found

20 November 2026. A medium code review of the unpushed commits found a stale-result bug (the stay-journey reset key lacked the visit duration) and an unguarded coordinate access in the AI distance code; both fixed, plus the stay line is no longer truncated and one rounding rule is documented. I also noticed the distance test promised in entry 163 had never been written (a chained `sed` failure skipped it); it now exists, so the note's claim is true. 578 backend and 207 frontend tests pass. Not re-run in the browser: the key change is a one-token fix covered by reasoning, not a live check.

## 166. Qualify the stay route checks around check-in and check-out

20 November 2026. The leave-by and way-back checks assume the traveler is at the stay, which is wrong before check-in on the arrival day or after check-out on the departure day. Added a plain note in those cases rather than changing the estimate. 1 frontend test (208 total); verified live and signed in for the arrival-day branch, baseline restored; the departure-day branch was checked live afterwards on day 3 and restored. Committed locally; not pushed. See [the learning note](../lodging-learning.md).

## 167. Offer the stay as the starting place for a fresh-start check

20 November 2026. A searched stay now keeps its retained place id and appears in the readiness check's list of mapped places, so "I'm at my hotel" is a one-click starting point. The id only nominates a candidate; the destination-scoped lookup and later checks are unchanged. 3 backend and 1 frontend test (582 / 209 pass); verified live and signed in up to selecting the stay, baseline restored. Deploy backend first. Committed locally; not pushed. See [the learning note](../lodging-learning.md).

## 168. Fix the second review's findings

20 November 2026. The way-back note on the departure day now compares the visit's end with check-out; the arrival-day boundary is strict; the stay's place id is trusted only when its external id matches the retained record; a stray generated file was reverted. 3 more test assertions (582 / 209 pass). Browser not re-run; the changes are small pure-function and query-filter fixes covered by tests. Committed locally; not pushed.

## 169. Show linked costs in the stay panel

20 November 2026. Costs could already be linked to a stay but the stay panel did not show them. It now lists them as entered (no total, to avoid a figure that could disagree with the cost summary). 1 frontend test (210 pass); verified live and signed in with a temporary linked cost, which I removed (the two earlier QA cost records were untouched). Committed locally; not pushed. See [the learning note](../lodging-learning.md).

## 170. Show the stay in the restore review

20 November 2026. The restore review's preferences panel now mentions a recorded stay. Type-checked and the suite passes; not verified in a browser, because that needs an accepted version on the QA trip and accepting is irreversible. Committed locally; not pushed.

## 171. Run an automated accessibility audit on the stay UI

20 November 2026. Ran axe-core against the live stay panel, stay-journey section, map panel and day workspace. The stay features were clean; the map section shared its "Map" label with MapLibre's canvas and now reads "Map of <destination>". The audit also found 18 pre-existing contrast failures (2.9 to 4.45:1) in the day workspace's muted green text; recorded as a follow-up, not restyled here. Baseline restored; committed locally, not pushed. See [the learning note](../lodging-learning.md).

## 172. Raise the day workspace's muted text to readable contrast

20 November 2026. Fixed the 21 contrast failures the audit found (muted greens at 2.9 to 4.5:1) by darkening 17 declarations in `itinerary.css` to at least 4.6:1 with the same hue. Axe now reports none in the day workspace. Remaining and untouched: the shared header label (3.75:1) and a heading-order issue. Not seen by eye (no screenshots). Committed locally; not pushed. See [the learning note](../lodging-learning.md).

## 173. Fix contrast in the trip creation form

20 November 2026. Audited the creation form with axe at first load and with each step opened: about 50 contrast failures (muted green text at 2.8 to 4.4:1). Darkened 21 declarations in four trip stylesheets to at least 4.6:1 keeping each hue; axe now reports none there. Chat, history and review screens were not audited; no screenshots, so not seen by eye. 210 frontend tests and the build pass. Committed locally; not pushed. See [the learning note](../lodging-learning.md).

## 174. Audit chat, review and history; make the chat log keyboard-reachable

20 November 2026. Extended the axe audit to the chat, review plan and plan history screens: one muted chat color and one dialog-header color failed contrast (now darkened with the same hue), and the scrollable chat log was not keyboard-focusable (now `tabIndex={0}` with a focus outline). Axe reports none afterwards. No data changed; not seen by eye. 210 tests and the build pass. Committed locally; not pushed.

## 175. Finish the contrast pass with the My trips library

20 November 2026. Three more muted colors in the library darkened to at least 4.6:1; axe is clean on the creation form, day view, outline, chat, review, history and library. One heading-order skip on the day-1 transfer card remains. Not seen by eye. 210 tests and the build pass. Committed locally; not pushed.

## 176. Fix the heading order on the transfer cards

20 November 2026. The arrival and departure card headings are h2 instead of h3 so they no longer skip a level under the day's h1; computed style is unchanged. Axe is clean on the whole day-1 page. Committed locally; not pushed.

## 177. Run the CI steps locally before any push

20 November 2026. The workflow (`.github/workflows/ci.yml`) runs `make setup`, `make migrate`, `alembic check`, then `make check` (ruff, pytest, frontend tests, typecheck, build) on Node 22 and the default uv Python. Locally I had used Node 25 and Python 3.12, so I repeated the matching steps on the CI versions with the 20 unpushed commits: the 582 backend tests passed on Python 3.14.4 in a throwaway environment against a fresh Postgres cluster (so `alembic upgrade head` and `alembic check` ran too); the 210 frontend tests passed on Node 22.23; ruff check, `npm run typecheck` and `npm run build` pass; `uv lock --check` shows the lock file consistent (no dependency was changed). The local Postgres is 17.11, the same major version as CI's `postgres:17` service. `npm ci --dry-run` also succeeds, so the web lock file is consistent. Not reproduced: a real `npm ci` install and the hosted deploy builds. This lowers, but does not remove, the chance that CI fails on a push. No code changed.

## 178. Fix keyboard focus loss in the stay form

20 November 2026. Opening the stay form and choosing a search result both removed the focused button and dropped focus to the page body. Focus now moves to the name field in both cases. Verified live by reading the active element at each step; no data changed. Committed locally; not pushed.

## 179. Check focus handling in the other day-view dialogs

20 November 2026. After the stay-form focus fix, I read `document.activeElement` after opening "Add activity", "Add a meal or other cost" and "Plan this day with AI" in the day view: each opens a native dialog and puts focus on its first control (the activity forms on "What would you like to do?", the planner on "Close day planner"), and closing the planner returned focus to its trigger button. "Running late" did not appear on the QA trip (it needs a started trip), so it was not checked, and I did not record where focus lands after closing the two activity dialogs. No code changed and no data was changed. This was a scripted check, not a screen-reader session.

## 180. Run the strict axe rule set on the stay UI at desktop and phone width

20 November 2026. Re-ran axe with the WCAG 2.0, 2.1 and 2.2 (A and AA) and best-practice tags, which include the target-size rule, on the stay panel, the stay-journey section (with a result showing) and the map panel at 1280 px and at 390 px, plus the whole page at 390 px: no violations, and no horizontal overflow at 390 px. QA trip restored to its baseline, session kept. No code changed. Axe covers only a subset of accessibility problems; a screen-reader pass and a look by eye are still open.

## 181. Estimate the drive between destinations

20 November 2026. With about 48 minutes of the goal used (the hook's complaint was right), I took the largest remaining product gap I had listed, intercity travel, and built a driving estimate between two mapped destinations: `POST /journeys/intercity` (server-read coordinates from retained references, drive only) and an explicit button on the arrival and departure cards. Start and finish legs have no button because the trip origin is only a name. 6 new tests (585 backend and 213 frontend pass); verified live and signed in with a temporary second destination (Jaipur to Agra: 3 h 23 min, 269 km), axe clean, 390 px clean, baseline restored. Committed locally; not pushed. See [the learning note](../intercity-estimate-learning.md).

## 182. Let the starting point be mapped, so the first and last journeys get an estimate

20 November 2026. The first and finish journeys had no drive estimate because the starting location was plain text. The starting location now uses the destination map search; a match stores a map point (typing clears it), saved in the origin's existing optional coordinates (no schema or migration change). The intercity endpoint takes either a reference or coordinates at each end. Verified live and signed in (Delhi to Jaipur 3 h 7 min, 304 km; Jaipur back to Delhi 3 h 9 min, 306 km), axe clean, 390 px clean, origin restored to plain "Delhi". 586 backend and 217 frontend tests pass. Committed locally; not pushed. See [the intercity note](../intercity-estimate-learning.md).

## 183. Offer the drive estimate as the traveler's own travel time

20 November 2026. After a drive estimate, an explicit button copies the hours (rounded up to a hundredth) into that journey's own "Approximate hours" entry. It changes only that field and is never automatic. 2 frontend tests (219 total); verified live and signed in; axe clean. Restore caveat: clearing the field leaves an all-default preference entry because the app cannot delete one. Committed locally; not pushed. See [the intercity note](../intercity-estimate-learning.md).

## 184. Regression-check the creation flow and note a second QA trip

20 November 2026. The new starting-location search sits in the first step of the main creation flow, so I walked it on a new draft: required, Enter-to-search, choosing a match and continuing all work. Doing it created a second trip in the account (`639aceee-71ae-4e06-87fc-b70be8dc8d16`, now "Kyoto, Japan" as its start) because a new draft autosaves when signed in; there is no delete, so it stays as a disposable QA trip. No code changed. Committed locally; not pushed.

## 185. Check the drive estimate on a three-destination trip

20 November 2026. On the disposable QA trip (Delhi start; Jaipur, Agra, Varanasi) all six arrival and departure cards paired the right places, and two long estimates worked (634 km and 826 km). The main QA trip was not touched. No code changed. Committed locally; not pushed.

## 186. Add a road-time panel for the whole route

20 November 2026. "See the whole trip" gets a panel that estimates every mapped journey on the route on request and totals only what was estimated ("about 20 h 39 min, 2033 km across 4 journeys" on the disposable trip). 4 frontend tests (223 total); verified live and signed in, axe and 390 px clean; an unaudited contrast failure in the existing overview was fixed on the way. Committed locally; not pushed. See [the intercity note](../intercity-estimate-learning.md).

## 187. Fix what the review of the intercity work found

20 November 2026. Fixed a floating-point rounding bug in the "Use X hours" value (an exhaustive test over 0 to 3000 minutes now guards it), made a malformed reference a handled 422 instead of a 500, hid the button for a place and itself, corrected the starting-location field's wording and Enter handling, and removed an unused import. 225 frontend and 592 backend tests pass; not re-run in the browser. Committed locally; not pushed.

## 188. Review the new endpoints for security and add a cache

20 November 2026. Read the new endpoints for authentication, validation, request forgery, access control and data exposure (no issues), found the shared provider quota to be the real exposure (the whole-route panel can spend a request per journey), and added a bounded six-hour in-process cache for intercity estimates that keeps the original retrieval time and never caches failures. Added a plain disclosure that the stay and start coordinates are sent to Geoapify. 595 backend and 225 frontend tests pass. Committed locally; not pushed. See [the intercity note](../intercity-estimate-learning.md).

## 189. Record a journey the traveler already booked

20 November 2026. PRD FR-05 asks for an "Add existing transport booking" form. Added four optional fields to the per-journey entry (departure, arrival, reference, booked), a form on each arrival and departure card, summaries that say the times are as entered, and day-view flags for activities that start before the recorded arrival or run past the recorded departure. No migration; older plans still load. 607 backend and 232 frontend tests pass; verified live and signed in on the disposable QA trip (flags, persistence, removal), axe and 390 px clean after darkening one existing conflict color. Not built: buffers, overnight arrivals, use by the AI planner and chat. Committed locally; not pushed. See [the learning note](../transfer-bookings-learning.md).

## 190. Make the AI planner respect recorded arrival and departure times

20 November 2026. The day graph narrows its planning window to the traveler's recorded arrival (first day at a stop) and departure (last day), passes it to the model, and enforces it after the answer so a clash is repaired rather than trusted. 3 backend tests (610 pass); live with real Groq on the disposable trip: with arrival 11:00 the proposal started at 11:15. Proposal discarded, details removed. Committed locally; not pushed. See [the booking note](../transfer-bookings-learning.md).

## 191. Add visible buffers to recorded journeys

20 November 2026. Two optional buffers (settling in after arrival, being at the gate before departure) on each recorded journey, shown in the summary, used in the day flags and in the AI planner's enforced window. 616 backend and 233 frontend tests pass; verified live and signed in (flag, validation, summary, axe). Committed locally; not pushed. See [the booking note](../transfer-bookings-learning.md).

## 192. Fix what the review of the booking work found

20 November 2026. Fixed a remount that dropped the save notice and keyboard focus, a stale "not set" caveat beside a saved booking, and an inverted planner window (now an honest empty proposal without calling the model). Overnight arrivals and cache accounting are deliberate and documented. 617 backend and 233 frontend tests pass; verified live and signed in. Committed locally; not pushed.

## 193. List recorded journeys in the chat's route summary; re-run CI parity

20 November 2026. The chat's route summary now lists recorded journeys as the traveler's own entries, built server-side (618 backend tests; verified live through the real chat). I also re-ran the CI-parity checks on the 38 local commits: 617 backend tests on Python 3.14.4, 233 frontend tests on Node 22, ruff, lock files, and `npm ci --dry-run` all pass. Committed locally; not pushed.

## 194. Flag a booked stay that no longer matches the plan, and show dates from the trip

20 November 2026. PRD FR-04: booked stays are commitments and changes are flagged. Added an optional "nights you booked" on a booked stay, a plain note when the plan's nights differ, and check-in and check-out dates derived from the trip's exact dates. No migration. 622 backend and 237 frontend tests pass; verified live and signed in on the disposable trip (validation, derived dates, flag, clearing, axe). Not built: several stays in one destination. Committed locally; not pushed. See [the learning note](../lodging-learning.md).

## 195. Make the stay-nights change tell you about a booked stay

20 November 2026. "Change nights between stays" ignored a stay marked as booked. The preview now lists each booked stay whose nights change, as a warning (not a block), and the preview's headings no longer skip a level. 623 backend and 238 frontend tests pass; verified live and signed in (previewed, not applied). Committed locally; not pushed. See [the learning note](../lodging-learning.md).

## 196. Show recorded journeys on the day timeline

20 November 2026. Open gaps before a recorded arrival (first day) and after a recorded departure (last day) now read as "On the move" instead of "time to leave open"; activities are untouched. One pure function, 239 frontend tests; verified live and signed in, axe clean, arrival removed afterwards. Committed locally; not pushed. See [the booking note](../transfer-bookings-learning.md).

## 197. Fix what the review of the nights and timeline work found

20 November 2026 (resumed after a gap; the clock showed the 5-hour mark had passed, and the stop hook asked for active work up to it, so I resumed active work). The rebalance warning now matches the stay panel when the new nights equal the booked nights, the timeline split no longer overlaps on inconsistent times, and unchecking "booked" clears stale nights text. 624 backend and 240 frontend tests pass. Committed locally; not pushed.

## 198. Allow several stays in one destination (phase 1)

20 November 2026. PRD FR-04. Each destination can now have up to four other stays besides its main one, each covering its own nights, with per-stay dates, booked-nights checks, coverage notes and chat wording. No migration; existing single stays are unchanged. 634 backend and 247 frontend tests pass; verified live and signed in (add, validation, clash, notes, chat, axe, removal). Phase 2 (map pins and picking the stay for a night in the route checks) is next. Committed locally; not pushed. See [the learning note](../lodging-learning.md).

## 199. Several stays: map pins and the stay for a night (phase 2)

20 November 2026. The day map shows a pin per located stay, and the leave-by and way-back checks use the stay of the previous night in the morning and tonight's in the evening, naming them; a missing stay is said, not guessed. 248 frontend tests pass; verified live and signed in with two searched stays. Remaining main-stay-only surfaces: AI context, fresh-start list, restore review, rebalance warning for extra stays. Committed locally; not pushed.

## 200. Several stays: finish the remaining surfaces (phase 3)

20 November 2026. The AI planner, the fresh-start list, the rebalance warning and the restore review now understand several stays and pick the stay for a night; shared backend helpers mirror the frontend's. 637 backend and 248 frontend tests pass; not re-run live for these four (tests only). Committed locally; not pushed.

## 201. Fix what the review of the several-stays work found

20 November 2026. Kept the main stay's night fields available (no silent range loss), told the AI planner about tonight's stay on a stay-change day, made the other-stay panels stable and distinguishable, removed a duplicate comment. 638 backend and 248 frontend tests pass; not re-run live. Committed locally; not pushed.

## 202. Let a stay be kept fixed

20 November 2026. PRD FR-07: a lock is separate from a booking. Stays get "Keep this stay fixed"; "Change nights between stays" refuses to alter a destination with a locked stay until it is unlocked. 640 backend and 249 frontend tests pass; verified live and signed in (blocked, then allowed after unlocking, axe clean, stay removed). Journeys are not lockable yet. Committed locally; not pushed. See [the learning note](../lodging-learning.md).

## 203. Warn when changing nights moves a booked journey

20 November 2026. The "Change nights between stays" preview now lists booked journeys that fall on a different day, with how far and the traveler's own details. 641 backend and 250 frontend tests pass; verified live and signed in. Committed locally; not pushed. See [the booking note](../transfer-bookings-learning.md).

## 204. Fix what the review of the lock and booked-journey work found

20 November 2026. Confirmed the rebalance is the only automatic writer of nights; the refusal lists every locked stay; the picker flags a destination with a fixed stay; the journey line is tidied. 641 backend and 250 frontend tests pass. Committed locally; not pushed.

## 205. Let a stay carry a confirmation reference

20 November 2026. PRD FR-07: an optional confirmation number or note on a stay, as entered, never checked or sent to the AI. 644 backend and 251 frontend tests pass; verified live and signed in. Committed locally; not pushed.

## 206. Let a journey be kept fixed

20 November 2026. PRD FR-07 for transfers: each recorded journey gets "Keep this journey fixed"; "Change nights between stays" refuses a change that would move a locked journey's day until it is unlocked. 645 backend and 252 frontend tests pass; verified live and signed in. Committed locally; not pushed. See [the booking note](../transfer-bookings-learning.md).

## 207. Live-check several stays in the AI planner, the fresh-start list and the restore review

20 November 2026. Closed the three gaps left by phase 3 on the disposable trip: both stays are offered in the fresh-start check, a real Groq proposal for a stay-change day cited "returning to the evening stay", and the restore review lists both stays (and showed "nights 1" for one night, now fixed). Accepted one proposal on the disposable trip to get a restorable version (it stays in its history). 252 frontend tests pass. Committed locally; not pushed.

## 208. Check the several-stays and journey-lock UI at phone width

20 November 2026. At 390 px the stay panels and forms and the journey form have no overflow and no short controls, and axe is clean. No code changed; stays removed. Committed locally; not pushed.

## 209. Add a calendar file export

20 November 2026. "See the whole trip" can download a .ics of activities, stays and journeys, made in the browser for trips with exact dates. A check against an independent validator found unescaped semicolons that my own test had mirrored (fixed). 258 frontend tests pass; verified live on the disposable trip (file intercepted, 2 events, axe clean). Not verified in a real calendar app. Committed locally; not pushed. See [the calendar note](../calendar-export-learning.md).

## 210. Fix what the review of the calendar export found

20 November 2026. Malformed items are skipped instead of breaking the file (with a message on failure), journey ids are stable, line breaks and ids are sanitized, an unnamed stay has a title, and the notice clears when the plan changes. 260 frontend tests pass. Committed locally; not pushed.


## 211. Fix the layout of the road-time and calendar panels

20 November 2026. First real screenshots (headless Chrome) showed the two new panels in the whole-trip view squeezed into flex rows. Now stacked blocks. The day view with two stays on day 3 also looks coherent. 261 frontend tests, typecheck and build pass. Phone (390 px) overview and day 3 also viewed: panels stacked, no horizontal overflow. Committed locally; not pushed.

## 212. Look at the stay pins on a real map

20 November 2026. With two mapped stays in a guest draft (no network lookups apart from map tiles) the day map shows two pins; clicking one turns it orange and the status line names the stay and its nights. The two pins look the same, so they are told apart only by hover text, a click or the status line; I left that as is. No code changed. Committed locally; not pushed.
