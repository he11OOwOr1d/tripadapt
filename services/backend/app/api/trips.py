import base64
import hashlib
import json
from datetime import date, datetime, timezone
from typing import Generic, TypeVar
from uuid import NAMESPACE_URL, UUID, uuid4, uuid5

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, Response
from pydantic import BaseModel
from sqlalchemy import and_, delete, or_, select
from sqlalchemy.orm import Session

from app.api.identity import current_user, session
from app.persistence.models import (
    Activity,
    AppUser,
    CreateReceipt,
    DestinationStop,
    PlanVersion,
    Trip,
)
from app.trips.schemas import (
    ActivityInput,
    CommandBatch,
    PlanInput,
    StrictModel,
    TripCreate,
    TripPatch,
)


class Problem(BaseModel):
    type: str
    title: str
    status: int
    code: str
    detail: str
    request_id: str
    issues: list[dict]


router = APIRouter(
    prefix="/api/v1",
    responses={
        status: {
            "model": Problem,
            "content": {"application/problem+json": {}},
            "description": "Structured problem response",
        }
        for status in (400, 401, 404, 409, 412, 422, 428, 429, 503)
    },
)
T = TypeVar("T")


class Meta(BaseModel):
    request_id: str


class Envelope(BaseModel, Generic[T]):
    data: T
    meta: Meta


class TripView(StrictModel):
    id: UUID
    title: str
    lifecycle: str
    current_version_id: UUID | None
    draft_version_id: UUID | None
    lock_version: int
    created_at: datetime
    updated_at: datetime


class VersionView(PlanInput):
    id: UUID
    trip_id: UUID
    version_number: int
    edit_sequence: int
    status: str
    source: str
    validation_status: str
    validation_report: dict


class StopView(StrictModel):
    id: UUID
    logical_item_id: UUID
    position: int
    name: str
    timezone: str
    desired_nights: int | None
    arrival_date: date | None = None
    departure_date: date | None = None


class Page(BaseModel):
    next_cursor: str | None
    has_more: bool


class TripList(Envelope[list[TripView]]):
    page: Page


class Me(StrictModel):
    id: UUID
    email: str
    display_name: str | None
    email_verified_at: datetime | None


def wrap(request, data):
    return {"data": data, "meta": {"request_id": request.state.request_id}}


def owned(db, user, trip_id, lock=False):
    query = select(Trip).where(
        Trip.id == trip_id, Trip.owner_id == user.id, Trip.deleted_at.is_(None)
    )
    trip = db.scalar(query.with_for_update() if lock else query)
    if trip is None:
        raise HTTPException(404, "RESOURCE_NOT_FOUND")
    return trip


def etag(trip):
    return f'"trip:{trip.id}:{trip.lock_version}"'


@router.get("/me", response_model=Envelope[Me])
def me(request: Request, user: AppUser = Depends(current_user)):
    return wrap(request, user)


@router.post("/trips", status_code=201, response_model=Envelope[TripView])
def create(
    body: TripCreate,
    request: Request,
    response: Response,
    user: AppUser = Depends(current_user),
    db: Session = Depends(session),
    idempotency_key: UUID | None = Header(None),
):
    fingerprint = hashlib.sha256(
        json.dumps(
            body.model_dump(mode="json"), sort_keys=True, separators=(",", ":")
        ).encode()
    ).hexdigest()
    if idempotency_key:
        # Serialize retries per owner, without cross-owner key collisions.
        db.scalar(select(AppUser).where(AppUser.id == user.id).with_for_update())
        receipt = db.get(CreateReceipt, (user.id, idempotency_key))
        if receipt:
            if receipt.fingerprint != fingerprint:
                raise HTTPException(409, "IDEMPOTENCY_KEY_REUSED")
            existing = owned(db, user, receipt.trip_id)
            response.headers["ETag"] = etag(existing)
            return wrap(request, existing)
    trip = Trip(owner_id=user.id, title=body.title)
    db.add(trip)
    db.flush()
    settings = body.plan.model_dump(exclude={"stops", "activities", "budget"})
    for key in ("preferences", "origin", "return_location"):
        value = getattr(body.plan, key)
        settings[key] = value.model_dump(mode="json") if value is not None else None
    version = PlanVersion(
        trip_id=trip.id,
        version_number=1,
        created_by=user.id,
        **settings,
        budget_amount=body.plan.budget.amount if body.plan.budget else None,
        budget_mode=body.plan.budget.mode if body.plan.budget else "target",
    )
    db.add(version)
    db.flush()
    sync_route(db, version, body.plan.stops, body.plan.activities, cascade=True)
    trip.draft_version_id = version.id
    db.flush()
    if idempotency_key:
        db.add(
            CreateReceipt(
                owner_id=user.id,
                key=idempotency_key,
                fingerprint=fingerprint,
                trip_id=trip.id,
            )
        )
        db.flush()
    response.headers["ETag"] = etag(trip)
    response.headers["Location"] = f"/api/v1/trips/{trip.id}"
    return wrap(request, trip)


