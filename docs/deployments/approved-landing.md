# Approved landing release — 9 November 2026

- Public URL: https://elsewhere-ui-review.vercel.app
- Project: elsewhere-ui-review (`prj_KRehkRCZYVAhi5eJgfWv6uXAbUTD`)
- Team: forchatgptnik-gmailcoms-projects
- Deployment: `dpl_DEqsg5Ai6BmYsWVmFzYHvLf1y3uD`
- Target: production; status READY; build approximately 19 seconds.
- Framework: Next.js. Source is the current local working copy, not a Git commit.

Approved combination: pasture hero, beige-and-green palette, Peach postcard introduction and Alpine compact planner. Landing work is locked; small refinements can follow completion of the wider product.

Uploaded a 37-file source snapshot through the Vercel plugin. The release snapshot serves Fieldtrip at `/`, redirects `/design` and `/design/options` to it, and removes the palette comparison controls. Local review routes and controls remain available. Source hashes are in `approved-landing-manifest.json`. No secrets or environment files were uploaded. Prepared snapshot: `/tmp/tripadapt-landing-approved`.

Local production build and TypeScript passed. Vercel reported READY and assigned the existing public alias. Anonymous HTTP checks returned 200 for root, Fieldtrip, new trip, demo trip and Archivo font. Browser verified the approved postcard and compact planner. Adding Shangarh updated the sample to three stops, seven stay nights and ₹16,100; its dialog showed the same details. Reset returned to the original sample. No browser console errors were observed. Screenshot: `docs/references/palettes/approved-live-landing.png`.

The site remains a UI prototype with illustrative dates, costs and weather. This release does not add live integrations or booking capability.

## Post-deploy observability

No error/fatal runtime logs matched the new deployment in the most recent five-minute window. A one-hour query exceeded the available retention window and was retried with five minutes. No drains are configured. Browser console was clean during the smoke check; ongoing external error monitoring is not configured by this release.

## Meadow edge refinement

Thinned the hero-to-page transition from 70px to 36px. Replaced the broad bare soil band with a short textured grass fringe using the hero’s four grass colors, leaving a narrow soil lip. Geometry is deterministic for server hydration; four batched SVG paths avoid thousands of individual DOM elements. Follow-up deployment: `dpl_BbTiih4jGMQPF2LHDocvk3Lm5PJz`.
