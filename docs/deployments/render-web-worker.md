# Render web service: API and planning worker

Use this mode for a hobby deployment that can tolerate Render Free cold starts.
The authenticated FastAPI API and one PostgreSQL queue consumer run together.
Browser API requests wake the service; startup resumes queued work. No public
worker trigger, extra bearer secret, cron, or artificial keep-alive is needed.

## Create the service

Import the repository's `render.yaml` as a Render Blueprint, or create a **Web
Service**, Python runtime, **Free** instance with these settings:

- Root directory: `services/backend`
- Build: `uv sync --locked --no-dev`
- Start: `uv run --no-sync uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 1 --timeout-graceful-shutdown 25`
- Health check: `/api/v1/health/ready`
- Python: `PYTHON_VERSION=3.12.12`

Set `PLANNING_WORKER_EMBEDDED=true`, `PLANNING_AI_ENABLED=true`,
`PLANNING_FIXTURES_ENABLED=false`, and `GROQ_MODEL=openai/gpt-oss-120b`.
Use the existing Supabase `DATABASE_URL` (including `sslmode=require`),
`SUPABASE_URL`, and server-only `GROQ_API_KEY`. Never prefix these with
`NEXT_PUBLIC_`. Keep secrets in Render environment settings, never Git.

Set `CORS_ORIGINS=["https://elsewhere-ui-review.vercel.app"]`.
For mapped-place planning set `ACTIVITY_SEARCH_ENABLED=true`,
`ACTIVITY_PLACES_PROVIDER=geoapify`, and server-only `GEOAPIFY_API_KEY`.
Optional Google checks need the existing backend-only Google/Routes keys,
with restrictions allowing Render's outbound IPs. Destination lookup uses
`PLACE_SEARCH_ENABLED=true`; observe the provider's use limits.

The existing database must already be migrated; startup never runs migrations.

## Connect the frontend after readiness succeeds

In Vercel's `elsewhere-ui-review` project set Config variables:

```
NEXT_PUBLIC_API_BASE_URL=https://YOUR-SERVICE.onrender.com/api/v1
NEXT_PUBLIC_PLANNING_AI_ENABLED=true
```

Redeploy the frontend. Leave its existing Supabase public configuration intact.
Verify sign-in, opening a saved trip, sending a chat message, and receiving a
completed reply. A cold start may initially time out: retry the connection once
the service has started. Do not stop the old API until account saving is verified.

## Recovery and limits

Use **one Uvicorn worker**. The worker catches queue outages and backs off;
normal idle polling waits five seconds. PostgreSQL row locks, heartbeats,
60-second leases and the existing attempt limit protect job processing.
Shutdown allows 20 seconds for in-flight work. If Render terminates the process,
unfinished work can be reclaimed after its lease expires on the next startup.
As with the existing worker, model/provider calls may be repeated after a crash;
proposal publication remains protected by the job lease and current trip state.

Render Free sleeps after 15 minutes without inbound traffic and may restart at
any time. Pending jobs resume only when the service is awake; this is not an
always-on worker or a guaranteed completion service. Free hours are shared across
the workspace, and Render can restrict high outbound traffic. Do not add uptime
pings to prevent sleep. For dependable unattended jobs use a persistent paid host.

Keep `PLANNING_WORKER_EMBEDDED=false` on Vercel/serverless deployments.

References: https://render.com/docs/free and https://render.com/docs/deploy-fastapi

## Verified deployment — 13 November 2026

- Render service: `elsewhere-api-worker`, Free, Singapore; service ID
  `srv-dbrh4boae00c73flh46g`.
- Source branch: `codex/render-web-worker`; runtime change commit `6a20c30`.
- API base: `https://elsewhere-api-worker.onrender.com/api/v1`.
- Readiness returned HTTP 200 with Supabase connected at `0019_google_place_ids`;
  readiness also checks that the embedded worker thread is alive.
- Browser preflight for the production frontend returned HTTP 200.
- Vercel production frontend redeployed as `dpl_B7c88tpTzdRfwuagxrjdf1qfZug8`
  from the existing main commit `5dd2df3`, using the Render API URL and AI UI flag.
- Verified in the signed-in production browser: saved trip opened, chat loaded,
  an "Explain this day" request completed and displayed a reply. No local
  planning worker was running. The traveler's unsent composer text was preserved.
- 29 lifecycle/health/job/conversation tests and 11 identity tests passed; Ruff
  passed for the changed Python files. Credentials were imported into Render
  with the owner's explicit approval; the temporary local import file was removed.

The former Vercel API remains available as a rollback option. It does not run
an embedded worker. The local uncommitted itinerary/delay features were not part
of this deployment, and no migrations or changes to existing trips were applied.
