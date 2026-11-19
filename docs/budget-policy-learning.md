# Preserve an explicit strict budget through the frontend

15 November 2026.

## Why this slice

The core-workflow audit found a constraint-loss bug: the backend/API supports target and strict budgets, but the account adapter loaded only the amount and always wrote `mode: target`. Editing a strict-budget trip through the frontend could silently weaken its constraint.

The view model now carries optional `budgetMode`; new/legacy mode-less drafts default to target. Account create/load/save retains strict mode, and invalid locally stored mode values fail validation before transmission. A zero amount remains an explicit budget, not a missing value.

## Interface and behavior

The optional preferences and final trip review now expose target versus strict beside budget controls. The selection is disabled until an amount is entered. Target copy explains that spending can exceed a guide; strict copy states that a draft can be saved but cannot currently be accepted because complete cost verification is missing. Switching to target is always explicit. Clearing the amount removes the budget as before.

Proposal review displays the mode and whole-trip amount. Existing server validation continues to block strict-budget acceptance; no cost or schedule guard was weakened. The current accepted snapshot stays unchanged when a strict draft is saved or its review is discarded.

The nearby summary now distinguishes missing stay/travel estimates from the user's selected budget. It no longer says “Budget left open” when a budget exists but no estimates have been entered. Cost breakdown warnings call the amount a target or strict limit consistently. Estimates remain labeled incomplete and do not imply live prices, bookings, refunds or complete expense coverage.

## Verification

- **420 backend tests** pass on local Python 3.12 and CI Python 3.14 (13 existing LangSmith warnings). One added API regression confirms strict persistence, a blocking `STRICT_BUDGET_UNVERIFIED` review and rejected acceptance without metadata/draft mutation. Backend implementation was unchanged. Changed-test Ruff passes.
- **131 frontend tests**, TypeScript and production build pass. Three added tests cover strict create/reload/unrelated-save preservation, explicit target selection, legacy defaults, zero amounts and rejection of invalid local policy before transmission. Whitespace passes.
- Real authenticated browser/API: entered INR 15,000 on the known QA trip, selected strict, autosaved and reloaded. Both optional preferences and final trip review retained strict. Server review showed the strict-cost blocker and **zero acceptance actions**. Phone dialog client/scroll widths both 347px; desktop/390×844 phone checked and viewport reset.
- Explicitly selecting target saved that mode without changing the amount. Discarded the strict review, cleared the temporary budget, and reloaded. A full `PlanInput` comparison—not just activity counts—matched the entire original QA draft. Accepted version **55** and planning lifecycle stayed unchanged; 11 activities remain. No accepted snapshot, reservation or chat turn was created.
- Screenshots: `.local/qa/budget-strict-desktop.png`, `.local/qa/budget-strict-review-phone.png` (ignored artifacts).

## Trade-offs and remaining scope

This preserves and exposes the constraint; it does not complete expense accounting. Current stay/transport inputs are user allowances, not a complete priced ledger. Strict acceptance remains unavailable until complete, correctly scoped costs can be checked. Making strict available in the form is not a claim that the system can currently satisfy it.

The next core slice should establish structured cost coverage: explicit units, known/unknown categories and paid/proposed amounts, before attempting to certify strict-budget feasibility. Live lodging/transport offers, fatigue revisions and trip-from-selected-point adaptation remain separate gaps; see [workflow audit](core-workflow-audit-learning.md).

Learning notes/journal only updated. Finalized PRD/architecture/API/database design documents and locked landing untouched. No new key, migration, push or deployment.
