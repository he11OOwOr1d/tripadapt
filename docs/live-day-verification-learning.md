# Learning: live day checks reveal data conflicts and a date-input bug

13 November 2026. This rehearsal exercised the complete browser → authenticated proposal → Google Places/Routes → pending-review boundary with real provider responses. Its purpose was to verify a successful multi-visit live acceptance. That success case remains unverified; the live data encountered conflicts, which correctly prevented acceptance.

## Bug found and fixed

The check-only date initially appeared filled but disappeared after subsequent form updates, leaving Accept disabled. The day-delay form handled only the date input's change event. Handling its input event as well synchronizes controlled state with the browser's displayed value. The selected date then survived Google listing choices and explicit travel-mode changes, and acceptance became enabled when all required inputs and acknowledgments were present. Flexible trip dates were never changed.

The regression was reproduced and verified through the actual browser form. TypeScript, all 72 frontend tests and production build pass after the fix. Backend logic, provider restrictions, quotas, schema and environment values are unchanged.

## Live outcomes

| Rehearsal | Result | Effect on the trip |
| --- | --- | --- |
| Two mapped museum visits, walking mode | Both visits passed current-hours checks; the connecting route returned an access warning | Acceptance returned 409; review stayed pending; no schedule change |
| Same pair, explicitly selected driving mode | The route fit the available gap but included restricted/private-road usage | Acceptance remained blocked; no provisional fallback |
| One alternate museum | Google reported the first venue closed | Named visit feedback identified the conflict; review stayed pending |
| Final museum/gallery pair | No nearby Google match was returned for the gallery discovery record | Live acceptance remained disabled before a request could be submitted |

The date used for these checks was 13 November 2026. The first venue pair used 30-minute visits at candidate times 10:15 and 12:15, a preserved 90-minute gap and 10-minute arrival buffer. The final pair used candidate times 11:45 and 13:45. All venues were explicitly selected from actual discovery results and matched where possible; no sample response, coordinate substitution or unrelated listing was used to force a success.

API readiness confirmed the existing hosted database and schema revision `0019_google_place_ids`. Live discovery and Google match requests returned 200, proposal creation returned 201 and guard rejections returned structured 409 problems. The existing day timing UI exposed the route-access warning for inspection. These observations verify real connectivity and fail-closed behavior, not successful acceptance or a guaranteed itinerary.

## Decisions and lessons

- Keep access warnings blocking in live acceptance. A generous time gap does not establish permission to use a restricted route.
- A retained map record does not prove that a venue is open or that Google has a matching nearby listing. Identity confirmation and current-hours checks have separate jobs.
- A plausible time and an enabled form are insufficient evidence of a live success. Record the returned guard outcome and whether any version actually changed.
- Preserve the original review after a failed check. Changing mode is explicit; editing a venue requires a fresh candidate rather than rebasing the old one.
- Bound live QA instead of repeatedly changing venues until one happens to pass. No provider warnings were suppressed, security restrictions relaxed or provisional acceptance used to manufacture a result.

## Cleanup and remaining work

Only the existing QA trip's originally empty day 5 was used. Two temporary activities were added, revised for the bounded alternatives and removed afterward. Account autosave and reload confirmed the empty day restored. QA reviews 30–32 were discarded; the five earlier pending reviews remained. No proposal was accepted and no accepted snapshot changed.

Desktop and 390-pixel phone screenshots show the retained date and honest missing-match state: `/tmp/elsewhere-live-day-checks-desktop.png` and `/tmp/elsewhere-live-day-checks-phone.png`. Provider response bodies and Google details were not persisted in repository artifacts.

Next priorities are better place-identity discovery/reconciliation and a future live acceptance rehearsal using a genuinely eligible mapped day. Larger batches, other travel modes/destinations and provider outages remain outside this particular live rehearsal. Main design documents are untouched; only learning documentation is updated. No push or deployment.

Follow-up: [nearby matching refinement](place-matching-learning.md) now adds destination context, more bounded candidates and explicit name/address input while retaining the source-location guard. Moved-record reconciliation and successful live day acceptance remain open.
