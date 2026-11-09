# Elsewhere — Landing Storyboard

> **Current flow proposal — 9 November 2026:** See [landing-and-planning-wireflow-v1.md](landing-and-planning-wireflow-v1.md) for landing content, exact CTA behavior and the guided planning journey. The Fieldtrip hero remains approved; older storyboards below are historical visual explorations. This proposal is for review and has not been implemented.

> **Latest exploration — 8 November 2026:** The user has requested a fresh pencil-stroke/cartoon direction and rejected the rendered scenery and dimensional character in the valley prototype. See [sketchbook-design.md](sketchbook-design.md) and `/design/sketchbook`. This is a new design for review; the older 3D references below are historical context, not constraints on this exploration.

**Updated:** 7 November 2026  
**Read with:** [visual-direction.md](visual-direction.md).  
**Scope:** Landing experience and feature storytelling, not the full application's screen specification.

**Approved sunny visual reference:** [hero-concept-v1.png](references/hero-concept-v1.png), approved 7 November 2026. Use its rich stylized 3D treatment as the shared art target across all scenes; see [implementation handoff](hero-art-review.md). Later scene poses/choreography still require review.

## 1. Narrative and approval status

**Rest → invitation → discovery → connected planning → personal pace → adaptation → return to rest.**

One world connects every scene. A map within it expands into the actual planning workspace, then resolves back into the world at the end.

The user confirmed the story direction and requested screen-by-screen visual exploration. The hero composition follows the user's drawing. Screen two's action and role are agreed in principle. Feature scenes below develop the discussed narrative and remain subject to individual visual review. Dialogue is draft copy; no character name is finalized.

## 2. Stage overview

| Stage | Narrative action | Visitor learns |
|---|---|---|
| 1. Passing storm | Relaxed traveler remains in the meadow as rain clears | The emotional invitation |
| 2. Meet the traveler | He gets up and approaches the visitor | A friendly guide invites them onward |
| 3. Discover possibilities | He brings/collects postcards and points toward possibilities | Research places and save ideas |
| 4. Connect the journey | He unfolds a map that becomes the workspace | Destinations, stays, transport, and budget fit together |
| 5. Make it your pace | He admires a plan with room to rest | Preferences and intentional free time shape the itinerary |
| 6. Change the day | A rain cloud affects an activity; he reacts and offers alternatives | Replanning preserves important commitments |
| 7. Back to the grass | He tires of presenting and returns to rest | Final invitation to begin |

Do not interpret this table as seven separately branded white sections. Use connected 3D scene framing and deliberate transitions.

## 3. Stage 1 — Passing storm / hero

### Layout

Follow [the original drawing](references/hero-composition-sketch.jpeg): mountains across the background, dominant peaks left/right, smaller peaks between, central river widening toward the bottom, lush grass on both banks, reclining person lower-left, house lower-right, clouds and sun above. Slightly elevated view across the meadow.

### Action

Initial rain with restrained distant lightning. Approximately 10–15 seconds later, rain has softened, clouds have separated, and sunlight reaches the grass. Settle into clouds intermittently shading the sun, swaying grass, flowing river, and subtle resting movement. Preserve one scene throughout.

### Interface

Minimal navigation plus a compact invitation placed after composing the scene. Candidate headline: “Some days, you need a different view.” Candidate CTA: “Find my elsewhere.” Secondary direct-planning path. Clear controls remain usable during the intro. Optional character thought on interaction: “I could stay here a while.”

### Resting frame to review

Sunny valley with no permanent speech bubble. Do not show all weather phases simultaneously. Weather storyboard annotations live outside the actual UI.

### Exit

The visitor's scroll attracts the character's attention and begins his approach. No unrelated full-screen replacement.

## 4. Stage 2 — Meet the traveler

### Entry choreography

1. Character turns toward the visitor.
2. Stretches and shifts weight.
3. Stands naturally from the reclining pose.
4. Walks toward the foreground along the left bank.
5. Scarf/clothes respond to movement and consistent wind.
6. Stops slightly left of center, faces visitor, opens one hand.
7. Dialogue and actions appear in the quiet space to his right.

Camera moves gently forward/lower if needed, maintaining world orientation. Character approaches physically, not as a suddenly enlarged overlay. House remains on the right, smaller behind him; river remains center/right; recognizable mountain shapes persist. Backpack remains where it was unless he visibly picks it up.

### Settled pose

Full or nearly full body. Soft smile, eye contact, head slightly angled, weight on one leg, one open inviting hand. Correct foot contact and shadow, readable silhouette, no rigid sales-presenter pose.

### Draft dialogue

“You want a little of this too?”

“I came looking for a change of scenery. Found this spot. Got very good at doing nothing.”

“Come on. I’ll show you how your next trip could take shape.”

Actions: “Show me how” → feature story; “I’m ready to plan” → direct setup.

Optional repeat-click joke: “A short introduction. I’ve got a very busy afternoon of nothing.”

### Visual scope

Do not add map/postcards/features yet. This stage introduces the companion. Design review should include the settled screen and separate reclining → rising → walking → speaking frames.

## 5. Stage 3 — Discover possibilities

### Intent

Introduce discovery without immediately demanding dates and budget. Show that the product welcomes more than mountain travel.

### Proposed action/composition

Character moves toward a resting spot along the same trail or near the house. He examines postcards; a few destination possibilities appear in a deliberate composition. He may enter from the left/peek beside a panel, motivated by walking there. Mountains/coast/forest/city can be selectable possibilities rather than abruptly replacing the entire established world.

### Draft dialogue and heading

“I knew I needed a break. Where to go? Absolutely no idea.”

Heading: “Follow what catches your eye.”

### Feature demonstration

