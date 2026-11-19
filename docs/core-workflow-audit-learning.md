# Core workflow audit after recovery-flow work

15 November 2026. Implementation assessment, not a change to finalized requirements. Read the finalized PRD for authoritative scope; this note separates delivered slices from remaining product work.

| Workflow area | Existing implementation and evidence | Remaining scope |
| --- | --- | --- |
| Personal trip setup | Ordered multi-destination route, exact/flexible dates, nights, origin/travelers, stay/transport allowances and autosaved account drafts | Real accommodation/transport offer selection and complete downstream dependency handling |
| Review and ownership | Separate draft/accepted snapshots, explicit proposal acceptance/discard, history, lifecycle controls and revision guards | Broader lifecycle/archive UX; this audit does not claim every completed-trip manual surface is immutable |
| Conversational planning | Durable planning jobs, scoped day proposals and explanatory/handoff chat; active chat has explicit limited permissions | Broad autonomous trip editing is not implemented; active chat does not generate arbitrary itinerary mutations |
| Adaptive day changes | Weather-related planning proposals, reported delays and explicit remaining-day context/timing reviews; protected/completed items and fresh checks retained | Fatigue-specific revisions and trip-from-selected-point changes that reconcile multiple stays/transfers |
| Recovery reliability | Guided unresolved-item editing, exact draft review/receipt recovery, read-only retry and immediate discard navigation cleanup | Persistent skipped/ongoing execution model; unknown proposal creation receipts still use pending history |
| Budget | Stay/transport allowance breakdown and backend strict-budget blocking; this slice fixes frontend strict-mode loss and exposes the choice | Complete scoped cost ledger, unknowns, paid versus proposed costs, conversion provenance and strict feasibility with sufficient evidence |

## Decision for this turn

Prioritize budget-mode preservation because it fixes a silent weakening of an existing hard constraint, rather than introducing another proposal path. The backend already rejects strict acceptance with incomplete costs; the UI now carries the user's choice honestly. [Implementation and verification](budget-policy-learning.md).

## Next functional slice

Establish structured cost coverage and explain unknown amounts before attempting strict-budget feasibility. Preserve the distinction between entered allowances and provider prices, keep paid costs separate from future spending and avoid double counting room/night/person/transfer units. Do not imply removing an item refunds money.

This is a focused audit of the implemented planning/replanning path, not a claim that every PRD integration or nonfunctional requirement was reverified. Finalized source documents remain unchanged.
