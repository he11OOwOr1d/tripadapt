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
        if (activity.fixed or activity.booked or activity.resolved) and (
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
    restored_costs = {cost.id: cost for cost in candidate.costs}
    affected_payments = [
        cost
        for cost in current.costs
        if cost.status == "paid"
        and (
            restored_costs.get(cost.id) != cost
            or (
                current.display_currency != candidate.display_currency
                and (cost.currency is None or cost.conversion_rate is not None)
            )
            or (
                cost.unit == "per_person"
                and current.traveler_count != candidate.traveler_count
            )
        )
    ]
    if affected_payments:
        labels = ", ".join(f"‘{cost.label}’" for cost in affected_payments[:3])
        if len(affected_payments) > 3:
            labels += f" and {len(affected_payments) - 3} more"
        report["issues"].append(
            {
                "id": "RESTORE_PAID_COSTS",
                "code": "RESTORE_PAID_COSTS",
                "activity_id": None,
                "detail": (
                    f"Restoring this version changes or removes recorded payments: {labels}. "
                    "This only changes the trip record. It does not issue a refund."
                ),
                "blocking": False,
                "acknowledgeable": True,
            }
        )
    if any(i["blocking"] for i in report["issues"]):
        report["status"] = "conflicted"
    return report
