from uuid import uuid4

import pytest
import test_reschedule

from app.planning.removal import RemoveActivity, remove_activity, validate_removal
from app.planning.reschedule import MoveActivity, move_activity, validate_move
from app.planning.resize import ResizeActivity, resize_activity, validate_resize
from app.planning.validation import same_plan


@pytest.mark.parametrize("edit", ["move", "resize", "remove"])
def test_row_order_does_not_reject_a_valid_scoped_edit(edit):
    base, scope = test_reschedule.sample()
    # A third row ensures removal also leaves multiple records to reorder.
    extra = base.activities[0].model_copy(deep=True)
    extra.logical_id = uuid4()
    extra.local_day_offset = 0
    base.activities.append(extra)
    ident = str(base.activities[0].logical_id)
    if edit == "move":
        candidate, metadata = move_activity(
            base,
            scope,
            MoveActivity(
                activity_id=ident, local_start_time="11:00", destination_day=17
            ),
        )
        validate = validate_move
    elif edit == "resize":
        candidate, metadata = resize_activity(
            base, scope, ResizeActivity(activity_id=ident, duration_minutes=45)
        )
        validate = validate_resize
    else:
        candidate, metadata = remove_activity(
            base, scope, RemoveActivity(activity_id=ident)
        )
        validate = validate_removal
    reversed_base = base.model_copy(deep=True)
    reversed_base.activities.reverse()
    candidate.activities.reverse()
    validate(reversed_base, candidate, scope, metadata)
    candidate.activities[0].user_label = "Unrequested edit"
    with pytest.raises(ValueError):
        validate(reversed_base, candidate, scope, metadata)


def test_route_order_and_duplicate_or_changed_activities_are_still_significant():
    base, _ = test_reschedule.sample()
    extra = base.stops[0].model_copy(deep=True)
    extra.client_id = str(uuid4())
    base.stops.append(extra)
    reordered = base.model_copy(deep=True)
    reordered.activities.reverse()
    assert same_plan(base, reordered)
    reordered.stops.reverse()
    assert not same_plan(base, reordered)
    duplicated = base.model_copy(deep=True)
    duplicated.activities.append(duplicated.activities[0].model_copy(deep=True))
    assert not same_plan(base, duplicated)
    assert not same_plan(duplicated, duplicated)
    changed = base.model_copy(deep=True)
    changed.activities[0].completed = True
    assert not same_plan(base, changed)
