# UI feedback deployment

- Public URL: https://elsewhere-ui-review.vercel.app
- Project: elsewhere-ui-review (`prj_KRehkRCZYVAhi5eJgfWv6uXAbUTD`)
- Team: forchatgptnik-gmailcoms-projects
- Deployment: `dpl_CsZp39S9nENaKSLgjJwqgzXMHEAQ`
- Target: production, status READY
- Framework: Next.js, Node 22
- Source: current local working copy, not a Git commit or automatic Git deployment.

A focused 24-file snapshot was uploaded through the Vercel plugin. Included the Fieldtrip components/styles, global layout/styles, trip workbench and mock adapter, required fonts/licences, package files and TS configuration. Source manifest with SHA1/size is beside this note. No environment files or backend credentials were uploaded.

The deployment snapshot exports Fieldtrip at `/`; `/design` and `/design/options` redirect to Fieldtrip. This avoids presenting old design studies to reviewers. Original local entry routes were not modified. `/design/fieldtrip`, `/trips/new` and `/trips/demo` remain available. The temporary prepared source is at `/tmp/tripadapt-feedback-deploy` for this machine/session.

Verified the public production alias anonymously: root, Fieldtrip, demo and local Archivo font return 200. Browser review confirmed the canvas hero renders and adding Shangarh updates the route to three stops/seven nights and ₹16,100. The hosted build is a UI prototype with illustrative data; desktop remains its intended review size. Future local edits require another deployment.
