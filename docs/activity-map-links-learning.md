# Learning: link a map location without replacing an activity

13 November 2026. The activity editor now lets a traveler attach, change or remove an attributed map location on an existing activity. The search stays inside the current destination, with explicit category selection and filtering of returned names. Choosing a result edits only the local form; Save changes applies it through the existing account autosave path. Cancel leaves the saved activity untouched.

## Decisions and tradeoffs

- Preserve the activity's logical ID, personal title, kind, destination/day, local time, duration and fixed/booked/completed flags when attaching a location. This resolves missing-location warnings without deleting and recreating activities.
- Separate personal labels from map identity. Earlier validation required a label to equal the discovery record's name. That prevented a manual activity from keeping its own title when linked. Remove that equality check in client validation and backend saving, while retaining server-side place existence and exact destination-reference validation. The authoritative source record remains immutable and is displayed under its real name in the editor, timeline and full proposal.
- A title edit keeps an explicitly selected location. A destination change clears the location and Google listing. Choosing a different discovery snapshot or removing the map link clears the prior Google listing; reselecting the identical snapshot can retain it. Google checks still validate listing/location identity separately.
- Reuse the existing public discovery adapter and attributed Geoapify/OSM records. No private activity label or trip contents are sent in the search. Only the selected destination reference and category go to the backend. Account writes continue to send place IDs, not client coordinates or provider response payloads.
- Keep the form compact: a disclosure for search, explicit selection, then collapse back to the chosen place and return keyboard focus to its control. Loading, errors, no results, no filter matches, missing destination location and cancellation retain manual planning.

This remains a partial category search within 5 km of the destination centre, with at most the existing 12 results. It is not a comprehensive address, restaurant or hotel search. No new provider, API fields, migration or environment variables are needed. Linking a location verifies neither hours nor travel and makes no reservation. Existing pending reviews become stale after saving edits; prepare a fresh review rather than silently rewriting old candidates.

## Verification

264 backend tests pass on Python 3.12 and CI-matching 3.14. New coverage links and renames a day-13 manual activity while preserving its identity, 95-minute duration and all protected flags; reopens, accepts and detaches it while preserving the accepted snapshot. Missing/foreign place references and cross-destination associations remain rejected. Discovery records retain their original source names. All 67 frontend tests, TypeScript, production build, Ruff and diff checks pass. Frontend checks cover pure edit semantics, clearing stale Google IDs, wrong-destination choices and independent label/place persistence through the account adapter.

Live browser discovery returned 11 Jaipur museum records. On the existing QA trip's day-3 culture activity, filtering had an explicit no-match state; choosing Albert Hall Museum preserved the custom label, 09:00 start and 60-minute duration. Cancel/reopen showed no saved link. A second explicit selection was saved, account autosave completed, and reload showed the original title plus the real map name. Renaming retained the link; changing destination cleared it in the edit; Cancel restored the saved state. Desktop and 390/320-pixel phone layouts were inspected. The temporary map link was removed and saved afterward; original activity identity, timing and title were preserved. No activity was added, removed or accepted as a new itinerary version.

Screenshots: `/tmp/elsewhere-activity-location-desktop.png` and `/tmp/elsewhere-activity-location-phone.png`. Local API readiness confirmed its existing hosted database connection and schema revision; the separate disposable local database was used only for automated tests.

## Remaining work

A direct edit-and-return handoff from a pending review, broader place search and successful all-mapped live Google day acceptance remain open. This slice verifies live discovery and saved map attachment, not a successful Google acceptance check. Cross-day, weather and fatigue replanning remain separate work.

Only learning documentation updated; main PRD, architecture, API-design and database-design documents are unchanged. No push or deployment.

Follow-up: [direct review-to-editor handoff](delay-edit-handoff-learning.md) now addresses edit-and-return within the current session. The broader discovery and successful live Google acceptance gaps remain open.
