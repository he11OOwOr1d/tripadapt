# Make trip lifecycle visible in the workspace

15 November 2026.

## Work and decisions

The workspace now shows the server-provided trip lifecycle in a quiet green-and-paper strip. Planning permits day generation; active trips emphasize the existing fresh-start check and use explanation/remaining-day chat prompts. Completed and archived trips keep conversation history available with new requests disabled. Unknown lifecycle values fail closed for these actions rather than assuming planning.

The account adapter carries lifecycle separately from editable trip settings, and autosave retains it when replacing the account reference. No new backend policy, database field or lifecycle transition was added. Server checks from the previous slice remain authoritative, including races after a page loads.

Chat keeps the traveler’s unsent message across close/reopen and reload. Active chat hides older replacement-research actions and replaces old follow-up choices with supported prompts. Existing proposal/history inspection stays available; backend acceptance still decides whether an agent proposal is stale. The interface does not describe the entire completed trip as immutable: this slice gates AI and remaining-day entry points, not every manual editing surface.

## Design rationale

Reuse the existing Elsewhere palette, typography and spacing. One left-edge status strip communicates the mode; a soft green treatment emphasizes the active day check. No new illustration, motion, status dropdown or competing primary navigation was introduced. Existing native buttons, focus treatment and fresh confirmation dialog remain in use.

## Verification and lessons

- 108 frontend tests, TypeScript and production build pass. Added policy coverage for planning/active/closed/unknown states, plus an adapter create/load/save check that retains lifecycle without writing it into plan settings. Whitespace checks pass.
- Browser against the real authenticated API: planning showed AI generation; temporary active state showed “Trip underway,” no generation button, and an enabled fresh-start action. Loading accepted context opened explicit date/time/location confirmation for version 46.
- Completed state showed its status, retained conversation history and an unsent note, disabled the composer, and exposed neither day generation nor the remaining-day check. Restoring planning re-enabled generation and preserved the note; the QA note was then cleared without sending.
- Desktop and 390×844 phone layouts inspected; viewport reset afterward. QA lifecycle changes were guarded by expected lifecycle/revision/snapshot assertions and restored to planning. Accepted/draft snapshots and their 11 activities each stayed unchanged. No proposal or new chat turn was created.
- Screenshots: `.local/qa/lifecycle-active-desktop.png`, `.local/qa/lifecycle-active-chat-phone.png`, `.local/qa/lifecycle-completed-chat-phone.png`, `.local/qa/lifecycle-planning-desktop.png` (ignored local artifacts).

## Trade-offs and next step

Lifecycle reflects the latest account load/save; it is not pushed between tabs. Server authorization remains the protection against a concurrent transition. No new keys or migrations are needed. Backend code was unchanged, so this slice ran frontend checks rather than repeating backend suites.

Next: deliberate start/finish lifecycle controls, with clear consequences, accepted-plan prerequisites where appropriate, concurrency handling and reversible navigation. Do not infer that a trip is active from its dates or silently transition it.

Learning docs only were updated. Finalized PRD, architecture, API/database design documents and locked landing remain unchanged. No push or deployment.
