"use client";
import { useRef, useState } from "react";
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
  "Room for each place",
  "Stay & travel",
  "All together",
];
const headings = [
  "Where does your escape begin?",
  "When feels right?",
  "The places that pull you.",
  "Give each place a little time.",
  "A way there. A place to land.",
  "Your escape, all together.",
];
const introductions = [
  "Start with what you know. There’s room to change your mind.",
  "Choose your dates, a window, or leave the calendar open.",
  "Add your destinations in travel order. One place or many, anywhere.",
  "Stay a little longer, or just pass through. The route is yours to shape.",
  "Keep preferences and allowances together. You can leave details open.",
  "A route to build around, with space for the days still to come.",
];

export default function TripCreation({
  trip,
  update,
  reorder,
  remove,
  onOpen,
}: {
  trip: Trip;
  update: (patch: Partial<Trip>) => void;
  reorder: (index: number, delta: number) => void;
  remove: (id: string) => void;
  onOpen: () => void;
}) {
  const [step, setStep] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const [furthest, setFurthest] = useState(() =>
    trip.origin.trim() && trip.stops.length ? 5 : trip.origin.trim() ? 1 : 0,
  );
  const [errors, setErrors] = useState<string[]>([]);
  const [proposal, setProposal] = useState<Stop[] | null>(null);
  const [place, setPlace] = useState("");
  const [timezone, setTimezone] = useState("");
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
    setCollapsed(false);
    setErrors([]);
    setProposal(null);
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
                {s.nights
                  ? `${s.nights} stay nights`
                  : "Day visit · no stay night"}
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
          <span>stay nights</span>
        </div>
        <div>
          <strong>{time.travelNights}</strong>
          <span>travel nights</span>
        </div>
        <div>
          <strong>{time.days ?? "—"}</strong>
          <span>total trip days</span>
        </div>
      </div>
      <p className="creation-note">
        {time.remaining === null
          ? "Total duration is open. Allocated nights are a partial outline."
          : time.remaining < 0
            ? `${-time.remaining} nights over your available time.`
            : `${time.remaining} ${time.remaining === 1 ? "night" : "nights"} unallocated. Leave time open or plan it later.`}
      </p>
      <div className="creation-summary-cost">
        <span>User-entered stay & travel subtotal</span>
        <strong>{costs.known ? money(costs.total) : "Not priced yet"}</strong>
        {!!costs.known && (
          <span>{money(costs.total / trip.travelers)} per traveler</span>
        )}
        <small>
          {costs.unknown} stay/leg allowances not entered. Meals, activities,
          taxes and local travel are extra and unknown.
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
      ? `${time.stays} stay nights + ${time.travelNights} travel nights${time.days ? ` / ${time.days} days` : " / duration open"}`
      : "Give the route a little time",
    costs.known
      ? `${money(costs.total)} entered / other costs still open`
      : "Preferences first. Details can come later.",
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
            {trip.stops.length} stops · {time.stays} stay nights
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
                    Manual entry for now. Include the region or country to
                    distinguish namesakes.
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
                    Departure and finish are inclusive travel days. A 7-day trip
                    has 6 nights; overnight travel uses a night, too. Same-day
                    travel fits within a day.
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
                    <label>
                      Destination
                      <input
                        value={place}
                        aria-invalid={!!placeError}
                        aria-describedby={
                          placeError ? "place-error" : "place-help"
                        }
                        placeholder="e.g. Kyoto, Japan"
                        onChange={(e) => setPlace(e.target.value)}
                      />
                    </label>
                    <label>
                      Destination timezone
                      <input
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
                      Destination search is not connected. These are
                      user-entered places, not verified search results. Repeated
                      visits are welcome.
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
                        <small>{s.timezone} · user-entered</small>
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
                  <div className="creation-time-strip">
                    <strong>
                      {time.days === null
                        ? "Duration open"
                        : `${time.days} days / ${time.available} nights`}
                    </strong>
                    <span>
                      {time.stays} stay nights + {time.travelNights} overnight
                      travel nights
                    </span>
                  </div>
                  {trip.stops.map((s, i) => (
                    <div key={s.id} className="creation-time-stop">
                      <span className="route-dot">{i + 1}</span>
                      <div>
                        <h3>{s.name}</h3>
                        <small>
                          {s.nights
                            ? `${s.nights} nights at this destination`
                            : "Day visit · no accommodation night"}
                        </small>
                      </div>
                      <label>
                        Stay nights
                        <input
                          aria-label={`Stay nights for stop ${i + 1}: ${s.name}`}
                          type="number"
                          min="0"
                          required
                          value={s.nights}
                          onChange={(e) => {
                            setProposal(null);
                            update({
                              stops: trip.stops.map((x) =>
                                x.id === s.id
                                  ? { ...x, nights: Number(e.target.value) }
                                  : x,
                              ),
                            });
                          }}
                        />
                      </label>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setProposal(suggestedSplit(trip))}
                  >
                    Suggest a split
                  </button>
                  <p className="creation-note">
                    An illustrative equal split of available nights; for open
                    duration, {trip.pace === "relaxed" ? 3 : 2} nights per stop.
                    Not a researched recommendation. Your allocation changes
                    only if you accept.
                  </p>
                  {proposal && (
                    <section className="creation-proposal">
                      <h3>A split to consider</h3>
                      <p>
                        {proposal
                          .map((s) => `${s.name}: ${s.nights} nights`)
                          .join(" · ")}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          update({ stops: proposal });
                          setProposal(null);
                          setErrors([]);
                        }}
                      >
                        Use this split
                      </button>
                      <button type="button" onClick={() => setProposal(null)}>
                        Keep my allocation
                      </button>
                    </section>
                  )}
                  <details className="creation-disclosure" open>
                    <summary>Make room for travel</summary>
                    <p>
                      Enter your own provisional travel time. Hours do not
                      automatically add whole days. Count a night here only when
                      it is spent traveling instead of staying.
                    </p>
                    {routeLegs(trip).map((l) => (
                      <div key={l.key} className="creation-leg">
                        <h3>
                          {l.from} → {l.to}
                        </h3>
                        <div className="trip-fields">
                          <label>
                            Journey hours · optional
                            <input
                              type="number"
                              min="0"
                              step="0.25"
                              value={
                                trip.travelPreferences?.[l.key]?.hours ?? ""
                              }
                              onChange={(e) =>
                                travel(l.key, { hours: e.target.value })
                              }
                            />
                          </label>
                          <label>
                            Nights spent traveling
                            <input
                              type="number"
                              min="0"
                              value={
                                trip.travelPreferences?.[l.key]?.overnight ?? 0
                              }
                              onChange={(e) => {
                                setProposal(null);
                                travel(l.key, {
                                  overnight: Number(e.target.value),
                                });
                              }}
                            />
                          </label>
                        </div>
                      </div>
                    ))}
                    <p className="creation-note">
                      User-entered assumptions only. Departure/arrival
                      schedules, timezone changes and boarding buffers are not
                      validated here. Travel dates remain provisional.
                    </p>
                  </details>
                  {problems.length > 0 && (
                    <div className="creation-alert">
                      <h3>The route needs more room.</h3>
                      {problems.map((p) => (
                        <p key={p}>{p}</p>
                      ))}
                      <button type="button" onClick={() => go(1)}>
                        Change dates or duration
                      </button>
                      <p className="creation-note">
                        You can use Save draft above to keep this unresolved
                        draft.
                      </p>
                    </div>
                  )}
                  <p className="creation-note">
                    {time.allHours
                      ? `${time.hours} journey hours entered. `
                      : "Some journey times remain unknown. "}
                    Stay nights + travel nights do not prove that the
                    connections fit. Remaining nights stay unallocated.
                  </p>
                </>
              )}
              {step === 4 && (
                <>
                  <div className="creation-info">
                    Preferences, not reservations. No live inventory or prices
                    are connected. Leave an allowance blank when you don’t know
                    it.
                  </div>
                  <h3>Places to stay</h3>
                  {trip.stops.map((s) => (
                    <section
                      className="creation-preference"
                      key={s.id}
                      aria-label={`Stay at ${s.name}, visit ${trip.stops.indexOf(s) + 1}`}
                    >
                      <h3>
                        {s.name} <small>{s.nights} stay nights</small>
                      </h3>
                      {s.nights === 0 ? (
                        <p>Day visit. No stay allowance needed.</p>
                      ) : (
                        <>
                          <div className="trip-fields">
                            <label>
                              Stay preference
                              <select
                                value={
                                  trip.stayPreferences?.[s.id]?.style || ""
                                }
                                onChange={(e) =>
                                  stay(s.id, { style: e.target.value })
                                }
                              >
                                <option value="">Decide later</option>
                                <option>Hostel</option>
                                <option>Guesthouse</option>
                                <option>Hotel</option>
                                <option>Apartment</option>
                                <option>Other / own arrangement</option>
                              </select>
                            </label>
                            <label>
                              Allowance basis
                              <select
                                value={
                                  trip.stayPreferences?.[s.id]?.basis || "room"
                                }
                                onChange={(e) =>
                                  stay(s.id, {
                                    basis: e.target.value as "room" | "bed",
                                  })
                                }
                              >
                                <option value="room">Per room per night</option>
                                <option value="bed">Per bed per night</option>
                              </select>
                            </label>
                          </div>
                          <label>
                            Your nightly allowance · {trip.currency}
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="Unknown"
                              value={trip.stayPreferences?.[s.id]?.rate ?? ""}
                              onChange={(e) =>
                                stay(s.id, { rate: e.target.value })
                              }
                            />
                          </label>
                          <p className="creation-note">
                            {s.nights} nights ×{" "}
                            {trip.stayPreferences?.[s.id]?.basis === "bed"
                              ? `${trip.travelers} beds`
                              : `${trip.rooms} rooms`}
                            . Occupancy, availability, taxes and fees need
                            checking.
                          </p>
                        </>
                      )}
                    </section>
                  ))}
                  <h3>Journeys between places</h3>
                  {routeLegs(trip).map((l) => (
                    <section
                      key={l.key}
                      className="creation-preference"
                      aria-label={`Travel from ${l.from} to ${l.to}`}
                    >
                      <h3>
                        {l.from} → {l.to}
                      </h3>
                      <div className="trip-fields">
                        <label>
                          Transport preference
                          <select
                            value={trip.travelPreferences?.[l.key]?.mode || ""}
                            onChange={(e) =>
                              travel(l.key, { mode: e.target.value })
                            }
                          >
                            <option value="">Decide later</option>
                            {[
                              "Bus",
                              "Rail",
                              "Flight",
                              "Private transfer",
                              "Own vehicle",
                              "Other",
                            ].map((m) => (
                              <option key={m}>{m}</option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Allowance basis
                          <select
                            value={
                              trip.travelPreferences?.[l.key]?.basis || "person"
                            }
                            onChange={(e) =>
                              travel(l.key, {
                                basis: e.target.value as "person" | "vehicle",
                              })
                            }
                          >
                            <option value="person">
                              Per person for this leg
                            </option>
                            <option value="vehicle">
                              Per vehicle for this leg
                            </option>
                          </select>
                        </label>
                      </div>
                      <label>
                        Your allowance for this leg · {trip.currency}
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="Unknown"
                          value={trip.travelPreferences?.[l.key]?.rate ?? ""}
                          onChange={(e) =>
                            travel(l.key, { rate: e.target.value })
                          }
                        />
                      </label>
                      <p className="creation-note">
                        {trip.travelPreferences?.[l.key]?.basis === "vehicle"
                          ? "One vehicle assumed; capacity not checked."
                          : `${trip.travelers} travelers.`}{" "}
                        A preference does not confirm a service exists.
                      </p>
                    </section>
                  ))}
                  <CostBreakdown trip={trip} />
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
                          <p>
                            {s.nights} stay nights · {s.timezone}
                          </p>
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
                    {time.stays} stay nights + {time.travelNights} travel
                    nights.{" "}
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
                          {trip.travelPreferences?.[l.key]?.mode || "Mode open"}{" "}
                          ·{" "}
                          {trip.travelPreferences?.[l.key]?.hours
                            ? `${trip.travelPreferences[l.key].hours} hours`
                            : "Time unknown"}{" "}
                          · {trip.travelPreferences?.[l.key]?.overnight || 0}{" "}
                          travel nights
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="creation-review-header">
                    <h3>Your allowances</h3>
                    <button type="button" onClick={() => go(4)}>
                      Edit stay & travel
                    </button>
                  </div>
                  <CostBreakdown trip={trip} />
                  <div className="creation-info">
                    <h3>Draft outline · checks incomplete</h3>
                    <p>
                      Days remain open for activities in the workspace. Travel
                      schedules, accommodation availability, opening hours and
                      weather are unconnected. No itinerary has been generated
                      or accepted, and nothing is booked.
                    </p>
                    <p>
                      Use Save draft to keep a copy in this browser. Account
                      saving is not available yet.
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
              <p className="creation-save-note">
                Draft stays on this screen as you move between steps. Save
                explicitly to keep it after leaving; browser storage can be
                cleared and does not sync across devices.
              </p>
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
    <details className="creation-disclosure creation-costs" open>
      <summary>Cost breakdown · user-entered allowances</summary>
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
        Meals, activities, taxes/fees and local travel are unpriced. These are
        planning allowances, not live quotes, paid amounts or a complete trip
        total. No currency conversion or reservation is made.
      </p>
    </details>
  );
}
