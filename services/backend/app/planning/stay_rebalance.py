"""Move nights between stays, or between a stay and the trip length.

Deterministic and traveler-chosen. Nothing is moved, shortened or removed
silently: activities left on days that no longer exist block the change unless
the traveler names them to drop, and fixed, booked, completed or skipped activities can
never be dropped here. The result is a draft edit; the accepted plan changes
only through the existing review and acceptance.
"""

from datetime import timedelta
from typing import Literal
from uuid import UUID

from pydantic import Field, model_validator

from app.planning.cost_coverage import project_costs
from app.planning.live_acceptance import planned_visit_date
from app.planning.validation import validate_plan
from app.trips.schemas import PlanInput, StrictModel, expected_nights, stays_of


class Relocation(StrictModel):
    """Move a displaced flexible activity to a remaining day in the route."""

    activity_id: UUID
    day_offset: int = Field(ge=0)
    # Optional different stay; its map link is then cleared (wrong destination).
    stop_id: UUID | None = None
    # Optional new local start time; absent keeps the original time.
    local_start_time: str | None = Field(
        default=None, pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d$"
    )


class RebalanceInput(StrictModel):
    stop_id: UUID
    # Positive adds nights to `stop_id`; negative takes nights away.
    delta_nights: int = Field(ge=-30, le=30)
    # Where the nights come from or go to: another stay, or the trip length.
    counterpart: UUID | Literal["trip_length"]
    drop_activity_ids: list[UUID] = Field(default_factory=list, max_length=200)
    relocate: list[Relocation] = Field(default_factory=list, max_length=200)

    @model_validator(mode="after")
    def meaningful(self):
        if self.delta_nights == 0:
            raise ValueError("Choose at least one night to move")
        if self.counterpart == self.stop_id:
            raise ValueError("Choose a different stay to balance against")
        moved = [m.activity_id for m in self.relocate]
        if len(moved) != len(set(moved)) or set(moved) & set(self.drop_activity_ids):
            raise ValueError("Choose one decision per activity: drop or move")
        return self


class RebalanceConflict(ValueError):
    def __init__(self, code, detail, activities=()):
        self.code, self.detail, self.activities = code, detail, list(activities)
        super().__init__(detail)


def _activity(a, stop_name):
    return dict(
        activity_id=str(a.logical_id),
        stop_id=str(a.stop_logical_id),
        label=a.user_label,
        destination=stop_name,
        day=a.local_day_offset + 1,
        start=a.local_start_time.strftime("%H:%M"),
        protected=a.fixed or a.booked or a.resolved,
    )


