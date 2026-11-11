from contextlib import asynccontextmanager
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from starlette.exceptions import HTTPException

from app.api import conversation, destinations, planning_jobs, proposals, revisions  # noqa: F401 - register proposal routes
from app.api.trips import router
from app.config import settings
from app.persistence.database import engine
from app.persistence.models import SystemProbe


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    engine.dispose()


app = FastAPI(title="TripAdapt API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["GET", "POST", "PATCH"],
    allow_headers=["Content-Type", "Authorization", "If-Match", "Idempotency-Key"],
    expose_headers=["ETag", "Location", "X-Request-ID"],
)


@app.middleware("http")
async def request_context(request: Request, call_next):
    request.state.request_id = str(uuid4())
    response = await call_next(request)
    response.headers["X-Request-ID"] = request.state.request_id
    if request.url.path.startswith(
        ("/api/v1/trips", "/api/v1/jobs")
    ) or request.url.path in ("/api/v1/me", "/api/v1/destinations/search"):
        response.headers["Cache-Control"] = "private, no-store"
    return response


class ResponseMeta(BaseModel):
    request_id: str


class LiveData(BaseModel):
    status: str
    service: str


class LiveResponse(BaseModel):
    data: LiveData
    meta: ResponseMeta


class ReadyData(BaseModel):
    status: str
    api: str
    database: str
    schema_revision: str
    initialized_at: str


class ReadyResponse(BaseModel):
    data: ReadyData
    meta: ResponseMeta


@app.get("/api/v1/health/live", response_model=LiveResponse)
def live(request: Request):
    return {
        "data": {"status": "ok", "service": "tripadapt-api"},
        "meta": {"request_id": request.state.request_id},
    }


@app.get(
    "/api/v1/health/ready",
    response_model=ReadyResponse,
    responses={503: {"description": "Database or schema unavailable"}},
)
def ready(request: Request):
    try:
        with engine.connect() as connection:
            revision = connection.execute(
                text("SELECT version_num FROM alembic_version")
            ).scalar_one()
            marker = connection.execute(
                select(SystemProbe.initialized_at).where(SystemProbe.id == 1)
            ).scalar_one()
            if revision != "0016_trip_conversation":
                raise ValueError("Schema revision mismatch")
        return {
            "data": {
                "status": "ok",
                "api": "connected",
                "database": "connected",
                "schema_revision": revision,
                "initialized_at": marker.isoformat(),
            },
            "meta": {"request_id": request.state.request_id},
        }
    except (SQLAlchemyError, ValueError):
        return JSONResponse(
            status_code=503,
            media_type="application/problem+json",
            content={
                "type": "urn:tripadapt:error:database-unavailable",
                "title": "Database is not ready",
                "status": 503,
                "code": "DATABASE_NOT_READY",
                "detail": "Check PostgreSQL connectivity and run database migrations.",
                "request_id": request.state.request_id,
            },
        )


app.include_router(router)


def problem(request, status, code, issues=None):
    return JSONResponse(
        status_code=status,
        media_type="application/problem+json",
        content={
            "type": f"urn:tripadapt:error:{code.lower().replace('_', '-')}",
            "title": code.replace("_", " ").capitalize(),
            "status": status,
            "code": code,
            "detail": "Review the request and retry.",
            "request_id": request.state.request_id,
            "issues": issues or [],
        },
    )


@app.exception_handler(HTTPException)
async def http_problem(request, exc):
    response = problem(request, exc.status_code, str(exc.detail))
    response.headers.update(exc.headers or {})
    return response


@app.exception_handler(RequestValidationError)
async def validation_problem(request, exc):
    return problem(
        request,
        422,
        "VALIDATION_FAILED",
        [
            {"path": ".".join(map(str, issue["loc"])), "code": issue["type"]}
            for issue in exc.errors()
        ],
    )


@app.exception_handler(IntegrityError)
async def integrity_problem(request, exc):
    return problem(request, 409, "IDENTITY_OR_RESOURCE_CONFLICT")
