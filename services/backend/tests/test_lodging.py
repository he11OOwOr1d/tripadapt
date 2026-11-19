import pytest
from pydantic import ValidationError

from app.providers.activities import ActivityDiscovery
from app.trips.schemas import Lodging, PlanInput, StayPreference


def stay(**lodging):
    return StayPreference.model_validate(
        dict(style="Hotel", rate="", basis="room", lodging=lodging)
    )


def test_a_stay_without_lodging_is_unchanged():
    assert StayPreference(style="", rate="", basis="room").lodging is None


def test_a_name_alone_is_a_valid_record_with_honest_defaults():
    lodging = stay(name="Hostel on the corner").lodging
    assert lodging.booked is False and lodging.latitude is None
    assert lodging.check_in == "" and lodging.address == ""


def test_a_searched_place_keeps_its_source_and_coordinates():
    lodging = stay(
        name="Hotel Aurora",
        latitude=26.9124,
        longitude=75.7873,
        external_id="geoapify/51abc",
        source="Geoapify / OpenStreetMap contributors",
        check_in="14:00",
        check_out="11:00",
        booked=True,
    ).lodging
    assert lodging.external_id == "geoapify/51abc" and lodging.booked


def test_a_searched_stay_may_carry_its_retained_place_id():
    lodging = stay(
        name="Hotel Aurora",
        latitude=26.9,
        longitude=75.8,
        external_id="geoapify/51abc",
        place_id="7a5c1f0e-33d8-4a8e-9b7d-0d6e2f7f9a11",
    ).lodging
    assert str(lodging.place_id) == "7a5c1f0e-33d8-4a8e-9b7d-0d6e2f7f9a11"


@pytest.mark.parametrize(
    "bad",
    [
        dict(name=""),
        dict(name="x" * 121),
        dict(name="Bell\x07"),
        dict(name="A", address="line\nbreak"),
        dict(name="A", latitude=10.0),  # one coordinate
        dict(name="A", latitude=91, longitude=0),
        dict(name="A", latitude=0, longitude=0),  # Null Island is a missing value
        dict(name="A", external_id="geoapify/1"),  # a searched place needs coordinates
        dict(name="A", external_id="https://example.test/1", latitude=1, longitude=1),
        dict(
            name="A",
            place_id="not-a-uuid",
            external_id="geoapify/1",
            latitude=1,
            longitude=1,
        ),
        dict(
            name="A", place_id="7a5c1f0e-33d8-4a8e-9b7d-0d6e2f7f9a11"
        ),  # no searched place behind it
        dict(name="A", booked_nights=0),
        dict(name="A", booked_nights=366),
        dict(name="A", booked_nights="many"),
        dict(name="A", check_in="25:00"),
        dict(name="A", check_out="9:00"),
        dict(name="A", latitude=float("nan"), longitude=1),
        dict(name="A", unknown="field"),
    ],
)
def test_invalid_lodging_is_rejected(bad):
    with pytest.raises(ValidationError):
        Lodging.model_validate(bad)


def test_lodging_round_trips_through_a_plan():
    plan = PlanInput.model_validate(
        dict(
            stops=[
                dict(
                    client_id="s1",
                    name="Jaipur",
                    timezone="Asia/Kolkata",
                    desired_nights=2,
                )
            ],
            preferences=dict(
                stay_preferences={
                    "s1": dict(
                        style="",
                        rate="",
                        basis="room",
                        lodging=dict(name="Haveli", booked=True),
                    )
                }
            ),
        )
    )
    again = PlanInput.model_validate(plan.model_dump(mode="json"))
    assert again.preferences.stay_preferences["s1"].lodging.name == "Haveli"


def test_lodging_search_accepts_hotel_types_and_rejects_other_tourism():
    def transport(*args):
        def el(i, kind):
            return {
                "type": "node",
                "id": i,
                "lat": 26.91 + i / 1000,
                "lon": 75.78,
                "tags": {"name": f"Place {i}", "tourism": kind},
            }

        return {
            "elements": [
                el(1, "hotel"),
                el(2, "guest_house"),
                el(3, "museum"),
                el(4, "hostel"),
            ]
        }

    page = ActivityDiscovery(transport).search(26.91, 75.78, "lodging")
    assert {p.name for p in page.results} == {"Place 1", "Place 2", "Place 4"}
    assert all(p.category == "lodging" for p in page.results)


def test_booked_nights_are_optional_and_recorded_as_entered():
    assert stay(name="Haveli").lodging.booked_nights is None
    lodging = stay(name="Haveli", booked=True, booked_nights=3).lodging
    assert lodging.booked_nights == 3
    again = PlanInput.model_validate(
        dict(
            stops=[
                dict(
                    client_id="s1",
                    name="Jaipur",
                    timezone="Asia/Kolkata",
                    desired_nights=3,
                )
            ],
            preferences=dict(
                stay_preferences={
                    "s1": dict(
                        style="",
                        rate="",
                        basis="room",
                        lodging=dict(name="Haveli", booked=True, booked_nights=3),
                    )
                }
            ),
        )
    )
    dumped = again.model_dump(mode="json")
    assert (
        dumped["preferences"]["stay_preferences"]["s1"]["lodging"]["booked_nights"] == 3
    )
