# A lighter remaining day for a tired traveler

15 November 2026. Implementation note, not a change to the finalized requirements.

## Work and scope

The core workflow audit listed tiredness-driven revisions as missing. They now extend the existing remaining-day replanning, which already requires a confirmed current time and mapped location, a timing preview, a saved proposal, fresh route checks and explicit acceptance. They do not add a parallel edit path.

In the "A fresh start for today" dialog, the "Feeling tired?" section offers two **explicit** choices:

- **Rest here first** (0–120 minutes in the UI; the API allows up to 240). The rest time is added to the starting clock before the first journey, so later flexible start times shift.
- **Skip for today.** Tick any of the "Available to reconsider" (flexible) activities.

The app never decides what to drop, shorten or reorder.

## Safeguards

- Fixed, booked and completed activities cannot be skipped: the server returns `REPLAN_SKIP_PROTECTED` or `REPLAN_SKIP_INVALID`. Commitments keep their times, and the existing commitment-conflict check still applies.
- Skips and rest are part of the frozen request. Acceptance re-runs the same deterministic preview from that request, re-checks every remaining journey (including the rest offset), and verifies the stored candidate is exactly the base minus the named skips plus the frozen time changes.
- When anything is skipped or rest is added, an extra acknowledgeable issue (`REMAINING_DAY_FATIGUE`) names the skipped activities and their times. It states that skipping cancels or refunds nothing, that paid costs linked to them stay recorded, and that their estimates are removed. Acceptance needs this acknowledgement as well as the existing remaining-day one.
- The client validator rejects a preview whose skips or rest differ from what the traveler chose, including any skip the traveler didn't tick.

## Bug found and fixed

Combining skips with linked costs exposed a latent integrity bug. Candidate builders that remove an activity through a bare model copy skip plan validation, so linked costs were not reconciled. The stored candidate is reconciled when written, so the integrity comparison at acceptance failed with `PLAN_CONFLICT`. Two builders are fixed by re-validating the candidate:

- `apply_remaining` (remaining day, including skips);
- `remove_activity` (chat removal).

The weather replacement keeps the activity's logical ID, so its cost links remain valid.

## Verification

- **Backend (Supabase):**
  - An end-to-end test with rest and a skip: 10:15 + 30 min rest + 20 min drive + 10 min buffer gives Visit 2 at 11:15, and the fixed 13:00 visit is unchanged. The fatigue acknowledgement names "Visit 1 (10:20)". The draft is untouched until acceptance. Accepting without acknowledgements returns 409. After acceptance, Visit 1 is gone, its paid ticket is kept with `link_removed`, and its estimate is removed.
  - Skip guards for protected, completed and unknown activities, and for out-of-range rest.
  - A chat-removal regression test for linked costs.
  - The remaining-day, readiness and hours suites still pass.
- **Frontend:** 149 tests, including exact-choice validation and the save payload. TypeScript and the production build pass.
- **Not done:** no live signed-in browser walk-through of the dialog. This flow needs a signed-in account, a mapped current location and live Google route calls.

## Next

- Replanning across several stays and transfers.
- Recording what actually happened to each activity.
- Production deployment.

17 November live-browser follow-up: used the signed-in QA four-fixes trip with one mapped visit temporarily placed on today's destination-local date at 10:40. Fresh readiness at 10:17 allowed a 30-minute rest preview, moving the visit to 10:58 with a 10-minute buffer and preserving its duration. The starting point and destination were the same retained map record, so travel was zero; this did not verify an external Google route call. Saved the rest review, inspected its explicit fatigue acknowledgment and disabled acceptance before acknowledgment, then discarded it. Explicitly choosing the visit under Skip for today produced a preview naming that exact visit and no remaining visits. No proposal was accepted. Restored the original day/time; all QA plan values matched baseline by activity ID, with planning lifecycle and no accepted pointer. Screenshot: `.local/qa/fatigue-live-preview.png`. Live acceptance, different-location route checks and linked-payment retention through fatigue acceptance remain unverified in this walkthrough.

