from datetime import date
from decimal import Decimal
from typing import Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", from_attributes=True)


class Preferences(StrictModel):
    pace: Literal["relaxed", "balanced", "fast"] = "balanced"
    interests: list[str] = Field(default_factory=list, max_length=100)
    preferred_modes: list[str] = Field(default_factory=list, max_length=20)


class Location(StrictModel):
    label: str = Field(min_length=1, max_length=300)
    latitude: Decimal = Field(ge=-90, le=90)
    longitude: Decimal = Field(ge=-180, le=180)


class Budget(StrictModel):
    amount: Decimal = Field(ge=0, max_digits=18, decimal_places=4)
    mode: Literal["target", "strict"] = "target"


class StopInput(StrictModel):
    client_id: str | None = Field(default=None, max_length=100)
    name: str = Field(min_length=1, max_length=300)
    timezone: str
    desired_nights: int | None = Field(default=None, ge=0)
    arrival_date: date | None = None
    departure_date: date | None = None

    @field_validator("timezone")
    @classmethod
    def valid_timezone(cls, value):
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError):
            raise ValueError("An IANA timezone is required") from None
        return value

    @model_validator(mode="after")
    def dates(self):
        if (
            self.arrival_date
            and self.departure_date
            and self.departure_date < self.arrival_date
        ):
            raise ValueError("departure_date precedes arrival_date")
        return self


class PlanInput(StrictModel):
    date_mode: Literal["exact", "window", "duration", "open_ended"] = "open_ended"
    start_date: date | None = None
    end_date: date | None = None
    window_start: date | None = None
    window_end: date | None = None
    desired_days: int | None = Field(default=None, gt=0)
    traveler_count: int = Field(default=1, gt=0)
    room_count: int = Field(default=1, gt=0)
    display_currency: str = Field(default="INR", pattern=r"^[A-Z]{3}$")
    budget: Budget | None = None
    preferences: Preferences = Field(default_factory=Preferences)
    origin: Location | None = None
    return_location: Location | None = None
    stops: list[StopInput] = Field(default_factory=list, max_length=500)

    @model_validator(mode="after")
    def consistency(self):
        for start, end in [
            (self.start_date, self.end_date),
            (self.window_start, self.window_end),
        ]:
            if start and end and end < start:
                raise ValueError("Date range is reversed")
        if self.date_mode == "exact" and not self.start_date:
            raise ValueError("Exact dates require start_date")
        if self.date_mode == "window" and not (self.window_start and self.window_end):
            raise ValueError("Window mode requires both window dates")
        if self.date_mode == "duration" and not self.desired_days:
            raise ValueError("Duration mode requires desired_days")
        ids = [stop.client_id for stop in self.stops if stop.client_id is not None]
        if len(ids) != len(set(ids)):
            raise ValueError("Duplicate client_id")
        return self


class TripCreate(StrictModel):
    title: str = Field(min_length=1, max_length=300)
    plan: PlanInput = Field(default_factory=PlanInput)


class TripPatch(StrictModel):
    title: str | None = Field(default=None, min_length=1, max_length=300)
    lifecycle: Literal["planning", "active", "completed", "archived"] | None = None

    @model_validator(mode="after")
    def nonnull(self):
        if any(getattr(self, key) is None for key in self.model_fields_set):
            raise ValueError("Metadata fields cannot be null")
        return self
