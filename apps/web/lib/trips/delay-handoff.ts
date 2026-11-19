import type { Activity, Trip } from "./adapter";
import type { Proposal } from "./proposals";
import { delayCoverage } from "./day-check-feedback";

export type DelaySeed = { activityId: string; readyTime: string; stopId: string; day: number };
export type DelayReturn = { tripId: string; reviewId: string; editedActivityId: string; seed: DelaySeed };
export type DelayEditHandler = (proposal: Proposal, activityId: string) => boolean;

/** Resolve edits from the current draft; frozen candidate times must never overwrite it. */
export function delayEditTarget(trip: Trip, proposal: Proposal, activityId: string): { activity: Activity; seed: DelaySeed } | undefined {
  if (proposal.status !== "pending" || proposal.stale || proposal.generation?.operation !== "delay_day") return;
  const command = proposal.generation.command;
  if (!command || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(command.ready_time)) return;
  const { day, visits } = delayCoverage(proposal);
  const first = visits.find(a => a.logical_id === command.activity_id);
  const target = day.find(a => a.logical_id === activityId);
  if (!first || !target || day.indexOf(target) < Math.max(0, day.indexOf(first) - 1)) return;
  const activity = trip.activities.find(a => a.id === activityId);
  const seed = { activityId: command.activity_id, readyTime: command.ready_time, stopId: first.stop_logical_id, day: first.local_day_offset + 1 };
  if (!activity || activity.stopId !== seed.stopId || activity.day !== seed.day || !canResumeDelay(trip, seed)) return;
  return { activity: { ...activity }, seed };
}

export function canResumeDelay(trip: Trip, seed: DelaySeed): boolean {
  const activity = trip.activities.find(a => a.id === seed.activityId);
  return !!activity && !activity.completed && activity.stopId === seed.stopId && activity.day === seed.day && trip.stops.some(s => s.id === seed.stopId && seed.day >= 1 && seed.day <= s.nights + 1);
}