17 November acceptance follow-up: the signed-in QA audit trip was resumed to active, and one disposable 18:00 activity was added to today's otherwise empty day 3. Fresh saved-draft readiness, 30-minute rest and explicit skip produced a saved review naming that exact activity. Acceptance stayed disabled until the provisional, entered strict-budget, fresh-location and fatigue acknowledgments were checked. Acceptance succeeded; reload showed the empty day. Because every remaining visit was explicitly skipped, no external journey or hours lookup was required. Rest is acknowledged context, not an automatically added itinerary block.

Both saved draft and accepted plan were compared to their pre-test full PlanInput baselines, with activity arrays ordered by logical ID: both matched. Completed lifecycle was restored. Accepted version 7 and the test review remain in QA history; the accepted pointer changed even though plan content returned to baseline. No paid cost was linked to the temporary activity, so payment-retention-through-fatigue and different-location route acceptance remain separate live gaps. Screenshot: `.local/qa/fatigue-accepted-live.png`. No production code, push or deployment changed.

17 November different-location rehearsal: resumed the dedicated QA audit trip and temporarily moved its mapped 15-minute visit to today's day 3 at 11:00. Retrieved a distinct starting record, International Art Museum of America, through live Geoapify search. With explicit 10:25 local context and 30-minute rest, the Google-backed walking preview moved the Asian Art Museum visit to 11:14. Saved the proposal and selected all required acknowledgments. Fresh acceptance returned a remaining-day context/routes rejection; the UI preserved the pending review and original timing. The generic error did not identify which exact condition failed, so elapsed-time or route drift is not asserted as the confirmed cause.

Discarded the test review, restored the visit to day 1 at 10:30, and restored completed lifecycle. Full draft and accepted plans matched their captured baselines by logical activity ID; accepted version 7 stayed unchanged. Screenshot: `.local/qa/fatigue-route-blocked.png`. This verifies a live different-location route preview and guarded refusal, not successful route-backed fatigue acceptance. Better specific rejection feedback and a successful eligible acceptance remain open. No production code, push or deployment changed.

### Recovery guidance after a failed check

The frontend now translates known remaining-day errors into specific next actions across the workflow. The server still decides whether a schedule can be accepted. A live QA check verified that checking yesterday’s scheduled day explains the date mismatch and directs the traveler to today’s itinerary day. Desktop and 390px browser checks passed. The previously blocked different-location acceptance was not replayed in this check.

### Different-location acceptance succeeded

The QA traveler started at the International Art Museum of America and was headed to the Asian Art Museum of San Francisco. The live browser flow confirmed local context, previewed walking with 30 minutes of rest, saved the review, and explicitly accepted the 13:46 start after a fresh route check. The visit had originally been moved temporarily to 13:20 for the test. The original QA schedule was restored and verified against the baseline in both the draft and latest accepted snapshot. The QA trip began without an accepted pointer and retains the test and restoration snapshots in its history. This run used a planning trip and did not recheck venue hours or weather.

### Google Places access during the live hours check

The signed-in review required a matching Google listing before it could accept with hours enabled. A direct Places Text Search request from the backend host independently returned HTTP 403 with Google's generic `ACCESS_DENIED` reason for the configured `GOOGLE_MAPS_API_KEY`. The response did not identify an IP restriction, disabled service or billing issue. A working Routes request with `ROUTES_API_KEY` does not establish Places access.

In the Google Cloud project that owns the Places key, verify that billing is active, Places API (New) is enabled, and the key's API restrictions allow Places API (New). If the key is restricted by IP, verify the backend host's current public egress IP is allowed. Keep the key in the backend environment. Once the configuration is corrected, rerun the browser listing match and the hours-enabled review.

References: [Places API setup](https://developers.google.com/maps/documentation/places/web-service/get-api-key) and [Google Maps API security guidance](https://developers.google.com/maps/api-security-best-practices).

The automated fatigue acceptance check also verifies that a skipped visit's paid ticket keeps its identifier, amount and paid status in both the editable draft and the accepted snapshot. Only its activity link is removed. The linked estimate is dropped. This coverage uses simulated route responses.
