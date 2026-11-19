# Save and accept a remaining-day timing proposal

14 November 2026

## Outcome

A changed timing preview can now be saved as an immutable pending proposal, fetched again through the existing review flow, discarded or explicitly accepted. Preview and save leave the editable draft unchanged. Acceptance creates an accepted snapshot and synchronizes the draft only after acknowledgement, stale-plan checks, fresh context validation and fresh route checks.

The UI explains that saving retains the reported starting location/time with this proposal. Public map references and the user's report are retained; Google route payloads, route estimates and provider warnings are not saved as evidence. The frozen activity timings are the proposed application state, not a claim of verified venue availability.

## Decisions and why

- **No silent accepted/draft merge.** Accepted-basis proposals can be saved only when that snapshot and the current draft have the same plan data. A different draft requires choosing the saved-draft basis. Both draft identity/edit sequence and accepted pointer are pinned by the existing proposal boundary.
- **Save reruns the preview.** The server compares the submitted timings to a freshly computed result before freezing them. If routes or elapsed time change the result, the user must prepare another preview. Unchanged timings create no redundant proposal. Idempotent retries return the original proposal; keys cannot be reused across commands or changed bodies.
- **Acceptance checks the frozen plan.** Rebuild only the allowed start-time edits from the retained base and compare the entire candidate, preserving every unrelated field, activity, flag, duration and destination. Acknowledgements are validated before external calls. Rerun readiness and routes, then check the frozen arrival gaps—including the first journey from the reported location—against those fresh estimates and buffers. New estimates must fit the actual frozen times; acceptance never silently regenerates them.
- **Fresh context is required.** The five-minute report limit remains, and elapsed time can make a particular initial journey infeasible sooner. The user explicitly acknowledges still being at the starting point. Expired context, stale drafts, warnings, errors or insufficient gaps leave the review pending and the saved trip unchanged. Saved proposals can be reopened later, but expiry does not authorize accepting old location assumptions.
- **Reuse review/history.** The proposal appears with a remaining-day label and a short change list. Full itinerary remains accessible in a disclosure. Successful acceptance uses the existing refresh and version-history flow. No special booking or reservation action is introduced.

## Verification

- 379 backend tests pass on Python 3.12 and CI Python 3.14; CI has 13 existing LangSmith deprecation warnings. Eight new cases cover save/get/idempotency, no draft mutation before acceptance, synchronized acceptance, clock expiry, route warnings, candidate tampering, stale drafts, changed previews, cross-command key reuse, accepted/draft divergence, missing acknowledgement without provider calls and discard availability.
- 97 frontend tests pass, including exact basis/preview transport and idempotency-key propagation. TypeScript, production build, changed-backend Ruff and diff whitespace checks pass. Generated OpenAPI includes the save-proposal endpoint and strict bounded input.
- Live browser rehearsal against the real Supabase-backed backend: temporary Jaipur day-5 activity at Chhoti roundabout view, initially **21:08 for 20 minutes**. Reported starting point Sawai Jai Singh II; Google driving estimate **9 minutes**, plus **10 minutes buffer**. Preview and save proposed **21:25**, while the underlying timeline still showed **21:08**. Explicit acknowledgement and fresh-route acceptance updated the timeline to **21:25–21:45**, retained on reload. Plan history recorded accepted **version 43**.
- Desktop and 390×844 phone screenshots show the accepted timing. Restored original snapshot **42** through the normal review flow: exactly **one temporary activity removed, zero changed, no route/settings changes**. Reload confirmed empty day 5 and no temporary visit. Accepted test snapshot remains in history; nothing was booked or cancelled. Screenshots: `/tmp/elsewhere-remaining-accepted-desktop.png`, `/tmp/elsewhere-remaining-accepted-phone.png`.

## Trade-offs and remaining sequence

This is provisional timing acceptance with mandatory fresh route checks. It does **not** verify hours, weather, prices or reservations; the review requires acknowledging those limits. Walk/traffic-unaware drive, six remaining visits per action, preserved order/durations and clock-change-day rejection remain as documented in the preview slice. Trip length itself is unrestricted.

Next, extend the existing Google listing/hours review to all affected remaining visits while preserving the mandatory initial-journey guard. Add actionable per-venue failures and rehearse positive/blocked acceptance. Broader AI reordering, removals, duration changes and progress resolution require explicit user choices rather than being inferred from the clock.

Learning documentation and generated OpenAPI updated. Finalized PRD, architecture, database/API design documents and locked landing untouched. No push or deployment.
