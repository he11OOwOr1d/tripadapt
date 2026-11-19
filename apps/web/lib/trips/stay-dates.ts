import type { Trip } from "./adapter";
import { displayDate, provisionalDate } from "./itinerary";

/**
 * Check-in and check-out dates for a stay, derived from the trip's own provisional dates:
 * the stop's arrival day and departure day. Null when the trip has no exact dates.
 */
export function stayDates(trip: Trip, arrivalDay: number, departureDay: number): { checkIn: string | null; checkOut: string | null } {
  const inDate = provisionalDate(trip, arrivalDay), outDate = provisionalDate(trip, departureDay);
  return { checkIn: inDate ? displayDate(inDate) : null, checkOut: outDate ? displayDate(outDate) : null };
}
