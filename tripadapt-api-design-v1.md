# TripAdapt — API Design

**Approval:** Product and technical design baseline approved on 3 November 2026. Unselected vendors, credentials, quotas, notification channel, and other explicitly pending implementation choices remain open; approval does not imply provisioning or implementation.
**Version:** 1.0 draft · **Date:** 2 November 2026  
**Status:** Approved API design baseline; endpoints are not implemented.  
**Baseline:** PRD 2.1, architecture 1.1, database design 1.1, and approved optional monitoring.

## 1. API boundary

FastAPI owns application operations under `/api/v1`. Next.js consumes this API. The browser map uses a separately restricted Google Maps browser key. AI/provider credentials remain server-side. Auth-provider verification and recovery endpoints belong to the selected identity provider, not a custom password implementation in this API.

Use JSON with UTF-8, UUID identifiers, RFC3339 instants with offsets, ISO calendar dates, IANA timezone identifiers, and decimal strings for monetary amounts. Undated plans retain local day offsets and local times rather than fabricated UTC instants.

Public discovery is rate-limited. Private resources require authenticated ownership. Treat opaque resource IDs as identifiers, not authorization.

## 2. Common response conventions

Successful single-resource responses wrap the resource in `data`; lists also include `page`. Include `meta.request_id` for correlation.

```json
{"data":{"id":"<uuid>","status":"queued"},"meta":{"request_id":"req_123"}}
```

List pagination: `?limit=20&cursor=<opaque>`, default 20, maximum 100. Return `page.next_cursor` and `page.has_more`. Discovery providers may impose smaller limits. Bind cursors to the query; expired provider cursors yield an explicit error.

Freshness and coverage accompany externally sourced information:

```json
{"source":{"provider":"google_places","retrieved_at":"2026-11-02T08:00:00Z","status":"sourced","expires_at":null},"coverage":{"status":"partial","limitations":["Selected review sample"]}}
```

Source statuses: `sourced`, `estimated`, `user_entered`, `unavailable`, `simulated`. `sourced` does not guarantee real-world accuracy. Unknown values are null, not zero or empty claims of availability. Avoid embedding provider payloads wholesale.

## 3. Authentication and account API

Production authentication transport will be finalized with the identity provider. Private endpoints accept validated bearer access tokens unless the chosen integration deliberately adopts secured cookies. FastAPI verifies issuer, audience, signature, expiry, and mapped internal user. Cookie mode requires CSRF protection; CORS uses explicit allowed origins.

| Method/path | Access | Behavior |
|---|---|---|
| GET /me | Signed in | Current internal ID, display name, email, trusted verification state |
| PATCH /me | Signed in | Update allowed profile fields such as display name |
| GET /me/notification-preferences | Signed in | Current delivery preferences |
| PATCH /me/notification-preferences | Signed in | Update supported preferences |
| DELETE /me | Signed in, recent authentication | Schedule account deletion and disable monitoring |
| POST /integrations/auth/events | Verified provider signature | Idempotent identity synchronization; provider-specific payload |

Email changes and recovery use the identity provider's verified flow. PATCH /me cannot set email_verified_at or accept an unverified replacement email. Matching email alone does not link accounts. GET /me may lazily create the application profile from trusted identity claims if supported. Webhook events have unique provider event IDs and tolerate retries/out-of-order updates.

## 4. Discovery and provider searches

| Method/path | Access | Inputs / output |
|---|---|---|
| GET /destinations/search | Public | q, optional locale/country bias, cursor; destination candidates |
| GET /places/search | Public | destination reference or bounding region, q/category, cursor |
| GET /places/{place_id} | Public | fields selection; normalized details |
| GET /places/{place_id}/reviews | Public | Provider-available attributed sample and source link |
| POST /places/{place_id}/review-summary | Signed in | Optional AI summary where provider permits processing; metered |
| GET /destinations/{destination_id}/content | Public | Permitted discovery articles/videos/photos and external links |
| POST /accommodation/search | Signed in | Destination, dates, rooms, occupancy, currency, filters |
| POST /transport/search | Signed in | Endpoints, dates/time preferences, modes, travelers |
| POST /routes/estimate | Signed in | Endpoints/waypoints, mode, departure time; normalized routes |
| GET /weather | Public, limited | Coordinates/place, relevant date range; forecast and coverage |

Search IDs are application/provider references returned by discovery; external IDs need a provider namespace. Detail requests use allowlisted field groups, not arbitrary upstream field masks. Location objects accept a place reference or validated coordinates and label. Limit waypoint/candidate counts and query lengths through published schemas.

Accommodation and intercity searches require appropriate dates for date-specific offers. Return 422 `DATES_REQUIRED` if missing; undated research remains available through place discovery. Search results are transient offers, not reservations. Include price unit, currency, known taxes/fees, observed time, availability status, and external link when supported. Unknown supplier inventory is not an empty claim that no service exists.

