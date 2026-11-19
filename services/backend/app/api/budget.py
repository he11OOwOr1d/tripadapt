"""Owned snapshot cost coverage; never mutates or calls a price provider."""

from uuid import UUID

from fastapi import Depends, Header, HTTPException, Request, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.identity import current_user, session
from app.api.proposals import plan_input
from app.api.trips import Envelope, get_version, router, wrap
from app.persistence.models import AppUser, PlanVersion
from app.planning.cost_coverage import CostCoverage, project_costs


@router.get(
    "/trips/{trip_id}/versions/{version_id}/budget",
    response_model=Envelope[CostCoverage],
)
def budget(
    trip_id: UUID,
    version_id: UUID,
    request: Request,
    response: Response,
    if_match: str | None = Header(None),
    user: AppUser = Depends(current_user),
    db: Session = Depends(session),
):
    row = get_version(db, user, trip_id, version_id)
    row = db.scalar(
        select(PlanVersion)
        .where(PlanVersion.id == row.id)
        .with_for_update(read=True)
        .execution_options(populate_existing=True)
    )
    token = (
        f'"draft:{row.id}:{row.edit_sequence}"'
        if row.status == "draft"
        else f'"{row.status}:{row.id}"'
    )
    if if_match is not None and if_match != token:
        raise HTTPException(412, "PRECONDITION_FAILED")
    response.headers["ETag"] = token
    return wrap(request, project_costs(plan_input(db, row), row.id))
