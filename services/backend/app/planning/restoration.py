"""Restoration never silently rewinds protected present-day records."""

from app.planning.validation import validate_plan


def restoration_report(current, candidate):
    report = validate_plan(candidate)
    items = {str(a.logical_id): a for a in candidate.activities}
    current_stops = {s.client_id: s for s in current.stops}
    restored_stops = {s.client_id: s for s in candidate.stops}
    dates_changed = any(
        getattr(current, name) != getattr(candidate, name)
        for name in (
            "date_mode",
            "start_date",
            "end_date",
            "window_start",
            "window_end",
            "desired_days",
        )
    )
    for activity in current.activities:
        if (activity.fixed or activity.booked or activity.completed) and (
            items.get(str(activity.logical_id)) != activity
            or dates_changed
            or current_stops.get(str(activity.stop_logical_id))
            != restored_stops.get(str(activity.stop_logical_id))
        ):
            report["issues"].append(
                {
                    "id": f"RESTORE_PROTECTED:{activity.logical_id}",
                    "code": "RESTORE_PROTECTED",
                    "detail": f"Restoring would overwrite or remove the protected activity ‘{activity.user_label}’. Reconcile it in the plan editor first.",
                    "activity_id": str(activity.logical_id),
                    "blocking": True,
                    "acknowledgeable": False,
                }
            )
    if any(i["blocking"] for i in report["issues"]):
        report["status"] = "conflicted"
    return report
