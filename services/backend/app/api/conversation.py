"""Owner-scoped persistent conversation, using the existing durable job boundary."""

from datetime import datetime
from uuid import UUID

from fastapi import Depends, Header, HTTPException, Query, Request, Response
from pydantic import Field
from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from app.api.identity import current_user, session
from app.api.planning_jobs import (
    ConversationJobRequest,
    DayScope,
    JobView,
    admit_job,
    job_view,
)
from app.api.trips import Envelope, owned, router, wrap
from app.persistence.models import AppUser, ConversationTurn, PlanningJob
from app.trips.schemas import StrictModel


class MessageInput(StrictModel):
    text: str = Field(min_length=1, max_length=2000)
    base_version_id: UUID
    scope: DayScope


class TurnView(StrictModel):
    id: UUID
    user_text: str
    assistant_text: str | None
    kind: str | None
    choices: list[str]
    created_at: datetime
    job: JobView


class ConversationPage(StrictModel):
    turns: list[TurnView]
    next_cursor: UUID | None


def turn_view(db, turn):
    return {
        **{
            key: getattr(turn, key)
            for key in (
                "id",
                "user_text",
                "assistant_text",
                "kind",
                "choices",
                "created_at",
            )
        },
        "job": job_view(db.get(PlanningJob, turn.job_id)),
    }


@router.get("/trips/{trip_id}/messages", response_model=Envelope[ConversationPage])
def messages(
    trip_id: UUID,
    request: Request,
    before: UUID | None = None,
    limit: int = Query(20, ge=1, le=50),
    user: AppUser = Depends(current_user),
    db: Session = Depends(session),
):
    owned(db, user, trip_id)
    query = select(ConversationTurn).where(ConversationTurn.trip_id == trip_id)
    if before:
        cursor = db.scalar(
            select(ConversationTurn).where(
                ConversationTurn.id == before, ConversationTurn.trip_id == trip_id
            )
        )
        if cursor is None:
            raise HTTPException(400, "INVALID_CURSOR")
        query = query.where(
            or_(
                ConversationTurn.created_at < cursor.created_at,
                and_(
                    ConversationTurn.created_at == cursor.created_at,
                    ConversationTurn.id < cursor.id,
                ),
            )
        )
    rows = list(
        db.scalars(
            query.order_by(
                ConversationTurn.created_at.desc(), ConversationTurn.id.desc()
            ).limit(limit + 1)
        )
    )
    return wrap(
        request,
        {
            "turns": [turn_view(db, t) for t in reversed(rows[:limit])],
            "next_cursor": rows[limit - 1].id if len(rows) > limit else None,
        },
    )


@router.post(
    "/trips/{trip_id}/messages", status_code=202, response_model=Envelope[TurnView]
)
def send(
    trip_id: UUID,
    body: MessageInput,
    request: Request,
    response: Response,
    if_match: str | None = Header(None),
    idempotency_key: UUID | None = Header(None),
    user: AppUser = Depends(current_user),
    db: Session = Depends(session),
):
    if not body.text.strip():
        raise HTTPException(422, "MESSAGE_EMPTY")
    job_body = ConversationJobRequest(
        operation="chat",
        engine="groq",
        base_version_id=body.base_version_id,
        scope=body.scope,
        instructions=body.text.strip(),
    )
    result = admit_job(
        trip_id, job_body, request, response, if_match, idempotency_key, user, db
    )
    job = db.get(PlanningJob, result["data"]["id"])
    turn = db.scalar(select(ConversationTurn).where(ConversationTurn.job_id == job.id))
    if turn is None:
        history = list(
            db.scalars(
                select(ConversationTurn)
                .where(
                    ConversationTurn.trip_id == trip_id,
                    ConversationTurn.assistant_text.is_not(None),
                )
                .order_by(
                    ConversationTurn.created_at.desc(), ConversationTurn.id.desc()
                )
                .limit(6)
            )
        )
        job.input = {
            **job.input,
            "conversation": [
                {"user": t.user_text, "assistant": t.assistant_text}
                for t in reversed(history)
            ],
        }
        turn = ConversationTurn(
            trip_id=trip_id, job_id=job.id, user_text=body.text.strip()
        )
        db.add(turn)
        db.flush()
    return wrap(request, turn_view(db, turn))
