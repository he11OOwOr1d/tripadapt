# Showing and carrying over journeys a route change removes

15 November 2026. Implementation note, not a change to the finalized requirements.

## Problem

Journeys are keyed by their endpoints, so reordering or removing a stop creates new journeys and silently orphans the old ones. The old journey's mode, hours and budget stopped counting. Costs linked to it followed the removal rule on the next save: estimates dropped, payments kept but unlinked. The traveler only saw one generic sentence of warning.

## Work

- **What it shows.** When the route step opens, the trip is captured as a baseline. While the traveler reorders, adds or removes stops, a "Journeys your route change removed" panel lists each journey that no longer exists and carried something they entered: mode, budget, estimates that will be removed if left, and payments kept as recorded.
- **Carrying over.** For each removed journey, the traveler can pick one of the new journeys that has no details yet and "Carry details over". This moves the travel details and every linked cost's journey key to the new journey and deletes the old details, so nothing counts twice. It never overwrites details the new journey already has, never carries to a journey that doesn't exist, and never carries from one that still exists.
- **Leaving it.** If the traveler leaves a journey uncarried, the existing server rules apply unchanged.
- **Where the code lives.** All of this is client-side and pure (`lib/trips/journey-impact.ts`), shown by `JourneyImpact.tsx`. `TripCreation.tsx` gained one insertion and the baseline capture. There is no server or schema change, because the existing removal rule already protects payments.

## Verification

- **Frontend:** 159 tests. They cover a swap listing the lost journey with its mode, budget, estimate and payment plus the three new journeys; carry-over moving the details and both linked costs exactly once and leaving nothing behind; refusing invalid sources and targets; and never overwriting existing details.
- **Browser (incognito, on-device, so no account data was touched):** Delhi → Jaipur → Udaipur with Rail and a paid INR 500 ticket on Delhi → Jaipur. Swapping the stops showed the panel. Carrying to Delhi → Udaipur cleared the panel; the Stay & travel step showed Rail on Delhi → Udaipur, and the ticket read "For the journey Delhi → Udaipur".
- TypeScript passes for these files. The production build is still blocked by the other session's in-progress `ProposalReview.tsx`.

## Limits and next

- The baseline is per visit to the route step, so changes from an earlier visit aren't listed.
- Changing the origin or the return choice elsewhere isn't covered by this panel; the server still reconciles those.
- Next: prompt for a new place after a move to another stay, and record what actually happened to each activity.
