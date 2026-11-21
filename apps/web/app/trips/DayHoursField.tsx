"use client";
import { dayHoursProblem } from "../../lib/trips/traveler-day";

/** The hours the traveler wants to be out and about. Optional: empty means the usual day. */
export default function DayHoursField({ start, end, onChange }: { start: string; end: string; onChange: (hours: { dayStart: string; dayEnd: string }) => void }) {
  const problem = dayHoursProblem(start, end);
  return (
    <fieldset className="day-hours-field" aria-describedby="day-hours-help">
      <legend>Your day</legend>
      <p id="day-hours-help">
        The hours you want to be out and about, such as 07:00 to 22:30. Planning with AI stays inside them, and the day view shows your open time within them. Leave both empty for the usual day.
      </p>
      <div className="day-hours-times">
        <label>
          Day starts
          <input type="time" value={start} aria-invalid={!!problem} onChange={(e) => onChange({ dayStart: e.target.value, dayEnd: end })} />
        </label>
        <label>
          Day ends
          <input type="time" value={end} aria-invalid={!!problem} onChange={(e) => onChange({ dayStart: start, dayEnd: e.target.value })} />
        </label>
        {(start || end) && <button type="button" onClick={() => onChange({ dayStart: "", dayEnd: "" })}>Use the usual day</button>}
      </div>
      {problem && <p role="alert" className="day-hours-problem">{problem} It is not saved to your account until it is fixed.</p>}
    </fieldset>
  );
}
