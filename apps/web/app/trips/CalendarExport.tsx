"use client";
import { useState } from "react";
import type { Trip } from "../../lib/trips/adapter";
import { icsCalendar } from "../../lib/trips/calendar";

/** A calendar file of the plan, made on this device. Nothing is uploaded and nothing in the plan changes. */
export default function CalendarExport({ trip }: { trip: Trip }) {
  const [notice, setNotice] = useState("");
  const dated = trip.mode === "exact" && /^\d{4}-\d{2}-\d{2}$/.test(trip.start);
  function download() {
    const result = icsCalendar(trip);
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
      <button type="button" onClick={download}>Download a calendar file</button>
    </> : <p>Calendar files need exact trip dates. Choose exact dates in the trip form to download one.</p>}
    {notice && <p role="status">{notice}</p>}
  </section>;
}
