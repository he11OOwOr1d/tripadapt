"""Read-only forecast for an explicitly selected destination and local date."""

from datetime import date, datetime, timedelta, timezone
from typing import Literal
from uuid import UUID
from zoneinfo import ZoneInfo

from fastapi import Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session

from app.api.identity import session
from app.api.trips import Envelope, router, wrap
from app.persistence.models import PlaceReference
from app.providers.weather import WeatherDay, WeatherFailure, WeatherProvider
from app.trips.schemas import StrictModel

weather_provider = WeatherProvider()


class WeatherView(StrictModel):
    status: Literal["date_needed", "outside_forecast_window", "forecast", "not_covered"]
    visit_date: date | None
    timezone: str
    horizon_start: date
    horizon_end: date
    coverage_start: date | None = None
    coverage_end: date | None = None
    day: WeatherDay | None = None
    retrieved_at: datetime | None = None
    cached: bool = False
    source: str = "Open-Meteo"


def weather_view(reference, visit_date, provider, now):
    zone = reference.payload["timezone"]
    today = now.astimezone(ZoneInfo(zone)).date()
    result = WeatherView(
        status="date_needed",
        visit_date=visit_date,
        timezone=zone,
        horizon_start=today,
        horizon_end=today + timedelta(days=15),
    )
    if visit_date is None:
        return result
    if not result.horizon_start <= visit_date <= result.horizon_end:
        return result.model_copy(update={"status": "outside_forecast_window"})
    forecast = provider.forecast(
        reference.payload["latitude"], reference.payload["longitude"], zone, today
    )
    day = next((d for d in forecast.days if d.date == visit_date), None)
    present = day and any(
        v is not None for k, v in day.model_dump().items() if k != "date"
    )
    return result.model_copy(
        update={
            "status": "forecast" if present else "not_covered",
            "coverage_start": forecast.days[0].date,
            "coverage_end": forecast.days[-1].date,
            "day": day if present else None,
            "retrieved_at": forecast.retrieved_at,
            "cached": forecast.cached,
        }
    )


@router.get("/weather", response_model=Envelope[WeatherView])
def get_weather(
    request: Request,
    response: Response,
    destination_reference_id: UUID,
    visit_date: date | None = None,
    db: Session = Depends(session),
):
    response.headers["Cache-Control"] = "private, no-store"
    reference = db.get(PlaceReference, destination_reference_id)
    if reference is None:
        raise HTTPException(404, "DESTINATION_REFERENCE_NOT_FOUND")
    try:
        return wrap(
            request,
            weather_view(
                reference, visit_date, weather_provider, datetime.now(timezone.utc)
            ),
        )
    except WeatherFailure as error:
        raise HTTPException(
            error.status,
            error.code,
            headers={"Retry-After": "60"} if error.status == 429 else None,
        ) from None
