# Checking a strict budget against complete entries

15 November 2026. Implementation note, not a change to the finalized requirements.

## Work and scope

Strict budgets used to block acceptance unconditionally (`STRICT_BUDGET_UNVERIFIED`). They can now be checked, but only when coverage is genuinely complete. Completeness cannot be inferred from what has been entered, so it needs both known amounts and an explicit statement from the traveler.

Coverage is **complete** only when all of the following hold:

- every stay and journey allowance is known, including allocated nights;
- no cost entry has an unknown amount;
- no foreign-currency entry is missing its conversion rate;
- no entry has unknown tax;
- the traveler has ticked **"I've entered every cost I expect for this trip"**. This is stored as `preferences.costs_confirmed`, defaults to false and is never inferred.

When coverage is incomplete, `missing` lists each gap in plain language, `total` stays `null` and acceptance remains blocked. When it is complete, `total` equals the known subtotal (estimates plus recorded payments).

## Validation outcomes for a strict budget

| State | Issue | Blocking |
| --- | --- | --- |
| Coverage incomplete | `STRICT_BUDGET_UNVERIFIED`, listing what's missing | Yes |
| Complete, total above the limit | `STRICT_BUDGET_EXCEEDED`, with both amounts | Yes |
| Complete, total at or below the limit | `STRICT_BUDGET_FROM_ENTRIES` | No, but it must be acknowledged |

The passing case is deliberately an acknowledgeable advisory and not a silent pass. The traveler explicitly accepts that the check uses their own entries and rates, not live prices or availability. Comparisons use exact decimals, so a total exactly at the limit passes.

## Decisions and trade-offs

- **The confirmation is a statement, not a proof.** It stays set until the traveler clears it. It cannot hide a gap the app can detect: any new unknown amount, missing rate or unknown tax makes coverage incomplete again regardless of the checkbox.
- **Paid totals stay separate.** `paid_total` remains `null` because a complete *spend* total does not mean every payment has been recorded.
- **Target budgets are unchanged.** They still guide planning and show "exceeds" warnings only.
- **No schema migration.** The flag lives in the version's preferences, so it freezes into reviews and copies across revisions like other settings.

## Verification

- **Backend, pure tests:**
  - complete and incomplete coverage for each gap type (blank amount, unknown tax, missing rate, tax not included without a percentage, unconfirmed);
  - exact boundaries: 170.68 against a 170.68 limit passes, against 170.67 it is exceeded.
- **Backend, end to end on Supabase:**
  - a complete strict trip totalling INR 270 is refused without the acknowledgement and accepted with it;
  - the same trip with a 269.99 limit gets a blocking "exceeds" issue and a 409 on accept;
  - the earlier incomplete strict-budget test still blocks.
- **Frontend:** 148 tests (confirmation round trip and never inferred, complete-coverage reply validation), plus TypeScript and the production build.
- **Not done:** no browser check of the checkbox or the missing list in this slice.

## Next

- Live price or availability evidence, so strict checks could rely on more than the traveler's own entries.
- Broader areas from the core workflow audit:
  - tiredness-driven changes;
  - replanning across several stays and transfers;
  - recording what actually happened to each activity;
  - production deployment.

17 November live-browser follow-up: on the signed-in dedicated QA audit trip, confirmed the entered total INR 299, including INR 200 linked paid stay counted once and EUR 1 plus 10% tax converted at the entered rate to INR 99. Unchecking completeness and waiting for account saving changed the complete total to Unknown and listed the missing confirmation with strict acceptance blocked. Restored the checkbox and saved; the total returned to INR 299. No proposal was accepted. Screenshot: `.local/qa/live-budget-verified.png`. This verifies checkbox/account-save/coverage feedback, not the acceptance action itself. Fatigue live routing, multi-item reminder sequences and post-commit lost-response browser simulation remain separate outstanding checks.