A partial successful provider response can return 200 with coverage limitations; a wholly failed provider call returns a structured upstream error. Optional content/media is fetched on demand. Photos/embeds use authorized URLs/flows and attribution; do not implement a generic arbitrary URL proxy.

Review responses include sample size, provider total count where available, ordering information, original author/date/source attribution, and original links. Optional AI summaries are labeled: “AI-generated summary of available reviews. AI can make mistakes; check the original reviews before deciding.” Include sources and summarized review count. No summary endpoint is enabled until processing permission is verified. If generation is asynchronous, return 202 and an owned job resource.

## 5. Trips and plan versions

| Method/path | Success | Behavior |
|---|---|---|
| POST /trips | 201 | Create trip with initial editable draft |
| GET /trips | 200 | Owned trips, paginated |
| GET /trips/{trip_id} | 200 | Trip metadata, current/draft version references, lock version |
| PATCH /trips/{trip_id} | 200 | Title/lifecycle only; conditional update |
| DELETE /trips/{trip_id} | 202 | Hide trip, disable monitoring, cancel jobs, schedule purge |
| GET /trips/{trip_id}/versions/{version_id} | 200 | Version overview and validation summary |
| GET /trips/{trip_id}/versions/{version_id}/stops | 200 | Ordered stops |
| GET /trips/{trip_id}/versions/{version_id}/schedule | 200 | Filter by stop/date/day offset; paginated for long trips |
| GET /trips/{trip_id}/versions/{version_id}/budget | 200 | Itemized totals, paid commitments, unknown costs |
| POST /trips/{trip_id}/draft | 201 or 200 | Clone current accepted version, or return existing draft |
| POST /trips/{trip_id}/draft/commands | 200 | Atomically apply typed edits to draft and validate |
| POST /trips/{trip_id}/draft/submit | 201 | Freeze draft as proposal for review |
| DELETE /trips/{trip_id}/draft | 204 | Discard editable draft |

All private endpoints check ownership. Versions referenced through a trip must belong to that trip. Initial draft inputs can include date mode, destinations, budget, traveler/room counts, and preferences; empty partial drafts are allowed.

Example create request:

```json
{
  "title":"Rajasthan trip",
  "plan":{
    "date_mode":"duration",
    "desired_days":12,
    "traveler_count":2,
    "room_count":1,
    "display_currency":"INR",
    "budget":{"amount":"60000.00","mode":"target"},
    "preferences":{"pace":"balanced","interests":["culture","food"]},
    "stops":[{"client_id":"stop_a","name":"Jaipur","timezone":"Asia/Kolkata","desired_nights":4},{"client_id":"stop_b","name":"Udaipur","timezone":"Asia/Kolkata","desired_nights":4}]
  }
}
```

Desired stay nights need not exhaust the trip duration; unscheduled time is permitted and shown. No arbitrary seven-day limit exists. Exact-date input consistency, processing limits, and long-trip sectioning are validated independently.

Accepted versions are immutable. Direct editing changes a draft; the UI may immediately display that draft while clearly distinguishing unsaved-to-current changes. Making edits current follows the same proposal acceptance operation as an agent plan.

## 6. Commands and concurrency

Draft mutation uses `If-Match: "draft:<version_id>:<edit_sequence>"`. Metadata changes use the trip ETag returned by GET. Missing required preconditions return 428; mismatches return 412. This guards draft edits independently from accepted-plan revisions.

```json
{
  "commands":[
    {"type":"activity.update","logical_id":"<uuid>","changes":{"duration_minutes":60}},
    {"type":"activity.set_fixed","logical_id":"<uuid>","fields":["start","inclusion"]}
  ]
}
```

Supported command families:

- plan.update_settings
- stop.add/update/remove/reorder
- activity.add/update/remove/move/set_fixed/set_completion
- stay.add/update/remove/set_fixed
- transport.add/update/remove/set_fixed
- cost.add/update/remove

Publish discriminated schemas for each command. Reject unknown fields/command types. Batch edits are atomic; reject the batch if structural validation fails. Schedule conflicts may be saved as an explicitly conflicted draft with issues returned, but not promoted as a feasible accepted plan. Only explicit user commands may alter protected fields; agent proposals cannot silently unlock them. Removing a stop reports dependents and requires an explicit cascade choice.

Responses return a new ETag, changed logical IDs, and validation issues. Physical IDs change across versions; logical IDs identify conceptual items. Version snapshots return both.

## 7. Shortlists

