import type { Activity, Stop } from "./adapter";
import { isActivityPlace, type ActivityPlace } from "./activity-search";

/** A personal label is independent of the explicitly chosen place identity. */
export function patchActivity(activity: Activity, changes: Partial<Activity>): Activity {
  const next = { ...activity, ...changes };
  return changes.stopId !== undefined && changes.stopId !== activity.stopId
    ? { ...next, place: undefined }
    : next;
}

export function attachActivityLocation(activity: Activity, stop: Stop, place: ActivityPlace): Activity {
  if (stop.id !== activity.stopId || !stop.location || !isActivityPlace(place) || place.destination_reference_id !== stop.location.reference_id) {
    throw new Error("Choose a mapped place from this activity’s destination.");
  }
  return { ...activity, place };
}

export function detachActivityLocation(activity: Activity): Activity {
  return { ...activity, place: undefined };
}
