"""Read-only allowance and cost-record projection, not a complete ledger."""

from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from typing import Literal

from app.trips.schemas import StrictModel, plan_legs


class AllowanceRow(StrictModel):
    key: str
    category: Literal["accommodation", "transport"]
    label: str
    unit: Literal["room_night", "bed_night", "person_trip", "vehicle_trip"]
    quantity: int | None
    unit_amount: Decimal | None
    estimated_amount: Decimal | None
    amount_status: Literal["estimated", "unknown"]
    covered_by_records: Decimal = Decimal("0.00")


class RecordRow(StrictModel):
    key: str
    category: Literal[
        "food", "activity", "accommodation", "transport", "taxes_fees", "miscellaneous"
    ]
    linked_to: str | None
    link_removed: bool
    label: str
    unit: Literal["per_person", "per_group"]
    quantity: int
    travelers: int | None
    unit_amount: Decimal | None
    amount: Decimal | None
    amount_status: Literal["estimated", "paid", "unknown"]
    entered_status: Literal["estimated", "paid"]
    tax_status: Literal["included", "excluded", "unknown"]
    tax_percent: Decimal | None
    tax_amount: Decimal | None
    tax_known: bool
    currency: str
    original_amount: Decimal | None
    conversion: Literal["none", "converted", "missing_rate"]
    conversion_rate: Decimal | None
    rate_note: str | None
    rate_date: date | None


class CostCoverage(StrictModel):
    version_id: str
    currency: str
    rows: list[AllowanceRow]
    estimated_subtotal: Decimal
    known_allowances: int
    unknown_allowances: int
    records: list[RecordRow]
    estimated_records: int
    paid_records: int
    unknown_records: int
    unconverted_records: int
    tax_unknown_records: int
    recorded_paid_subtotal: Decimal
    known_subtotal: Decimal
    unpriced_categories: list[str]
    coverage_complete: bool
    # What still prevents a complete total; empty only when complete.
    missing: list[str]
    total: Decimal | None
    paid_total: None = None
    budget_amount: Decimal | None
    budget_mode: Literal["target", "strict"] | None
    estimates_exceed_budget: bool
    notice: str


def money(cents):
    return Decimal(f"{cents // 100}.{cents % 100:02d}")


def cents(rate):
    whole, _, fraction = rate.partition(".")
    return int(whole) * 100 + int((fraction + "00")[:2])


