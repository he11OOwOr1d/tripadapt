# Confirm context before replanning the remaining day

14 November 2026

## What shipped

The itinerary has a “Check a fresh start for today” panel. Choose the accepted snapshot or saved draft, load that basis, explicitly confirm destination-local date/time and a retained mapped current location, then inspect a read-only readiness report. The context and check endpoints require account ownership. The check requires a matching base version and ETag; neither endpoint edits activities, creates a proposal, activates the trip or saves the reported location/time.

The report separates completed items, unresolved earlier items, an activity spanning the reported time, upcoming fixed/booked commitments and future flexible activities. Earlier does not mean completed. Unresolved status, a conflicting base or no future flexible activities prevents readiness. The selected destination/day is checked against the chosen basis, including days beyond seven.

## Decisions and why

- **Explicit accepted versus draft basis.** An accepted snapshot may differ from ongoing edits. Its activities, destination reference and timezone must remain together. Accepted tokens identify the current accepted pointer; draft tokens also include the edit sequence. A changed base requires reloading.
- **Reported location, no GPS.** Reuse attributed retained map records and existing bounded category discovery. The selected source is checked against the chosen destination reference. Search may retain public discovery records, but it does not attach them to the itinerary or store the traveler's report.
- **Local time with offset.** The server supplies an unconfirmed clock hint. The request must be within five minutes of server time, on today’s destination-local date and, for an exact trip, the selected scheduled date. Zone round-tripping rejects nonexistent DST times; an explicit offset distinguishes repeated hours.
- **Readiness is not permission or feasibility.** Reports expire after five minutes. A future generator must revalidate the base, report and constraints; this response is not an authorization token. Venue hours, journey feasibility and weather remain separate checks.
- **Native controls need real browser checks.** Testing caught a time input whose displayed value could change without React updating the submitted value. Handling input as well as change fixed it. Any time/location change clears confirmation and the previous report.

## Trade-offs and limits

- This slice checks readiness only. It does not generate a remaining-day proposal, route from the current location, infer progress, cancel reservations or make bookings.
- The location search covers partial categories within 5 km of the destination centre. It is not arbitrary-address, hotel or GPS coverage. Destinations without a map reference need one before checking.
- Past and in-progress items require an explicit status decision in the plan. When using an accepted snapshot, draft edits must go through the existing review/accept flow before they change that snapshot.
- The current implementation rejects base-wide blocking validation conflicts conservatively. A later generator may offer scoped repairs, but must explain them rather than ignore conflicts elsewhere.
- No location/report persistence or new database migration. The future proposal endpoint needs its own validation and concurrency boundary.

## Evidence

- 362 backend tests pass on Python 3.12 and CI Python 3.14; the latter retains 13 existing LangSmith deprecation warnings. Ten new tests cover classification, no input mutation, long stays, positive readiness, empty remainder, exact-date mismatch, stale/wrong-offset reports, DST gap/fold, ownership, source mismatch, mandatory/stale preconditions, no created version/lifecycle change and accepted/draft separation after draft edits.
- 95 frontend tests pass, including malformed/cross-basis/cross-day context rejection. TypeScript, Ruff on the new backend files and the production frontend build pass. Generated OpenAPI includes the two new endpoints.
- Browser: local web app against the real Supabase-backed service; accepted QA snapshot 42 and saved draft loaded separately. Geoapify returned six attributed places. Checking day 3 listed all five earlier uncompleted activities and no flexible remainder; no itinerary edits were made. A deliberately old local time produced the specific stale-time error; correction cleared confirmation and recovered. Positive readiness is covered by API integration tests, not a live browser rehearsal.
- Desktop and 390×844 phone checks: no dialog horizontal overflow (347px client/scroll width), stacked date/time controls, visible keyboard focus, result heading receives focus, Escape restores focus to the opener, fresh confirmation after reopening. No added animation. Screenshots: `/tmp/elsewhere-readiness-desktop.png`, `/tmp/elsewhere-readiness-phone.png`.

## Next sequence

Prepare a bounded remaining-day proposal from freshly confirmed context. Preserve completed/protected activities, handle unresolved progress explicitly, check the initial journey from the reported location and every affected connection, then reuse preview, live-evidence acceptance and stale-base protection. Broader autonomous replanning and multi-visit live acceptance remain separate milestones.

Only learning notes/journal and generated code contracts were updated. Finalized PRD, system architecture, database/API design documents and the locked landing were untouched. No push or deployment.