| Method/path | Success | Behavior |
|---|---|---|
| GET /trips/{trip_id}/shortlist | 200 | Saved ideas by destination logical ID |
| POST /trips/{trip_id}/shortlist | 201 | Save place/manual location with priority |
| PATCH /trips/{trip_id}/shortlist/{item_id} | 200 | Change priority, notes, destination association |
| DELETE /trips/{trip_id}/shortlist/{item_id} | 204 | Remove shortlist item |

A saved external article does not create an activity unless an identifiable place or explicit custom activity is selected. Retain external content only as permitted.

## 8. Agent planning and jobs

| Method/path | Success | Behavior |
|---|---|---|
| POST /trips/{trip_id}/planning-jobs | 202 | Generate or replan from explicit base version |
| GET /jobs/{job_id} | 200 | Owned status, progress, proposal/result reference |
| GET /jobs/{job_id}/events | 200 | Progress events using after_event_id/limit |
| POST /jobs/{job_id}/cancel | 202 | Request cooperative cancellation |
| GET /trips/{trip_id}/messages | 200 | Paginated trip conversation |
| POST /trips/{trip_id}/messages | 201 or 202 | Add message; immediate clarification or asynchronous agent job |

Job creation requires `Idempotency-Key`. Input:

```json
{
  "operation":"replan",
  "base_version_id":"<uuid>",
  "trigger":{"type":"rain","description":"Replace outdoor afternoon activities"},
  "scope":{"type":"remaining_day","stop_logical_id":"<uuid>","local_date":"2026-11-12"},
  "current_context":{"time":"2026-11-12T13:00:00+05:30","location":{"latitude":26.9,"longitude":75.8}},
  "instructions":"Keep dinner at 8 p.m."
}
```

Operations: generate/replan. Scopes: whole_trip, remaining_day, from_point, selected_stops; schema validates applicable combinations. Generate may use a frozen copy of the current draft; capture draft ID and edit sequence in the job. Replans usually use the accepted version. Caller must explicitly choose the basis; do not combine accepted and draft records implicitly.

A stale base returns 409 unless the caller explicitly requests historical inspection without publishing. Job admission can return 429 when concurrency/model/provider budgets are exhausted. Return `Location: /api/v1/jobs/{id}` and recommended polling interval. Polling must not trigger fresh provider calls.

Job states: queued, running, succeeded, failed, cancelled, superseded. A succeeded job may return a conflicted/incomplete proposal: execution success and plan feasibility are separate fields. Cancellation is cooperative; already completed external calls may be billed. An already terminal job returns its terminal state without inventing cancellation.

Message input includes text and base_version_id; conversational edits produce typed draft changes or a proposal and never silently change the accepted plan. Use the same operation budgets as direct planning requests. Persist a user message once under idempotency; repeated delivery must not create duplicate agent jobs.

## 9. Proposals, acceptance and history

| Method/path | Success | Behavior |
|---|---|---|
| GET /trips/{trip_id}/proposals | 200 | Paginated proposals |
| GET /trips/{trip_id}/proposals/{proposal_id} | 200 | Candidate reference, diff, costs, evidence, conflicts |
| POST /trips/{trip_id}/proposals/{proposal_id}/accept | 200 or 202 | Accept if ready; otherwise start required revalidation |
| POST /trips/{trip_id}/proposals/{proposal_id}/discard | 200 | Discard pending proposal |
| GET /trips/{trip_id}/revisions | 200 | Accepted history |
| POST /trips/{trip_id}/revisions/{version_id}/restore | 202 | Create and validate a restoration proposal |

Acceptance requires `Idempotency-Key` and an expected_current_version_id, nullable for first acceptance. Under a short transaction, verify ownership, current base, pending status, feasibility, and evidence readiness before advancing the trip pointer. Conflicted proposals return 409 `PLAN_CONFLICT`; stale ones return 409 `STALE_PROPOSAL`.

For provisional evidence, distinguish advisory unknown facts from unresolved feasibility conflicts. Advisory uncertainty may be accepted with explicit acknowledged issue IDs; hard constraint violations cannot. The server decides which issue classes are acknowledgeable. Acknowledgement never changes a supplier booking or guarantees availability.

If fresh external checks are required, return 202 with a revalidation job; keep the current plan unchanged. After revalidation, show updated proposal details and require a new acceptance request. Never auto-accept a materially changed candidate. Precondition checks run again after external work.

Restoration creates a new candidate version; it does not mutate historical versions or restore supplier reservations.

## 10. Monitoring and notifications

| Method/path | Success | Behavior |
|---|---|---|
| GET /trips/{trip_id}/monitoring | 200 | Consent/preferences, eligibility, last check, next check, pause reason |
| PUT /trips/{trip_id}/monitoring | 200 | Enable/disable; allowed trigger/channel preferences |
| GET /notifications | 200 | Owned inbox, unread filter, cursor |
| PATCH /notifications/{notification_id} | 200 | Set read/unread |
| GET /usage | 200 | User-facing remaining operation allowances/reset times |

