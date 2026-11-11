# Trip conversation — first slice

Update: [conversational time changes](conversational-edits.md) now support one reviewed start-time change on the selected day. The first-slice limitations below are historical.

10 November 2026. This continues the existing Elsewhere itinerary and Groq integration. The locked landing and personal trip form are unchanged.

## Delivered experience

Open **Chat with Elsewhere** in the saved itinerary workspace. Desktop keeps a collapsible conversation panel beside the route/day. Phones use a focused chat view with **Back to plan**; the current selected day and both views' work are preserved. Conversations are account-backed, with earlier-message pagination. Unsent text is kept in session storage for the trip. Escape closes chat, Ctrl/Command+Enter sends, and focus returns to the relevant control. The composer remains available for drafting a follow-up while a queued request runs.

Supported outcomes:

- Read-only facts: the selected day's schedule, destination order/stay nights/travelers, and recorded fixed/booked/completed items.
- Clarification: ambiguous requests produce concise choices plus the normal free-text composer.
- Additions to the selected day: a request such as **Suggest a rest break** narrows the sample catalog to the requested activity types and produces a proposal card. The existing review/accept/discard rules apply; chat alone cannot accept changes.
- Explicit limitations: modifying existing items, destination lengths, transfers, live searches, provider prices/weather and reservations are not conversational actions in this slice. The traveler can use the existing editor for manual changes.

Canonical quick choices are handled as explicit typed intents instead of spending a model call to guess their meaning. Other free text is classified by Groq into a strict routing schema. Read-only answers are rendered from authorized saved trip records, not invented by the model. The model does not have database-edit, acceptance or booking tools. This is an initial facts-and-additions companion, not an unrestricted travel-advice chatbot.

## Backend and durability

Migration `0016_trip_conversation` introduces private `conversation_turn` rows. Each contains a user message, a completed assistant reply/clarification/proposal reference through its unique job, bounded choices and a timestamp. Messages and their jobs are created in one transaction. Browser API roles have no table privileges.

`GET /api/v1/trips/{id}/messages` returns the latest 20 turns by default, with an owner/trip-scoped `before` cursor and a maximum page size of 50. `POST /api/v1/trips/{id}/messages` returns HTTP 202 and a durable turn/job reference. It requires the current draft ETag, UUID idempotency key, text (1–2,000 characters), explicit base version and selected-day scope. Blank text, stale drafts and cross-account access are rejected. Matching retries reuse the same turn/job. Normal public planning-job requests still use `operation: generate`; conversation jobs are admitted only through the message endpoint.

The existing PostgreSQL worker processes the request. It loads the frozen saved draft and at most six completed previous turns. These messages are context, while the saved trip remains authoritative. There is no permanent conversation-summary memory yet. The UI can retrieve older history without supplying all of it to the model.

A read-only reply is published only after lease/cancellation/base-freshness checks. It never updates the trip or draft. A supported addition runs the existing LangGraph planner with bounded instructions and a filtered activity catalog. Publication of its proposal and assistant reply is atomic. The proposal cannot move, replace or unlock existing activities, and it cannot touch another day/destination. The previous stale-proposal and evidence-ID safeguards also apply on acceptance.

The same per-trip/owner/global concurrency controls and durable retry limits cover conversation. Free-text classification plus planning permits at most six provider calls in an attempt; ordinary generation retains its existing five-call limit. Canonical quick actions can avoid the routing call. Known provider/auth/rate-limit failures use the existing safe error policy. Raw conversations are not written to logs; the private persisted history is only accessible through authorized trip endpoints. No credentials or other accounts' data enter model context.

## Progress and motion

The three-dot trail and text follow actual job status: reading the message, gathering context, composing, checking timing or retrying. Small wording variants are stable for a turn/stage; they do not cycle through invented internal thoughts or pretend provider searches occurred. A longer wait says the trip is unchanged. Cancellation remains available while work is pending. Reduced-motion preferences disable the dot animation. Replies appear after completion; token streaming is not implemented.

## Current evidence limit

AI additions still use the clearly labeled sample culture/walk/meal/rest/free-time catalog. This is real Groq execution with sample evidence, not live destination recommendations. Places, route times, hours, prices and weather remain unknown. Existing proposal acknowledgments make that distinction explicit. Selecting or accepting anything makes no reservation.

## Verification

The browser checks used the existing QA trip, leaving the traveler's original trip untouched:

1. Opened the desktop panel and asked **Explain this day**. An initial routing mismatch returned a route summary; canonical quick intents and the routing prompt were corrected. The retest returned the selected day's actual schedule.
2. Sent **Help me decide** through live Groq and received clarification choices.
3. Selected Jaipur day four and requested a rest break through chat. The proposal contained exactly one new 30-minute break and retained other days/items. It was reviewed and accepted; the day then showed one item.
4. Reloaded and reopened conversation history. Accepted schedule data and messages remained available.
5. Verified draft text survives Escape/close/reopen. Checked keyboard sending and focus behavior. Inspected 1440px desktop and 390/320px phone layouts. A four-button navigation overflow was found and fixed; phone document width stayed within the viewport afterward.

Backend tests cover persisted/idempotent messages, ownership/cursor isolation, blank/stale input, grounded replies that do not alter draft ETags, clarification scope, chat-to-proposal integration, explicit quick-action routing and the existing worker/planning protections. Final verification passed: 55 backend tests, 13 frontend regression tests, Ruff, and the production build with TypeScript validation. Screenshots are in `docs/references/trip-conversation/`.

## Running and next work

Use the existing server-only Groq configuration and `PLANNING_AI_ENABLED` / `NEXT_PUBLIC_PLANNING_AI_ENABLED` flags. No new key or database service is required. Run API, worker and web separately (`make api`, `make worker`, `make web`). No deployment was performed.

Next work: richer grounded explanations, more flexible clarification questions and preference handling, explicit typed edits to existing items, downstream replanning, live travel providers, long-conversation summaries and optional response streaming. Production usage quotas and durable LangGraph node checkpoints remain outstanding; the current durable job recovery can repeat provider calls after a worker crash.