@router.get("/trips", response_model=TripList)
def listing(
    request: Request,
    limit: int = Query(20, ge=1, le=100),
    cursor: str | None = None,
    user: AppUser = Depends(current_user),
    db: Session = Depends(session),
):
    query = select(Trip).where(Trip.owner_id == user.id, Trip.deleted_at.is_(None))
    if cursor:
        try:
            data = json.loads(base64.urlsafe_b64decode(cursor))
            if data["owner"] != str(user.id):
                raise ValueError()
            stamp, ident = datetime.fromisoformat(data["time"]), UUID(data["id"])
            query = query.where(
                or_(
                    Trip.updated_at < stamp,
                    and_(Trip.updated_at == stamp, Trip.id < ident),
                )
            )
        except (ValueError, KeyError, TypeError):
            raise HTTPException(400, "INVALID_CURSOR") from None
    rows = list(
        db.scalars(
            query.order_by(Trip.updated_at.desc(), Trip.id.desc()).limit(limit + 1)
        )
    )
    more = len(rows) > limit
    rows = rows[:limit]
    next_cursor = None
    if more:
        last = rows[-1]
        next_cursor = base64.urlsafe_b64encode(
            json.dumps(
                {
                    "owner": str(user.id),
                    "time": last.updated_at.isoformat(),
                    "id": str(last.id),
                }
            ).encode()
        ).decode()
    return {
        **wrap(request, rows),
        "page": {"next_cursor": next_cursor, "has_more": more},
    }


@router.get("/trips/{trip_id}", response_model=Envelope[TripView])
def get_trip(
    trip_id: UUID,
    request: Request,
    response: Response,
    user: AppUser = Depends(current_user),
    db: Session = Depends(session),
):
    trip = owned(db, user, trip_id)
    response.headers["ETag"] = etag(trip)
    return wrap(request, trip)


@router.patch("/trips/{trip_id}", response_model=Envelope[TripView])
def patch(
    trip_id: UUID,
    body: TripPatch,
    request: Request,
    response: Response,
    if_match: str | None = Header(None),
    user: AppUser = Depends(current_user),
    db: Session = Depends(session),
):
    trip = owned(db, user, trip_id, lock=True)
    if if_match is None:
        raise HTTPException(428, "PRECONDITION_REQUIRED")
    if if_match != etag(trip):
        raise HTTPException(412, "PRECONDITION_FAILED")
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(trip, key, value)
    trip.lock_version += 1
    trip.updated_at = datetime.now(timezone.utc)
    db.flush()
    response.headers["ETag"] = etag(trip)
    return wrap(request, trip)


def get_version(db, user, trip_id, version_id):
    owned(db, user, trip_id)
    version = db.scalar(
        select(PlanVersion).where(
            PlanVersion.id == version_id, PlanVersion.trip_id == trip_id
        )
    )
    if version is None:
        raise HTTPException(404, "RESOURCE_NOT_FOUND")
    return version


