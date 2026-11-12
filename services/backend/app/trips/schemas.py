from datetime import date, time
from decimal import Decimal
from typing import Annotated, Literal
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", from_attributes=True)


class StayPreference(StrictModel):
    style: str = Field(max_length=100)
    rate: str = Field(pattern=r"^$|^\d+(\.\d{1,2})?$")
    basis: Literal["room", "bed"]


class TravelPreference(StrictModel):
    mode: str = Field(max_length=100)
    hours: str = Field(pattern=r"^$|^\d+(\.\d{1,2})?$")
    overnight: int = Field(ge=0)
    rate: str = Field(pattern=r"^$|^\d+(\.\d{1,2})?$")
    basis: Literal["person", "vehicle"]


class Preferences(StrictModel):
    pace: Literal["relaxed", "balanced", "fast"] = "balanced"
    interests: list[str] = Field(default_factory=list, max_length=100)
    preferred_modes: list[str] = Field(default_factory=list, max_length=20)
    return_to_origin: bool = True
    stay_preferences: dict[str, StayPreference] = Field(
        default_factory=dict, max_length=500
    )
    travel_preferences: dict[str, TravelPreference] = Field(
        default_factory=dict, max_length=501
    )


class ActivityInput(StrictModel):
    google_place_id: str | None = Field(default=None, pattern=r"^[A-Za-z0-9_-]{1,200}$")
    place_id: UUID | None = None
    kind: Literal["custom", "meal", "rest", "free_time"] = "custom"
    logical_id: UUID
    stop_logical_id: UUID
    user_label: str = Field(min_length=1, max_length=300)
    local_day_offset: int = Field(ge=0)
    local_start_time: time
    duration_minutes: int = Field(gt=0)
    fixed: bool = False
    completed: bool = False
    booked: bool = False


class Location(StrictModel):
    label: str = Field(min_length=1, max_length=300)
    latitude: Decimal | None = Field(default=None, ge=-90, le=90)
    longitude: Decimal | None = Field(default=None, ge=-180, le=180)

    @model_validator(mode="after")
    def paired_coordinates(self):
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("Provide both coordinates or neither")
        return self


class Budget(StrictModel):
    amount: Decimal = Field(ge=0, max_digits=18, decimal_places=4)
    mode: Literal["target", "strict"] = "target"


class StopInput(StrictModel):
    place_reference_id: UUID | None = None
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
    activities: list[ActivityInput] = Field(default_factory=list, max_length=5000)
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


class SettingsCommand(StrictModel):
    type: Literal["plan.update_settings"]
    changes: PlanInput


class StopSyncCommand(StrictModel):
    # Explicit ordered route replacement; logical IDs remain stable.
    type: Literal["stop.reorder"]
    stops: list[StopInput] = Field(max_length=500)
    cascade: bool = False


class ActivitySyncCommand(StrictModel):
    type: Literal["activity.replace_user_schedule"]
    activities: list[ActivityInput] = Field(max_length=5000)


class CommandBatch(StrictModel):
    commands: list[
        Annotated[
            SettingsCommand | StopSyncCommand | ActivitySyncCommand,
            Field(discriminator="type"),
        ]
    ] = Field(min_length=1, max_length=3)

    @model_validator(mode="after")
    def unique_commands(self):
        types = [c.type for c in self.commands]
        if len(set(types)) != len(types):
            raise ValueError("Duplicate command type")
        return self
