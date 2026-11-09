# Landing direction layouts

**Approved and locked: 9 November 2026.** The final landing combines the unchanged pasture hero, green-and-beige palette, Peach postcard introduction and Alpine compact sample planner. Further landing refinements are deferred until the wider product is built.

## Current comparison

The beige-and-green Field notes design is the default and now adopts the approved Peach postcard composition, for its editorial introduction. Its sample planner uses the compact Alpine layout, keeping choices beside the live trip summary. Its tape, note, ink and shadows use sage and pine rather than peach and slate. Alpine and Peach are alternatives that change composition as well as colour. The approved hero artwork and the connected sample journey remain shared.

- `/design/fieldtrip/original#about`: Field notes postcard layout in beige and green.
- `/design/fieldtrip/alpine#about`: Alpine daylight.
- `/design/fieldtrip/peach#about`: Peach horizon.

The Design directions selector is a local review tool, not a proposed customer-facing feature. Switching in place retains trip selections; opening a direct route initializes a fresh sample.

## Alpine daylight

A wide, calm panorama anchors an asymmetric heading and explanation. A route/date overlay makes the artwork part of the planning story. Three horizontal feature links lead into the matching planner tabs. The supporting workspace uses precise edges, quieter panels and a more structured information hierarchy. Journal and footer styling follow this restrained direction.

## Peach horizon

A large editorial heading sits alongside a taped, rotated postcard, a circular stamp and a small handwritten-feeling note. A trip bookmark ties the illustration back to the selected journey. The planner is open rather than enclosed in a large panel; pill tabs and lightly tilted cards introduce a softer rhythm. Its cost summary becomes a horizontal ledger below the workspace. Weather, journal and footer treatments follow the paper-and-postcard direction.

## Implementation

`DirectionIntro.tsx` supplies the alternative introductions. `directions.css` scopes composition changes using the landing root's `data-direction`. Shared state remains in `LandingExperience.tsx`; design switching does not remount that state. `FieldtripDesign.tsx` maps the active review palette to a treatment. Dusk remains the earlier colour-only study.

## Verification

Production build and TypeScript passed with 43 routes. Reviewed both introductions and the Peach planner at 1440×1000. Checked controls for horizontal clipping at 1280×900. Adding Shangarh produced the three-stop ₹16,100 sample, which persisted when switching to Alpine and then Field notes. Alpine's practical-details link selected the Stay & travel tab. The trip dialog opened and closed with Escape. Final screenshots use the reset two-stop sample.

Preview captures are in `docs/references/palettes/`: `alpine-redesign.png`, `peach-redesign.png`, their `-full.png` counterparts, and `peach-redesign-planner.png`. These changes are local; the Vercel deployment has not been updated.

## Combined Field notes direction

Introduction and planner treatments are independently selectable through `direction` and `plannerDirection`. The green default combines the Peach postcard introduction with Alpine’s compact planner. Peach and Alpine review routes retain their own complete treatments.
