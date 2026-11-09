# Elsewhere — visual wireframes v1

9 November 2026. Review deliverable, not final visual design or a live product implementation.

**Open:** http://localhost:3000/design/wireframes  
**Based on:** [landing and planning wireflow](landing-and-planning-wireflow-v1.md)

## What to review

The screen map links to ten visual surfaces. The left rail is a review tool and is not proposed product navigation. The product progress bar, Back and Continue controls demonstrate the actual guided sequence.

| Surface | Primary review question | Capture |
|---|---|---|
| Landing | Is the explanation clear before someone starts? Is the sample entry useful? | [Landing](references/wireframes/landing.png) |
| Basics | Are origin, travelers, rooms and date flexibility approachable? | [Basics](references/wireframes/basics.png) |
| Places | Is adding, repeating, reordering and removing destinations understandable? | [Places](references/wireframes/places.png) |
| Time | Can people understand stay nights versus overnight transport and resolve an over-allocation? | [Time](references/wireframes/time.png) |
| Stay & travel | Are per-bed, per-room, per-person and per-vehicle costs distinguishable? | [Comparison](references/wireframes/comparison.png) |
| Days | Is the distinction between suggested activities and free days clear? | [Days](references/wireframes/days.png) |
| Review | Does the trip overview give enough confidence without looking like a confirmed reservation? | [Review](references/wireframes/review.png) |
| Account save | Can people cancel or retry without losing the trip? | [Account](references/wireframes/account.png) |
| Workspace | Is it clear how to return to planning or report a change? | [Workspace](references/wireframes/workspace.png) |
| Revision preview | Is it clear what changes, what costs more and what stays fixed? | [Revision](references/wireframes/revision.png) |

[Screen map](references/wireframes/screen-map.png)

Start with **Walk through the experience**, then **Plan my escape**. Review the landing content hierarchy and the first three planning steps before debating final colours or illustrations. The hero block explicitly reserves the approved art; the existing Fieldtrip design and deployed site remain untouched.

## Interactive paths

- One sample draft carries traveler count, dates, route, durations, room/bed preference, transfer style, costs and accepted revision through the screens.
- Basics offers exact dates, a flexible window or unknown dates. Calendar day buttons and date text fields work. The calendar is an in-app date selector, not an external-calendar integration.
- Suggested places vary by theme. A manual place entry works; repeated stops have separate identifiers. Reorder uses keyboard-accessible buttons.
- Time separates overnight transport from stays. Increase nights beyond fixed dates and Continue shows a conflict. Suggest a split proposes an allocation; acceptance changes durations. Zero-night day visits are allowed.
- Stay and transport selections use explicit illustrative rate bases and recalculate group/per-traveler allowances. Unknown expenses are listed separately.
- Days can remain open. Activity editing/generation details are represented as a surface to refine, not a completed itinerary editor or AI integration. Weather and packing do not invent a forecast.
- Review offers an editable trip title, expandable itinerary/cost/packing areas, and return links to earlier steps.
- Authentication success/failure/cancellation are explicitly simulated; no credentials are requested. Cancellation retains the draft. The simulated success opens the workspace.
- The sample trip uses separate session state. Copying it into a personal draft clears exact dates and the accepted weather revision. Personal and sample edits do not silently overwrite each other.
- Browser Save/Open is an explicit local-only mechanism with failure notices. Nothing is saved to an account or server.
- The rain proposal preserves the sample 18:10 transfer, displays its additional per-person allowance and changes the draft only after acceptance. Open-day/no-disruption cases are represented.

## Scope and design fidelity

Quiet near-monochrome type, borders and reserved illustration areas are intentional. These wireframes are for reviewing hierarchy, information order and user decisions. They are not another proposed art direction. Desktop is the current review scope.

This is not the full PRD implemented: live providers, real authentication, production guest persistence, provider-specific occupancy/child-age rules, date/transfer feasibility, activity CRUD/generation, error recovery for every service and supplier booking operations remain separate implementation work. The landing's connected in-page sample is shown at the content/layout level and hands off to the interactive sample workspace here. No new API contract, database schema, or deployment is introduced.

## Verification

Production build passed (39 routes), TypeScript passed and browser error log was empty. Visually inspected Basics, Time, Review and Revision, and captured all ten surfaces at a 1440×1000 desktop viewport.

Exercised the guided flow with three travelers and three destinations. An over-allocation was blocked; the accepted split created five stay nights plus one overnight travel night within six available nights. Comfort rooms and shared transport produced ₹18,250; accepting the indoor alternative added ₹1,350 to reach ₹19,600. The 18:10 transfer remained fixed. Canceling sign-in retained the route, name and costs. An undated three-traveler draft was saved, the sample reset, and that draft was reopened successfully from browser storage.

## Decisions for the next review

1. Does the landing explain enough without delaying the primary action?
2. Should Basics remain one screen, or should date entry open as a dedicated panel?
3. Is the persistent summary useful, or too detailed before comparison?
4. Are the six stages the right divisions, especially Time versus Stay & travel?
5. Should the final overview initially expand the itinerary, or begin collapsed?

After layout approval, apply the approved visual direction and illustrations to these surfaces, then implement the actual application against the existing contracts.
