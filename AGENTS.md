# Elsewhere project working preferences

- For user-facing changes, run the relevant browser and end-to-end workflow checks before reporting the change complete. Include desktop and phone checks when layout or interaction changes.
- Clearly distinguish live verification from simulated or unit-test coverage. Report remaining verification gaps explicitly.
- Use dedicated QA trips, record their baseline before mutations, and restore their original plan data after testing. Never silently use landing-page sample data for a personal trip.
- Update learning notes and the development journal. Preserve finalized PRD, architecture, API and database design documents unless the user explicitly requests changes to them.
- Keep the approved landing in `apps/web/app/design/fieldtrip/` locked except for a necessary small shared integration correction.
- Do not push or deploy unless the user requests it.
