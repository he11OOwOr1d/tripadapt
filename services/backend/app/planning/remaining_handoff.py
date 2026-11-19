"""Read-only pointer into explicit remaining-day confirmation; no user report."""

from typing import Literal
from uuid import UUID

from pydantic import Field

from app.planning.readiness import scoped_day
from app.trips.schemas import StrictModel


class RemainingHandoff(StrictModel):
    type: Literal["remaining_day"] = "remaining_day"
    stop_id: UUID
    local_day_offset: int = Field(ge=0)
    base_etag: str = Field(pattern=r'^"draft:[a-f0-9-]+:\d+"$')


def validate_remaining_handoff(plan, scope, action, etag):
    action = RemainingHandoff.model_validate(action)
    if (
        action.base_etag != etag
        or str(action.stop_id) != scope["stop_logical_id"]
        or action.local_day_offset != scope["local_day_offset"]
    ):
        raise ValueError("Stale remaining-day handoff")
    scoped_day(plan, action.stop_id, action.local_day_offset)
    return action
