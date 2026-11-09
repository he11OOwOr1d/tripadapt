# Application screens — first implementation

7 November 2026. Implementation proposal for review; no final visual approval implied.

## Ownership and entry points

- `/trips/new`: empty trip setup; `/trips/demo`: labeled Rajasthan sample workspace.
- App screens own `apps/web/app/trips/`, `apps/web/lib/trips/`, and `apps/web/tests/trip-draft.test.mjs`.
- Landing chat was sent the route and ownership boundary. Landing page, layout, global styles, 3D scene, assets, and dependencies were not edited by this implementation.
- Scoped workspace CSS uses existing font availability. No artwork or new assets.

## Implemented behavior

Ordered destinations support repeated places, editable stay nights/timezones, reordering, and explicit removal with dependent activity deletion. Activities remain associated with destination IDs when route order changes. The UI identifies affected stays/transfers as needing review; neither is mocked as a live integration.

Setup captures exact dates, a tentative window, or duration; travelers, rooms, target budget/currency, origin, pace and interests. Itinerary sections use local destination day offsets. Add/edit/remove activities or free-time blocks; change destination/day/start/duration; explicitly change fixed/completed state. Booking state is separate and no supplier booking is created or changed.

Local checks expose overlaps, midnight-crossing activity blocks, invalid timezones, day bounds, stay-length and flexible-window conflicts. Conflicts may remain in a saved draft. No accepted plan or feasible proposal is fabricated. Prices, calendar scheduling, routing, forecasts, opening hours, accommodation and transfer checks remain unknown/unconnected. Overnight transfers are a later module, not represented as ordinary same-day activities.

Mock saves use a versioned browser-local slot, with explicit save/open and visible errors. Reloading then choosing **Open saved draft** restores it. It is not account/private/server persistence. Opening saved/sample data asks before replacing unsaved edits.

## API handoff

`TripAdapter` is a replaceable UI persistence port. Its `Trip` model is a frontend view model, **not an API request/response contract**. Current mock calls never reach the backend. No API contract change is proposed or made.

Once implemented endpoint schemas are available, map create/overview/stop/schedule reads to this view model and map explicit edits to the approved typed draft command families. The real adapter must preserve UUID/logical IDs, ETags and edit sequences, ownership, conditional writes, idempotency where required, server validation and paginated schedule sections. Full snapshot local saves must not become an invented server PUT. Proposal submission/review/acceptance is intentionally pending backend availability.

## Verification

Production build and TypeScript pass. Five Node tests cover interval boundaries, destination/day isolation, shortened stays, exact/flexible scope conflicts and mock persistence/failure. Run from root with Node 22.6+:

```sh
node --experimental-strip-types --test apps/web/tests/trip-draft.test.mjs
```

Headless Chrome exercised setup, activity creation/edit/movement, overlap display, save/reopen after reload, destination reorder and cascade removal, Escape dismissal, and 390px overflow. Desktop/mobile screenshots were visually inspected. No page errors occurred. Modal Tab containment and focus restoration are implemented; no screen-reader audit has been performed.