Monitoring input includes enabled, trigger types, selected supported channels, and explicit consent to the presented setting/version. Frequencies are server-bounded, not unrestricted client intervals. Distant/undated trips may return enabled=true with eligibility/pause reason rather than implying checks occur. Disable prevents new checks and cancels pending monitoring jobs where practical. Ignore in-flight results for notification publication when consent has been revoked.

In-app delivery is supported initially. Do not accept email/push channel selection until configured and verified. Email-dependent actions require a verified address. Channel-specific enrollment routes will be added when the channel is selected. Never claim alerts arrive while the app is closed until an external channel is operational.

Scheduler triggers and worker job claims are internal authenticated operations, not public user endpoints. Provider delivery webhooks require signature validation and idempotent event handling.

## 11. Error contract

Use `application/problem+json` for failures with stable codes and safe details:

```json
{
  "type":"urn:tripadapt:error:stale-proposal",
  "title":"The trip changed after this proposal was created",
  "status":409,
  "code":"STALE_PROPOSAL",
  "detail":"Refresh the trip and request an updated proposal.",
  "request_id":"req_123",
  "issues":[{"path":"expected_current_version_id","code":"VERSION_MISMATCH"}]
}
```

| Status | Typical code |
|---|---|
| 400 | INVALID_CURSOR, INVALID_IDEMPOTENCY_KEY |
| 401 | AUTH_REQUIRED, TOKEN_INVALID |
| 403 | EMAIL_VERIFICATION_REQUIRED, ACTION_NOT_ALLOWED |
| 404 | RESOURCE_NOT_FOUND, including another user's private resource |
| 409 | STALE_PROPOSAL, PLAN_CONFLICT, IDEMPOTENCY_KEY_REUSED, JOB_ALREADY_ACTIVE |
| 412 | PRECONDITION_FAILED |
| 413 | REQUEST_TOO_LARGE |
| 422 | VALIDATION_FAILED, DATES_REQUIRED, UNSUPPORTED_MODE |
| 428 | PRECONDITION_REQUIRED |
| 429 | RATE_LIMITED, USAGE_LIMIT_REACHED |
| 502 | PROVIDER_RESPONSE_INVALID |
| 503 | PROVIDER_UNAVAILABLE, SERVICE_TEMPORARILY_UNAVAILABLE |
| 504 | PROVIDER_TIMEOUT |

Include Retry-After when a meaningful retry time exists. Do not leak provider credentials, internal stack traces, private IDs, or full upstream error bodies. FastAPI's default validation errors must be normalized to this contract. Nonfatal schedule issues live in successful draft/proposal responses, not necessarily HTTP failures.

## 12. Idempotency, budgets and privacy

Scope keys by internal user and operation; store request hash and resulting resource/outcome. Same key/body replays the prior result; different body yields 409. Public reads do not require keys. Document retention/reset behavior before launch.

Before any costly external/model call, reserve allowance atomically. API retries do not automatically repeat upstream work. Bound candidate counts, batch command counts, text length, tool steps and polling frequency. Return rate-limit metadata appropriate to the limiting operation; expose only user-relevant budgets, not sensitive global usage.

Sentry captures application exceptions and sampled performance telemetry. LangSmith traces selected agent runs/evaluations. Correlate request/job/version/run identifiers and redact emails, booking references, secrets and restricted provider content before export. Instrumentation failures must not break API operations.

## 13. OpenAPI and implementation checks

FastAPI will generate an OpenAPI specification from explicit request/response schemas with discriminated unions, enums, examples, nullability and error responses. Generate or validate TypeScript client types from that contract. Commit the generated spec after implementation begins and review breaking changes.

Contract tests cover auth/ownership, pagination, schema errors, command atomicity, ETags, idempotency, stale acceptance, asynchronous revalidation, long-trip pagination, quota handling and monitoring consent. End-to-end checks cover anonymous discovery → sign-in → draft → generated proposal → acceptance → disruption → revised acceptance.

Unselected details: identity provider and transport, review-summary permissions, suppliers, external notification channel, numeric operational limits and idempotency retention. These require concrete implementation selections; this document does not promise unavailable integrations.

## 14. Design alignment

This document refines earlier endpoint sketches: use `/versions` for all snapshots and `/revisions` for accepted history; direct edits operate on drafts and pass through proposals before becoming current. It also makes revalidation asynchronous when external calls are necessary. Supporting generic asynchronous review summaries may require broadening the database job type/schema or introducing a separate task table; do not force a non-trip task into a required trip foreign key. Final migration/OpenAPI work must reconcile these details explicitly.

References: [System architecture](tripadapt-system-architecture-v1.md), [Database design](tripadapt-database-design-v1.md), [PRD](tripadapt-prd-v2.md).
