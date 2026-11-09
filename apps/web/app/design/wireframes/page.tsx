"use client";
import { useRef, useState } from "react";
import "./wireframes.css";

type Stop = { id: string; name: string; nights: number };
type Draft = {
  origin: string;
  end: string;
  returnHome: boolean;
  people: number;
  rooms: number;
  mode: "exact" | "flexible" | "unknown";
  start: string;
  finish: string;
  duration: number;
  budget: number;
  stops: Stop[];
  stay: "hostel" | "simple" | "comfort";
  travel: "shared" | "private";
  pace: string;
  openDays: boolean;
  accepted: boolean;
  name: string;
};
const sample: Draft = {
  origin: "Delhi",
  end: "Delhi",
  returnHome: true,
  people: 2,
  rooms: 1,
  mode: "exact",
  start: "2026-12-08",
  finish: "2026-12-14",
  duration: 6,
  budget: 20000,
  stops: [
    { id: "jibhi", name: "Jibhi", nights: 3 },
    { id: "sainj", name: "Sainj", nights: 2 },
  ],
  stay: "simple",
  travel: "shared",
  pace: "Relaxed",
  openDays: false,
  accepted: false,
  name: "A little mountain escape",
};
const stages = [
  "Landing",
  "Basics",
  "Places",
  "Time",
  "Stay & travel",
  "Days",
  "Review",
  "Account save",
  "Trip workspace",
  "Revision preview",
];
const descriptions = [
  "Understand Elsewhere and choose an entry path.",
  "Origin, travelers and date flexibility.",
  "Collect and order the destinations.",
  "Allocate stays and include travel time.",
  "Compare room/bed and transport allowances.",
  "Choose suggested activities or open days.",
  "Inspect the same trip as a complete overview.",
  "Preserve the draft across authentication.",
  "Use and edit the trip after setup.",
  "Review a proposed change before applying it.",
];
const money = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const night = (n: number) => `${n} ${n === 1 ? "night" : "nights"}`;
function dayDiff(a: string, b: string) {
  return a && b ? Math.round((Date.parse(b) - Date.parse(a)) / 86400000) : 0;
}
function pretty(value: string) {
  return value
    ? new Date(value + "T12:00:00Z").toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        timeZone: "UTC",
      })
    : "Choose date";
}
function addDate(value: string, n: number) {
  return new Date(Date.parse(value) + n * 86400000).toISOString().slice(0, 10);
}
function ScenicBlock({
  label,
  small = false,
}: {
  label: string;
  small?: boolean;
}) {
  return (
    <div className={`wf-art ${small ? "wf-art-small" : ""}`}>
      <svg viewBox="0 0 600 170" aria-hidden="true">
        <path d="M0 145L100 60L160 115L260 25L390 135L470 75L600 145" />
        <path d="M0 160Q150 125 310 157T600 145" />
      </svg>
      <span>{label}</span>
    </div>
  );
}
function Calendar({
  start,
  finish,
  onPick,
}: {
  start: string;
  finish: string;
  onPick: (date: string) => void;
}) {
  const [month, setMonth] = useState("2026-12");
  const date = new Date(month + "-01T12:00:00Z"),
    year = date.getUTCFullYear(),
    m = date.getUTCMonth(),
    count = new Date(Date.UTC(year, m + 1, 0)).getUTCDate(),
    offset = (date.getUTCDay() + 6) % 7;
  function shift(n: number) {
    setMonth(new Date(Date.UTC(year, m + n, 1)).toISOString().slice(0, 7));
  }
  return (
    <div className="wf-calendar">
      <div>
        <button aria-label="Previous month" onClick={() => shift(-1)}>
          ←
        </button>
        <strong>
          {date.toLocaleDateString("en-GB", {
            month: "long",
            year: "numeric",
            timeZone: "UTC",
          })}
        </strong>
        <button aria-label="Next month" onClick={() => shift(1)}>
          →
        </button>
      </div>
      <div className="wf-calendar-grid">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <small key={i}>{d}</small>
        ))}
        {Array.from({ length: offset }, (_, i) => (
          <span key={`blank-${i}`} />
        ))}
        {Array.from({ length: count }, (_, i) => {
          const v = `${month}-${String(i + 1).padStart(2, "0")}`;
          return (
            <button
              key={v}
              className={
                v === start || v === finish
                  ? "wf-date-edge"
                  : v > start && v < finish
                    ? "wf-date-range"
                    : ""
              }
              aria-label={`Select ${v}`}
              aria-pressed={v === start || v === finish}
              onClick={() => onPick(v)}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}
export default function Wireframes() {
  const [draft, setDraft] = useState<Draft>(() => structuredClone(sample));
  const [sampleDraft, setSampleDraft] = useState<Draft>(() =>
    structuredClone(sample),
  );
  const [sampleMode, setSampleMode] = useState(false);
  const [screen, setScreen] = useState(-1),
    [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [newPlace, setNewPlace] = useState(""),
    [dateTarget, setDateTarget] = useState<"start" | "finish">("start"),
    [theme, setTheme] = useState("Mountains"),
    [saved, setSaved] = useState(false),
    [suggestion, setSuggestion] = useState(false),
    [rain, setRain] = useState(false),
    [view, setView] = useState("Today");
  const title = useRef<HTMLHeadingElement>(null);
  const d = sampleMode ? sampleDraft : draft;
  const setD = sampleMode ? setSampleDraft : setDraft;
  const patch = (change: Partial<Draft>) => {
    setD((v) => ({ ...v, ...change }));
    setSaved(false);
    setError("");
  };
  const stays = d.stops.reduce((n, s) => n + s.nights, 0),
    travelNights = d.stops.length && d.travel === "shared" ? 1 : 0,
    allocated = stays + travelNights,
    available =
      d.mode === "exact"
        ? dayDiff(d.start, d.finish)
        : d.mode === "flexible"
          ? d.duration
          : 0;
  const stayCost =
      stays *
      (d.stay === "hostel"
        ? 650 * d.people
        : (d.stay === "comfort" ? 2600 : 1800) * d.rooms),
    transport =
      d.travel === "private" ? 6500 * Math.ceil(d.people / 4) : 1750 * d.people,
    activities = d.accepted ? 450 * d.people : 0,
    total = stayCost + transport + activities;
  const mismatch = available > 0 && allocated > available;
  const dates =
    d.mode === "exact"
      ? `${pretty(d.start)} – ${pretty(d.finish)}`
      : d.mode === "flexible"
        ? `${night(d.duration)} · flexible dates`
        : "Dates open";
  function go(n: number) {
    setScreen(n);
    setError("");
    setSuggestion(false);
    setTimeout(() => title.current?.focus(), 0);
  }
  function begin() {
    setSampleMode(false);
    go(1);
  }
  function sampleTrip() {
    setSampleDraft(structuredClone(sample));
    setSampleMode(true);
    setRain(false);
    go(8);
  }
  function revise(change: Partial<Draft>) {
    patch({ ...change, accepted: false });
    setNotice(
      "Trip updated. Affected stays, transfers and activities need review.",
    );
  }
  function next() {
    if (screen === 1 && (!d.origin.trim() || d.people < 1 || d.rooms < 1)) {
      setError("Add an origin, at least one traveler and a room count.");
      return;
    }
    if (
      screen === 1 &&
      d.mode === "exact" &&
      (!d.start || !d.finish || dayDiff(d.start, d.finish) <= 0)
    ) {
      setError("Choose a return date after departure.");
      return;
    }
    if (screen === 2 && !d.stops.length) {
      setError("Add at least one destination to continue.");
      return;
    }
    if (screen === 3 && mismatch) {
      setError(
        "The allocation exceeds your dates. Shorten a stay, change dates, or save an unresolved browser draft.",
      );
      return;
    }
    go(screen + 1);
  }
  function addPlace(name: string) {
    if (!name.trim()) return;
    patch({
      stops: [
        ...d.stops,
        {
          id: `stop-${Date.now()}-${d.stops.length}`,
          name: name.trim(),
          nights: 2,
        },
      ],
      accepted: false,
    });
    setNewPlace("");
    setNotice(`${name} added. Check the time allocation.`);
  }
  function saveLocal() {
    try {
      localStorage.setItem(
        "elsewhere-wireframe-v1",
        JSON.stringify({
          version: 1,
          draft: d,
          screen: Math.max(1, Math.min(screen, 6)),
        }),
      );
      setNotice(
        "Draft saved in this browser only. No account or reservation was created.",
      );
    } catch {
      setNotice(
        "Browser storage is unavailable. Keep this tab open to retain your draft.",
      );
    }
  }
  function restore() {
    try {
      const v = JSON.parse(
        localStorage.getItem("elsewhere-wireframe-v1") || "null",
      );
      if (
        v?.version !== 1 ||
        !Array.isArray(v.draft?.stops) ||
        !v.draft.origin ||
        !Number.isFinite(v.draft.people)
      )
        throw Error();
      setDraft(v.draft);
      setSampleMode(false);
      go(v.screen);
      setNotice("Browser draft restored.");
    } catch {
      setNotice("No compatible browser draft is available.");
    }
  }
  const route = [
    d.origin || "Origin",
    ...d.stops.map((s) => s.name),
    d.returnHome ? d.origin : d.end || "Finish",
  ].join(" → ");
  const counts = (
    <>
      {d.people} travelers · {d.rooms} {d.rooms === 1 ? "room" : "rooms"}
    </>
  );
  const budgetBreakdown = (
    <dl className="wf-costs">
      <div>
        <dt>
          {d.stay === "hostel" ? `${d.people} beds` : `${d.rooms} room(s)`} ×{" "}
          {night(stays)}
        </dt>
        <dd>{money(stayCost)}</dd>
      </div>
      <div>
        <dt>
          {d.travel === "shared"
            ? "Bus, rail & local allowance"
            : "Private vehicle allowance"}
        </dt>
        <dd>{money(transport)}</dd>
      </div>
      {d.accepted ? (
        <div>
          <dt>Accepted indoor activity · {d.people} people</dt>
          <dd>{money(activities)}</dd>
        </div>
      ) : null}
      <div className="wf-cost-total">
        <dt>Illustrative group total</dt>
        <dd>{money(total)}</dd>
      </div>
      <div>
        <dt>Per traveler</dt>
        <dd>{money(Math.round(total / d.people))}</dd>
      </div>
    </dl>
  );
  const timeline = (
    <div className="wf-timeline">
      <article>
        <time>Travel day</time>
        <div>
          <h3>
            {d.origin} → {d.stops[0]?.name || "First stop"}
          </h3>
          <p>
            {d.travel === "shared"
              ? "Overnight connection · 1 travel night"
              : "Road transfer · no assumed overnight"}
          </p>
          <small>
            Illustrative connection; schedule and arrival need checking.
          </small>
        </div>
        <span>Transfer</span>
      </article>
      {d.stops.map((stop, i) => (
        <article key={stop.id}>
          <time>
            {stop.name}
            <br />
            {night(stop.nights)}
          </time>
          <div>
            <h3>
              {d.openDays
                ? "Room to wander"
                : i === 0
                  ? d.accepted
                    ? "A local studio and a longer breakfast"
                    : "A forest walk and a village morning"
                  : "An open meadow and an unhurried afternoon"}
            </h3>
            <p>
              {d.openDays
                ? "No activities scheduled. Add something whenever you like."
                : "Suggested activities · provisional travel time and hours"}
            </p>
            <button className="wf-link" onClick={() => go(5)}>
              Edit these days
            </button>
          </div>
          <span>{d.accepted && i === 0 ? "Revised" : "Flexible"}</span>
        </article>
      ))}
      <article>
        <time>18:10</time>
        <div>
          <h3>
            {d.stops.at(-1)?.name || "Last stop"} →{" "}
            {d.returnHome ? d.origin : d.end || "Finish"}
          </h3>
          <p>Sample return transfer. Kept fixed during replanning.</p>
        </div>
        <span>Keep fixed</span>
      </article>
    </div>
  );
  return (
    <main className="wf">
      <aside className="wf-review-rail">
        <a href="/design/fieldtrip" className="wf-logo">
          elsewhere.
        </a>
        <span className="wf-tag">Wireframe review · v1</span>
        <button
          className={screen === -1 ? "wf-current" : ""}
          onClick={() => go(-1)}
        >
          Screen map
        </button>
        <div className="wf-rail-group">
          {stages.map((name, i) => (
            <button
              key={name}
              className={screen === i ? "wf-current" : ""}
              onClick={() => go(i)}
            >
              <span>
                {i === 0
                  ? "L"
                  : i <= 6
                    ? `P${i}`
                    : i === 7
                      ? "A"
                      : i === 8
                        ? "W"
                        : "R"}
              </span>
              {name}
            </button>
          ))}
        </div>
        <p>
          Review navigation can jump to any screen. The product’s Continue
          buttons validate the draft.
        </p>
        <button onClick={saveLocal}>Save browser draft</button>
        <button onClick={restore}>Open browser draft</button>
        <a href="/design/fieldtrip">Back to current design ↗</a>
      </aside>
      <div className="wf-review-main">
        <header className="wf-review-bar">
          <span>
            Layout & flow review · sample data · no booking or live APIs
          </span>
          <button
            onClick={() => {
              setDraft(structuredClone(sample));
              setSampleMode(false);
              setSaved(false);
              setRain(false);
              setNotice("Sample reset.");
              go(0);
            }}
          >
            Reset sample
          </button>
        </header>
        <div className="wf-canvas">
          {sampleMode ? (
            <div className="wf-banner">
              You’re exploring a sample. Your personal draft is preserved.
              <button
                onClick={() => {
                  setDraft({
                    ...structuredClone(d),
                    mode: "unknown",
                    start: "",
                    finish: "",
                    accepted: false,
                  });
                  setSampleMode(false);
                  go(1);
                }}
              >
                Use route as a starting point
              </button>
              <button onClick={begin}>Return to my draft</button>
            </div>
          ) : null}
          {notice ? (
            <div className="wf-notice" role="status">
              {notice}
              <button aria-label="Dismiss status" onClick={() => setNotice("")}>
                ×
              </button>
            </div>
          ) : null}
          {screen === -1 ? (
            <>
              <div className="wf-heading">
                <span>Visual wireflow</span>
                <h1 tabIndex={-1} ref={title}>
                  One trip. From a feeling
                  <br />
                  to a plan you can change.
                </h1>
                <p>
                  Start at the landing page, or open a screen below. This is a
                  structural prototype; the approved hero artwork is not being
                  redesigned.
                </p>
                <button className="wf-primary" onClick={() => go(0)}>
                  Walk through the experience →
                </button>
              </div>
              <div className="wf-screen-map">
                {stages.map((name, i) => (
                  <button key={name} onClick={() => go(i)}>
                    <div className={`wf-mini wf-mini-${i}`}>
                      <span />
                      <span />
                      <span />
                      <span />
                    </div>
                    <strong>
                      {i === 0
                        ? "Landing"
                        : i < 7
                          ? `Step ${i}`
                          : "After planning"}{" "}
                      / {name}
                    </strong>
                    <p>{descriptions[i]}</p>
                    <span>Open screen →</span>
                  </button>
                ))}
              </div>
            </>
          ) : null}
          {screen === 0 ? (
            <div className="wf-landing">
              <header>
                <strong>elsewhere.</strong>
                <nav>
                  <button onClick={sampleTrip}>Explore a sample</button>
                  <button onClick={begin}>Start planning →</button>
                </nav>
              </header>
              <section className="wf-landing-hero">
                <ScenicBlock label="Approved hero artwork stays here — scenery and motion preserved" />
                <div>
                  <span>A little out of the ordinary</span>
                  <h1 tabIndex={-1} ref={title}>
                    Leave the
                    <br />
                    usual behind.
                  </h1>
                  <p>
                    Plan your places, stays and journeys together. Leave a
                    little room for life to happen.
                  </p>
                  <button className="wf-primary" onClick={begin}>
                    Plan my escape →
                  </button>
                  <button className="wf-link" onClick={sampleTrip}>
                    See a sample trip
                  </button>
                  <small>Dates can come later.</small>
                </div>
              </section>
              <section className="wf-landing-explain">
                <div>
                  <h2>
                    Your places, stays and journeys.
                    <br />
                    One connected plan.
                  </h2>
                  <p>
                    Choose where you want to go. Shape the days around your
                    time, budget and pace.
                  </p>
                  <button className="wf-link" onClick={sampleTrip}>
                    Try a sample trip →
                  </button>
                </div>
                <div className="wf-example">
                  <small>Interactive example</small>
                  <strong>Delhi → Jibhi → Sainj → Delhi</strong>
                  <p>3 nights + 2 nights + overnight travel</p>
                  <span>Stay + travel allowance: ₹12,500</span>
                  <small>Illustrative prices; some expenses unpriced.</small>
                </div>
              </section>
              <section className="wf-landing-explain">
                <div>
                  <h2>
                    When the day changes,
                    <br />
                    your whole trip doesn’t have to.
                  </h2>
                  <p>
                    Review another way to spend the morning, while your evening
                    transfer stays fixed.
                  </p>
                  <button
                    className="wf-link"
                    onClick={() => {
                      setSampleDraft(structuredClone(sample));
                      setSampleMode(true);
                      setRain(true);
                      go(9);
                    }}
                  >
                    Try the rain example →
                  </button>
                </div>
                <div className="wf-example">
                  <span>09:00 · Outdoor walk → Indoor studio</span>
                  <strong>18:10 · Return transfer stays fixed</strong>
                  <small>Illustrated weather example</small>
                </div>
              </section>
              <section className="wf-landing-end">
                <h2>A whole trip you can make your own.</h2>
                <p>
                  An editable itinerary, connected costs and room for a change.
                </p>
                <button className="wf-primary" onClick={begin}>
                  Start planning →
                </button>
                <button className="wf-link" onClick={sampleTrip}>
                  Open the sample itinerary
                </button>
              </section>
              <footer>
                elsewhere.
                <span>
                  Explore the example · How changes work · Start planning
                </span>
              </footer>
            </div>
          ) : null}
          {screen >= 1 && screen <= 6 ? (
            <>
              <div className="wf-product-top">
                <strong>elsewhere.</strong>
                <span>
                  Your trip draft{" "}
                  <b>
                    {saved ? "Saved in prototype" : "Not saved to an account"}
                  </b>
                </span>
                <button onClick={saveLocal}>Save for later</button>
              </div>
              <nav className="wf-progress" aria-label="Planning progress">
                {stages.slice(1, 7).map((s, i) => (
                  <button
                    key={s}
                    aria-current={screen === i + 1 ? "step" : undefined}
                    onClick={() => {
                      if (i + 1 < screen) go(i + 1);
                    }}
                    disabled={i + 1 > screen}
                  >
                    <span>{i + 1}</span>
                    {s}
                  </button>
                ))}
              </nav>
              <div className="wf-planning-grid">
                <section className="wf-work">
                  <div className="wf-screen-title">
                    <small>Step {screen} of 6</small>
                    <h1 tabIndex={-1} ref={title}>
                      {
                        [
                          "",
                          "Where does your escape begin?",
                          "Where would you like to go?",
                          "Give each place a little time.",
                          "Find your way there. Find a place to land.",
                          "How much would you like to leave open?",
                          "Your escape, all together.",
                        ][screen]
                      }
                    </h1>
                    <p>
                      {
                        [
                          "",
                          "A few details to build around. You can change them later.",
                          "Add places, put them in order, and choose where to finish.",
                          "A suggested split is a starting point, not a commitment.",
                          "Illustrative options show how comparisons will work.",
                          "Travel time and breathing room belong in the plan too.",
                          "Inspect the details before saving. Nothing here is a booking.",
                        ][screen]
                      }
                    </p>
                  </div>
                  {screen === 1 ? (
                    <>
                      <label className="wf-field">
                        Traveling from
                        <input
                          value={d.origin}
                          onChange={(e) => revise({ origin: e.target.value })}
                          placeholder="Town, airport or station"
                        />
                      </label>
                      <div className="wf-form-row">
                        <label className="wf-field">
                          Travelers
                          <input
                            type="number"
                            min="1"
                            value={d.people}
                            onChange={(e) =>
                              revise({
                                people: Math.max(1, Number(e.target.value)),
                              })
                            }
                          />
                        </label>
                        <label className="wf-field">
                          Rooms needed
                          <input
                            type="number"
                            min="1"
                            value={d.rooms}
                            onChange={(e) =>
                              revise({
                                rooms: Math.max(1, Number(e.target.value)),
                              })
                            }
                          />
                        </label>
                      </div>
                      <fieldset>
                        <legend>When would you like to go?</legend>
                        <div className="wf-segment">
                          {(
                            [
                              ["exact", "Exact dates"],
                              ["flexible", "Flexible window"],
                              ["unknown", "Not sure yet"],
                            ] as const
                          ).map(([value, label]) => (
                            <button
                              key={value}
                              aria-pressed={d.mode === value}
                              onClick={() => revise({ mode: value })}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </fieldset>
                      {d.mode !== "unknown" ? (
                        <>
                          <div className="wf-form-row">
                            <label className="wf-field">
                              {d.mode === "exact"
                                ? "Departure"
                                : "Earliest departure (optional)"}
                              <input
                                type="date"
                                value={d.start}
                                onFocus={() => setDateTarget("start")}
                                onChange={(e) =>
                                  revise({ start: e.target.value })
                                }
                              />
                            </label>
                            <label className="wf-field">
                              {d.mode === "exact"
                                ? "Return"
                                : "Latest return (optional)"}
                              <input
                                type="date"
                                value={d.finish}
                                onFocus={() => setDateTarget("finish")}
                                onChange={(e) =>
                                  revise({ finish: e.target.value })
                                }
                              />
                            </label>
                          </div>
                          <div className="wf-calendar-layout">
                            <Calendar
                              start={d.start}
                              finish={d.finish}
                              onPick={(v) => {
                                revise({ [dateTarget]: v });
                                setDateTarget(
                                  dateTarget === "start" ? "finish" : "start",
                                );
                              }}
                            />
                            <div>
                              <strong>
                                Select{" "}
                                {dateTarget === "start"
                                  ? "departure"
                                  : "return"}
                              </strong>
                              <p>
                                Departure and return are travel dates. Stay
                                nights and overnight travel are allocated next.
                              </p>
                              {d.mode === "flexible" ? (
                                <label className="wf-field">
                                  Desired nights
                                  <input
                                    type="number"
                                    min="1"
                                    value={d.duration}
                                    onChange={(e) =>
                                      revise({
                                        duration: Math.max(1, +e.target.value),
                                      })
                                    }
                                  />
                                </label>
                              ) : (
                                <b>
                                  {dayDiff(d.start, d.finish) > 0
                                    ? `${night(dayDiff(d.start, d.finish))} available`
                                    : "Choose a valid date range"}
                                </b>
                              )}
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="wf-callout">
                          Start with places. Dates, dated offers and forecasts
                          can come later.
                        </div>
                      )}
                      <details className="wf-details">
                        <summary>
                          Have a budget or pace in mind? Optional
                        </summary>
                        <label className="wf-field">
                          Group budget target · INR
                          <input
                            type="number"
                            min="0"
                            value={d.budget || ""}
                            placeholder="No target yet"
                            onChange={(e) =>
                              patch({ budget: Math.max(0, +e.target.value) })
                            }
                          />
                        </label>
                        <div className="wf-segment">
                          {["Relaxed", "Balanced", "Active"].map((p) => (
                            <button
                              key={p}
                              aria-pressed={d.pace === p}
                              onClick={() => patch({ pace: p })}
                            >
                              {p}
                            </button>
                          ))}
                        </div>
                      </details>
                    </>
                  ) : null}
                  {screen === 2 ? (
                    <>
                      <div className="wf-segment">
                        {["Mountains", "Coast", "Something different"].map(
                          (t) => (
                            <button
                              key={t}
                              aria-pressed={theme === t}
                              onClick={() => setTheme(t)}
                            >
                              {t}
                            </button>
                          ),
                        )}
                      </div>
                      <form
                        className="wf-search"
                        onSubmit={(e) => {
                          e.preventDefault();
                          addPlace(newPlace);
                        }}
                      >
                        <label className="wf-field">
                          Search or enter a place
                          <input
                            value={newPlace}
                            onChange={(e) => setNewPlace(e.target.value)}
                            placeholder="I know where I want to go…"
                          />
                        </label>
                        <button className="wf-secondary" type="submit">
                          Add place
                        </button>
                      </form>
                      <div className="wf-place-options">
                        {(theme === "Mountains"
                          ? ["Jibhi", "Sainj", "Shangarh"]
                          : theme === "Coast"
                            ? ["Varkala", "Fort Kochi", "Marari"]
                            : ["Puducherry", "Mamallapuram", "Auroville"]
                        ).map((name, i) => (
                          <article key={name}>
                            <ScenicBlock small label="Place illustration" />
                            <h3>{name}</h3>
                            <p>
                              {
                                [
                                  "A slower start",
                                  "Room to explore",
                                  "An open afternoon",
                                ][i]
                              }
                            </p>
                            <button onClick={() => addPlace(name)}>
                              + Add stop
                            </button>
                          </article>
                        ))}
                      </div>
                      <div className="wf-section-label">
                        <h2>Your route</h2>
                        <span>Repeated visits are allowed.</span>
                      </div>
                      <div className="wf-route-list">
                        <span className="wf-origin">Start: {d.origin}</span>
                        {d.stops.map((s, i) => (
                          <div key={s.id}>
                            <span className="wf-node">{i + 1}</span>
                            <strong>{s.name}</strong>
                            <button
                              disabled={i === 0}
                              aria-label={`Move ${s.name} earlier`}
                              onClick={() => {
                                const a = [...d.stops];
                                [a[i - 1], a[i]] = [a[i], a[i - 1]];
                                revise({ stops: a });
                              }}
                            >
                              ↑
                            </button>
                            <button
                              disabled={i === d.stops.length - 1}
                              aria-label={`Move ${s.name} later`}
                              onClick={() => {
                                const a = [...d.stops];
                                [a[i + 1], a[i]] = [a[i], a[i + 1]];
                                revise({ stops: a });
                              }}
                            >
                              ↓
                            </button>
                            <button
                              aria-label={`Remove ${s.name}`}
                              onClick={() =>
                                revise({
                                  stops: d.stops.filter((x) => x.id !== s.id),
                                })
                              }
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                      <label className="wf-check">
                        <input
                          type="checkbox"
                          checked={d.returnHome}
                          onChange={(e) =>
                            revise({ returnHome: e.target.checked })
                          }
                        />
                        Return to {d.origin || "my origin"}
                      </label>
                      {!d.returnHome ? (
                        <label className="wf-field">
                          Finish in
                          <input
                            value={d.end}
                            onChange={(e) => revise({ end: e.target.value })}
                          />
                        </label>
                      ) : null}
                    </>
                  ) : null}
                  {screen === 3 ? (
                    <>
                      <div className="wf-allocation">
                        <div>
                          <small>Available</small>
                          <strong>
                            {available > 0 ? night(available) : "Open"}
                          </strong>
                        </div>
                        <div>
                          <small>Assigned stays</small>
                          <strong>{night(stays)}</strong>
                        </div>
                        <div>
                          <small>Travel overnight</small>
                          <strong>{night(travelNights)}</strong>
                        </div>
                        <div className={mismatch ? "wf-warning" : ""}>
                          <small>
                            {mismatch ? "Over allocation" : "Remaining"}
                          </small>
                          <strong>
                            {available > 0
                              ? night(Math.abs(available - allocated))
                              : "Not set"}
                          </strong>
                        </div>
                      </div>
                      <div className="wf-section-label">
                        <span>
                          {dates} · {d.pace} pace
                        </span>
                        <button
                          className="wf-secondary"
                          disabled={!d.stops.length}
                          onClick={() => setSuggestion(true)}
                        >
                          Suggest a split
                        </button>
                      </div>
                      {suggestion ? (
                        <div className="wf-callout">
                          <strong>A balanced starting split</strong>
                          <p>
                            Distribute{" "}
                            {night(
                              Math.max(
                                0,
                                (available || allocated) - travelNights,
                              ),
                            )}{" "}
                            across {d.stops.length} stops; keep the overnight
                            transfer separate. Adjust every stop afterward.
                          </p>
                          <button
                            onClick={() => {
                              const n = Math.max(
                                  0,
                                  (available || allocated) - travelNights,
                                ),
                                base = Math.floor(n / d.stops.length),
                                extra = n % d.stops.length;
                              revise({
                                stops: d.stops.map((s, i) => ({
                                  ...s,
                                  nights: base + (i < extra ? 1 : 0),
                                })),
                              });
                              setSuggestion(false);
                            }}
                          >
                            Use this split
                          </button>
                          <button onClick={() => setSuggestion(false)}>
                            Keep my allocation
                          </button>
                        </div>
                      ) : null}
                      <div
                        className="wf-day-strip"
                        aria-label="Trip night allocation"
                      >
                        {d.travel === "shared" ? (
                          <span className="wf-transfer-night">
                            Travel night
                          </span>
                        ) : null}
                        {d.stops.map((s, i) => (
                          <span
                            key={s.id}
                            style={{ flex: Math.max(1, s.nights) }}
                            className={`wf-strip-${i % 3}`}
                          >
                            {s.name}
                            <b>{night(s.nights)}</b>
                          </span>
                        ))}
                      </div>
                      <div className="wf-route-list">
                        {d.stops.map((s) => (
                          <div key={s.id}>
                            <strong>{s.name}</strong>
                            <span>
                              {s.nights === 0 ? "Day visit" : night(s.nights)}
                            </span>
                            <button
                              disabled={s.nights === 0}
                              aria-label={`Fewer nights in ${s.name}`}
                              onClick={() =>
                                revise({
                                  stops: d.stops.map((x) =>
                                    x.id === s.id
                                      ? { ...x, nights: x.nights - 1 }
                                      : x,
                                  ),
                                })
                              }
                            >
                              −
                            </button>
                            <button
                              aria-label={`More nights in ${s.name}`}
                              onClick={() =>
                                revise({
                                  stops: d.stops.map((x) =>
                                    x.id === s.id
                                      ? { ...x, nights: x.nights + 1 }
                                      : x,
                                  ),
                                })
                              }
                            >
                              +
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="wf-callout">
                        {mismatch
                          ? "Your stays and overnight transfer exceed the available nights. Shorten stays or change dates."
                          : available > allocated
                            ? `${night(available - allocated)} still open. You can leave breathing room or allocate it.`
                            : "Transfer times and stay dates need validation against real services."}
                        <button className="wf-link" onClick={() => go(1)}>
                          Change dates
                        </button>
                      </div>
                    </>
                  ) : null}
                  {screen === 4 ? (
                    <>
                      <div className="wf-comparison-label">
                        <span>Compare the whole route</span>
                        <b>
                          {d.mode === "exact"
                            ? dates
                            : "Provisional · dates not fixed"}
                        </b>
                      </div>
                      <h2>A place to land</h2>
                      <div className="wf-compare-grid">
                        {(
                          [
                            {
                              id: "hostel",
                              name: "Hostel beds",
                              rate: 650,
                              basis: "per person / night",
                              note: "Shared space, individual beds",
                            },
                            {
                              id: "simple",
                              name: "Simple private room",
                              rate: 1800,
                              basis: "per room / night",
                              note: "Private room; room count applies",
                            },
                            {
                              id: "comfort",
                              name: "More comfortable room",
                              rate: 2600,
                              basis: "per room / night",
                              note: "Higher illustrative room allowance",
                            },
                          ] as const
                        ).map((s) => (
                          <button
                            key={s.id}
                            aria-pressed={d.stay === s.id}
                            onClick={() => patch({ stay: s.id })}
                          >
                            <span className="wf-radio" />
                            <h3>{s.name}</h3>
                            <strong>{money(s.rate)}</strong>
                            <small>{s.basis}</small>
                            <p>{s.note}</p>
                          </button>
                        ))}
                      </div>
                      <h2>The way between</h2>
                      <div className="wf-compare-grid wf-two">
                        <button
                          aria-pressed={d.travel === "shared"}
                          onClick={() => revise({ travel: "shared" })}
                        >
                          <span className="wf-radio" />
                          <h3>Bus, rail & local rides</h3>
                          <strong>{money(1750)}</strong>
                          <small>per traveler · route allowance</small>
                          <p>
                            Includes an illustrative overnight outbound leg.
                            Exact service and duration unknown.
                          </p>
                        </button>
                        <button
                          aria-pressed={d.travel === "private"}
                          onClick={() => revise({ travel: "private" })}
                        >
                          <span className="wf-radio" />
                          <h3>Private transfers</h3>
                          <strong>{money(6500)}</strong>
                          <small>
                            per vehicle · up to 4 people in this example
                          </small>
                          <p>
                            No overnight assumed. Changing this option flags the
                            time allocation for review.
                          </p>
                        </button>
                      </div>
                      <details className="wf-details">
                        <summary>Already booked something?</summary>
                        <p>
                          The real planner will support entered booking times,
                          location, cost and references. This wireframe does not
                          create or verify a reservation.
                        </p>
                      </details>
                      <div className="wf-callout">
                        These are comparison allowances, not available offers.
                        Food, other activities, taxes and fees remain unpriced.
                      </div>
                    </>
                  ) : null}
                  {screen === 5 ? (
                    <>
                      <div className="wf-segment">
                        <button
                          aria-pressed={!d.openDays}
                          onClick={() => patch({ openDays: false })}
                        >
                          Suggest my days
                        </button>
                        <button
                          aria-pressed={d.openDays}
                          onClick={() => patch({ openDays: true })}
                        >
                          Keep my days open
                        </button>
                      </div>
                      <div className="wf-section-label">
                        <span>My pace</span>
                        <div className="wf-segment">
                          {["Relaxed", "Balanced", "Active"].map((p) => (
                            <button
                              key={p}
                              aria-pressed={d.pace === p}
                              onClick={() => patch({ pace: p })}
                            >
                              {p}
                            </button>
                          ))}
                        </div>
                      </div>
                      {timeline}
                      <div className="wf-callout">
                        <strong>Weather & packing</strong>
                        <p>
                          No forecast is connected in this prototype. For
                          distant dates, the product will offer labeled seasonal
                          guidance rather than invent a forecast.
                        </p>
                        <span>
                          Example packing considerations: layers, a rain shell
                          and shoes suitable for the selected activities.
                        </span>
                      </div>
                    </>
                  ) : null}
                  {screen === 6 ? (
                    <>
                      <div className="wf-trip-pass">
                        <div>
                          <span>Trip overview · illustrative draft</span>
                          <label className="wf-field">
                            Trip name
                            <input
                              value={d.name}
                              onChange={(e) => patch({ name: e.target.value })}
                            />
                          </label>
                          <h2>{route}</h2>
                        </div>
                        <div className="wf-ticket-stats">
                          <span>
                            When<strong>{dates}</strong>
                          </span>
                          <span>
                            Who<strong>{counts}</strong>
                          </span>
                          <span>
                            Time<strong>{night(stays)} in stays</strong>
                          </span>
                          <span>
                            Estimate<strong>{money(total)}</strong>
                          </span>
                        </div>
                        <div className="wf-ticket-bottom">
                          {mismatch
                            ? "Needs review · dates do not fit"
                            : "Draft · supplier availability and timing need checking"}
                          <span>Not a ticket or booking confirmation</span>
                        </div>
                      </div>
                      <details className="wf-details" open>
                        <summary>
                          Day-by-day itinerary{" "}
                          <span>{d.stops.length} stops</span>
                        </summary>
                        {timeline}
                      </details>
                      <details className="wf-details">
                        <summary>Costs and unpriced items</summary>
                        {budgetBreakdown}
                        <p>
                          Food, additional activities, taxes and fees unknown.
                        </p>
                        <button className="wf-link" onClick={() => go(4)}>
                          Edit stay and travel
                        </button>
                      </details>
                      <details className="wf-details">
                        <summary>Weather & packing</summary>
                        <p>
                          No date-specific forecast connected. Clothing
                          suggestions require destination, activities and
                          available condition data.
                        </p>
                      </details>
                      <div className="wf-callout">
                        Save an incomplete draft if you like. Check schedules,
                        prices and activity hours before considering it ready to
                        travel.
                      </div>
                    </>
                  ) : null}
                  {error ? (
                    <p role="alert" className="wf-error">
                      {error}
                    </p>
                  ) : null}
                  <div className="wf-form-actions">
                    <button
                      className="wf-secondary"
                      onClick={() => go(screen === 1 ? 0 : screen - 1)}
                    >
                      ← Back
                    </button>
                    {screen === 6 ? (
                      <button className="wf-primary" onClick={() => go(7)}>
                        Save to my account →
                      </button>
                    ) : (
                      <button className="wf-primary" onClick={next}>
                        {
                          [
                            "",
                            "Continue to places",
                            "Plan the time",
                            "Compare stays & travel",
                            "Shape the days",
                            "Review my trip",
                          ][screen]
                        }{" "}
                        →
                      </button>
                    )}
                  </div>
                  {screen === 6 ? (
                    <button className="wf-link" onClick={() => go(5)}>
                      Keep editing without sign-in
                    </button>
                  ) : null}
                </section>
                <aside className="wf-trip-summary">
                  <span>Your trip, taking shape</span>
                  <h2>{d.name || "My escape"}</h2>
                  <p>{route}</p>
                  <div className="wf-summary-row">
                    <span>Dates</span>
                    <strong>{dates}</strong>
                    <button onClick={() => go(1)}>Edit</button>
                  </div>
                  <div className="wf-summary-row">
                    <span>Travelers</span>
                    <strong>{counts}</strong>
                    <button onClick={() => go(1)}>Edit</button>
                  </div>
                  <div className="wf-summary-row">
                    <span>Stays</span>
                    <strong>
                      {night(stays)} · {d.stops.length} stops
                    </strong>
                    <button onClick={() => go(3)}>Edit</button>
                  </div>
                  {budgetBreakdown}
                  <small>
                    Illustrative allowances. Some expenses unpriced.
                  </small>
                  {d.budget > 0 ? (
                    <p className={total > d.budget ? "wf-warning" : ""}>
                      {total > d.budget
                        ? `${money(total - d.budget)} above your target`
                        : `${money(d.budget - total)} below your target`}{" "}
                      · {money(d.budget)} group target
                    </p>
                  ) : null}
                  <div className="wf-summary-state">
                    {mismatch
                      ? "Needs review: time allocation exceeds dates."
                      : d.mode !== "exact"
                        ? "Dates open. Offers and forecasts remain provisional."
                        : "Services, availability and hours need checking."}
                  </div>
                </aside>
              </div>
            </>
          ) : null}
          {screen === 7 ? (
            <div className="wf-auth">
              <span className="wf-tag">
                Account-save handoff · wireframe only
              </span>
              <h1 tabIndex={-1} ref={title}>
                Keep your escape
                <br />
                close at hand.
              </h1>
              <p>
                Your draft stays here while you sign in. No account is required
                to keep exploring.
              </p>
              <div className="wf-auth-provider">
                [ Authentication provider / email form ]
                <small>
                  Integration placeholder. No credentials are collected or sent.
                </small>
              </div>
              <button
                className="wf-primary"
                onClick={() => {
                  setSaved(true);
                  setNotice(
                    "Simulated account save. This prototype has not created an account or saved to a server.",
                  );
                  go(8);
                }}
              >
                Simulate successful sign-in & save →
              </button>
              <button
                className="wf-secondary"
                onClick={() => {
                  setNotice("Sign-in canceled. Your draft is still intact.");
                  go(6);
                }}
              >
                Cancel and return to my trip
              </button>
              <button
                className="wf-link"
                onClick={() =>
                  setError(
                    "Example failure: sign-in could not complete. Retry or return to your intact draft.",
                  )
                }
              >
                Show sign-in failure state
              </button>
              {error ? (
                <p className="wf-error" role="alert">
                  {error}
                </p>
              ) : null}
              <div className="wf-example">
                <strong>{d.name}</strong>
                <p>{route}</p>
                <span>
                  {dates} · {counts}
                </span>
              </div>
            </div>
          ) : null}
          {screen === 8 ? (
            <div className="wf-workspace">
              <header>
                <div>
                  <small>
                    {sampleMode
                      ? "Sample trip · edits stay in this example"
                      : "Editable trip workspace · prototype"}
                  </small>
                  <h1 tabIndex={-1} ref={title}>
                    {d.name}
                  </h1>
                  <p>
                    {route} · {dates}
                  </p>
                </div>
                <button
                  className="wf-primary"
                  onClick={() => {
                    setRain(true);
                    go(9);
                  }}
                >
                  Change my plan →
                </button>
              </header>
              <nav className="wf-segment">
                {["Today", "Whole trip", "Costs"].map((v) => (
                  <button
                    key={v}
                    aria-pressed={view === v}
                    onClick={() => setView(v)}
                  >
                    {v}
                  </button>
                ))}
                <button onClick={() => go(6)}>Trip overview ↗</button>
              </nav>
              <div className="wf-workspace-grid">
                <section>
                  <div className="wf-section-label">
                    <h2>
                      {view === "Costs"
                        ? "What’s priced so far"
                        : view === "Whole trip"
                          ? "Every place, connected"
                          : "A little room in the day"}
                    </h2>
                    <button
                      className="wf-link"
                      onClick={() => go(view === "Costs" ? 4 : 5)}
                    >
                      Edit plan
                    </button>
                  </div>
                  {view === "Costs" ? (
                    <>
                      {budgetBreakdown}
                      <p>
                        Still unpriced: food, other activities, taxes and fees.
                        No booking or payment has been made.
                      </p>
                    </>
                  ) : (
                    timeline
                  )}
                </section>
                <aside className="wf-trip-summary">
                  <span>At a glance</span>
                  <h2>{night(stays)} of stays</h2>
                  <p>{counts}</p>
                  <strong className="wf-big-total">{money(total)}</strong>
                  <small>Illustrative group total</small>
                  <div className="wf-callout">
                    Forecast unavailable in this prototype. Report a change to
                    try a clearly labeled weather example.
                  </div>
                  <button className="wf-secondary" onClick={() => go(2)}>
                    Edit route
                  </button>
                  <button className="wf-secondary" onClick={saveLocal}>
                    Save a browser copy
                  </button>
                </aside>
              </div>
            </div>
          ) : null}
          {screen === 9 ? (
            <div className="wf-revision">
              <div className="wf-screen-title">
                <small>Illustrated disruption example</small>
                <h1 tabIndex={-1} ref={title}>
                  A different morning.
                  <br />
                  Still your trip.
                </h1>
                <p>
                  Review the proposed change. Your current plan stays in place
                  until you accept.
                </p>
              </div>
              <div className="wf-segment">
                <button aria-pressed={rain} onClick={() => setRain(true)}>
                  Rain at the first stop
                </button>
                <button aria-pressed={!rain} onClick={() => setRain(false)}>
                  No disruption
                </button>
              </div>
              {rain && !d.openDays ? (
                <>
                  <div className="wf-revision-columns">
                    <section>
                      <span>Current plan</span>
                      <article>
                        <time>
                          09:00 · {d.stops[0]?.name || "First destination"}
                        </time>
                        <h2>Outdoor walk</h2>
                        <p>Unsuitable in this illustrated rain example.</p>
                      </article>
                      <div className="wf-fixed-block">
                        18:10 · Return transfer
                        <br />
                        <strong>Keep fixed</strong>
                      </div>
                    </section>
                    <section>
                      <span>Proposed revision</span>
                      <article>
                        <time>09:30 · same destination</time>
                        <h2>
                          A local studio.
                          <br />A longer breakfast.
                        </h2>
                        <p>
                          Indoor alternative · provisional hours and
                          suitability.
                        </p>
                        <strong>
                          +{money(450 * d.people)} for {d.people} travelers
                        </strong>
                      </article>
                      <div className="wf-fixed-block">
                        18:10 · Return transfer
                        <br />
                        <strong>Unchanged</strong>
                      </div>
                    </section>
                  </div>
                  <div className="wf-revision-total">
                    <span>Group estimate</span>
                    <strong>
                      {money(total - activities)} →{" "}
                      {money(total - activities + 450 * d.people)}
                    </strong>
                    <small>
                      No reservation is changed. Additional supplier action may
                      be required.
                    </small>
                  </div>
                  <div className="wf-form-actions">
                    <button
                      className="wf-secondary"
                      onClick={() => {
                        setNotice(
                          "Proposal discarded. Your current itinerary is unchanged.",
                        );
                        go(8);
                      }}
                    >
                      Keep my current plan
                    </button>
                    <button
                      className="wf-primary"
                      onClick={() => {
                        patch({ accepted: true });
                        setNotice(
                          "Revision accepted in this prototype. Indoor activity added; 18:10 transfer preserved.",
                        );
                        go(8);
                      }}
                    >
                      Keep this revision →
                    </button>
                  </div>
                </>
              ) : (
                <div className="wf-callout">
                  <h2>
                    {d.openDays
                      ? "Your days are open."
                      : "Nothing needs to change."}
                  </h2>
                  <p>
                    {d.openDays
                      ? "No outdoor activity is scheduled to replace. Add an activity or keep the day free."
                      : "Return to the itinerary or try the rain example."}
                  </p>
                  <button className="wf-secondary" onClick={() => go(8)}>
                    Return to my trip
                  </button>
                </div>
              )}
            </div>
          ) : null}
          {screen !== -1 ? (
            <details className="wf-design-note">
              <summary>Review notes for this screen</summary>
              <p>
                {descriptions[screen]} Visual hierarchy, copy length, decisions
                and navigation are reviewable. Illustrations, offer
                integrations, weather and authentication are placeholders, not
                completed features.
              </p>
              <p>
                {screen === 0
                  ? "The approved hero stays. The landing sample must share state across its demonstrations; these wireframes use a sample-workspace entry to demonstrate the handoff."
                  : screen === 3
                    ? "Try increasing nights beyond the date range, then Continue. Exact dates should not silently stretch."
                    : screen === 4
                      ? "Hostels price per person; private rooms per room; shared travel per traveler; private vehicles per capacity group. Unknown costs stay separate."
                      : screen === 7
                        ? "Cancel and failure preserve the draft. The success action is explicitly simulated."
                        : "Use the progress bar to go back, or the review rail to inspect another surface. The same draft carries through."}
              </p>
            </details>
          ) : null}
        </div>
      </div>
    </main>
  );
}
