# Planner UX refinement — 10 November 2026

Supersedes the verbose time-allocation screen and manual-save toolbar. The locked landing and approved Unfolding identity remain intact. User feedback: time allocation was unclear, transport inputs repeated across steps, the form was text-heavy and account actions dominated the page.

## Design plan and critique

Tokens: paper #e9e8d5, warm white #fff9e8, forest #294d3d, leaf #819968 and soft leaf #e3e9d3. Keep local Archivo/Barlow typography and the established layered form. Layout: `[wordmark | quiet save status · My trips · account]`, then `[compact answered steps + one active question | nearby route summary]`. Left align form text. The memorable detail is the proportional night ribbon tied directly to destination colors and quantity controls, not extra decorative artwork.

Review against brief: retain the beginning and ordered-place entry; remove duplicated travel timing from allocation; replace the ambiguous Room for each place label with Time in each place. A night is explained once with a concrete arrival/departure example. No slider with an arbitrary maximum and no seven-day cap. Avoid hiding constraints behind a purely decorative bar: numbers, native inputs, explicit conflict messages and text summaries remain accessible. Even splitting is an explicit user action, not an inferred recommendation. The first implementation retained too much of the old completed-step chrome; compacted answered rows and visually removed the repeated page introduction beyond the first step.

## Result

- Time in each place: total days/nights, proportional ribbon, per-stop +/- controls with keyboard-editable numeric inputs, explicit day visits, unallocated time and Split nights evenly. Overnight transport consumes the same night budget and is displayed separately.
- Stay & travel: short accommodation style choices and per-leg transport selectors. Budgets and journey timing are optional disclosures. No second allocation questionnaire. Cost details stay available without overwhelming an unpriced draft.
- Header: save status, My trips, account icon. New trip/sign-out/device recovery live inside the account menu. My trips is a native modal dialog with its own loading/error/empty states and focus restoration rather than an inline panel beside the form.
- Automatic saving: per-input debouncing; local recovery copy; serialized account writes that coalesce intervening edits; one account reference/ETag updated between writes; explicit sync failures and paused stale-version writes. Form inputs remain usable during a background save. Listing/switching trips flushes pending edits; the current trip cannot be replaced silently after a sync failure. Guests have a separate automatic device draft, never a sample/account backup silently loaded into their trip. New blank journeys are not created in the account until there is meaningful content.
- Reservations, supplier availability and research-backed suggestions are never implied. Day activities/revisions remain the existing workspace's separate concern.

## Verification

New queue tests cover serialized writes, coalescing, paused failed writes with explicit retry, and ignoring stale completion after switching trips. Existing adapter tests cover idempotent retries, account configuration failures and full trip round-trip. Browser QA uses a separate clearly named UX check trip, leaving the user's existing route untouched. Validated a 14-day two-destination allocation, preferences, automatic cloud creation/update, immediate library opening after rename, persisted preferences after reopen, overnight-travel conflict and resolution. Final desktop/mobile captures and checks are recorded below after completion.

The approved pattern is a local implementation; no deployment or Git push is authorized by this refinement.

Final QA: production build and TypeScript passed; all 8 frontend tests passed. In Chrome, verified account autosave without a save button, rename followed immediately by opening My trips, reopen/refresh with route and accommodation/transport choices retained, native numeric ArrowUp/ArrowDown and Tab behavior, modal Escape/focus restoration and account-menu Escape. Tested 390px and 320px layouts without horizontal overflow. In a separate unsigned-in browser, an 18-day guest draft restored its starting location and duration after refresh. Overnight transport was explicitly set to one night, produced an over-allocation message, then Split nights evenly resolved it to 6 + 6 accommodation nights + 1 travel night within a 14-day trip. Captures: `docs/references/planner-ux-refinement/`. Testing left a clearly labeled UX check account trip for review; the user's original trip was not edited.

Account sync remains version guarded. Invalid/incomplete fields can stay on the device until they form a valid API input; sync failures are visible and navigation flushes pending work. Existing device-copy recovery remains in the account menu. Reduced-motion CSS disables incidental effects; there are no animated step entrances or continuous motion. No supplier or itinerary-generation integration was added.
