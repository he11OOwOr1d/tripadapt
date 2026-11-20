import pytest
from pydantic import ValidationError

from app.trips.schemas import PlanInput, TravelPreference


def leg(**extra):
    return TravelPreference.model_validate(
        dict(mode="Rail", hours="3.5", overnight=0, rate="", basis="person", **extra)
    )


def test_a_journey_without_booking_details_is_unchanged():
    preference = leg()
    assert preference.departure == "" and preference.arrival == ""
    assert preference.reference == "" and preference.booked is False
    assert preference.arrival_buffer == 0 and preference.departure_buffer == 0
    assert preference.locked is False


def test_booking_details_are_recorded_as_entered():
    preference = leg(
        departure="09:15",
        arrival="12:40",
        reference="PNR 4X7Q",
        booked=True,
        arrival_buffer=30,
        departure_buffer=90,
    )
    assert (preference.arrival_buffer, preference.departure_buffer) == (30, 90)
    assert (preference.departure, preference.arrival) == ("09:15", "12:40")
    assert preference.reference == "PNR 4X7Q" and preference.booked is True


@pytest.mark.parametrize(
    "bad",
    [
        dict(departure="24:00"),
        dict(departure="9:15"),
        dict(departure="09:60"),
        dict(arrival="noon"),
        dict(arrival="12:40:00"),
        dict(reference="x" * 101),
        dict(reference="PNR\nINJECT"),
        dict(reference="bell\x07"),
        dict(arrival_buffer=-1),
        dict(arrival_buffer=241),
        dict(departure_buffer=-5),
        dict(departure_buffer=1000),
        dict(arrival_buffer="soon"),
        dict(unknown="field"),
    ],
)
def test_invalid_booking_details_are_rejected(bad):
    with pytest.raises(ValidationError):
        leg(**bad)


def test_booking_details_round_trip_through_a_plan_and_older_plans_still_load():
    base = dict(
        stops=[
            dict(
                client_id="s1",
                name="Jaipur",
                timezone="Asia/Kolkata",
                desired_nights=2,
            )
        ]
    )
    key = '["origin:Delhi","s1"]'
    plan = PlanInput.model_validate(
        {
            **base,
            "preferences": dict(
                travel_preferences={
                    key: dict(
                        mode="Rail",
                        hours="",
                        overnight=0,
                        rate="",
                        basis="person",
                        arrival="14:30",
                        booked=True,
                    )
                }
            ),
        }
    )
    again = PlanInput.model_validate(plan.model_dump(mode="json"))
    assert again.preferences.travel_preferences[key].arrival == "14:30"
    older = PlanInput.model_validate(
        {
            **base,
            "preferences": dict(
                travel_preferences={
                    key: dict(
                        mode="Bus", hours="4", overnight=0, rate="", basis="person"
                    )
                }
            ),
        }
    )
    assert older.preferences.travel_preferences[key].arrival == ""
