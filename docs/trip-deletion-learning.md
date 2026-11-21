# Deleting a trip: learning note

21 November 2026. PRD FR-11 says a traveler can reopen **and delete** trips, and the API design lists `DELETE /trips/{trip_id}` (202: hide the trip, disable monitoring, cancel jobs, schedule a purge). The database already had `trip.deleted_at`, and every read already ignored deleted trips, but there was no way to delete. The status notes said so ("the app has no delete or rename"), and my own QA trips could not be cleaned up.

## What it does

- **`DELETE /api/v1/trips/{id}`** needs the trip's current `If-Match` version (428 without it, 412 if the trip changed since it was read), as `PATCH` does. In one transaction it stops the trip's unfinished planning jobs, sets `deleted_at` and bumps the version. It answers 202 with the id and the time.
- **Stopping jobs** is one shared function (`app/jobs/cancel.py`), also used by the existing "cancel job" endpoint: a queued job is cancelled outright and can never be claimed; a running one is told to stop; finished ones are left alone. A job row the worker holds locked at that instant is skipped rather than waited for, because the worker takes the job lock then the trip lock and delete takes them the other way round; skipping is safe because the worker re-reads the trip before publishing and already treats a deleted trip as superseded.
- **My trips** now has a **Delete** button per trip with an inline confirmation: "It leaves your account now and any planning in progress stops. This can't be undone from the app." The safe choice ("Keep it") has the focus, backing out returns focus to that trip's Delete button, and after a delete focus moves to "Start a new trip" and a polite notice says what was deleted. Failures are said plainly ("Nothing was changed; try again in a moment") and the trip stays listed.
- **Deleting the trip that is open** lets any in-flight save finish first (so it cannot land after the delete), then returns to a blank new trip with the library still open, and overwrites the device copy of that trip so its content does not linger in this browser.
- **A trip already deleted elsewhere** (a stale list, another tab) counts as deleted: the traveler asked for it to be gone, so a 404 is not an error. If the trip changed between reading its version and deleting (its own autosave, another tab) the version is read again and the delete retried, up to three times.

## What it deliberately does not do

- **It does not erase anything.** The rows stay, marked deleted, and nothing reads them. The design's section 14 calls for a background cleanup after a recovery window; that job is **not built**. It is a destructive operation on tangled foreign keys (trips and versions point at each other, and jobs, proposals and chat turns reference the trip without cascading), so it should be written and tested carefully with a retention decision from the owner, not blind. Until then "deleted" means hidden, and the confirmation text says "leaves your account", not "erased".
- No undo, and no list of deleted trips.

## Bugs found on the way

- **CORS refused the request.** The API allowed only `GET`, `POST` and `PATCH` from the web app, so the browser's preflight for `DELETE` was answered 400 and the first live delete failed (gracefully, with the right message). The 654 backend tests passed because the test client does not enforce CORS. It is fixed, with a test that checks the preflight directly (allowed for the web app's origin, refused for another origin and for `PUT`). On the hosted site this would have broken deletion after deploy.
- **Focus was lost** after "Keep it" (it fell to the page body); fixed by returning it to the Delete button. Found by checking, not by a test.

## Checks

- Backend: 11 new tests, 655 pass. They cover the version requirement, hiding from reads and the list, other trips untouched, deleting twice, another traveler, queued jobs, a running job that never publishes, finished jobs left alone, and a **walk over every route in the API that takes a trip id**: after deletion none may succeed (GETs must answer 404; anything else must be a 4xx). I broke the code three ways on purpose (reads forgetting `deleted_at`, jobs not stopped, delete skipping the job step) and each was caught.
- Frontend: 6 tests for the read-version-then-delete logic (already gone, version changed and retry, bounded retries, other errors not retried, a missing version never guessed); 311 pass.
- Live (local app, local API, the real account database, disposable "QA delete test" trips only; the two earlier QA trips were not touched): confirmation shows with focus on "Keep it"; Keep it returns focus; delete removes the row with a notice; the API then answers 404 and the list omits it; deleting the open trip with an unsaved edit in flight resets to a blank trip, keeps the library open, shows no sync error, overwrites the device copy and does **not** create a new trip afterwards; a trip deleted elsewhere is handled without an error; with the API stopped the app says it could not delete and keeps the trip, and a retry after the API returned deleted it. All four disposable trips were deleted with the feature itself.
- The dialog markup was also rendered in a guest page (the signed-in window cannot take screenshots) at 1280 and 390 px: no controls under 44 px, no overflow.
- **Not checked:** the hosted site (not deployed), a screen reader, and the unverified assumption that a deleted trip's worker-side leftovers (a conversation reply already saved for it) are harmless because nothing can read them.
