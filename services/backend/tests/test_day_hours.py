"""FR-01: optional daily hours. The hours a traveler wants to be out and about decide the window the AI plans inside."""

from uuid import uuid4

import pytest
import test_day_graph as dg
from pydantic import ValidationError

from app.agents.day_graph import planning_window, run_day_graph, validate_ai_candidate
from app.agents.groq_provider import PlanningFailure
from app.trips.schemas import DEFAULT_DAY, Preferences, day_bounds


def with_hours(plan, start, end):
    plan.preferences.day_start, plan.preferences.day_end = start, end
    return plan


def window_text(plan, stop, day):
    provider = dg.RecordingProvider([dg.answer("12:00")])
    run_day_graph(plan, stop, day, uuid4(), provider)
    return "".join(provider.seen)


def test_unset_hours_keep_the_default_day():
    prefs = Preferences()
    assert (prefs.day_start, prefs.day_end) == ("", "")
    assert day_bounds(prefs) == DEFAULT_DAY == (9 * 60, 18 * 60)
    plan, stop = dg.base()
    assert planning_window(plan, plan.stops[0], 0)[:2] == (540, 1080)


@pytest.mark.parametrize(
    "start,end,expected",
    [("07:00", "23:00", (420, 1380)), ("00:00", "23:59", (0, 1439)), ("10:00", "14:00", (600, 840)), ("06:30", "22:15", (390, 1335))],
)
def test_valid_hours_are_used_as_given(start, end, expected):
    prefs = Preferences(day_start=start, day_end=end)
    assert day_bounds(prefs) == expected


@pytest.mark.parametrize(
    "fields",
    [
        {"day_start": "09:00"},  # one without the other has no meaning
        {"day_end": "18:00"},
        {"day_start": "9:00", "day_end": "18:00"},  # not HH:MM
        {"day_start": "09:00", "day_end": "24:00"},
        {"day_start": "09:60", "day_end": "18:00"},
        {"day_start": "09:00", "day_end": "9pm"},
        {"day_start": "18:00", "day_end": "09:00"},  # a day does not wrap past midnight
        {"day_start": "09:00", "day_end": "09:00"},
        {"day_start": "10:00", "day_end": "13:59"},  # shorter than four hours
    ],
)
def test_hours_that_make_no_sense_are_refused(fields):
    with pytest.raises(ValidationError):
        Preferences(**fields)


def test_exactly_four_hours_is_the_shortest_day():
    assert day_bounds(Preferences(day_start="10:00", day_end="14:00")) == (600, 840)


def test_hours_survive_the_plan_round_trip_and_unknown_neighbours_are_still_refused():
    plan, _ = dg.base()
    with_hours(plan, "07:00", "23:00")
    again = type(plan).model_validate(plan.model_dump(mode="json"))
    assert (again.preferences.day_start, again.preferences.day_end) == ("07:00", "23:00")
    with pytest.raises(ValidationError):
        Preferences(day_start="07:00", day_end="23:00", nonsense=True)


def test_a_late_riser_gets_a_late_window_and_the_model_is_told():
    plan, stop = dg.base()
    with_hours(plan, "10:00", "23:00")
    assert planning_window(plan, plan.stops[0], 0)[:2] == (600, 1380)
    assert "10:00" in window_text(plan, stop, 0) and "23:00" in window_text(plan, stop, 0)
    # 20:00 is outside the default day but inside this one, so it is accepted at the first try
    provider = dg.RecordingProvider([dg.answer("20:00")])
    result, _ = run_day_graph(plan, stop, 15, uuid4(), provider)
    assert provider.schema_calls == 1 and result.activities[-1].local_start_time.hour == 20


def test_the_same_proposal_is_repaired_when_the_day_is_the_default():
    plan, stop = dg.base()
    provider = dg.RecordingProvider([dg.answer("20:00"), dg.answer("11:00")])
    result, _ = run_day_graph(plan, stop, 15, uuid4(), provider)
    assert provider.schema_calls == 2 and result.activities[-1].local_start_time.hour == 11


def test_a_short_day_rejects_a_block_that_would_run_past_its_end():
    plan, stop = dg.base()
    with_hours(plan, "10:00", "14:00")
    provider = dg.RecordingProvider([dg.answer("13:30"), dg.answer("12:00")])
    result, _ = run_day_graph(plan, stop, 15, uuid4(), provider)
    assert provider.schema_calls == 2  # a block starting at 13:30 would end after 14:00
    assert result.activities[-1].local_start_time.hour == 12
    early = dg.RecordingProvider([dg.answer("09:30"), dg.answer("10:00")])
    result, _ = run_day_graph(plan, stop, 15, uuid4(), early)
    assert early.schema_calls == 2 and result.activities[-1].local_start_time.hour == 10


def test_recorded_journeys_still_narrow_the_travelers_own_hours():
    plan, stop = dg.base()
    with_hours(plan, "08:00", "22:00")
    dg.with_journey(plan, 0, arrival="15:00", arrival_buffer=30)
    assert planning_window(plan, plan.stops[0], 0)[:2] == (15 * 60 + 30, 22 * 60)
    dg.with_journey(plan, 1, departure="19:00", departure_buffer=60)
    assert planning_window(plan, plan.stops[0], 20)[:2] == (8 * 60, 18 * 60)
    # an arrival before the traveler's day begins does not start the day early
    plan2, stop2 = dg.base()
    with_hours(plan2, "10:00", "20:00")
    dg.with_journey(plan2, 0, arrival="06:00")
    assert planning_window(plan2, plan2.stops[0], 0)[:2] == (600, 1200)


def test_a_day_left_with_no_usable_time_still_skips_the_model():
    plan, stop = dg.base()
    with_hours(plan, "09:00", "13:00")
    dg.with_journey(plan, 0, arrival="12:50")
    provider = dg.RecordingProvider([])
    result, metadata = run_day_graph(plan, stop, 0, uuid4(), provider)
    assert provider.seen == [] and metadata["additions"] == []


def test_the_publish_check_uses_the_travelers_hours_not_a_fixed_day():
    """validate_ai_candidate is the last check before a proposal is published or accepted; it must agree with the planner."""
    plan, stop = dg.base()
    with_hours(plan, "07:00", "23:00")
    job = uuid4()
    result, metadata = run_day_graph(plan, stop, 15, job, dg.RecordingProvider([dg.answer("20:00")]))
    validate_ai_candidate(plan, result, stop, 15, job, metadata)  # accepted: inside 07:00 to 23:00
    # the same proposal, once the traveler's hours are gone from both the plan and the proposal, is refused
    default_base = plan.model_copy(deep=True)
    for p in (default_base, result):
        p.preferences.day_start = p.preferences.day_end = ""
    with pytest.raises(ValueError, match="Invalid day window"):
        validate_ai_candidate(default_base, result, stop, 15, job, metadata)


def test_without_hours_the_publish_check_is_as_strict_as_before():
    plan, stop = dg.base()
    job = uuid4()
    result, metadata = run_day_graph(plan, stop, 15, job, dg.RecordingProvider([dg.answer("11:00")]))
    validate_ai_candidate(plan, result, stop, 15, job, metadata)
    with pytest.raises(PlanningFailure):
        run_day_graph(plan, stop, 15, uuid4(), dg.RecordingProvider([dg.answer("20:00"), dg.answer("20:00")]))
