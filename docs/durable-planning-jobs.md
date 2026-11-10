# Durable planning jobs — step 2

10 November 2026. This is a local fixture-backed rehearsal of the planning pipeline. There are no model, LangGraph, places, routing, weather or booking calls in this slice.

## User flow

On a saved itinerary day, **Try day planner (test)** opens a focused dialog. Queue a request, close and reopen it to resume status, cancel it, or review its completed proposal. A separate worker adds at most two clearly labeled meal/break fixtures into open time on the requested destination/day. Existing activities, locks, bookings, completed items, destination order and stay settings remain unchanged. Generation does not modify the editable or accepted plan. Acceptance revalidates the base and scope, stores the accepted snapshot, and copies accepted additions into the editable draft. Both fixture provenance and unverified travel information require explicit acknowledgments.

If the trip changes before publication, the job becomes `superseded`. If it changes after publication, ordinary proposal acceptance rejects the stale base. A full day may produce no additions; that result is explicitly described as unchanged. A repeat request does not add a second copy of already present fixture meal/break labels.

## API subset

`POST /api/v1/trips/{id}/planning-jobs` requires a UUID `Idempotency-Key` and exact draft `If-Match`. The initial request schema supports only:

```json
{
  "operation": "generate",
  "engine": "fixture",
  "base_version_id": "<draft UUID>",
  "scope": {
    "type": "selected_day",
    "stop_logical_id": "<destination occurrence UUID>",
    "local_day_offset": 0
  }
}
```

`selected_day` is an additive relative-day scope for undated plans. Other generation/replanning scopes remain unimplemented and are rejected, rather than silently narrowed. A successful request returns HTTP 202, Location and Retry-After headers. Matching idempotent retries return the same job. Active admission limits: one per trip, two per owner, twenty globally; a short database admission lock makes the checks atomic.

`GET /api/v1/jobs/{id}` returns owner-scoped status, stage, attempts, selected day/destination, cancellation state and proposal reference. It performs no fresh generation or provider requests. `POST /api/v1/jobs/{id}/cancel` cancels queued work immediately, requests cooperative cancellation of running work, and retains an already terminal state. Both endpoints return private/no-store responses. Event history is not implemented; the UI polls durable current status.

## Worker and persistence

Migration `0014_planning_jobs` adds `planning_job` to the same PostgreSQL database. Input is a frozen validated plan and base revision/edit-sequence snapshot. Table access is revoked from browser API roles. Jobs are claimed with `FOR UPDATE SKIP LOCKED`, one row at a time. Each claim receives a fresh lease token, a 60-second lease and heartbeat. Publication checks the token and expiry, so a recovered job cannot be overwritten by its old worker. At most three attempts run; failures back off by five seconds times the attempt count. Expired leases can be reclaimed. Publication and proposal creation are atomic, giving one result despite at-least-once execution. Fixture activity IDs are derived from the job ID for deterministic retries.

A separate process performs pure generation outside a transaction, with short claim/heartbeat/publication transactions. Cancellation and base freshness are checked at publication. The current fixture function is bounded and fast. Real model/provider calls will require periodic heartbeats, call-level timeouts, operation budgets and checkpoint recovery; these are not provided by this fixture runner.

Run locally from the repository root:

```sh
make api
make worker
make web
```

Local ignored configuration has `PLANNING_FIXTURES_ENABLED=true` in the backend and `NEXT_PUBLIC_PLANNING_FIXTURES_ENABLED=true` in the web app. Both example files default to false. Restart the corresponding process after changes. No model/API key is required. The fixture worker is a separate local process; it is not hosted by Next.js or automatically deployed to Vercel.

## Verification

Browser checks used the existing QA trip, leaving the traveler's original trip untouched: queue with the worker stopped, close/reopen and resume, cancel, queue again, start the worker, poll to success, review fixture additions, acknowledge and accept, and reload the selected day. Original meal and completed break remained, and accepted fixture additions persisted. Desktop and 390px phone layouts were inspected; the phone dialog had no document overflow. Screenshots are in `docs/references/planning-jobs/`.

Backend tests cover idempotent admission, ownership, no-store polling, disabled mode, invalid scope/ETags, queued and running cancellation, expired-lease recovery, fencing of an old attempt, retry exhaustion, stale-trip supersession, protected-item preservation, deterministic fixture IDs and acceptance into the draft. Test claims are owner-scoped so they cannot consume unrelated development jobs. Database integration tests use outer transaction rollback. Multi-process claim contention and forced process termination are not separately browser-tested; lease recovery is tested by advancing the stored expiry.

## Next

Replace the fixture generator behind this job boundary with a bounded LangGraph workflow and typed candidate output. Add permitted provider tools/evidence, richer feasibility validation, generated reasons/diffs and model evaluations before exposing real recommendations. Full-trip generation, adaptive replanning, SSE/event history and production worker hosting remain future work. No deployment was performed.