def project_costs(plan, version_id):
    rows, subtotal = [], 0

    def add(key, category, label, unit, quantity, rate):
        nonlocal subtotal
        amount = None
        if quantity is not None and rate is not None and rate != "":
            amount = cents(rate) * quantity
            subtotal += amount
        rows.append(
            AllowanceRow(
                key=key,
                category=category,
                label=label,
                unit=unit,
                quantity=quantity,
                unit_amount=Decimal(rate) if amount is not None else None,
                estimated_amount=money(amount) if amount is not None else None,
                amount_status="estimated" if amount is not None else "unknown",
            )
        )

    for stop in plan.stops:
        p = plan.preferences.stay_preferences.get(stop.client_id)
        # Unknown night allocation is still unknown even when a rate is entered.
        if stop.desired_nights == 0:
            continue
        nights = stop.desired_nights
        bed = p is not None and p.basis == "bed"
        quantity = (nights or 0) * (plan.traveler_count if bed else plan.room_count)
        if nights is None:
            # Unallocated nights stay unknown, never a known free stay.
            add(
                f"stay:{stop.client_id}",
                "accommodation",
                stop.name,
                "bed_night" if bed else "room_night",
                None,
                None,
            )
        else:
            add(
                f"stay:{stop.client_id}",
                "accommodation",
                stop.name,
                "bed_night" if bed else "room_night",
                quantity,
                p.rate if p else None,
            )
    for leg in plan_legs(plan):
        key = leg["key"]
        p = plan.preferences.travel_preferences.get(key)
        vehicle = p is not None and p.basis == "vehicle"
        add(
            key,
            "transport",
            f"{leg['from']} → {leg['to']}",
            "vehicle_trip" if vehicle else "person_trip",
            1 if vehicle else plan.traveler_count,
            p.rate if p else None,
        )
    records, record_estimates, paid = [], 0, 0
    allowance_coverage = {}
    names = {s.client_id: s.name for s in plan.stops}
    journeys = {leg["key"]: f"{leg['from']} → {leg['to']}" for leg in plan_legs(plan)}
    titles = {a.logical_id: a.user_label for a in plan.activities}
    for record in plan.costs:
        travelers = plan.traveler_count if record.unit == "per_person" else None
        currency = record.currency or plan.display_currency
        foreign = currency != plan.display_currency
        original = amount = None
        tax = None
        if record.amount != "":
            original = cents(record.amount) * record.quantity * (travelers or 1)
            if record.tax_status == "excluded" and record.tax_percent:
                # Tax on the whole original total, half-up to cents, kept apart.
                tax = int(
                    (Decimal(original) * Decimal(record.tax_percent) / 100).quantize(
                        Decimal(1), rounding=ROUND_HALF_UP
                    )
                )
                original += tax
            if not foreign:
                amount = original
            elif record.conversion_rate:
                # Half-up to whole cents in the display currency.
                amount = int(
                    (Decimal(original) * Decimal(record.conversion_rate)).quantize(
                        Decimal(1), rounding=ROUND_HALF_UP
                    )
                )
        if amount is not None:
            # A linked stay/journey record is part of that allowance, not a
            # second purchase. Keep excess costs and unrelated extras additive.
            allowance_key = (
                f"stay:{record.stop_id}"
                if record.category == "accommodation" and record.stop_id
                else record.leg_key
                if record.category == "transport" and record.leg_key
                else None
            )
            if allowance_key:
                allowance_coverage[allowance_key] = (
                    allowance_coverage.get(allowance_key, 0) + amount
                )
            if record.status == "paid":
                paid += amount
            else:
                record_estimates += amount
        records.append(
            RecordRow(
                key=f"record:{record.id}",
                category=record.category,
                linked_to=titles.get(record.activity_id)
                if record.activity_id
                else names.get(str(record.stop_id))
                if record.stop_id
                else journeys.get(record.leg_key)
                if record.leg_key
                else None,
                link_removed=record.link_removed,
                label=record.label,
                unit=record.unit,
                quantity=record.quantity,
                travelers=travelers,
                unit_amount=Decimal(record.amount) if original is not None else None,
                amount=money(amount) if amount is not None else None,
                amount_status=record.status if amount is not None else "unknown",
                entered_status=record.status,
                tax_status=record.tax_status,
                tax_percent=Decimal(record.tax_percent) if record.tax_percent else None,
                tax_amount=money(tax) if tax is not None else None,
                tax_known=record.tax_status == "included"
                or (record.tax_status == "excluded" and tax is not None),
                currency=currency,
                original_amount=money(original) if original is not None else None,
                conversion="none"
                if not foreign
                else "converted"
                if amount is not None or (original is None and record.conversion_rate)
                else "missing_rate",
                conversion_rate=Decimal(record.conversion_rate)
                if record.conversion_rate
                else None,
                rate_note=record.rate_note,
                rate_date=record.rate_date,
            )
        )
    for row in rows:
        if row.estimated_amount is not None:
            covered = min(
                int(row.estimated_amount * 100), allowance_coverage.get(row.key, 0)
            )
            row.covered_by_records = money(covered)
            subtotal -= covered
    recorded = {r.category for r in records}
    known = subtotal + record_estimates + paid
    estimated = money(subtotal + record_estimates)
    missing = []
    if any(r.amount_status == "unknown" for r in rows):
        missing.append("Every stay and journey needs an allowance and nights.")
    if any(r.amount_status == "unknown" for r in records):
        missing.append("Some cost entries have no amount.")
    if any(r.conversion == "missing_rate" for r in records):
        missing.append("Some costs in another currency have no conversion rate.")
    if any(not r.tax_known and r.original_amount is not None for r in records):
        missing.append("Some costs have unknown tax.")
    if not plan.preferences.costs_confirmed:
        missing.append("Confirm that you have entered every cost for this trip.")
    complete = not missing
    return CostCoverage(
        version_id=str(version_id),
        currency=plan.display_currency,
        rows=rows,
        estimated_subtotal=estimated,
        known_allowances=sum(r.amount_status == "estimated" for r in rows),
        unknown_allowances=sum(r.amount_status == "unknown" for r in rows),
        records=records,
        estimated_records=sum(r.amount_status == "estimated" for r in records),
        paid_records=sum(r.amount_status == "paid" for r in records),
        unknown_records=sum(r.amount_status == "unknown" for r in records),
        unconverted_records=sum(r.conversion == "missing_rate" for r in records),
        tax_unknown_records=sum(
            not r.tax_known and r.original_amount is not None for r in records
        ),
        recorded_paid_subtotal=money(paid),
        known_subtotal=money(known),
        coverage_complete=complete,
        missing=missing,
        total=money(known) if complete else None,
        # Categories with no entry at all; an entry does not make one complete.
        unpriced_categories=[
            name
            for name, category in [
                ("Activities", "activity"),
                ("Meals", "food"),
                ("Local transport", None),
                ("Taxes and fees", "taxes_fees"),
                ("Miscellaneous", "miscellaneous"),
            ]
            if category not in recorded
        ],
        budget_amount=plan.budget.amount if plan.budget else None,
        budget_mode=plan.budget.mode if plan.budget else None,
        estimates_exceed_budget=bool(plan.budget and money(known) > plan.budget.amount),
        notice=(
            "Total from your confirmed entries and manual exchange rates. "
            if complete
            else "Your own allowances and cost entries only; complete cost coverage remains unknown. "
        )
        + "Linked stay and journey entries count toward their matching allowance, not twice. "
        + "Complete payment coverage remains unknown. Booked does not mean paid; removing an item does not imply a refund.",
    )
