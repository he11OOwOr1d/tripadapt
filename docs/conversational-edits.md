# Conversational time changes

10 November 2026. The next slice after facts and additions lets a traveler ask to move **one existing activity to an exact local start time on the selected day**. For example: “Move Explore the old city to 11:00 AM.”

## Experience and boundaries

Groq routes the request, then extracts a typed activity ID and HH:MM time from the scoped saved schedule. Missing/ambiguous activity or time asks for clarification. Fixed, booked and completed activities cannot move through chat. Unknown IDs, another day/destination, overlaps, crossing midnight and unchanged times are explained without a candidate. No other item moves to make space. Existing full-plan blocking constraints still apply.

A valid request creates a frozen proposal, leaving the draft unchanged. Review shows the activity, local day and current/proposed times. The complete itinerary is available in a disclosure. Acceptance requires acknowledging AI interpretation and unverified travel feasibility. Accept/discard, stale-base protection, cancellation, idempotency and ownership use the existing boundaries. No reservation is made.

## Implementation decision

Keep Groq/LangGraph and the PostgreSQL leased worker. A simple time command does not need a new multi-agent graph or a sample-catalog generation pass. Deterministic code copies the saved plan and changes one start-time field. The same dispatcher validates candidates at publication and acceptance. It reconstructs the expected result from the frozen base and typed command, rejects protected changes and compares the complete candidate. Normal additions retain their catalog and scope validation.

The request uses existing message/job/proposal endpoints and `generation` metadata; no database migration or new secret is required. The metadata distinguishes a requested move from sample-catalog additions and contains the before/after display. Two model calls are sufficient for routing/extraction; the existing six-call conversation ceiling remains. Model interpretation still needs user review, and opening hours/travel times remain unknown.

## Lesson from browser verification

A live request exposed a READ COMMITTED polling race: separate message and job queries could return an old empty assistant reply with a newly completed job. The messages endpoint now reads both rows in one joined SQL statement, so each displayed turn/status uses the same statement snapshot. A successfully completed job must not be presented as failed just because polling crossed the completion transaction.

## Verification

Automated checks: fresh PostgreSQL 17 migrations, 70 backend tests, 13 frontend tests, Ruff, TypeScript and production frontend build. New cases cover protected items, overlap/midnight/invalid/no-op times, scope, candidate tampering, clarification and message → proposal → explicit acceptance → reload. Browser verification uses the synthetic “UX check” trip; the personal trip is untouched. Live Groq routing/extraction used two calls to prepare a 09:00 → 11:00 move for “Explore the old city” on Jaipur day one. Reviewed at desktop and 390px, accepted on phone, then reloaded at 320px: the activity remained 11:00–12:30 with the same duration. No horizontal overflow was observed at 320px. Reference images: `docs/references/conversational-edits/`.

Broader edits (duration, removal, cross-day moves), cascading replanning, live providers, response streaming and production hosting remain future work. This is a single-activity time-change slice.

## 11 November: move to another day at the same destination

The traveler can now ask to move one activity from the selected day to another destination-local day, for example “Move my museum visit to day 2 in Jaipur at 11:00 AM.” An explicit request to keep its time is supported. Review shows both day numbers, both times and the destination name. The default for old commands remains the selected day; existing saved proposals continue to validate.

`destination_day` is a nullable, one-based destination day in the internal typed command. Null preserves the selected day. Ambiguous day references ask for clarification; out-of-stay day numbers are rejected. A zero-night visit has day 1, while longer stays have nights + 1 local days. Cross-destination moves, inferred whole-trip day mapping, protected edits and automatic conflict repair are excluded. No arbitrary trip-length cap is introduced.

Deterministic reconstruction changes only the requested activity’s local day and start time. It validates the full resulting plan, including overlaps on the receiving day, and repeats the checks at acceptance. Existing activities, duration, ownership and stale-version protections remain in effect.

Checks: 76 backend tests, 13 frontend tests, Ruff, TypeScript and production build. Integration tests cover acceptance/reload across days; unit cases cover bounds, receiving-day overlap, keeping the same time and rejecting destination tampering.