One selected place opens readable details: image, description, duration, known hours/cost, available ratings/review attribution, source link, save-to-trip action. Other possibilities stay secondary. Do not invent review text as genuine data. AI summaries, if shown, are separate and clearly disclosed according to PRD.

### Exit

Saved places collect near a folded map. Their visual identifiers carry into the next stage.

## 6. Stage 4 — Map becomes workspace

### Intent

Demonstrate how discoveries connect into a practical multi-destination journey. This is the defining world-to-workspace transition.

### Proposed choreography

1. Traveler unfolds a physical map on a rock/table.
2. Camera approaches; selected places become readable markers.
3. Route lines connect destinations and stay lengths appear.
4. Map grows to occupy most of the viewport; world remains at the edges.
5. It resolves into stable itinerary/map controls, not a disconnected dashboard pasted below.
6. Character steps to an edge, giving information room.

Exact table/rock placement is open; adding it must respect the established world geography.

### Draft dialogue

“Then one place became three. This kept the journey making sense.”

Heading: “A few places. One journey.”

### Feature demonstration

Example route: Delhi → Jaipur → Udaipur → Delhi. Destinations and stay lengths editable. Show accommodation anchors and transport occupying real time. Budget labeled estimated with unknowns visible. No package-tour implication or duration restriction.

The physical map is a storytelling object; the resulting map UI must use appropriate sourced geography rather than fictional geographic accuracy. Demonstration values must be labeled where needed.

### Resting frame

Compact destination/day navigation, central itinerary, synchronized map, expandable assistant. Keep only the relevant panels open. No internal agent graphs or execution logs.

## 7. Stage 5 — Make it your pace

### Intent

Show the lifestyle direction affecting actual planning, not only marketing copy.

### Proposed action

Character leans near the workspace or points appreciatively at an open afternoon. He is mostly still while the visitor inspects the plan. Avoid blocking controls or creating a separate unrelated backdrop.

### Draft dialogue

“My one condition: leave time for absolutely nothing.”

Heading: “You don’t have to fill every hour.”

### Feature demonstration

A day includes activity durations, travel time, lunch, intentional free time, and dinner “Keep fixed · 8 p.m.” A request such as “Give us a slower afternoon, but keep dinner at eight” produces a proposed revision. Show what moves or drops and any cost change. A pace control is a proposed demo interaction, not yet a locked UI component. Do not invent wellness/relaxation scores.

### Exit

A cloud/weather cue draws attention to a relevant outdoor item, preparing the adaptation stage. Preserve workspace state.

## 8. Stage 6 — Plans meet real life

### Intent

Explain the product's core differentiation clearly: adapt connected plans while preserving user control.

### Proposed action

A small rain cloud appears over an outdoor activity. Character notices, opens an umbrella, and approaches from another motivated angle. Do not restart the opening's full storm. Keep the workspace readable.

### Draft dialogue

“The weather had other ideas. We worked around it.”

Heading: “The day changed. Your trip can too.”

### Feature demonstration

Choose “It's raining,” “Running late,” or “Taking it slower.” Show one primary example at a time. Rain replaces an outdoor afternoon with an indoor visit/café; dinner at 8 p.m. remains fixed. Preview moved/removed/added items, travel implications, estimated cost difference, and booking actions. “Apply changes” and “Keep current plan” are explicit alternatives.

If demonstrating infeasibility, explain the fixed commitment conflict rather than pretending success. All interactive landing examples are clearly demonstrations, not real bookings or live forecasts.

Optional monitoring can appear discreetly: off by default, periodic checks, user-approved changes. Do not claim external notification delivery before a channel exists.

## 9. Stage 7 — Return to rest

### Action

Character puts away props, stretches, and looks back toward his original spot. The workspace contracts into the physical map or otherwise returns spatially to the world. He folds it/picks up appropriate items, walks back along a coherent path, and lies down on the left bank again.

Restore the opening's recognizable composition: house right, river center, mountains behind. A subtle later light state is a proposal, not a mandatory sunset. No teleportation or inexplicable environment swap.

### Draft dialogue

“Right. That's enough productivity. My grass is waiting.”

Closing heading: “He's found his spot. Where's yours?”

Primary CTA: “Find my elsewhere.” Secondary direct-planning path. Compact footer.

The user specifically suggested that he gets tired of explaining and wants to return to where he was sleeping. Preserve that ending instead of automatically replacing it with him setting off on another adventure.

## 10. Interaction and accessibility across stages

- Visitor controls pace; normal scrolling and immediate route to planning remain available.
- Do not make text depend on completing every animation frame.
- Fast scroll snaps/blends to coherent stage states. Reverse behavior must be deliberate and visually continuous; exact replay policy remains open.
- Dialogue appears in short readable beats and remains accessible without audio.
- Sound off unless enabled. No compulsory thunder audio or intense repeating flashes.
- Reduced motion offers still scene compositions/simple transitions with the same information/actions.
- Mobile uses reframed stages, larger readable controls, and one workspace panel at a time. Maintain riverbank/landmark logic rather than shrinking the whole desktop composition.
- Character click jokes never block progress, cover controls, or substitute for error explanations.
- Source/availability/estimate disclosures remain readable in product demonstrations.

## 11. What each stage handoff must include

When asked for the next stage, provide only that stage unless the user requests otherwise:
1. Entry state and previous-stage continuity.
2. One primary resting composition.
3. Character pose, eye direction, gestures, and props.
4. Draft dialogue, clear heading, and actions.
5. Actual feature behavior, if applicable.
6. Exit transition and preserved state.
7. Small animation/accessibility notes.
8. A separate storyboard for motion if using a static design tool.

Inspect asset/render quality. A broken image, description in place of artwork, arbitrary character redesign, or a generic UI screenshot does not satisfy the intended scene. Review details at one stage before expanding the whole page.
