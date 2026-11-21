"use client";
import { useEffect, useState } from "react";
import type { Trip } from "../../lib/trips/adapter";
import { icsCalendar, REMINDER_CHOICES } from "../../lib/trips/calendar";

/** A calendar file of the plan, made on this device. Nothing is uploaded and nothing in the plan changes. */
export default function CalendarExport({ trip }: { trip: Trip }) {
  const [notice, setNotice] = useState("");
  const [reminder, setReminder] = useState("");
  // A count or a message about an earlier plan would be wrong once the plan changes.
  useEffect(() => { setNotice(""); }, [trip]);
  const dated = trip.mode === "exact" && /^\d{4}-\d{2}-\d{2}$/.test(trip.start);
  /** A link back to this plan, only for a saved trip on a secure address: the link needs the owner's sign-in, and a local address would lead nowhere. */
  function planLink(): string | undefined {
    try {
      const id = new URLSearchParams(window.location.search).get("trip");
      if (window.location.protocol !== "https:" || !id || !/^[0-9a-f-]{36}$/i.test(id)) return undefined;
      return `${window.location.origin}/trips/new?trip=${id}`;
    } catch { return undefined; }
  }
  function download() {
    let result: ReturnType<typeof icsCalendar>;
    try { result = icsCalendar(trip, new Date(), { reminderMinutes: reminder ? Number(reminder) : null, planUrl: planLink() }); } catch { setNotice("The calendar file could not be made from this plan. Nothing was changed."); return; }
    if (!result) { setNotice("There is nothing to put in a calendar yet. Add activities, a stay, or a journey with a departure or arrival time."); return; }
    const blob = new Blob([result.text], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const name = (trip.title || "my-trip").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "my-trip";
    link.href = url; link.download = `${name}.ics`;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice(`Downloaded ${result.events} ${result.events === 1 ? "event" : "events"}.`);
  }
  return <section className="calendar-export" aria-label="Calendar file">
    <h2>Take your plan with you</h2>
    {dated ? <>
      <p>Download your activities, stays and journeys with recorded times as a calendar file (.ics) for any calendar app. It is made on this device from your plan; nothing is uploaded. Times are written in UTC so each app shows them in your own time zone. Skipped activities are left out, and journeys to and from your starting point are not included. It is your plan, not confirmed bookings.</p>
      <p>Events keep the same ids, so importing a newer file into the same calendar should update them instead of adding copies (apps differ, so check the first time). Map places carry their position, and a saved trip adds a link back to it that only you can open.</p>
      <label className="calendar-reminder">Reminder for timed events
        <select value={reminder} onChange={(e) => { setReminder(e.target.value); setNotice(""); }} aria-describedby="calendar-reminder-note">
          <option value="">None</option>
          {REMINDER_CHOICES.map((m) => <option key={m} value={m}>{m === 1440 ? "1 day before" : m === 60 ? "1 hour before" : `${m} minutes before`}</option>)}
        </select>
      </label>
      <small id="calendar-reminder-note">Stays are all-day events and get no reminder. Your calendar app may add its own default reminders as well.</small>
      <button type="button" onClick={download}>Download a calendar file</button>
    </> : <p>Calendar files need exact trip dates. Choose exact dates in the trip form to download one.</p>}
    {notice && <p role="status">{notice}</p>}
  </section>;
}
