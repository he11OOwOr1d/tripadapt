"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  emptyTrip,
  sampleTrip,
  mockTripAdapter,
  mockSampleAdapter,
  issuesFor,
  type Trip,
  type Activity,
} from "../../lib/trips/adapter";
import TripCreation from "./TripCreation";
import { planningCosts } from "../../lib/trips/planning";
import "./workspace.css";
import "./creation.css";
import "./unfolding.css";

export default function TripWorkbench({
  initialView,
}: {
  initialView: "setup" | "itinerary";
}) {
  const [trip, setTrip] = useState<Trip>(() =>
    structuredClone(initialView === "setup" ? emptyTrip : sampleTrip),
  );
  const [view, setView] = useState(initialView);
  const [loadGeneration, setLoadGeneration] = useState(0);
  const adapter = initialView === "setup" ? mockTripAdapter : mockSampleAdapter;
  const [selected, setSelected] = useState("jaipur");
  const [day, setDay] = useState(1);
  const [notice, setNotice] = useState(
    "Changes stay in this draft. No accepted plan is connected.",
  );
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Activity | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const modalOpen = !!editing || !!removing;
  useEffect(() => {
    if (!modalOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>(".trip-dialog");
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusables = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          "button:not(:disabled),input,select,textarea",
        ) ?? [],
      );
    focusables()[0]?.focus();
    function keydown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setEditing(null);
        setRemoving(null);
      }
      if (e.key === "Tab") {
        const nodes = focusables();
        const first = nodes[0];
        const last = nodes.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    }
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      document.body.style.overflow = oldOverflow;
      previous?.focus();
    };
  }, [modalOpen]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const stop = trip.stops.find((s) => s.id === selected) ?? trip.stops[0];
  const issues = issuesFor(trip);
  const nights = trip.stops.reduce((n, s) => n + s.nights, 0);
  const costs = planningCosts(trip);
  function update(patch: Partial<Trip>) {
    setTrip((t) => ({ ...t, ...patch }));
    setDirty(true);
    setNotice("Unsaved draft changes.");
  }
  function reorder(index: number, delta: number) {
    const stops = [...trip.stops];
    [stops[index], stops[index + delta]] = [stops[index + delta], stops[index]];
    update({ stops });
    setNotice(
      "Route reordered. Activities remain with their destinations. Stays and connecting transport need review; none are connected in this mock.",
    );
  }
  async function save() {
    setBusy(true);
    try {
      await adapter.save(trip);
      setDirty(false);
      setNotice(
        "Draft saved in this browser only. The accepted plan is unchanged.",
      );
    } catch {
      setNotice(
        "Save failed. Check numeric fields, or browser storage may be unavailable or full. Your edits remain on screen.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function load() {
    setBusy(true);
    try {
      const saved = await adapter.load();
      if (saved) {
        setTrip(saved);
        setLoadGeneration((n) => n + 1);
        setView("setup");
        setDirty(false);
        setSelected(saved.stops[0]?.id ?? "");
        setDay(1);
        setNotice("Loaded your draft saved in this browser.");
      } else setNotice("No saved draft in this browser yet.");
    } catch {
      setNotice(
        "Could not read the saved draft. Your current edits remain on screen.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className={`trip-app ${view === "setup" ? "trip-unfolding" : ""}`}>
      <header className="trip-header">
        <Link href="/" className="trip-wordmark">
          elsewhere<span> / your journey</span>
        </Link>
        <span className="trip-demo">
          {initialView === "itinerary"
            ? "Editable sample · browser-local"
            : "Browser-local draft · no live services"}
        </span>
        <button
          disabled={busy}
          onClick={() => {
            if (
              !dirty ||
              window.confirm(
                "Replace unsaved edits with the saved browser draft?",
              )
            )
              void load();
          }}
        >
          Open saved draft
        </button>
      </header>
      <div className="trip-shell">
        <div className="trip-heading">
          <div>
            <p className="trip-kicker">A few places. One journey.</p>
            <h1>
              {view === "setup"
                ? "You don’t need it all figured out."
                : trip.title || "Your untitled journey"}
            </h1>
            <p>
              {view === "setup"
                ? "Just a beginning. We’ll open the rest as you go."
                : `${trip.stops.length} destinations · ${nights} nights planned · ${trip.mode === "duration" ? "Dates open" : trip.mode === "window" ? "Tentative window" : "Exact dates"}`}
            </p>
          </div>
          <button className="trip-primary" onClick={save} disabled={busy}>
            {busy ? "Working…" : dirty ? "Save draft" : "Save browser draft"}
          </button>
        </div>
        <div className="trip-status" role="status">
          {notice}
        </div>
        {view === "itinerary" && (
          <nav className="trip-tabs" aria-label="Trip workspace">
            <button onClick={() => setView("setup")}>Edit trip & route</button>
            <button aria-current="page" onClick={() => setView("itinerary")}>
              Itinerary draft
            </button>
          </nav>
        )}
        {view === "setup" ? (
          <TripCreation
            key={loadGeneration}
            trip={trip}
            update={update}
            reorder={reorder}
            remove={setRemoving}
            onOpen={() => {
              setSelected(trip.stops[0]?.id ?? "");
              setDay(1);
              setView("itinerary");
            }}
          />
        ) : (
          <div className="trip-workspace">
            <aside className="trip-panel trip-route">
              <p className="trip-kicker">THE JOURNEY</p>
              <h2>A place at a time.</h2>
              {trip.stops.map((s, i) => (
                <button
                  key={s.id}
                  className={`trip-route-stop ${stop?.id === s.id ? "is-active" : ""}`}
                  onClick={() => {
                    setSelected(s.id);
                    setDay(1);
                  }}
                >
                  <span className="trip-number">{i + 1}</span>
                  <span>
                    <strong>{s.name || "Unnamed destination"}</strong>
                    <small>
                      {s.nights} nights · {s.timezone || "Timezone unknown"}
                    </small>
                  </span>
                </button>
              ))}
              <button className="trip-add" onClick={() => setView("setup")}>
                Edit route & stay lengths
              </button>
              <div className="trip-budget">
                <p className="trip-kicker">BUDGET TARGET</p>
                <strong>
                  {trip.budget
                    ? `${trip.currency} ${Number(trip.budget).toLocaleString()}`
                    : "Not set"}
                </strong>
                <p>
                  Stay & travel subtotal:{" "}
                  {costs.known
                    ? `${trip.currency} ${costs.total.toLocaleString()}`
                    : "not entered"}
                </p>
                <small>
                  User-entered allowances only. Meals, activities, taxes and
                  local travel remain unpriced.
                </small>
              </div>
            </aside>
            <section className="trip-panel trip-timeline">
              <div className="trip-section-title">
                <div>
                  <p className="trip-kicker">EDITABLE DRAFT</p>
                  <h2>{stop?.name || "Start with a destination"}</h2>
                </div>
                <span className="trip-badge">Not accepted</span>
              </div>
              {stop ? (
                <>
                  <label className="trip-day">
                    Day at this destination
                    <input
                      type="number"
                      min="1"
                      max={stop.nights + 1}
                      value={day}
                      onChange={(e) =>
                        setDay(
                          Math.min(
                            stop.nights + 1,
                            Math.max(1, Number(e.target.value)),
                          ),
                        )
                      }
                    />
                    <span>of {stop.nights + 1} days</span>
                  </label>
                  <p className="trip-muted">
                    Local time · {stop.timezone || "Timezone not entered"} ·{" "}
                    {trip.mode === "duration"
                      ? "No calendar date assigned"
                      : "Calendar scheduling pending validation"}
                  </p>
                  <div className="trip-activities">
                    {trip.activities
                      .filter((a) => a.stopId === stop.id && a.day === day)
                      .sort((a, b) => a.start.localeCompare(b.start))
                      .map((a) => (
                        <article className="trip-activity" key={a.id}>
                          <time>{a.start}</time>
                          <div>
                            <h3>{a.title}</h3>
                            <p>
                              {a.minutes} min ·{" "}
                              {a.booked
                                ? "User-entered booking"
                                : "Planned · not booked"}
                              {a.fixed ? " · Keep fixed" : ""}
                              {a.completed ? " · Completed" : ""}
                            </p>
                            <small>
                              Mock / user-entered · hours, travel and
                              availability unchecked
                            </small>
                          </div>
                          <button
                            onClick={() => setEditing({ ...a })}
                            aria-label={`Edit ${a.title}`}
                          >
                            Edit
                          </button>
                        </article>
                      ))}
                  </div>
                  <div className="trip-free">
                    <span>↗</span>
                    <div>
                      <h3>Space is part of the plan.</h3>
                      <p>
                        Unscheduled time is left open. Add an activity when
                        you’re ready.
                      </p>
                    </div>
                  </div>
                  <button
                    className="trip-add"
                    onClick={() =>
                      setEditing({
                        id: crypto.randomUUID(),
                        stopId: stop.id,
                        day,
                        title: "",
                        start: "09:00",
                        minutes: 60,
                        fixed: false,
                        completed: false,
                        booked: false,
                      })
                    }
                  >
                    + Add activity or free time
                  </button>
                </>
              ) : (
                <button className="trip-add" onClick={() => setView("setup")}>
                  Add your first destination →
                </button>
              )}
            </section>
            <aside className="trip-panel trip-review">
              <p className="trip-kicker">BEFORE YOU GO</p>
              <h2>Keep the gaps visible.</h2>
              <p className="trip-badge">
                {issues.length
                  ? `${issues.length} draft issues`
                  : "Checks incomplete"}
              </p>
              {issues.length ? (
                <ul>
                  {issues.map((issue, i) => (
                    <li key={i}>{issue}</li>
                  ))}
                </ul>
              ) : (
                <p>
                  No local time overlaps detected. This is not a validated
                  travel plan.
                </p>
              )}
              <p>
                Opening hours, route durations, stays and supplier availability
                remain unknown. Local checks only cover activity overlaps, day
                bounds and stay length.
              </p>
              <hr />
              <h3>Draft, then decide.</h3>
              <p>
                Saving keeps an editable browser draft. Proposal review and
                acceptance will connect when the backend is available.
              </p>
            </aside>
          </div>
        )}
        {removing && (
          <div className="trip-overlay">
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="remove-title"
              className="trip-dialog"
            >
              <h2 id="remove-title">Remove this destination?</h2>
              <p>
                This also removes its{" "}
                {trip.activities.filter((a) => a.stopId === removing).length}{" "}
                activities from this draft, including any fixed or completed
                items. No supplier booking is cancelled.
              </p>
              <button autoFocus onClick={() => setRemoving(null)}>
                Keep destination
              </button>
              <button
                className="trip-danger"
                onClick={() => {
                  update({
                    stops: trip.stops.filter((s) => s.id !== removing),
                    activities: trip.activities.filter(
                      (a) => a.stopId !== removing,
                    ),
                  });
                  setRemoving(null);
                  setDay(1);
                }}
              >
                Remove destination and activities
              </button>
            </section>
          </div>
        )}
        {editing && (
          <div className="trip-overlay">
            <form
              role="dialog"
              aria-modal="true"
              aria-labelledby="activity-title"
              className="trip-dialog"
              onSubmit={(e) => {
                e.preventDefault();
                update({
                  activities: [
                    ...trip.activities.filter((a) => a.id !== editing.id),
                    editing,
                  ],
                });
                setEditing(null);
              }}
            >
              <h2 id="activity-title">Shape this part of the day.</h2>
              <label>
                Activity or free time
                <input
                  autoFocus
                  required
                  value={editing.title}
                  onChange={(e) =>
                    setEditing({ ...editing, title: e.target.value })
                  }
                />
              </label>
              <div className="trip-fields">
                <label>
                  Destination
                  <select
                    value={editing.stopId}
                    onChange={(e) =>
                      setEditing({ ...editing, stopId: e.target.value, day: 1 })
                    }
                  >
                    {trip.stops.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Day
                  <input
                    required
                    type="number"
                    min="1"
                    value={editing.day}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        day: Math.max(1, Number(e.target.value)),
                      })
                    }
                  />
                </label>
                <label>
                  Local start
                  <input
                    required
                    type="time"
                    value={editing.start}
                    onChange={(e) =>
                      setEditing({ ...editing, start: e.target.value })
                    }
                  />
                </label>
                <label>
                  Duration · minutes
                  <input
                    required
                    type="number"
                    min="1"
                    value={editing.minutes}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        minutes: Math.max(1, Number(e.target.value)),
                      })
                    }
                  />
                </label>
              </div>
              <label className="trip-check">
                <input
                  type="checkbox"
                  checked={editing.fixed}
                  onChange={(e) =>
                    setEditing({ ...editing, fixed: e.target.checked })
                  }
                />
                Keep fixed during future replanning
              </label>
              <label className="trip-check">
                <input
                  type="checkbox"
                  checked={editing.completed}
                  onChange={(e) =>
                    setEditing({ ...editing, completed: e.target.checked })
                  }
                />
                Completed
              </label>
              <p className="trip-muted">
                Fixed is separate from booked. You can explicitly edit fixed
                items here.
              </p>
              <div className="trip-dialog-actions">
                <button type="button" onClick={() => setEditing(null)}>
                  Cancel
                </button>
                <button className="trip-primary" type="submit">
                  Save activity to draft
                </button>
              </div>
              {trip.activities.some((a) => a.id === editing.id) && (
                <button
                  type="button"
                  className="trip-danger"
                  onClick={() => {
                    if (
                      window.confirm(
                        "Remove this activity from the draft? This does not cancel a booking.",
                      )
                    ) {
                      update({
                        activities: trip.activities.filter(
                          (a) => a.id !== editing.id,
                        ),
                      });
                      setEditing(null);
                    }
                  }}
                >
                  Remove activity
                </button>
              )}
            </form>
          </div>
        )}
      </div>
    </main>
  );
}
