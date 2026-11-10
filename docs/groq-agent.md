# Groq one-day agent — step 3

10 November 2026. Groq is the configured provider, with `openai/gpt-oss-120b`. This is a real model integration, using a deliberately synthetic activity catalog. It does not retrieve live attractions, prices, routes, weather, opening hours or availability.

## Flow

The saved itinerary offers **Plan this day with AI**. It queues `engine: groq` through the existing authorized planning-job API. The worker runs a bounded LangGraph workflow:

```mermaid
flowchart LR
    A[Scoped saved-day snapshot] --> B[Read-only tool gathering]
    B --> C[Separate strict JSON candidate call]
    C --> D[Deterministic checks]
    D -->|One repair allowed| C
    D --> E[Persist provisional proposal and reasons]
    E --> F[Traveler reviews and accepts or discards]
```

The read-only tools are `get_day_context` and `list_activity_candidates`. Their arguments must be empty: the backend supplies the authorized day, rather than allowing the model to request another user, trip or arbitrary URL. The catalog has five sample candidates: culture, walking, meal, rest and free time. If the model omits a mandatory read, the graph supplies that dependency explicitly. Tools and structured output use separate requests. Groq's strict response schema is generated from Pydantic. Model-supplied labels, durations, commitments and database identifiers are not trusted: the backend derives them from permitted candidate IDs and the job ID.

Only the selected day's destination/timezone, pace, bounded interests and existing schedule context are sent to Groq. No authentication tokens, email, database credentials, accommodation confirmation references or complete trip snapshot are supplied to the model. Traveler labels and tool responses are treated as untrusted data in the prompts. No code execution, arbitrary SQL, arbitrary network access or booking tools exist.

## Bounds and validation

- At most three gathering turns and four tool executions, then one structured candidate call and at most one repair call: five provider calls per attempt maximum.
- Each call has a 20-second SDK timeout and disables automatic SDK retries. Calls request at most 3,500 completion tokens. Graph time is checked against a 100-second budget at node/tool boundaries; an in-flight call may take its remaining timeout before the next boundary check.
- The initial selected-day pilot adds at most five catalog blocks within 09:00–18:00 local time. This is a per-day candidate budget, not a trip-length restriction. Existing activities at any time remain unchanged. Custom daily windows are future work.
- Server checks preserve every existing item, including fixed, completed and booked items, and all other destinations/days/settings. Added candidate IDs must exist in the catalog, labels/durations/kinds must match server evidence, and duplicates/invalid local times/overlaps are rejected. Publication and acceptance recheck the catalog-derived items against generation metadata.
- After one failed repair, no unusable candidate is published. Full-trip existing conflicts still prevent acceptance through the shared validator. Strict budgets remain blocked until complete cost evidence is supported.
- Periodic worker heartbeats renew leases every ten seconds. Cancellation is checked between nodes and during heartbeat renewal; an already in-flight Groq request may finish and be billed, but cancelled/lost-lease work cannot publish.
- Groq 429 responses honor a bounded Retry-After (5–300 seconds); connection errors and server errors may use the existing three-attempt durable retry policy. Authentication/configuration and invalid-candidate failures stop without repeatedly spending tokens. Safe status codes reach the UI; raw SDK errors, keys and upstream bodies are not logged.

Graph state is currently rebuilt from the frozen input after worker failure; there is no persistent LangGraph node checkpointer yet. Recovery is at least once and may repeat model calls. Stable item IDs and fenced atomic publication prevent duplicate accepted side effects; they do not guarantee exactly-once provider billing.

## Persistence and review

Migration `0015_ai_job_results` adds `planning_job.result_metadata`. It stores a bounded user-facing summary, per-addition reasons, model ID, catalog provenance, tool-read names and token/call counts. It does not store private chain-of-thought or raw conversations. Job input remains unchanged. The proposal response includes `generation` and distinguishes `source: ai` from `fixture` and `user`.

Review displays AI/sample-evidence status and a short explanation, with per-item reasons behind a disclosure. Unknown provider facts and AI sample evidence require explicit acknowledgments. Acceptance retains the immutable accepted snapshot and copies approved additions into the editable draft. Reservations are never made.

## Configuration and local execution

Backend ignored `.env`:

```dotenv
GROQ_API_KEY=<server-only key>
GROQ_MODEL=openai/gpt-oss-120b
PLANNING_AI_ENABLED=true
```

Web ignored `.env.local`:

```dotenv
NEXT_PUBLIC_PLANNING_AI_ENABLED=true
```

Both example files default the feature flag to false. The key has no public prefix and is never sent to the browser. Existing fixture mode remains available independently. Run API, worker and web in separate terminals using `make api`, `make worker`, `make web`. No deployment was performed.

## Verification

A synthetic live Groq smoke check generated and validated a structured candidate. Then the signed-in QA trip completed browser → API → PostgreSQL job → worker → live Groq → proposal → acceptance → reload. The observed account job used three model calls, read both scoped tools, and reported 1,141 input / 915 output tokens. Its five sample additions persisted on Jaipur day three while other days and the completed break stayed unchanged. The traveler's original trip was not modified.

Desktop and 390px phone review layouts were inspected; phone document width stayed within the viewport. Screenshots are in `docs/references/groq-agent/`. Automated tests use fake providers, not paid live calls, and cover structured output, a single overlap repair, invalid output, forbidden tools, cancellation boundaries, evidence tampering, safe provider errors, rate-limit classification and AI proposal acceptance. Existing job/ownership/lease/autosave tests remain in the regression suite. Final checks passed: 49 backend tests, 13 frontend regression tests, Ruff, and the production frontend build including TypeScript validation.

## Remaining work

Live destination-specific provider adapters and permitted evidence; budget/travel feasibility; richer interest/ranking evaluations; adjustable daily windows; full-trip generation; adaptive replanning; persisted node checkpoints and production worker hosting. The current sample catalog proves orchestration and acceptance; it is not a destination recommendation product yet.

Implementation references: [Groq structured output](https://console.groq.com/docs/structured-outputs), [official Groq Python SDK](https://github.com/groq/groq-python), [LangGraph graph API](https://docs.langchain.com/oss/python/langgraph/graph-api).
