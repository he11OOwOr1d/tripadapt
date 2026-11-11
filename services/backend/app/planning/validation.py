"""Deterministic checks shared by manual review and future agent candidates."""

import json

from app.trips.schemas import PlanInput


def validate_plan(plan: PlanInput) -> dict:
    issues = []

    def issue(code, detail, *, item=None, blocking=True):
        issues.append(
            {
                "id": f"{code}:{item or 'plan'}",
                "code": code,
                "detail": detail,
                "activity_id": item,
                "blocking": blocking,
                "acknowledgeable": not blocking,
            }
        )

    stops = {s.client_id: s for s in plan.stops}
    if not stops:
        issue("EMPTY_ROUTE", "Add a destination before accepting this plan.")
    if any(s.desired_nights is None for s in plan.stops):
        issue(
            "STAY_LENGTH_MISSING",
            "Allocate nights to every destination before accepting.",
        )
    points = ["origin:" + (plan.origin.label if plan.origin else "")] + [
        s.client_id for s in plan.stops
    ]
    if plan.preferences.return_to_origin:
        points.append("finish:" + (plan.origin.label if plan.origin else ""))
    elif plan.return_location:
        points.append("finish:" + plan.return_location.label)
    keys = [
        json.dumps([a, b], separators=(",", ":"), ensure_ascii=False)
        for a, b in zip(points, points[1:])
    ]
    travel_nights = sum(
        plan.preferences.travel_preferences[k].overnight
        for k in keys
        if k in plan.preferences.travel_preferences
    )
    allocated = sum(s.desired_nights or 0 for s in plan.stops) + travel_nights
    days = plan.desired_days
    if plan.date_mode == "exact" and plan.start_date and plan.end_date:
        days = (plan.end_date - plan.start_date).days + 1
    if days is not None and allocated > days - 1:
        issue(
            "DURATION_CONFLICT",
            f"The route needs {allocated} nights but the trip allows {days - 1}. Shorten stays or extend the trip.",
        )
    if plan.date_mode == "window" and plan.window_start and plan.window_end and days:
        if days > (plan.window_end - plan.window_start).days + 1:
            issue(
                "WINDOW_CONFLICT",
                "The desired duration does not fit inside the date window.",
            )
    seen = set()
    grouped = {}
    for a in plan.activities:
        ident = str(a.logical_id)
        if ident in seen:
            issue(
                "DUPLICATE_ACTIVITY", "An activity appears more than once.", item=ident
            )
        seen.add(ident)
        stop = stops.get(str(a.stop_logical_id))
        if stop is None:
            issue("STOP_MISSING", "Choose a destination for this activity.", item=ident)
            continue
        if stop.desired_nights is None or a.local_day_offset > stop.desired_nights:
            issue(
                "DAY_OUTSIDE_STAY",
                "This activity needs a day within its destination stay.",
                item=ident,
            )
        start = a.local_start_time.hour * 60 + a.local_start_time.minute
        if a.local_start_time.tzinfo is not None:
            issue(
                "LOCAL_TIME_REQUIRED",
                "Use the destination's local time without a UTC offset.",
                item=ident,
            )
        if a.local_start_time.second or a.local_start_time.microsecond:
            issue(
                "MINUTE_PRECISION_REQUIRED",
                "Schedule activities to whole minutes.",
                item=ident,
            )
        end = start + a.duration_minutes
        if end > 1440:
            issue(
                "CROSSES_MIDNIGHT", "Split this activity across two days.", item=ident
            )
        grouped.setdefault((str(a.stop_logical_id), a.local_day_offset), []).append(
            (start, end, a)
        )
    for items in grouped.values():
        for i, (start, end, a) in enumerate(items):
            overlaps = [
                b.user_label
                for j, (s, e, b) in enumerate(items)
                if i != j and s < end and e > start
            ]
            if overlaps:
                issue(
                    "OVERLAP",
                    "Overlaps " + ", ".join(overlaps) + ".",
                    item=str(a.logical_id),
                )
    # Provider evidence is not connected. Never claim a fully verified schedule.
    issue(
        "UNVERIFIED_EVIDENCE",
        "Opening hours, travel buffers, transport schedules and availability have not been verified. This is a provisional plan.",
        blocking=False,
    )
    if plan.budget and plan.budget.mode == "strict":
        issue(
            "STRICT_BUDGET_UNVERIFIED",
            "A strict budget cannot be checked until complete, correctly scoped costs are available.",
        )
    return {
        "status": "conflicted" if any(i["blocking"] for i in issues) else "provisional",
        "issues": issues,
    }


def same_plan(left: PlanInput, right: PlanInput) -> bool:
    """Activity identity is logical_id; only destination order encodes a route.

    SQL result order is not a schedule edit. Keep every typed field and the
    ordered stop list exact, but compare activities independently of row order.
    Do not collapse duplicates into a dict: those are invalid candidates.
    """

    def canonical(plan):
        data = plan.model_dump(mode="python")
        ids = [a.logical_id for a in plan.activities]
        if len(ids) != len(set(ids)):
            return None
        data["activities"] = sorted(
            data["activities"], key=lambda a: str(a["logical_id"])
        )
        return data

    before, after = canonical(left), canonical(right)
    return before is not None and after is not None and before == after
