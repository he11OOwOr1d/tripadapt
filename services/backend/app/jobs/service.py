"""One queue consumer alongside an HTTP server on a persistent web-service host.

Never enable this inside a serverless Function. PostgreSQL leases, heartbeats,
and attempt limits remain the authority for claims and restart recovery.
"""

import logging
import threading

from app.config import settings
from app.jobs.worker import run_once

logger = logging.getLogger(__name__)


class WebServiceWorker:
    def __init__(self):
        self.stopped = threading.Event()
        self.thread = threading.Thread(
            target=self._run, name="planning-worker", daemon=True
        )

    @property
    def alive(self):
        return self.thread.is_alive()

    def start(self):
        if not (settings.planning_ai_enabled or settings.planning_fixtures_enabled):
            raise RuntimeError("Enable a planning engine before starting the worker.")
        if settings.planning_ai_enabled and not settings.groq_api_key.get_secret_value():
            raise RuntimeError("AI planning requires GROQ_API_KEY.")
        self.thread.start()
        logger.info("Planning worker ready inside the web service.")

    def stop(self):
        self.stopped.set()
        self.thread.join(timeout=20)
        if self.alive:
            logger.warning("Worker stopping; unfinished jobs recover through leases.")

    def _run(self):
        while not self.stopped.is_set():
            try:
                worked = run_once()
            except Exception:
                # Do not print database URLs, credentials, prompts, or trip data.
                logger.warning("Queue temporarily unavailable; retrying in 15 seconds.")
                self.stopped.wait(15)
            else:
                if not worked:
                    self.stopped.wait(5)
