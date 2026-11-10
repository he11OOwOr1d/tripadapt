# Authentication frontend studies — 9 November 2026

Three independent UI proposals, not an authentication implementation or selection of identity provider. Keep the locked landing, working Unfolding trip creation, backend auth and browser draft storage unchanged. No password/account/OTP is sent, persisted or accepted by a service.

## Plan and critique before building

Shared tokens: forest #294d3d, deep green #214536, paper #f4eddc, light paper #fffaf0, meadow #c5d5a3, focus blue #4264ae. Local Archivo for expressive display and Barlow for readable interfaces. Restrained motion, native inputs, visible labels and focus; no new font or asset dependency.

1. **Return path:** asymmetric forest-green welcome plane on the left, a quiet paper sign-in form on the right. Original winding linework expresses the return to a trip rather than reusing a scenic hero, postcard or route pass. Left-aligned form and copy. `[green invitation + return line | paper form + account switch]`.
2. **Open door:** a tall central arched paper surface, a compact wordmark above it and generous meadow margins. Form and heading have their own measured width; one small open-door line drawing supports the entry metaphor. `[wordmark] [arched focused form] [quiet account switch]`. No earlier photo-window composition or artwork is reused.
3. **A little room:** open horizontal typography above a wide form rail; a forest-green action strip anchors the bottom. On desktop the fields sit beside one another; phones arrange the same labels in a clear vertical sequence. `[large welcome / short note] [wide mode selector + horizontal form] [green action strip]`. Extends Unfolding's broad surfaces without duplicating its accordion.

Critique: exclude provider logos before provider selection, invented saved-trip contents, auth success screens, fake legal links and extra marketing-card grids. Use three genuinely different geometries rather than a common card with palette changes. Password recovery is a clearly labeled UI state, never a claim that an email has been sent. Comparison uses fictional input only; visitor-entered data lives in component memory and resets when leaving. No earlier design component or auth UI is imported.

## Implementation and verification

Gallery: `/design/auth-studies`. Routes: `/return-path`, `/open-door`, `/little-room` beneath that gallery path. Each includes sign-in, sign-up and password-recovery modes. New source is isolated in `apps/web/app/design/auth-studies/`; no prior UI component, auth SDK, database table or credential endpoint is reused or added.

The provider-independent form uses native email/required validation, explicit labels, a password reveal control, confirm-password mismatch feedback, keyboard focus after mode changes and honest preview submission states. Passwords clear after preview submission and mode changes; there is no fetch, server action, local/session storage or account-state mutation. Preview fields disable normal credential autofill where browsers/password managers respect those hints. No fake provider buttons, legal links or successful sign-in state are shown.

Reviewed all three in both sign-in and sign-up modes at 1440×1000, 390×844 and 320×780. No horizontal page overflow at the phone widths. Checked mismatched/matching passwords, show/hide type changes, recovery preview, sign-in preview, and keyboard Tab from password to reveal control. Recovery says no email was sent; submission says no account/authentication occurred. Used fictional test values, then cleared them for final captures.

Critique fixes: gave the password input its own accessible label so the Show button does not contaminate its name; preserved whitespace when the wide-layout note wraps on phones; kept recovery/footer hit areas at least 44px. The scoped styles reset inherited scenic heading shadows and use reduced-motion overrides. No dependency added. Production build passed (54 routes) and TypeScript passed after the final copy adjustment.

Captures are in `docs/references/auth-studies/`: gallery, desktop sign-in/sign-up pairs and phone sign-in/sign-up pairs for all three. This work is local only; no Git push or deployment was made. The existing uncommitted backend Supabase work was preserved.

## Reference-led direction: Trail companion

The supplied turtle recording introduced the interaction idea: a friendly character responds to password entry and hides when the password is revealed. `/design/auth-studies/trail-companion` adapts that idea into a new cream mountain goat with a forest-green trail backpack. It connects to the approved meadow's goats and uses its drawing primitives without changing the landing. No video frame or reference asset is shipped.

The backpack gains a bedroll, map, cup and flag as sign-up password length increases. This is explicitly illustrative, not a strength score or acceptance policy. The scene receives only the discrete packing stage, reveal/focus state and normalized email length; it never receives password text. Revealing a password makes the goat cover its eyes. Sign-in, sign-up and recovery remain provider-independent frontend previews. No credentials are transmitted or persisted.

Canvas background is cached, animation pauses offscreen/when hidden, and reduced motion renders state changes without continuous animation. Frame requests, observers and listeners are cleaned up. Native labeled inputs, visible keyboard focus, live feedback and large controls support accessible form use. A new composition and original character replace the prior auth studies' visual patterns; cream paper, typography and drawing style connect it to Elsewhere.

Verification: production build passed with 55 routes; TypeScript passed. Browser-reviewed desktop 1440×1000 and phone 390×844 / 320×780; no horizontal overflow. Confirmed full backpack state, reveal/hide privacy caption, mismatch feedback retaining inputs, matching preview clearing passwords, sign-in/recovery mode changes, honest no-email recovery feedback and keyboard Tab from password to reveal. Reduced-motion behavior was code-reviewed. Browser extension adds a `cz-shortcut-listen` body attribute and can cause a development hydration warning; it is outside the app markup. Reference screenshots live in `docs/references/auth-studies/trail-companion/`. Local only, no push or deployment; auth provider/session integration remains pending.

## Revision: Little lookout — 10 November 2026

Supersedes the backpack direction above. Feedback: backpack changes were hidden behind the goat and too subtle. Removed the bag, landscape, packing stages and illustrative length meter. The new original SVG portrait makes the goat itself prominent, using cream #f7efd5, paper #f1eddd, meadow #e5e8d5, forest #294d3d and scarf #41634c with the established Archivo/Barlow type. Layout remains `[large quiet portrait | left-aligned form]`; one character interaction replaces multiple decorative elements.

Immediate field-driven poses: email focus tilts the head toward the form with following eyes and lifted ears; either password field raises both hooves over the eyes; password reveal turns the face completely away. No password-length thresholds or security scoring. The scene receives only focus/reveal state and normalized email length. CSS transitions last 100–180ms and disappear with reduced motion; no continuous animation, canvas loop or observers remain. Mobile uses a compact sticky portrait so the reaction is visible near the focused form rather than scrolling away. Landing is unchanged. This is the current direction; preceding meadow/backpack captures are historical.

Revision checks: TypeScript and production build passed. Browser-checked the three poses, confirmation-field coverage, sign-in mode, mismatch validation retaining input, and widths 1440, 390 and 320px without horizontal overflow. Updated captures: `docs/references/auth-studies/little-lookout/`. No deployment or Git push.

## Approved design

User approved the Little lookout authentication frontend on 10 November 2026. Treat this portrait and its field-driven interactions as the finalized visual direction for sign-in/sign-up. Approval is for the design; identity-provider integration, real sessions, recovery delivery and server-side authorization still require implementation and end-to-end verification.

## Integration following approval

The approved form now has real `/sign-in` and `/sign-up` entry points using Supabase Auth; the original `/design/auth-studies/trail-companion` remains a no-network preview. See [authentication and account saving](authentication-and-account-saving.md) for current implementation, tests and the pending live email-delivery check. Earlier preview-only descriptions above document the design phase rather than the current application integration.