@router.get(
    "/trips/{trip_id}/versions/{version_id}", response_model=Envelope[VersionView]
)
def version(
    trip_id: UUID,
    version_id: UUID,
    request: Request,
    response: Response,
    user: AppUser = Depends(current_user),
    db: Session = Depends(session),
):
    row = get_version(db, user, trip_id, version_id)
    data = {column.name: getattr(row, column.name) for column in row.__table__.columns}
    data["activities"] = activity_inputs(db, row)
    data["budget"] = (
        {"amount": row.budget_amount, "mode": row.budget_mode}
        if row.budget_amount is not None
        else None
    )
    data = {
        key: value for key, value in data.items() if key in VersionView.model_fields
    }
    response.headers["ETag"] = f'"draft:{row.id}:{row.edit_sequence}"'
    return wrap(request, data)


@router.get(
    "/trips/{trip_id}/versions/{version_id}/stops",
    response_model=Envelope[list[StopView]],
)
def stops(
    trip_id: UUID,
    version_id: UUID,
    request: Request,
    user: AppUser = Depends(current_user),
    db: Session = Depends(session),
):
    get_version(db, user, trip_id, version_id)
    rows = db.scalars(
        select(DestinationStop)
        .where(DestinationStop.version_id == version_id)
        .order_by(DestinationStop.position)
    )
    return wrap(
        request,
        [
            dict(
                id=row.id,
                logical_item_id=row.logical_item_id,
                position=row.position,
                name=row.name,
                timezone=row.timezone,
                desired_nights=row.suggested_nights,
                arrival_date=row.arrival_date,
                departure_date=row.departure_date,
            )
            for row in rows
        ],
    )


@router.post("/trips/{trip_id}/draft", response_model=Envelope[VersionView])
def draft(
    trip_id: UUID,
    request: Request,
    response: Response,
    user: AppUser = Depends(current_user),
    db: Session = Depends(session),
):
    trip = owned(db, user, trip_id, lock=True)
    if trip.draft_version_id is None:
        raise HTTPException(409, "DRAFT_UNAVAILABLE")
    return version(trip_id, trip.draft_version_id, request, response, user, db)


def activity_inputs(db, row):
    activities = db.scalars(select(Activity).where(Activity.version_id == row.id))
    stop_ids = {
        s.id: s.logical_item_id
        for s in db.scalars(
            select(DestinationStop).where(DestinationStop.version_id == row.id)
        )
    }
    return [
        ActivityInput(
            kind=a.kind,
            logical_id=a.logical_item_id,
            stop_logical_id=stop_ids[a.stop_id],
            user_label=a.user_label,
            local_day_offset=a.local_day_offset,
            local_start_time=a.local_start_time,
            duration_minutes=a.duration_minutes,
            fixed=a.fixed,
            completed=a.completed,
            booked=a.booked,
        ).model_dump(mode="json")
        for a in activities
    ]


def sync_route(db, version, stops, activities, cascade=False):
    ids = []
    for stop in stops:
        try:
            ids.append(UUID(stop.client_id) if stop.client_id else uuid4())
        except ValueError:
            ids.append(uuid5(NAMESPACE_URL, f"{version.id}:{stop.client_id}"))
    if len(set(ids)) != len(ids):
        raise HTTPException(422, "DUPLICATE_STOP_ID")
    if any(a.stop_logical_id not in ids for a in activities):
        raise HTTPException(422, "ACTIVITY_STOP_MISSING")
    if len({a.logical_id for a in activities}) != len(activities):
        raise HTTPException(422, "DUPLICATE_ACTIVITY_ID")
    existing = list(
        db.scalars(
            select(DestinationStop).where(DestinationStop.version_id == version.id)
        )
    )
    old_activities = list(
        db.scalars(select(Activity).where(Activity.version_id == version.id))
    )
    removed = {s.id for s in existing if s.logical_item_id not in ids}
    if any(a.stop_id in removed for a in old_activities) and not cascade:
        raise HTTPException(409, "STOP_HAS_DEPENDENTS")
    # Delete/reinsert physical rows atomically; stable logical IDs are retained.
    db.execute(delete(Activity).where(Activity.version_id == version.id))
    db.execute(delete(DestinationStop).where(DestinationStop.version_id == version.id))
    rows = {}
    for position, (stop, logical_id) in enumerate(zip(stops, ids, strict=True)):
        row = DestinationStop(
            version_id=version.id,
            logical_item_id=logical_id,
            position=position,
            name=stop.name,
            timezone=stop.timezone,
            suggested_nights=stop.desired_nights,
            arrival_date=stop.arrival_date,
            departure_date=stop.departure_date,
        )
        db.add(row)
        rows[logical_id] = row
    db.flush()
    for activity in activities:
        db.add(
            Activity(
                kind=activity.kind,
                version_id=version.id,
                logical_item_id=activity.logical_id,
                stop_id=rows[activity.stop_logical_id].id,
                user_label=activity.user_label,
                local_day_offset=activity.local_day_offset,
                local_start_time=activity.local_start_time.isoformat(),
                duration_minutes=activity.duration_minutes,
                fixed=activity.fixed,
                completed=activity.completed,
                booked=activity.booked,
            )
        )
    db.flush()


