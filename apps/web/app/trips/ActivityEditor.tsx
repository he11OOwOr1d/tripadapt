"use client";
import GooglePlaceCheck from "./GooglePlaceCheck";
import { routeSchedule, provisionalDate } from "../../lib/trips/itinerary";
import PlaceAttribution from "./PlaceAttribution";
import { useEffect, useRef, useState } from "react";
import type { Activity, Trip } from "../../lib/trips/adapter";
import {
  activityProblems,
  dayConflicts,
  clockMinutes,
  clock,
} from "../../lib/trips/itinerary";
export default function ActivityEditor({
  initial,
  trip,
  onSave,
  onClose,
  onRemove,
}: {
  initial: Activity;
  trip: Trip;
  onSave: (activity: Activity) => void;
  onClose: () => void;
  onRemove: () => void;
}) {
  const [draft, setDraft] = useState<Activity>(initial),
    [errors, setErrors] = useState<string[]>([]);
  const dialog = useRef<HTMLDialogElement>(null);
  const firstInput = useRef<HTMLInputElement>(null);
  const existing = trip.activities.some((a) => a.id === initial.id);
  const stop = trip.stops.find((s) => s.id === draft.stopId);
  const arrival = routeSchedule(trip).find(s => s.stop.id === draft.stopId)?.arrivalDay;
  const visitDate = arrival === undefined ? null : provisionalDate(trip, arrival + draft.day - 1);
  const conflicts =
    dayConflicts(
      {
        ...trip,
        activities: [
          ...trip.activities.filter((a) => a.id !== draft.id),
          draft,
        ],
      },
      draft.stopId,
      draft.day,
    )[draft.id] ?? [];
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const node = dialog.current;
    node?.showModal();
    firstInput.current?.focus();
    return () => {
      if (node?.open) node.close();
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  const patch = (value: Partial<Activity>) => {
    setDraft((a) => ({ ...a, ...value, googlePlaceId: (value.title !== undefined && value.title !== a.title) || (value.stopId !== undefined && value.stopId !== a.stopId) ? undefined : a.googlePlaceId, place: (value.title !== undefined && value.title !== a.title) || (value.stopId !== undefined && value.stopId !== a.stopId) ? undefined : a.place }));
    setErrors([]);
  };
  return (
    <dialog
      ref={dialog}
      className="day-editor"
      aria-labelledby="day-editor-title"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === dialog.current) onClose();
      }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fields = new FormData(e.currentTarget);
          const submitted: Activity = {
            ...draft,
            googlePlaceId: String(fields.get("title") ?? "").trim() === draft.title && String(fields.get("stopId") ?? "") === draft.stopId ? draft.googlePlaceId : undefined,
            place: String(fields.get("title") ?? "").trim() === draft.title && String(fields.get("stopId") ?? "") === draft.stopId ? draft.place : undefined,
            title: String(fields.get("title") ?? "").trim(),
            kind: String(fields.get("kind") ?? "custom") as Activity["kind"],
            stopId: String(fields.get("stopId") ?? ""),
            day: Number(fields.get("day")),
            start: String(fields.get("start") ?? ""),
            minutes: Number(fields.get("minutes")),
            fixed: fields.has("fixed"),
            completed: fields.has("completed"),
            booked: fields.has("booked"),
          };
          const problems = activityProblems(submitted, trip);
          if (problems.length) {
            setErrors(problems);
            return;
          }
          onSave(submitted);
        }}
      >
        <header>
          <div>
            <p>{existing ? "A little adjustment" : "Make it your day"}</p>
            <h2 id="day-editor-title">
              {existing ? "Edit this activity" : "Add to your day"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close activity editor"
          >
            ×
          </button>
        </header>
        {draft.place && <div className="activity-picked-place"><PlaceAttribution place={draft.place} /><p>The 60-minute starting duration is an estimate. Choose your time before saving; this makes no reservation.</p></div>}
        <label>
          What would you like to do?
          <input
            name="title"
            ref={firstInput}
            required
            maxLength={300}
            placeholder="A museum, a slow lunch, a wander…"
            value={draft.title}
            onChange={(e) => patch({ title: e.target.value })}
          />
        </label>
        <label>
          Type
          <select
            name="kind"
            value={draft.kind ?? "custom"}
            onChange={(e) =>
              patch({ kind: e.target.value as Activity["kind"] })
            }
          >
            <option value="custom">Activity</option>
            <option value="meal">Meal</option>
            <option value="rest">Break</option>
            <option value="free_time">Free time</option>
          </select>
        </label>
        <div className="editor-grid">
          <label>
            Destination
            <select
              name="stopId"
              value={draft.stopId}
              onChange={(e) => patch({ stopId: e.target.value, day: 1 })}
            >
              {trip.stops.map((s, i) => (
                <option key={s.id} value={s.id}>
                  {i + 1}. {s.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Day in this place
            <input
              type="number"
              required
              min={1}
              max={(stop?.nights ?? 0) + 1}
              name="day"
              value={draft.day}
              onChange={(e) => patch({ day: Number(e.target.value) })}
            />
          </label>
          <label>
            Start time
            <input
              name="start"
              type="time"
              onInput={(e) => patch({ start: e.currentTarget.value })}
              onBlur={(e) => patch({ start: e.currentTarget.value })}
              required
              value={draft.start}
              onChange={(e) => patch({ start: e.target.value })}
            />
          </label>
          <label>
            Duration · minutes
            <input
              type="number"
              required
              min={1}
              max={1440}
              name="minutes"
              value={draft.minutes}
              onChange={(e) => patch({ minutes: Number(e.target.value) })}
            />
          </label>
        </div>
        <p className="editor-caption">
          {stop?.timezone} · ends at{" "}
          {clockMinutes(draft.start) + draft.minutes > 1440
            ? `${clock(clockMinutes(draft.start) + draft.minutes - 1440)} next day`
            : clock(clockMinutes(draft.start) + draft.minutes)}
        </p>
        {draft.place && <GooglePlaceCheck key={draft.place.id} sourceId={draft.place.id} googleId={draft.googlePlaceId} onSelect={id=>setDraft(value=>({...value,googlePlaceId:id}))} visitDate={visitDate} start={draft.start} minutes={draft.minutes} timezone={stop?.timezone ?? "UTC"} />}
        <details className="editor-options">
          <summary>Keep fixed, completed or booked</summary>
          <label>
            <input
              type="checkbox"
              name="fixed"
              checked={draft.fixed}
              onChange={(e) => patch({ fixed: e.target.checked })}
            />
            Keep fixed during future replanning
          </label>
          <label>
            <input
              type="checkbox"
              name="completed"
              checked={draft.completed}
              onChange={(e) => patch({ completed: e.target.checked })}
            />
            Already completed
          </label>
          <label>
            <input
              type="checkbox"
              name="booked"
              checked={draft.booked}
              onChange={(e) => patch({ booked: e.target.checked })}
            />
            I’ve already booked this elsewhere
          </label>
          <p>These are your records. Choosing booked makes no reservation.</p>
        </details>
        {!!errors.length && (
          <div className="editor-error" role="alert">
            {errors.map((error) => (
              <p key={error}>{error}</p>
            ))}
          </div>
        )}
        {!!conflicts.length && (
          <div className="editor-warning">
            <strong>Timing needs a look</strong>
            {conflicts.map((c) => (
              <p key={c}>{c}</p>
            ))}
            {conflicts.some((c) => c.startsWith("Overlaps")) && (
              <p>You can keep an overlapping draft and adjust it later.</p>
            )}
          </div>
        )}
        <footer>
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="day-primary">
            {existing ? "Save changes" : "Add to day"}
          </button>
        </footer>
        {existing && (
          <button type="button" className="day-remove" onClick={onRemove}>
            Remove from trip
          </button>
        )}
      </form>
    </dialog>
  );
}
