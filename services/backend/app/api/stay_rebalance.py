"""Owned draft-only night rebalancing between stays; never touches accepted plans."""

from datetime import datetime, timezone
from uuid import UUID

from fastapi import Depends, Header, HTTPException, Request, Response
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.api.identity import current_user, session
from app.api.proposals import apply_plan, plan_input
from app.api.trips import get_version, owned, router, sync_route, wrap
from app.persistence.models import AppUser
from app.planning.stay_rebalance import (
    RebalanceConflict,
    RebalanceInput,
    rebalance_stays,
)


class RebalanceRequest(RebalanceInput):
    apply: bool = False


@router.post("/trips/{trip_id}/draft/stay-rebalance")
def stay_rebalance(
    trip_id: UUID,
    body: RebalanceRequest,
    request: Request,
    response: Response,
    if_match: str | None = Header(None),
    user: AppUser = Depends(current_user),
    db: Session = Depends(session),
):
    trip = owned(db, user, trip_id, lock=body.apply)
    if trip.lifecycle in ("completed", "archived"):
        raise HTTPException(409, "TRIP_CLOSED")
    if trip.draft_version_id is None:
        raise HTTPException(409, "DRAFT_UNAVAILABLE")
    row = get_version(db, user, trip_id, trip.draft_version_id)
    if row.status != "draft":
        raise HTTPException(409, "DRAFT_UNAVAILABLE")
    if if_match is None:
        raise HTTPException(428, "PRECONDITION_REQUIRED")
    token = f'"draft:{row.id}:{row.edit_sequence}"'
    if if_match != token:
        raise HTTPException(412, "PRECONDITION_FAILED")
    try:
        candidate, summary = rebalance_stays(
            plan_input(db, row),
            RebalanceInput.model_validate(body.model_dump(exclude={"apply"})),
        )
    except RebalanceConflict as error:
        return JSONResponse(
            status_code=409,
            content={
                "type": "urn:tripadapt:error:rebalance-conflict",
                "title": "Stay change needs a decision",
                "status": 409,
                "code": error.code,
                "detail": error.detail,
                "activities": error.activities,
            },
        )
    if body.apply:
        apply_plan(row, candidate)
        sync_route(
            db,
            row,
            candidate.stops,
            candidate.activities,
            cascade=True,
            costs=candidate.costs,
        )
        row.edit_sequence += 1
        row.validation_status = "unchecked"
        trip.updated_at = datetime.now(timezone.utc)
        trip.lock_version += 1
        db.flush()
        token = f'"draft:{row.id}:{row.edit_sequence}"'
    response.headers["ETag"] = token
    return wrap(request, {**summary, "applied": body.apply, "etag": token})