@router.post("/trips/{trip_id}/draft/commands", response_model=Envelope[VersionView])
def commands(
    trip_id: UUID,
    body: CommandBatch,
    request: Request,
    response: Response,
    if_match: str | None = Header(None),
    user: AppUser = Depends(current_user),
    db: Session = Depends(session),
):
    trip = owned(db, user, trip_id, lock=True)
    if trip.draft_version_id is None:
        raise HTTPException(409, "DRAFT_UNAVAILABLE")
    row = get_version(db, user, trip_id, trip.draft_version_id)
    if row.status != "draft":
        raise HTTPException(409, "DRAFT_UNAVAILABLE")
    if if_match is None:
        raise HTTPException(428, "PRECONDITION_REQUIRED")
    if if_match != f'"draft:{row.id}:{row.edit_sequence}"':
        raise HTTPException(412, "PRECONDITION_FAILED")
    route_command = next((c for c in body.commands if c.type == "stop.reorder"), None)
    activity_command = next(
        (c for c in body.commands if c.type == "activity.replace_user_schedule"), None
    )
    if route_command or activity_command:
        from app.trips.schemas import StopInput

        stops = (
            route_command.stops
            if route_command
            else [
                StopInput(
                    client_id=str(s.logical_item_id),
                    name=s.name,
                    timezone=s.timezone,
                    desired_nights=s.suggested_nights,
                    arrival_date=s.arrival_date,
                    departure_date=s.departure_date,
                )
                for s in db.scalars(
                    select(DestinationStop)
                    .where(DestinationStop.version_id == row.id)
                    .order_by(DestinationStop.position)
                )
            ]
        )
        activities = (
            activity_command.activities
            if activity_command
            else [ActivityInput(**a) for a in activity_inputs(db, row)]
        )
        sync_route(
            db,
            row,
            stops,
            activities,
            cascade=route_command.cascade if route_command else False,
        )
    for command in body.commands:
        if command.type == "plan.update_settings":
            if command.changes.stops or command.changes.activities:
                raise HTTPException(422, "USE_ROUTE_AND_ACTIVITY_COMMANDS")
            values = command.changes.model_dump(
                exclude={"stops", "activities", "budget"}, mode="python"
            )
            for key in ("preferences", "origin", "return_location"):
                value = getattr(command.changes, key)
                values[key] = value.model_dump(mode="json") if value else None
            for key, value in values.items():
                setattr(row, key, value)
            row.budget_amount = (
                command.changes.budget.amount if command.changes.budget else None
            )
            row.budget_mode = (
                command.changes.budget.mode if command.changes.budget else "target"
            )
    row.edit_sequence += 1
    row.validation_status = "unchecked"
    trip.updated_at = datetime.now(timezone.utc)
    trip.lock_version += 1
    db.flush()
    return version(trip_id, row.id, request, response, user, db)