def rebalance_stays(plan: PlanInput, body: RebalanceInput):
    """Return (candidate plan, summary). Raise RebalanceConflict on any block."""
    stops = {s.client_id: s for s in plan.stops}
    target = stops.get(str(body.stop_id))
    other = (
        None if body.counterpart == "trip_length" else stops.get(str(body.counterpart))
    )
    if target is None or (body.counterpart != "trip_length" and other is None):
        raise RebalanceConflict(
            "REBALANCE_STOP_UNKNOWN", "Choose stays that are in this plan."
        )
    if any(s.desired_nights is None for s in plan.stops):
        raise RebalanceConflict(
            "REBALANCE_NIGHTS_MISSING",
            "Give every stay a number of nights before moving nights between them.",
        )
    if any(s.arrival_date or s.departure_date for s in plan.stops):
        raise RebalanceConflict(
            "REBALANCE_DATED_STOPS",
            "Some stays have fixed arrival or departure dates. Change those dates "
            "explicitly in the planner; nothing changed.",
        )
    new_nights = {s.client_id: s.desired_nights for s in plan.stops}
    new_nights[target.client_id] += body.delta_nights
    if other is not None:
        new_nights[other.client_id] -= body.delta_nights
    for client_id, nights in new_nights.items():
        if nights < 0:
            raise RebalanceConflict(
                "REBALANCE_NEGATIVE",
                f"{stops[client_id].name} doesn't have enough nights to give.",
            )

    for stop in plan.stops:
        if new_nights[stop.client_id] == stop.desired_nights:
            continue
        for stay in stays_of(plan.preferences.stay_preferences.get(stop.client_id)):
            if stay.locked:
                raise RebalanceConflict(
                    "REBALANCE_STAY_LOCKED",
                    f"Your stay \u201c{stay.name}\u201d in {stop.name} is kept fixed, so its "
                    "nights are not changed automatically. Unlock it in the stay panel "
                    "first, or choose other stays. Nothing changed.",
                )

    # A stay with N nights spans local day offsets 0..N (arrival to departure).
    displaced = [
        a
        for a in plan.activities
        if a.local_day_offset > new_nights[str(a.stop_logical_id)]
    ]
    drop = set(body.drop_activity_ids)
    moves = {m.activity_id: m.day_offset for m in body.relocate}
    targets = {m.activity_id: str(m.stop_id) for m in body.relocate if m.stop_id}
    times = {
        m.activity_id: m.local_start_time for m in body.relocate if m.local_start_time
    }
    unknown = (drop | set(moves)) - {a.logical_id for a in displaced}
    if unknown:
        raise RebalanceConflict(
            "REBALANCE_DROP_INVALID",
            "Only activities on days that would no longer exist can be dropped or moved.",
        )
    by_id = {a.logical_id: a for a in displaced}
    for activity_id, day in moves.items():
        item = by_id[activity_id]
        stay = targets.get(activity_id, str(item.stop_logical_id))
        if stay not in stops:
            raise RebalanceConflict(
                "REBALANCE_MOVE_INVALID", "Move activities to a stay in this plan."
            )
        if day > new_nights[stay]:
            raise RebalanceConflict(
                "REBALANCE_MOVE_INVALID",
                f"Move {item.user_label} to a day that remains in {stops[stay].name}.",
            )
    protected = [a for a in displaced if a.fixed or a.booked or a.resolved]
    if protected:
        raise RebalanceConflict(
            "REBALANCE_PROTECTED",
            "Fixed, booked, completed or skipped activities are on days this change removes. "
            "Move them explicitly first; nothing changed.",
            [_activity(a, stops[str(a.stop_logical_id)].name) for a in protected],
        )
    undecided = [a for a in displaced if a.logical_id not in drop | set(moves)]
    if undecided:
        raise RebalanceConflict(
            "REBALANCE_DISPLACED",
            "Some activities are on days this change removes. Choose to drop each "
            "one or move it to a remaining day in your route; nothing changed.",
            [_activity(a, stops[str(a.stop_logical_id)].name) for a in undecided],
        )

    data = plan.model_dump(mode="json")
    for stop in data["stops"]:
        stop["desired_nights"] = new_nights[stop["client_id"]]
    data["activities"] = [
        a for a in data["activities"] if UUID(a["logical_id"]) not in drop
    ]
    for a in data["activities"]:
        if UUID(a["logical_id"]) in moves:
            a["local_day_offset"] = moves[UUID(a["logical_id"])]
            new_stop = targets.get(UUID(a["logical_id"]))
            if new_stop and new_stop != a["stop_logical_id"]:
                # A mapped place belongs to its old destination; never carry it.
                a["stop_logical_id"] = new_stop
                a["place_id"] = None
            if UUID(a["logical_id"]) in times:
                a["local_start_time"] = times[UUID(a["logical_id"])]
    days_before = plan.desired_days
    if body.counterpart == "trip_length":
        if plan.date_mode == "exact" and plan.end_date:
            data["end_date"] = (
                plan.end_date + timedelta(days=body.delta_nights)
            ).isoformat()
        elif plan.desired_days is not None:
            data["desired_days"] = plan.desired_days + body.delta_nights
            if data["desired_days"] < 1:
                raise RebalanceConflict(
                    "REBALANCE_NEGATIVE", "The trip can't be shorter than one day."
                )
    # Re-validate: linked costs follow the removal rule for dropped activities.
    candidate = PlanInput.model_validate(data)
    # A changed earlier stay shifts later calendar dates even when no local
    # activity offset changes. Never silently move a dated commitment/history.
    shifted = []
    for activity in plan.activities:
        if not (activity.fixed or activity.booked or activity.resolved):
            continue
        scope = {
            "scope": {
                "stop_logical_id": str(activity.stop_logical_id),
                "local_day_offset": activity.local_day_offset,
            }
        }
        before = planned_visit_date(plan, scope)
        after = planned_visit_date(candidate, scope)
        if before != after:
            shifted.append(
                {
                    **_activity(activity, stops[str(activity.stop_logical_id)].name),
                    "detail": f"Calendar date would change from {before} to {after}.",
                }
            )
    if shifted:
        raise RebalanceConflict(
            "REBALANCE_PROTECTED_DATE",
            "This would change the calendar date of a fixed, booked, completed "
            "or skipped activity. Resolve those dated commitments explicitly "
            "before changing nights; nothing changed.",
            shifted,
        )
    clashes = [
        i
        for i in validate_plan(candidate)["issues"]
        if i["code"] in ("OVERLAP", "CROSSES_MIDNIGHT")
        and i["activity_id"]
        and UUID(i["activity_id"]) in moves
    ]
    if clashes:
        raise RebalanceConflict(
            "REBALANCE_OVERLAP",
            "A moved activity would overlap another one or run past midnight on "
            "its new day. Choose a different day or time, or drop it; nothing "
            "changed.",
            [
                {
                    **_activity(
                        by_id[UUID(i["activity_id"])],
                        stops[str(by_id[UUID(i["activity_id"])].stop_logical_id)].name,
                    ),
                    "detail": "Would run past midnight at this time."
                    if i["code"] == "CROSSES_MIDNIGHT"
                    else i["detail"],
                }
                for i in clashes
            ],
        )
    blockers = [
        i
        for i in validate_plan(candidate)["issues"]
        if i["blocking"]
        and i["code"] in ("DURATION_CONFLICT", "WINDOW_CONFLICT", "STAY_LENGTH_MISSING")
    ]
    if blockers:
        raise RebalanceConflict("REBALANCE_DURATION", blockers[0]["detail"])

    before_costs = project_costs(plan, "before")
    after_costs = project_costs(candidate, "after")
    summary = dict(
        stays=[
            dict(
                stop_id=s.client_id,
                name=s.name,
                nights_before=s.desired_nights,
                nights_after=new_nights[s.client_id],
            )
            for s in plan.stops
        ],
        trip_days_before=days_before
        if plan.date_mode != "exact"
        else (plan.end_date - plan.start_date).days + 1
        if plan.end_date and plan.start_date
        else None,
        trip_days_after=candidate.desired_days
        if candidate.date_mode != "exact"
        else (candidate.end_date - candidate.start_date).days + 1
        if candidate.end_date and candidate.start_date
        else None,
        end_date_after=candidate.end_date.isoformat() if candidate.end_date else None,
        dropped=[
            _activity(a, stops[str(a.stop_logical_id)].name)
            for a in plan.activities
            if a.logical_id in drop
        ],
        moved=[
            {
                **_activity(a, stops[str(a.stop_logical_id)].name),
                "to_day": moves[a.logical_id] + 1,
                "to_stop_id": targets.get(a.logical_id, str(a.stop_logical_id)),
                "to_destination": stops[
                    targets.get(a.logical_id, str(a.stop_logical_id))
                ].name,
                "map_cleared": a.logical_id in targets
                and targets[a.logical_id] != str(a.stop_logical_id)
                and bool(a.place_id),
                "to_start": times.get(a.logical_id)
                or a.local_start_time.strftime("%H:%M"),
            }
            for a in plan.activities
            if a.logical_id in moves
        ],
        estimated_before=str(before_costs.estimated_subtotal),
        estimated_after=str(after_costs.estimated_subtotal),
        kept_payments=[
            c.label
            for c in candidate.costs
            if c.link_removed
            and not any(b.id == c.id and b.link_removed for b in plan.costs)
        ],
        # Stays the traveler marked as booked whose nights this change alters: a
        # commitment the app cannot change for them, so they are told to act on it.
        booked_stays=[
            dict(
                stop_id=s.client_id,
                name=s.name,
                stay=stay.name,
                booked_nights=stay.booked_nights,
                nights_before=expected_nights(preference, stay, s.desired_nights or 0),
                nights_after=expected_nights(preference, stay, new_nights[s.client_id]),
            )
            for s in plan.stops
            if new_nights[s.client_id] != s.desired_nights
            for preference in [plan.preferences.stay_preferences.get(s.client_id)]
            for stay in stays_of(preference)
            if stay.booked
            # A change that lands on the nights the traveler said they booked needs no warning.
            and stay.booked_nights
            != expected_nights(preference, stay, new_nights[s.client_id])
            and expected_nights(preference, stay, s.desired_nights or 0)
            != expected_nights(preference, stay, new_nights[s.client_id])
        ],
        notice="A draft change you chose. Stay allowances follow the new nights; "
        "nothing is booked, cancelled or refunded. Review and accept the draft to "
        "change your accepted plan.",
    )
    return candidate, summary