Live browser evidence on 11 November: Groq prepared the synthetic QA trip’s Jaipur move from local day 1 at 11:00 to local day 2 at 11:00. Desktop and 390px review displayed both days and times. Explicit phone acceptance cleared the source day; after reload, day 2 contained the same 90-minute activity at 11:00–12:30. At 320px, document width was 305px, within the viewport. Captures are in `docs/references/cross-day-edits/`. The traveler’s personal trip was not used.

## 11 November: reviewed duration changes

Chat can now propose an exact total duration for one existing activity on the selected day: “Make my museum visit 45 minutes.” The typed `ResizeActivity` command contains only an activity ID and total minutes. Groq can interpret explicit hour/minute units or an explicit increment from the saved duration; ambiguous requests ask for details. The model has no mutation tools. Combined move-and-duration requests ask for one change at a time.

Deterministic code preserves day, start time, label, protection flags and every other record. Fixed/booked/completed activities, unknown or out-of-scope IDs, nonpositive/no-op durations, overlaps, midnight crossings and other blocking plan conflicts cannot produce a usable proposal. A second reconstruction at publication and acceptance rejects extra changes. No automatic reshuffling occurs.

Review reuses the existing before/after treatment with explicit minute units and the unchanged start time. Existing acknowledgment, discard, stale-version, lease/cancellation and ownership boundaries remain. This adds no database migration, provider or credential. The tradeoff is a precise, reviewable edit rather than a general “make the day easier” replanner. Opening hours, travel buffers and supplier availability remain unverified.

Automated verification: 87 backend tests, 13 frontend tests, Ruff, TypeScript and production build. New cases cover duration/protection/scope/conflict checks, candidate tampering, missing-duration clarification and proposal acceptance/reload without changing the start time or other items.

Live duration check: the first request containing “keep its day and start time the same” received unnecessary clarification. The extraction prompt was tightened to distinguish keeping fields unchanged from combined edits and to prevent earlier move requests being carried forward as current intent. Retesting the exact wording produced the correct 90 → 60 minute proposal, with 11:00 and Jaipur day 2 unchanged. Desktop and 390px review captures are in `docs/references/duration-edits/`.

Phone acceptance succeeded. Reload at 320px showed Jaipur day 2 with the activity at 11:00–12:00, exactly 60 minutes; the day/start remained unchanged. Document width was 305px within the 320px viewport. The traveler’s personal trip was untouched. No deployment was performed.

## 11 November: reviewed removal

Chat can propose removing one explicitly named, unprotected activity on the selected day. The current message must request removal; bulk clears, replacements, hypothetical questions, ambiguous references and reservation cancellations require clarification. Routing and identification use bounded structured Groq calls. A typed `RemoveActivity` contains only the supplied activity ID.

Deterministic code removes that item from a deep copy of the frozen plan, preserves all remaining fields and rejects out-of-scope or fixed/booked/completed items. The candidate is reconstructed at publication and acceptance. Existing full-plan blocking validation still applies; unresolved conflicts may need manual attention first.

Review identifies the destination, day, local start and duration, with an explicit **Accept removal** action and a statement that no reservation is cancelled. Nothing leaves the saved draft before acceptance. Discard leaves it unchanged; a changed draft makes the proposal stale. The existing accepted-version snapshots remain immutable. A user-facing history/restore flow remains future work; this slice does not claim an undo control. No new migration, key or provider is needed.

Automated checks: 96 backend tests, 13 frontend tests, Ruff, TypeScript and production build. New tests cover protected and out-of-scope items, tampering that removes more than one item, removal of the final item, missing-identity clarification, draft preservation before acceptance, discard, acknowledgment, stale rejection and reload.

Live removal evidence: Groq prepared removal of the synthetic QA trip’s “Explore the old city” from Jaipur day 2 (11:00, 60 minutes). Desktop and 390px review identified the exact item and displayed Accept removal. Phone acceptance succeeded; reload at 320px showed the empty-day state with Add activity available. Document width remained 305px within the 320px viewport. Screenshots: `docs/references/removal-edits/`. The personal trip was untouched. No deployment was performed.
