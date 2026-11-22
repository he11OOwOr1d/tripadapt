# Shortlist and "not scheduled yet" (PRD FR-02 and FR-06)

22 November 2026. Two requirements asked for the same missing piece: FR-02 ("a place can be saved and added to an itinerary", "must-visit items that cannot fit appear in the unscheduled list with a reason", "API coverage gaps do not prevent manual place entry") and FR-06 ("requested items that do not fit remain visible"). Before this, a nearby place could only be given a day and time at once; there was nowhere to keep "I want to see this" without placing it, and nothing a traveler asked for was ever shown as left out.

## What it does

- **A shortlist per destination.** In the day view, below "Explore nearby places", a panel lists what the traveler wants in that destination. Each search result has **Save to shortlist** (it announces "Saved X to your shortlist", or why it could not). **Add something yourself** takes a name, an optional length and a must-visit tick, with no search needed, so places the map data does not know still work.
- **Must-visit, and how long.** Each entry can be marked must-visit and given a length (30 minutes to 6 hours, or "Not sure yet"). An unset length stays unknown; planning assumes an hour and says so in the reason.
- **Where each one stands.** Scheduled (day and time), skipped, or not scheduled. A filter shows everything, must-visit only, or not scheduled.
- **The reason.** For a must-visit or any open entry the panel says why it has no day, worked out from the same open time the day view draws (the traveler's own day hours, narrowed by recorded arrival and departure): either "Not placed yet. It fits on day 1 from 08:00 and on 1 other day", or "No day in Jaipur has 5 hours open. The longest open stretch is 4 hours on day 1. Shorten something, free a slot, or add a night."
- **Set a time.** Opens the existing activity editor already filled in on the first day it fits (the saved place travels with it, so the server checks it again); cancelling changes nothing.
- **Whole-trip view.** A "Not scheduled yet" list shows every must-visit item with no day, across destinations, with its reason and a button to open that destination. It works with or without exact dates.

## How it is built

- **No migration.** The list lives in the plan's `preferences.shortlists`, keyed by destination (like `stay_preferences`), so it is versioned, restored and accepted with the plan. Mirror limits: 30 entries per destination, a name up to 120 characters, a note up to 300, 5 to 720 minutes, a saved place at most once per destination, no unknown fields.
- **Saved place = a copy of the search result** (id, source id, name, category, position, source, retrieval time). Scheduling it sends only the place id, which the server resolves and checks as it already did. Stays are not allowed here (they have their own record).
- **Scheduled means:** an activity in the same destination that has the same saved place, or, failing that, the same name (case-insensitively), so a hand-made activity called "Fort" satisfies a wish called "Fort". A skipped activity does not count as scheduled.
- **Pure logic** is in `apps/web/lib/trips/shortlist.ts` (`wishReport`, `unscheduledMustVisits`, `openSpaces`) and reuses `dayTimeline`, `splitForJourneys` and `travelerDay`, so the reason can never disagree with the day view.
- **Lists belong to destinations.** On save, lists of destinations no longer in the plan are dropped, and only the fields the API knows are sent.

## Verification

- 25 backend tests (schema limits, refusals, round trip through a real saved draft, an old client without a shortlist) and 15 frontend tests (validation mirrors the API, add/change/remove, matching, scheduled/skipped/open, the reason wording, the exact-fit boundary, the traveler's hours, a recorded arrival, the unscheduled list, the editor handoff, the API shape). Mutation checks: removing the repeated-place rule, the exact-fit boundary, place matching, the scheduled test and the must-visit filter were each caught by a test.
- Whole suites after this change: 719 backend, 334 frontend; ruff, typecheck, build and the migration drift check are clean.
- **Live, signed in, local web and API against the hosted database, on a dedicated QA trip:** a hand-added must-visit entry showed "fits on day 1 from 08:00 and on 1 other day"; "Set a time" opened the editor with day 1, 08:00 and 3 hours filled in; after "Add to day" the entry read "Scheduled · day 1 at 08:00" and the count line vanished; it was still there after a reload (saved to the account). A real Geoapify search returned 11 museums; saving one showed it on the shortlist with its source and the assumed-hour note, and kept keyboard focus on the button, which became "On your shortlist". Saving a second result whose name matched in a different case said "Something with that name is already on the shortlist." Marking a saved place must-visit made the whole-trip view show "Not scheduled yet" with the reason. Axe found no violations in the shortlist, the search section or the whole-trip list; at 390 px there was no horizontal overflow and nothing under 44 px. The QA trip was deleted and then erased with the purge job; the database is back to its 10 trips.

## Not done, and boundaries

- **The AI planner and chat do not read the shortlist yet.** A must-visit place is not offered to the planner, and an AI proposal that leaves one out does not say so. That is the next slice (it touches the AI prompt, the add-only publish check and the proposal review).
- **No opening-hours reasoning.** The reason uses open time only. It does not say "closed on Tuesdays", because a saved place carries no hours; the existing hours check on a scheduled visit still applies.
- **Not checked:** the "no day fits" wording live in a browser (unit tests only), the panel with 30 entries, a screen reader, a touch device, the hosted app (not deployed).
- **Deploy and rollback:** no migration. The backend must go first (the older backend refuses an unknown `shortlists` field, so a plan saved with a shortlist is unreadable on it). After a shortlist is saved, roll forward rather than back.
