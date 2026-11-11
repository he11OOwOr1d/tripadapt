"use client";
import { useRef, useState } from "react";
import PlaceLookup from "./PlaceLookup";
import type { Trip, Stop } from "../../lib/trips/adapter";
import {
  planningCosts,
  planningProblems,
  routeLegs,
  suggestedSplit,
  timeAllocation,
} from "../../lib/trips/planning";

const steps = [
  "A beginning",
  "When you go",
  "Places to follow",
  "Time in each place",
  "Stay & travel",
  "All together",
];
const headings = [
  "Where does your escape begin?",
  "When feels right?",
  "The places that pull you.",
  "How long in each place?",
  "How would you like to travel?",
  "Your escape, all together.",
];
const introductions = [
  "Start with what you know. There’s room to change your mind.",
  "Choose your dates, a window, or leave the calendar open.",
  "Add your destinations in travel order. One place or many, anywhere.",
  "Choose your overnight stays. Leave a little time open if you like.",
  "Choose a place to sleep and a way to get there. Everything here is optional.",
  "A route to build around, with space for the days still to come.",
];

export default function TripCreation({
  trip,
  update,
  reorder,
  remove,
  onOpen,
  initialStep = 0,
  onStepChange,
  accountSavingAvailable = false,
}: {
  accountSavingAvailable?: boolean;
  initialStep?: number;
  onStepChange?: (step: number) => void;
  trip: Trip;
  update: (patch: Partial<Trip>) => void;
  reorder: (index: number, delta: number) => void;
  remove: (id: string) => void;
  onOpen: () => void;
}) {
  const [step, setStep] = useState(initialStep);
  const [collapsed, setCollapsed] = useState(false);
  const [furthest, setFurthest] = useState(() =>
    Math.max(
      initialStep,
      trip.origin.trim() && trip.stops.length ? 5 : trip.origin.trim() ? 1 : 0,
    ),
  );
  const [errors, setErrors] = useState<string[]>([]);
  const [place, setPlace] = useState("");
  const [timezone, setTimezone] = useState("");
  const timezoneInput = useRef<HTMLInputElement>(null);
  const [placeError, setPlaceError] = useState("");
  const title = useRef<HTMLHeadingElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const time = timeAllocation(trip);
  const costs = planningCosts(trip);
  const problems = planningProblems(trip);
  const money = (amount: number) =>
    `${trip.currency} ${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  function go(next: number) {
    setStep(next);
    onStepChange?.(next);
    setCollapsed(false);
    setErrors([]);
    setFurthest((n) => Math.max(n, next));
    requestAnimationFrame(() => {
      title.current?.focus();
      title.current?.scrollIntoView({ block: "start" });
    });
  }
  function basicsErrors(includeDates = step >= 1) {
    const result: string[] = [];
    if (!trip.origin.trim()) result.push("Enter your starting location.");
    if (
      ![trip.travelers, trip.rooms].every(
        (n) => Number.isSafeInteger(n) && n > 0,
      )
    )
      result.push("Travelers and rooms must be whole numbers of at least one.");
    if (!Number.isSafeInteger(trip.days) || trip.days < 0)
      result.push("Use a whole number of days, or leave duration open.");
    if (
      includeDates &&
      trip.mode !== "duration" &&
      (!trip.start || !trip.end || trip.end < trip.start)
    )
      result.push("Choose a valid start and end date.");
    return result;
  }
  function continueStep(next = step + 1) {
    if (!form.current?.reportValidity()) return;
    const result = [...basicsErrors(next === 5 || step >= 1)];
    if ((step > 1 || next === 5) && !trip.stops.length)
      result.push("Add at least one destination to your route.");
    if (
      (step > 1 || next === 5) &&
      trip.returnToOrigin === false &&
      !trip.finish?.trim()
    )
      result.push("Enter your finish location in Places.");
    if (step >= 3 || next === 5) result.push(...problems);
    if (result.length) {
      setErrors(result);
      return;
    }
    if (step === 5) onOpen();
    else go(next);
  }
  function addPlace() {
    if (!place.trim()) {
      setPlaceError("Enter a destination, including its region or country.");
      return;
    }
    try {
      if (!timezone) throw new Error();
      new Intl.DateTimeFormat("en", { timeZone: timezone }).format();
    } catch {
      setPlaceError(
        "Choose or enter a valid IANA timezone, such as Asia/Kolkata.",
      );
      return;
    }
    update({
      stops: [
        ...trip.stops,
        { id: crypto.randomUUID(), name: place.trim(), timezone, nights: 0 },
      ],
    });
    setPlace("");
    setTimezone("");
    setPlaceError("");
    setErrors([]);
  }
  function stay(
    id: string,
    patch: Partial<NonNullable<Trip["stayPreferences"]>[string]>,
  ) {
    const previous = trip.stayPreferences?.[id] ?? {
      style: "",
      rate: "",
      basis: "room" as const,
    };
    update({
      stayPreferences: {
        ...trip.stayPreferences,
        [id]: { ...previous, ...patch },
      },
    });
  }
  function travel(
    key: string,
    patch: Partial<NonNullable<Trip["travelPreferences"]>[string]>,
  ) {
    const previous = trip.travelPreferences?.[key] ?? {
      mode: "",
      hours: "",
      overnight: 0,
      rate: "",
      basis: "person" as const,
    };
    update({
      travelPreferences: {
        ...trip.travelPreferences,
        [key]: { ...previous, ...patch },
      },
    });
  }
  const summary = (
    <>
      <div className="creation-summary-top">
        <span>Your trip, taking shape</span>
        <span aria-hidden="true">↗</span>
      </div>
      <h2>{trip.title || "Somewhere of your own."}</h2>
      <p>
        {trip.travelers} {trip.travelers === 1 ? "traveler" : "travelers"} ·{" "}
        {trip.rooms} {trip.rooms === 1 ? "room" : "rooms"}
      </p>
      <p>
        {trip.mode === "duration"
          ? "Dates open"
          : trip.start && trip.end
            ? `${trip.start} — ${trip.end}${trip.mode === "window" ? " · flexible" : ""}`
            : "Dates to decide"}
      </p>
      <ol className="creation-route">
        <li className="route-end">{trip.origin || "Your starting point"}</li>
        {trip.stops.map((s, i) => (
          <li key={s.id}>
            <span className="route-dot">{i + 1}</span>
            <span>
              {s.name}
              <small>
                {s.nights ? `${s.nights} nights` : "Day visit · no stay night"}
              </small>
            </span>
          </li>
        ))}
        {!trip.stops.length && (
          <li className="route-invitation">
            Your first destination goes here.
          </li>
        )}
        {!!trip.stops.length && (
          <li className="route-end">
            {trip.returnToOrigin !== false
              ? `Back to ${trip.origin || "your start"}`
              : trip.finish || "Finish to decide"}
          </li>
        )}
      </ol>
      <div className="creation-summary-time">
        <div>
          <strong>{time.stays}</strong>
          <span>in accommodation</span>
        </div>
        <div>
          <strong>{time.travelNights}</strong>
          <span>on the move</span>
        </div>
        <div>
          <strong>{time.days ?? "—"}</strong>
          <span>total trip days</span>
        </div>
      </div>
      <p className="creation-note">
        {time.remaining === null
          ? "Dates are open. Keep shaping your route."
          : time.remaining < 0
            ? `${-time.remaining} ${-time.remaining === 1 ? "night" : "nights"} over your available time.`
            : time.remaining === 0
              ? "All nights accounted for."
              : `${time.remaining} ${time.remaining === 1 ? "night" : "nights"} left open.`}
      </p>
      <div className="creation-summary-cost">
        <span>Your estimated costs</span>
        <strong>{costs.known ? money(costs.total) : "Budget left open"}</strong>
        {!!costs.known && (
          <span>{money(costs.total / trip.travelers)} per traveler</span>
        )}
        <small>
          {costs.unknown > 0 ? "Some costs are still open. " : ""}Meals and
          local spending are extra.
        </small>
      </div>
    </>
  );
  const answers = [
    trip.origin.trim()
      ? `${trip.origin} / ${trip.travelers} ${trip.travelers === 1 ? "traveler" : "travelers"}`
      : "Your starting point and your people",
    trip.mode === "duration"
      ? trip.days
        ? `${trip.days} days / dates open`
        : "Dates and duration can come later"
      : trip.start && trip.end
        ? `${trip.start} to ${trip.end}${trip.mode === "window" ? " / flexible" : ""}`
        : "Choose dates or leave them open",
    trip.stops.length
      ? trip.stops.map((s) => s.name).join(" / ")
      : "One place, or many. Anywhere.",
    trip.stops.length
      ? `${time.stays} nights across ${trip.stops.length} ${trip.stops.length === 1 ? "place" : "places"}`
      : "Give the route a little time",
    costs.known
      ? `${money(costs.total)} entered / other costs still open`
      : "Sleep, transport and optional budgets",
    "Your route, time and allowances together",
  ];
  function leafHeader(index: number, active = false) {
    return (
      <button
        type="button"
        className="unfold-leaf-heading"
        id={`unfold-heading-${index}`}
        aria-expanded={active && !collapsed}
        aria-controls={active ? "unfold-active-body" : undefined}
        disabled={!active && index > furthest}
        onClick={() => (active ? setCollapsed((v) => !v) : go(index))}
      >
        <span>{steps[index]}</span>
        <small>{answers[index]}</small>
        <b aria-hidden="true">{active && !collapsed ? "−" : "+"}</b>
        {!active && index > furthest && <em>Up next</em>}
      </button>
    );
  }
  return (
    <div
      className={`creation unfolding-journey ${step === 5 ? "unfolding-review" : ""}`}
    >
      <details className="creation-mobile-summary">
        <summary>
          View your trip summary{" "}
          <span>
            {trip.stops.length} places · {time.stays} nights
          </span>
        </summary>
        {summary}
      </details>
      <div className="creation-layout">
        <div className="unfold-stack">
          {step === 5 ? (
            <div className="unfold-review-return">
              <button type="button" onClick={() => go(4)}>
                Back to your plan
              </button>
              <span>Trip overview · editable draft</span>
            </div>
          ) : (
            steps.slice(0, step).map((_, i) => (
              <section className={`unfold-leaf unfold-leaf-${i}`} key={i}>
                {leafHeader(i)}
              </section>
            ))
          )}
          <form
            ref={form}
            className={`creation-paper unfold-leaf unfold-leaf-${step}`}
            onSubmit={(e) => {
              e.preventDefault();
              continueStep();
            }}
          >
            {step !== 5 && leafHeader(step, true)}
            <div
              className="unfold-active-body"
              id="unfold-active-body"
              hidden={collapsed && step !== 5}
              role="region"
              aria-label={step === 5 ? "Trip overview" : undefined}
              aria-labelledby={
                step !== 5 ? `unfold-heading-${step}` : undefined
              }
            >
              <div className="creation-step-label">
                {step + 1} of {steps.length} · {steps[step]}
              </div>
              <h2 ref={title} tabIndex={-1}>
                {headings[step]}
              </h2>
              <p className="creation-intro">{introductions[step]}</p>
              {errors.length > 0 && (
                <div className="creation-alert" role="alert">
                  <strong>A little attention needed</strong>
                  <ul>
                    {errors.map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                  {step > 0 && basicsErrors().length > 0 && (
                    <button type="button" onClick={() => go(0)}>
                      Edit basics
                    </button>
                  )}
                </div>
              )}
              {step === 0 && (
                <>
                  <label>
                    Starting location
                    <input
                      required
                      autoComplete="address-level2"
                      placeholder="Town, airport or station"
                      value={trip.origin}
                      onChange={(e) => update({ origin: e.target.value })}
                      aria-describedby="origin-help"
                    />
                  </label>
                  <p id="origin-help" className="creation-note">
                    Include the region or country if there are namesakes.
                  </p>
                  <div className="trip-fields">
                    <label>
                      Travelers
                      <input
                        required
                        type="number"
                        min="1"
                        value={trip.travelers}
                        onChange={(e) =>
                          update({
                            travelers: Math.max(1, Number(e.target.value)),
                          })
                        }
                      />
                    </label>
                    <label>
                      Rooms
                      <input
                        required
                        type="number"
                        min="1"
                        value={trip.rooms}
                        onChange={(e) =>
                          update({ rooms: Math.max(1, Number(e.target.value)) })
                        }
                      />
                    </label>
                  </div>
                </>
              )}
              {step === 1 && (
                <>
                  <fieldset>
                    <legend>When would you like to go?</legend>
                    <div className="creation-choices">
                      {(["exact", "window", "duration"] as const).map(
                        (mode, i) => (
                          <label key={mode}>
                            <input
                              type="radio"
                              name="dates"
                              checked={trip.mode === mode}
                              onChange={() => update({ mode })}
                            />
                            {
                              [
                                "Exact dates",
                                "Flexible window",
                                "Not sure yet",
                              ][i]
                            }
                          </label>
                        ),
                      )}
                    </div>
                  </fieldset>
                  <div className="trip-fields">
                    {trip.mode !== "duration" && (
                      <>
                        <label>
                          {trip.mode === "exact"
                            ? "Departure date"
                            : "Earliest departure"}
                          <input
                            required
                            type="date"
                            value={trip.start}
                            onInput={(e) =>
                              update({ start: e.currentTarget.value })
                            }
                            onBlur={(e) => {
                              if (e.currentTarget.value !== trip.start)
                                update({ start: e.currentTarget.value });
                            }}
                            onChange={(e) => update({ start: e.target.value })}
                          />
                        </label>
                        <label>
                          {trip.mode === "exact"
                            ? "Return / finish date"
                            : "Latest finish"}
                          <input
                            required
                            type="date"
                            value={trip.end}
                            onInput={(e) =>
                              update({ end: e.currentTarget.value })
                            }
                            onBlur={(e) => {
                              if (e.currentTarget.value !== trip.end)
                                update({ end: e.currentTarget.value });
                            }}
                            min={trip.start}
                            onChange={(e) => update({ end: e.target.value })}
                          />
                        </label>
                      </>
                    )}
                    {trip.mode !== "exact" && (
                      <label>
                        Desired duration · days (optional)
                        <input
                          type="number"
                          min="1"
                          placeholder="Leave open"
                          value={trip.days || ""}
                          onChange={(e) =>
                            update({ days: Number(e.target.value) })
                          }
                        />
                      </label>
                    )}
                  </div>
                  <p className="creation-note">
                    You can adjust these dates later.
                  </p>
                  <details className="creation-disclosure">
                    <summary>A few optional preferences</summary>
                    <label>
                      Trip name
                      <input
                        value={trip.title}
                        placeholder="A little change of scenery"
                        onChange={(e) => update({ title: e.target.value })}
                      />
                    </label>
                    <div className="trip-fields">
                      <label>
                        Budget target · whole trip
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={trip.budget}
                          onChange={(e) => update({ budget: e.target.value })}
                        />
                      </label>
                      <label>
                        Display currency
                        <select
                          value={trip.currency}
                          onChange={(e) => {
                            if (
                              costs.known &&
                              !window.confirm(
                                "Change currency? Existing numeric allowances will be cleared; no currency conversion is connected.",
                              )
                            )
                              return;
                            update({
                              currency: e.target.value,
                              stayPreferences: Object.fromEntries(
                                Object.entries(trip.stayPreferences ?? {}).map(
                                  ([k, v]) => [k, { ...v, rate: "" }],
                                ),
                              ),
                              travelPreferences: Object.fromEntries(
                                Object.entries(
                                  trip.travelPreferences ?? {},
                                ).map(([k, v]) => [k, { ...v, rate: "" }]),
                              ),
                            });
                          }}
                        >
                          {["INR", "USD", "EUR", "GBP"].map((c) => (
                            <option key={c}>{c}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <label>
                      Pace
                      <select
                        value={trip.pace}
                        onChange={(e) => update({ pace: e.target.value })}
                      >
                        <option value="relaxed">Relaxed</option>
                        <option value="balanced">Balanced</option>
                        <option value="busy">Active</option>
                      </select>
                    </label>
                    <label>
                      Interests
                      <input
                        value={trip.interests}
                        onChange={(e) => update({ interests: e.target.value })}
                        placeholder="Food, forest paths, slow mornings…"
                      />
                    </label>
                  </details>
                </>
              )}
              {step === 2 && (
                <>
                  <div className="creation-add-place">
                    <h3>Add a place</h3>
                    <PlaceLookup value={place} error={!!placeError} onChange={value => { setPlace(value); setTimezone(""); setPlaceError(""); }} onSelect={choice => { setPlace(choice.label); setTimezone(choice.timezone); setPlaceError(""); timezoneInput.current?.focus(); }} />
                    <label>
                      Destination timezone
                      <input
                        ref={timezoneInput}
                        list="trip-timezones"
                        placeholder="e.g. Asia/Tokyo"
                        value={timezone}
                        onChange={(e) => setTimezone(e.target.value)}
                      />
                    </label>
                    <datalist id="trip-timezones">
                      {[
                        "Asia/Kolkata",
                        "Asia/Tokyo",
                        "Asia/Bangkok",
                        "Europe/London",
                        "Europe/Paris",
                        "America/New_York",
                        "America/Los_Angeles",
                        "Australia/Sydney",
                        "Pacific/Auckland",
                        "UTC",
                      ].map((z) => (
                        <option key={z} value={z} />
                      ))}
                    </datalist>
                    {placeError && (
                      <p id="place-error" role="alert">
                        {placeError}
                      </p>
                    )}
                    <button
                      type="button"
                      className="trip-primary"
                      onClick={addPlace}
                    >
                      Add to route
                    </button>
                    <p id="place-help" className="creation-note">
                      Search for a city and choose a match to fill its timezone, or enter both fields manually. Review the place before adding it. Repeated visits are welcome.
                    </p>
                  </div>
                  <div className="creation-section-heading">
                    <h3>Your route</h3>
                    <span>In travel order</span>
                  </div>
                  {!trip.stops.length && (
                    <div className="creation-empty">
                      <span aria-hidden="true">⌁</span>
                      <h3>Every journey starts with one place.</h3>
                      <p>
                        Add your first destination above. Your personal route
                        starts empty.
                      </p>
                    </div>
                  )}
                  {trip.stops.map((s, i) => (
                    <article key={s.id} className="creation-stop">
                      <span className="route-dot">{i + 1}</span>
                      <div>
                        <h3>{s.name}</h3>
                        <small>{s.timezone} · local time</small>
                      </div>
                      <div className="creation-stop-actions">
                        <button
                          type="button"
                          disabled={i === 0}
                          aria-label={`Move ${s.name} up`}
                          onClick={() => reorder(i, -1)}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          disabled={i === trip.stops.length - 1}
                          aria-label={`Move ${s.name} down`}
                          onClick={() => reorder(i, 1)}
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          aria-label={`Remove ${s.name}`}
                          onClick={() => remove(s.id)}
                        >
                          Remove
                        </button>
                      </div>
                    </article>
                  ))}
                  <label className="trip-check">
                    <input
                      type="checkbox"
                      checked={trip.returnToOrigin !== false}
                      onChange={(e) =>
                        update({ returnToOrigin: e.target.checked })
                      }
                    />
                    Return to my starting location
                  </label>
                  {trip.returnToOrigin === false && (
                    <label>
                      Finish location
                      <input
                        required
                        value={trip.finish || ""}
                        onChange={(e) => update({ finish: e.target.value })}
                        placeholder="Town, airport or station"
                      />
                    </label>
                  )}
                  <p className="creation-note">
                    Order changes keep each visit’s nights and activities. New
                    connections need their own travel details; old leg
                    allowances are excluded from the subtotal.
                  </p>
                </>
              )}
              {step === 3 && (
                <>
                  <section
                    className="time-budget"
                    aria-label="Trip time allocation"
                  >
                    <div>
                      <strong>
                        {time.days === null
                          ? `${time.stays} nights planned`
                          : `${time.days} days, ${time.available} nights`}
                      </strong>
                      <span>
                        {time.remaining === null
                          ? "Keep your dates open"
                          : time.remaining < 0
                            ? `${-time.remaining} ${-time.remaining === 1 ? "night" : "nights"} over`
                            : time.remaining === 0
                              ? "All nights accounted for"
                              : `${time.remaining} nights still open`}
                      </span>
                    </div>
                    <div
                      className="time-ribbon"
                      role="img"
                      aria-label={
                        trip.stops
                          .map((s) => `${s.name}: ${s.nights} nights`)
                          .join(", ") +
                        (time.travelNights
                          ? `, travel: ${time.travelNights} ${time.travelNights === 1 ? "night" : "nights"}`
                          : "")
                      }
                    >
                      {trip.stops.map((s, i) =>
                        s.nights > 0 ? (
                          <span
                            key={s.id}
                            className={`ribbon-stop ribbon-stop-${i % 4}`}
                            style={{ flex: s.nights }}
                            title={`${s.name}: ${s.nights} nights`}
                          >
                            {s.nights}
                          </span>
                        ) : null,
                      )}
                      {time.travelNights > 0 && (
                        <span
                          className="ribbon-travel"
                          style={{ flex: time.travelNights }}
                          title="Nights on the move"
                        >
                          {time.travelNights}
                        </span>
                      )}
                      {(time.remaining ?? 0) > 0 && (
                        <span
                          className="ribbon-open"
                          style={{ flex: time.remaining! }}
                          title="Nights left open"
                        >
                          {time.remaining}
                        </span>
                      )}
                    </div>
                    <p>
                      A night means sleeping in that place. Arrive Monday, leave
                      Wednesday: <strong>2 nights.</strong>
                    </p>
                  </section>
                  {!trip.stops.length ? (
                    <div className="creation-info">
                      <p>Add a destination to start dividing your time.</p>
                      <button type="button" onClick={() => go(2)}>
                        Add a place
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="time-stop-list">
                        {trip.stops.map((s, i) => (
                          <section className="time-stop" key={s.id}>
                            <div>
                              <span
                                className={`time-stop-dot ribbon-stop-${i % 4}`}
                                aria-hidden="true"
                              />
                              <div>
                                <h3>{s.name}</h3>
                                <p>
                                  {s.nights === 0
                                    ? "Day visit · no overnight stay"
                                    : `${s.nights} ${s.nights === 1 ? "night" : "nights"} of accommodation`}
                                </p>
                              </div>
                            </div>
                            <div className="night-stepper">
                              <button
                                type="button"
                                aria-label={`One fewer night in ${s.name}, stop ${i + 1}`}
                                disabled={s.nights === 0}
                                onClick={() =>
                                  update({
                                    stops: trip.stops.map((x) =>
                                      x.id === s.id
                                        ? {
                                            ...x,
                                            nights: Math.max(0, s.nights - 1),
                                          }
                                        : x,
                                    ),
                                  })
                                }
                              >
                                −
                              </button>
                              <label>
                                <span className="sr-only">
                                  Nights in {s.name}, stop {i + 1}
                                </span>
                                <input
                                  aria-label={`Nights in ${s.name}, stop ${i + 1}`}
                                  type="number"
                                  min="0"
                                  required
                                  value={s.nights}
                                  onChange={(e) =>
                                    update({
                                      stops: trip.stops.map((x) =>
                                        x.id === s.id
                                          ? {
                                              ...x,
                                              nights: Number(e.target.value),
                                            }
                                          : x,
                                      ),
                                    })
                                  }
                                />
                                <span>nights</span>
                              </label>
                              <button
                                type="button"
                                aria-label={`One more night in ${s.name}, stop ${i + 1}`}
                                onClick={() =>
                                  update({
                                    stops: trip.stops.map((x) =>
                                      x.id === s.id
                                        ? { ...x, nights: s.nights + 1 }
                                        : x,
                                    ),
                                  })
                                }
                              >
                                ＋
                              </button>
                            </div>
                          </section>
                        ))}
                      </div>
                      <div className="time-split-action">
                        <button
                          type="button"
                          onClick={() =>
                            update({ stops: suggestedSplit(trip) })
                          }
                        >
                          Split nights evenly
                        </button>
                        <span>A starting point you can change.</span>
                      </div>
                    </>
                  )}
                  {time.travelNights > 0 && (
                    <p className="creation-note">
                      {time.travelNights}{" "}
                      {time.travelNights === 1 ? "night is" : "nights are"} on
                      the move, rather than in accommodation. Change this in
                      Stay & travel.
                    </p>
                  )}
                  {problems.length > 0 && (
                    <div className="creation-alert">
                      <strong>Your nights don’t fit yet.</strong>
                      {problems.map((p) => (
                        <p key={p}>{p}</p>
                      ))}
                      <button type="button" onClick={() => go(1)}>
                        Adjust dates or duration
                      </button>
                    </div>
                  )}
                </>
              )}
              {step === 4 && (
                <>
                  <div className="preference-intro">
                    <span aria-hidden="true">⌂</span>
                    <div>
                      <h3>Where you’ll sleep</h3>
                      <p>Your style, not a booking.</p>
                    </div>
                  </div>
                  {trip.stops.map((s, i) => (
                    <section className="simple-preference" key={s.id}>
                      <div className="simple-preference-title">
                        <h3>{s.name}</h3>
                        <span>
                          {s.nights === 0 ? "Day visit" : `${s.nights} nights`}
                        </span>
                      </div>
                      {s.nights === 0 ? (
                        <p className="creation-note">
                          No overnight stay needed.
                        </p>
                      ) : (
                        <>
                          <fieldset className="stay-choices">
                            <legend className="sr-only">
                              Stay style for {s.name}, stop {i + 1}
                            </legend>
                            {["Guesthouse", "Hotel", "Apartment", "Hostel"].map(
                              (style) => (
                                <label key={style}>
                                  <input
                                    type="radio"
                                    name={`stay-${s.id}`}
                                    checked={
                                      trip.stayPreferences?.[s.id]?.style ===
                                      style
                                    }
                                    onChange={() => stay(s.id, { style })}
                                  />
                                  <span>{style}</span>
                                </label>
                              ),
                            )}
                            <label>
                              <input
                                type="radio"
                                name={`stay-${s.id}`}
                                checked={!trip.stayPreferences?.[s.id]?.style}
                                onChange={() => stay(s.id, { style: "" })}
                              />
                              <span>Decide later</span>
                            </label>
                            {trip.stayPreferences?.[s.id]?.style &&
                              ![
                                "Guesthouse",
                                "Hotel",
                                "Apartment",
                                "Hostel",
                              ].includes(trip.stayPreferences[s.id].style) && (
                                <label>
                                  <input
                                    type="radio"
                                    name={`stay-${s.id}`}
                                    checked
                                    readOnly
                                  />
                                  <span>
                                    {trip.stayPreferences[s.id].style}
                                  </span>
                                </label>
                              )}
                          </fieldset>
                          <details className="preference-details">
                            <summary>
                              {trip.stayPreferences?.[s.id]?.rate
                                ? `${money(Number(trip.stayPreferences[s.id].rate))} per ${trip.stayPreferences[s.id].basis === "bed" ? "bed" : "room"} / night`
                                : "Add a nightly budget"}
                            </summary>
                            <div className="trip-fields">
                              <label>
                                Nightly budget · {trip.currency}
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  placeholder="Leave open"
                                  value={
                                    trip.stayPreferences?.[s.id]?.rate ?? ""
                                  }
                                  onChange={(e) =>
                                    stay(s.id, { rate: e.target.value })
                                  }
                                />
                              </label>
                              <label>
                                For each
                                <select
                                  value={
                                    trip.stayPreferences?.[s.id]?.basis ||
                                    "room"
                                  }
                                  onChange={(e) =>
                                    stay(s.id, {
                                      basis: e.target.value as "room" | "bed",
                                    })
                                  }
                                >
                                  <option value="room">Room</option>
                                  <option value="bed">Bed</option>
                                </select>
                              </label>
                            </div>
                            <p className="creation-note">
                              {s.nights} nights ×{" "}
                              {trip.stayPreferences?.[s.id]?.basis === "bed"
                                ? `${trip.travelers} beds`
                                : `${trip.rooms} rooms`}
                              . Your estimate; taxes and fees are extra.
                            </p>
                          </details>
                        </>
                      )}
                    </section>
                  ))}
                  <div className="preference-intro">
                    <span aria-hidden="true">↗</span>
                    <div>
                      <h3>How you’ll get there</h3>
                      <p>Between places, in your route order.</p>
                    </div>
                  </div>
                  {routeLegs(trip).map((l, i) => (
                    <section className="simple-preference" key={l.key}>
                      <h3>
                        {l.from}
                        <span className="leg-arrow" aria-label="to">
                          {" "}
                          →{" "}
                        </span>
                        {l.to}
                      </h3>
                      <label className="journey-mode">
                        <span className="sr-only">
                          Transport from {l.from} to {l.to}
                        </span>
                        <select
                          aria-label={`Transport from ${l.from} to ${l.to}`}
                          value={trip.travelPreferences?.[l.key]?.mode || ""}
                          onChange={(e) =>
                            travel(l.key, { mode: e.target.value })
                          }
                        >
                          <option value="">Choose transport later</option>
                          {[
                            "Rail",
                            "Bus",
                            "Flight",
                            "Private transfer",
                            "Own vehicle",
                            "Other",
                          ].map((m) => (
                            <option key={m}>{m}</option>
                          ))}
                        </select>
                      </label>
                      <details className="preference-details">
                        <summary>
                          Travel time & overnight journeys
                          {(trip.travelPreferences?.[l.key]?.overnight ?? 0) > 0
                            ? ` · ${trip.travelPreferences![l.key].overnight} ${trip.travelPreferences![l.key].overnight === 1 ? "night" : "nights"}`
                            : ""}
                        </summary>
                        <p className="creation-note">
                          Only count nights spent on a train, bus or flight.
                          These replace accommodation nights.
                        </p>
                        <div className="trip-fields">
                          <label>
                            Approximate hours
                            <input
                              type="number"
                              min="0"
                              step="0.25"
                              value={
                                trip.travelPreferences?.[l.key]?.hours ?? ""
                              }
                              placeholder="Not sure yet"
                              onChange={(e) =>
                                travel(l.key, { hours: e.target.value })
                              }
                            />
                          </label>
                          <label>
                            Nights on the move
                            <input
                              type="number"
                              min="0"
                              value={
                                trip.travelPreferences?.[l.key]?.overnight ?? 0
                              }
                              onChange={(e) =>
                                travel(l.key, {
                                  overnight: Number(e.target.value),
                                })
                              }
                            />
                          </label>
                        </div>
                        <p className="creation-note">
                          Your estimate. Actual schedules still need checking.
                        </p>
                      </details>
                      <details className="preference-details">
                        <summary>
                          {trip.travelPreferences?.[l.key]?.rate
                            ? `${money(Number(trip.travelPreferences[l.key].rate))} per ${trip.travelPreferences[l.key].basis === "vehicle" ? "vehicle" : "person"}`
                            : "Add a journey budget"}
                        </summary>
                        <div className="trip-fields">
                          <label>
                            Journey budget · {trip.currency}
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="Leave open"
                              value={
                                trip.travelPreferences?.[l.key]?.rate ?? ""
                              }
                              onChange={(e) =>
                                travel(l.key, { rate: e.target.value })
                              }
                            />
                          </label>
                          <label>
                            For each
                            <select
                              value={
                                trip.travelPreferences?.[l.key]?.basis ||
                                "person"
                              }
                              onChange={(e) =>
                                travel(l.key, {
                                  basis: e.target.value as "person" | "vehicle",
                                })
                              }
                            >
                              <option value="person">Person</option>
                              <option value="vehicle">Vehicle</option>
                            </select>
                          </label>
                        </div>
                      </details>
                    </section>
                  ))}
                  {problems.length > 0 && (
                    <div className="creation-alert">
                      {problems.map((p) => (
                        <p key={p}>{p}</p>
                      ))}
                      <button type="button" onClick={() => go(3)}>
                        Adjust nights in each place
                      </button>
                    </div>
                  )}
                  <p className="preference-honesty">
                    Preferences and your own estimates only. Nothing is
                    reserved.
                  </p>
                  {costs.known > 0 && (
                    <details className="preference-details">
                      <summary>Your estimated costs</summary>
                      <CostBreakdown trip={trip} />
                    </details>
                  )}
                </>
              )}
              {step === 5 && (
                <>
                  <label>
                    Give your trip a name · optional
                    <input
                      value={trip.title}
                      onChange={(e) => update({ title: e.target.value })}
                      placeholder="Your next elsewhere"
                    />
                  </label>
                  <div className="creation-review-header">
                    <h3>Your route outline</h3>
                    <button type="button" onClick={() => go(2)}>
                      Edit route
                    </button>
                  </div>
                  <ol className="creation-review-route">
                    {trip.stops.map((s, i) => (
                      <li key={s.id}>
                        <span className="route-dot">{i + 1}</span>
                        <div>
                          <h3>{s.name}</h3>
                          <p>{s.nights} nights</p>
                          <small>
                            {trip.stayPreferences?.[s.id]?.style ||
                              "Stay preference open"}
                          </small>
                        </div>
                      </li>
                    ))}
                  </ol>
                  <div className="creation-review-header">
                    <h3>Time & connections</h3>
                    <button type="button" onClick={() => go(3)}>
                      Edit time
                    </button>
                  </div>
                  <p>
                    {time.stays} nights in accommodation
                    {time.travelNights > 0
                      ? ` + ${time.travelNights} on the move`
                      : ""}
                    .{" "}
                    {time.days === null
                      ? "Total duration still open."
                      : `${time.days} total trip days; ${Math.max(0, time.remaining ?? 0)} nights still open.`}
                  </p>
                  <ul className="creation-review-legs">
                    {routeLegs(trip).map((l) => (
                      <li key={l.key}>
                        <strong>
                          {l.from} → {l.to}
                        </strong>
                        <span>
                          {trip.travelPreferences?.[l.key]?.mode ||
                            "Transport to decide"}
                          {trip.travelPreferences?.[l.key]?.hours
                            ? ` · ${trip.travelPreferences[l.key].hours} hours`
                            : ""}
                          {(trip.travelPreferences?.[l.key]?.overnight ?? 0) > 0
                            ? ` · ${trip.travelPreferences![l.key].overnight} nights on the move`
                            : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="creation-review-header">
                    <h3>Your budget</h3>
                    <button type="button" onClick={() => go(4)}>
                      Edit stay & travel
                    </button>
                  </div>
                  <CostBreakdown trip={trip} />
                  <div className="creation-info">
                    <h3>Room for what comes next</h3>
                    <p>
                      Activities are still open. Stays and transport are
                      preferences, not bookings.
                    </p>
                    <p>
                      {accountSavingAvailable
                        ? "Your changes are saved automatically. Nothing has been reserved."
                        : "This sample stays in this browser."}
                    </p>
                  </div>
                </>
              )}
              <footer className="creation-actions">
                {step > 0 ? (
                  <button type="button" onClick={() => go(step - 1)}>
                    Back
                  </button>
                ) : (
                  <a href="/">Back to the view</a>
                )}
                {furthest === 5 && step < 4 && (
                  <button
                    type="button"
                    className="unfold-return-review"
                    onClick={() => continueStep(5)}
                  >
                    Return to review
                  </button>
                )}
                <button className="trip-primary" type="submit">
                  {
                    [
                      "Continue to dates",
                      "Continue to places",
                      "Plan the time",
                      "Continue to stay & travel",
                      "Review my trip",
                      "Open itinerary workspace",
                    ][step]
                  }{" "}
                  <span aria-hidden="true">↗</span>
                </button>
              </footer>
              {!accountSavingAvailable && (
                <p className="creation-save-note">
                  Sample edits stay here. Use Save sample to keep them.
                </p>
              )}
            </div>
          </form>
          {step !== 5 &&
            steps.slice(step + 1).map((_, offset) => {
              const i = step + 1 + offset;
              return (
                <section className={`unfold-leaf unfold-leaf-${i}`} key={i}>
                  {leafHeader(i)}
                </section>
              );
            })}
        </div>
        <aside className="creation-summary" aria-label="Your trip summary">
          {summary}
        </aside>
      </div>
    </div>
  );
}
function CostBreakdown({ trip }: { trip: Trip }) {
  const c = planningCosts(trip);
  const money = (n: number) =>
    `${trip.currency} ${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  return (
    <details className="creation-disclosure creation-costs">
      <summary>Your cost breakdown</summary>
      <dl>
        {[...c.stays, ...c.travel].map((r, i) => (
          <div key={i}>
            <dt>
              {r.label}
              <small>
                {r.quantity} {r.basis}
                {r.rate !== ""
                  ? ` × ${money(Number(r.rate))}`
                  : " · allowance not entered"}
              </small>
            </dt>
            <dd>{r.amount === null ? "Unknown" : money(r.amount)}</dd>
          </div>
        ))}
        <div className="creation-cost-total">
          <dt>
            Stay & travel subtotal
            <small>
              {c.unknown} allowances unknown · excludes unpriced expenses
            </small>
          </dt>
          <dd>{c.known ? money(c.total) : "Unknown"}</dd>
        </div>
      </dl>
      {!!c.known && (
        <p>
          {money(c.total / trip.travelers)} per traveler, before unpriced
          expenses.
        </p>
      )}
      {trip.budget !== "" && c.total > Number(trip.budget) && (
        <p className="creation-alert">
          Entered allowances already exceed your {money(Number(trip.budget))}{" "}
          target.
        </p>
      )}
      <p className="creation-note">
        Your estimates, not live prices. Meals, activities, taxes and local
        travel are extra.
      </p>
    </details>
  );
}
