"use client";
import { useState } from "react";
import type { Activity } from "../../lib/trips/adapter";
import { HOURS_ATTRIBUTION, type HoursCheck } from "../../lib/trips/place-hours";
import { dayHours } from "../../lib/trips/day-hours";
import PlaceHoursCheck from "./PlaceHoursCheck";

function VisitCheck({ activity, date, timezone, onResult }: { activity: Activity; date: string; timezone: string; onResult: (check: HoursCheck | null) => void }) {
  return <PlaceHoursCheck sourceId={activity.place!.id} visitDate={date || null} start={activity.start} minutes={activity.minutes} timezone={timezone} onResult={onResult} temporarySelection />;
}
export default function DayOpeningHours({ activities, date, timezone, results, onResult, onEdit }: { activities: Activity[]; date: string; timezone: string; results: Record<string, HoursCheck>; onResult: (id: string, check: HoursCheck | null) => void; onEdit: (activity: Activity) => void }) {
  const review = dayHours(activities, results);
  const [selected, setSelected] = useState("");
  const current = review.items.find(item => item.activity.id === selected) ?? review.items[0];
  return <section aria-label="Day opening-hours review" className="day-feasibility">
    <h3>Will the places be open?</h3>
    <p role="status">{review.items.length ? `${review.fits} of ${review.items.length} visits fit the regular hours${review.conflicts ? `; ${review.conflicts} need another time` : ""}.` : "No venue visits to check. Meal, rest and free-time blocks aren’t treated as venues."}</p>
    {!!review.items.length && <ol className="day-journey-review">{review.items.map(item => <li key={item.activity.id} data-state={item.state === "conflict" ? "shortfall" : item.state} aria-current={current?.activity.id === item.activity.id ? "step" : undefined}><div><strong>{item.activity.title}</strong><span>{item.state === "missing_location" ? "Mapped location needed · hours unknown" : item.state === "unchecked" ? "Hours not checked" : item.state === "fits" ? "Fits the regular opening hours" : item.state === "conflict" ? "Outside the regular opening hours" : item.check?.status === "outside_coverage" ? "Choose a current date" : "Hours remain unknown"}</span></div><button type="button" aria-label={`Review hours for ${item.activity.title}`} onClick={() => setSelected(item.activity.id)}>Review</button></li>)}</ol>}
    {current?.check && <section className="reported-details" aria-label="Selected visit hours result"><p className="provider-attribution">{HOURS_ATTRIBUTION}</p><strong>{current.check.place_name}</strong><p>{current.check.explanation}</p>{!!current.check.hours.length && <details><summary>Regular hours as listed · unverified</summary><ul>{current.check.hours.map((line,index)=><li key={index}>{line}</li>)}</ul></details>}<small>Checked {new Date(current.check.retrieved_at).toLocaleString()}. Full visit: {current.activity.start}, {current.activity.minutes} minutes.</small></section>}
    {current && <div><p><strong>{current.activity.title}</strong><br />{current.activity.start}, {current.activity.minutes} minutes · {timezone}</p>{!date ? <p>Choose a date above to check the full visit. Flexible trip dates stay unchanged.</p> : !current.activity.place ? <p>This activity has no mapped location. Add a sourced place through Explore nearby places; we won’t guess a place from its name.</p> : <VisitCheck key={`${current.activity.id}:${date}`} activity={current.activity} date={date} timezone={timezone} onResult={check => onResult(current.activity.id, check)} />}
      <button type="button" onClick={() => onEdit(current.activity)}>Edit {current.activity.title}</button></div>}
    <small>Results stay in this view and are never saved. Hours come from OpenStreetMap contributors, can be missing or out of date, and may omit holidays or special closures. Nothing reserves entry.</small>
  </section>;
}
