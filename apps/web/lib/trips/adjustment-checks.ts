import type { HoursCheck } from "./place-hours";
import type { JourneyCheck } from "./journeys";
export function adjustmentVerdict(hours:HoursCheck|null, onward:JourneyCheck|null, hasNext:boolean) {
  const hoursConflict=!!hours && hours.status==="outside_reported_hours";
  const onwardConflict=hasNext && !!onward && onward.spare_minutes<0;
  const unknown=!hours || hours.status!=="fits_reported_hours" || (hasNext && !onward);
  return hoursConflict || onwardConflict ? "The suggested time still has a conflict" : unknown ? "The suggested time still needs checks" : hasNext && !!onward?.warnings.length ? "Check the onward route warning" : "These checks fit the suggested time";
}
