"""One queue consumer alongside an HTTP server on a persistent web-service host.

Never enable this inside a serverless Function. PostgreSQL leases, heartbeats,
and attempt limits remain the authority for claims and restart recovery.
"""

import logging
import threading
from time import monotonic

from app.config import settings
from app.jobs.purge import purge_job
from app.jobs.worker import run_once

logger = logging.getLogger(__name__)


class WebServiceWorker:
    def __init__(self):
        self.stopped = threading.Event()
        self.thread = threading.Thread(
            target=self._run, name="planning-worker", daemon=True
        )
        # The first cleanup waits a couple of minutes so a restart settles before it touches anything.
        self.next_purge = monotonic() + 120

    @property
    def alive(self):
        return self.thread.is_alive()

    def start(self):
        if not (settings.planning_ai_enabled or settings.planning_fixtures_enabled):
            raise RuntimeError("Enable a planning engine before starting the worker.")
        if (
            settings.planning_ai_enabled
            and not settings.groq_api_key.get_secret_value()
        ):
            raise RuntimeError("AI planning requires GROQ_API_KEY.")
        self.thread.start()
        logger.info("Planning worker ready inside the web service.")

    def stop(self):
        self.stopped.set()
        self.thread.join(timeout=20)
        if self.alive:
            logger.warning("Worker stopping; unfinished jobs recover through leases.")

    def maybe_purge(self):
        """Erase trips deleted longer ago than the recovery window, at most once per interval. Never raises."""
        if not settings.trip_purge_enabled or monotonic() < self.next_purge:
            return
        self.next_purge = monotonic() + settings.trip_purge_interval_minutes * 60
        try:
            purge_job()
        except Exception:
            # No details: they could include database addresses. It is tried again next interval.
            logger.warning("Deleted-trip cleanup skipped; it will retry later.")

    def _run(self):
        while not self.stopped.is_set():
            self.maybe_purge()
            try:
                worked = run_once()
            except Exception:
                # Do not print database URLs, credentials, prompts, or trip data.
                logger.warning("Queue temporarily unavailable; retrying in 15 seconds.")
                self.stopped.wait(15)
            else:
                if not worked:
                    self.stopped.wait(5)
