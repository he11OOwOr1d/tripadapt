import json
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


class CostInput(StrictModel):
    """Traveler-entered cost; never a supplier quote, booking or charge.

    `amount` is a unit price. Total = amount × quantity, multiplied by the
    traveler count for per-person costs. Blank means unknown; zero is free.
    A cost may link to one activity or one stay (destination stop) by logical
    ID. When that item leaves the plan, an estimate goes with it, but a paid
    cost stays as an unlinked commitment flagged `link_removed`: removing an
    item never implies a refund.
    """

    id: UUID
    category: Literal[
        "food", "activity", "accommodation", "transport", "taxes_fees", "miscellaneous"
    ]
    label: str = Field(min_length=1, max_length=120, pattern=r"\S")
    unit: Literal["per_person", "per_group"]
    quantity: int = Field(ge=1, le=10000)
    amount: str = Field(pattern=r"^$|^\d{1,14}(\.\d{1,2})?$")
    status: Literal["estimated", "paid"]
    activity_id: UUID | None = None
    stop_id: UUID | None = None
    # Intercity journey key, as produced by `route_legs`; legs are not rows.
    leg_key: str | None = Field(default=None, min_length=1, max_length=1500)
    link_removed: bool = False
    # Optional foreign currency. Conversion uses only a traveler-entered rate
    # (display-currency units per one unit of `currency`), never a guessed one.
    currency: str | None = Field(default=None, pattern=r"^[A-Z]{3}$")
    conversion_rate: str | None = Field(
        default=None, pattern=r"^\d{1,10}(\.\d{1,10})?$"
    )
    rate_note: str | None = Field(default=None, min_length=1, max_length=200)
    rate_date: date | None = None
    # Whether `amount` already includes tax. "excluded" with a percentage adds
    # the tax; without one the tax is unknown, never assumed to be zero.
    tax_status: Literal["included", "excluded", "unknown"] = "unknown"
    tax_percent: str | None = Field(default=None, pattern=r"^\d{1,3}(\.\d{1,3})?$")

    @field_validator("tax_percent")
    @classmethod
    def canonical_percent(cls, value):
        return None if value is None else format(Decimal(value).normalize(), "f")

    @field_validator("conversion_rate")
    @classmethod
    def positive_rate(cls, value):
        if value is not None and Decimal(value) <= 0:
            raise ValueError("A conversion rate must be positive")
        return None if value is None else format(Decimal(value).normalize(), "f")

    @field_validator("amount")
    @classmethod
    def canonical_amount(cls, value):
        # One spelling per amount so snapshots compare equal after a DB read.
        return value if value == "" else f"{Decimal(value):.2f}"

    @model_validator(mode="after")
    def consistent(self):
        if self.status == "paid" and self.amount == "":
            raise ValueError("A paid cost needs the amount paid")
        if sum(bool(x) for x in (self.activity_id, self.stop_id, self.leg_key)) > 1:
            raise ValueError("A cost links to at most one item")
        if self.tax_percent is not None and (
            self.tax_status != "excluded" or Decimal(self.tax_percent) > 100
        ):
            raise ValueError("A tax percentage applies only to tax not included")
        if self.currency is None and (
            self.conversion_rate or self.rate_note or self.rate_date
        ):
            raise ValueError("A conversion rate needs the cost's own currency")
        if self.link_removed and (
            self.activity_id or self.stop_id or self.leg_key or self.status != "paid"
        ):
            raise ValueError("Only an unlinked paid cost can keep a removed link")
        return self


def route_legs(origin_label, return_to_origin, finish_label, stops):
    """Intercity journeys in route order, keyed exactly like the web client.

    `stops` is a sequence of (client_id, name). A key is the compact JSON pair
    of endpoint IDs; the same keys index stay/travel preferences.
    """
    if not stops:
        return []
    origin = origin_label or ""
    points = [(f"origin:{origin}", origin or "Starting point"), *stops]
    if return_to_origin:
        points.append((f"finish:{origin}", origin or "Starting point"))
    elif finish_label:
        points.append((f"finish:{finish_label}", finish_label))
    return [
        {
            "key": json.dumps(
                [start[0], end[0]], ensure_ascii=False, separators=(",", ":")
            ),
            "from": start[1],
            "to": end[1],
        }
        for start, end in zip(points, points[1:])
    ]


def plan_legs(plan):
    return route_legs(
        plan.origin.label if plan.origin else "",
        plan.preferences.return_to_origin,
        plan.return_location.label if plan.return_location else "",
        [(s.client_id, s.name) for s in plan.stops],
    )


def reconcile_costs(costs, stop_ids, activity_ids, leg_keys):
    """Apply the removal rule against the plan's current items. Pure, idempotent."""
    result = []
    for cost in costs:
        missing = (
            (cost.activity_id and cost.activity_id not in activity_ids)
            or (cost.stop_id and cost.stop_id not in stop_ids)
            or (cost.leg_key and cost.leg_key not in leg_keys)
        )
        if not missing:
            result.append(cost)
        elif cost.status == "paid":
            result.append(
                cost.model_copy(
                    update={
                        "activity_id": None,
                        "stop_id": None,
                        "leg_key": None,
                        "link_removed": True,
                    }
                )
            )
    return result


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
    # Traveler attests every cost is entered; needed before a strict budget can
    # be checked, since completeness cannot be inferred from the entries.
    costs_confirmed: bool = False


class ActivityInput(StrictModel):
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
    # Traveler-recorded outcome: it did not happen. Kept as history, never
    # inferred, and exclusive with completed.
    skipped: bool = False

    @model_validator(mode="after")
    def one_outcome(self):
        if self.completed and self.skipped:
            raise ValueError("An activity is either done or skipped, not both")
        return self

    @property
    def resolved(self):
        """Done or skipped: no longer upcoming, and protected from automatic edits."""
        return self.completed or self.skipped


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
    costs: list[CostInput] = Field(default_factory=list, max_length=500)

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
        if len({c.id for c in self.costs}) != len(self.costs):
            raise ValueError("Duplicate cost id")
        stop_ids = set()
        for stop in self.stops:
            try:
                stop_ids.add(UUID(stop.client_id))
            except (TypeError, ValueError):
                pass
        self.costs = reconcile_costs(
            self.costs,
            stop_ids,
            {a.logical_id for a in self.activities},
            {leg["key"] for leg in plan_legs(self)},
        )
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


class CostSyncCommand(StrictModel):
    # Explicit replacement of the draft's traveler-entered costs.
    type: Literal["cost.replace_records"]
    costs: list[CostInput] = Field(max_length=500)


class CommandBatch(StrictModel):
    commands: list[
        Annotated[
            SettingsCommand | StopSyncCommand | ActivitySyncCommand | CostSyncCommand,
            Field(discriminator="type"),
        ]
    ] = Field(min_length=1, max_length=4)

    @model_validator(mode="after")
    def unique_commands(self):
        types = [c.type for c in self.commands]
        if len(set(types)) != len(types):
            raise ValueError("Duplicate command type")
        return self
