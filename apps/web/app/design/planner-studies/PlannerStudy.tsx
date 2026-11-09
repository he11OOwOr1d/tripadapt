"use client";
import Link from "next/link";
import { useId, useRef, useState, type CSSProperties } from "react";
import { studies, type Study } from "./studies";
import "./studies.css";

type Visit = { id: number; name: string; nights: number };
const topics = [
  "A beginning",
  "A little time",
  "Your places",
  "Room to stay",
  "All together",
];
export default function PlannerStudy({ concept }: { concept: Study }) {
  const [origin, setOrigin] = useState("Mumbai");
  const [people, setPeople] = useState(2);
  const [days, setDays] = useState(12);
  const [dateMode, setDateMode] = useState("open");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [visits, setVisits] = useState<Visit[]>([
    { id: 1, name: "Lisbon", nights: 4 },
    { id: 2, name: "Porto", nights: 3 },
  ]);
  const [newPlace, setNewPlace] = useState("");
  const [message, setMessage] = useState("");
  const [open, setOpen] = useState(0);
  const [travel, setTravel] = useState(0);
  const [review, setReview] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const nextId = useRef(3);
  const id = useId();
  const study = studies.find((s) => s.id === concept)!;
  const nights = visits.reduce((n, v) => n + v.nights, 0);
  const exactDays =
    start && end && end >= start
      ? Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1
      : null;
  const capacity = dateMode === "exact" ? exactDays : days || null;
  const remaining = capacity === null ? null : capacity - 1 - nights - travel;
  const conflict = remaining !== null && remaining < 0;
  const route = visits.map((v) => v.name).join(" / ");
  function add() {
    if (!newPlace.trim()) {
      setMessage("Name a place to add it to the route.");
      return;
    }
    setVisits((v) => [
      ...v,
      { id: nextId.current++, name: newPlace.trim(), nights: 0 },
    ]);
    setNewPlace("");
    setMessage("Place added. Set its nights whenever you’re ready.");
  }
  function move(index: number, delta: number) {
    setVisits((v) => {
      const next = [...v];
      [next[index], next[index + delta]] = [next[index + delta], next[index]];
      return next;
    });
    setMessage("Travel order changed. Connections will need checking.");
  }
  function allocate(visit: Visit, n: number) {
    setVisits((v) =>
      v.map((p) => (p.id === visit.id ? { ...p, nights: Math.max(0, n) } : p)),
    );
  }
  function showReview() {
    setReview(true);
    dialog.current?.showModal();
  }
  function suggest() {
    const available = Math.max(
      0,
      (capacity === null ? visits.length * 3 : capacity - 1) - travel,
    );
    setVisits((v) =>
      v.map((p, i) => ({
        ...p,
        nights:
          Math.floor(available / v.length) + (i < available % v.length ? 1 : 0),
      })),
    );
    setMessage(
      "Illustrative even split applied at your request. Every stay remains editable.",
    );
  }
  const originInput = (large = false) => (
    <label className={large ? "ps-origin ps-large-field" : "ps-origin"}>
      Starting from
      <input
        value={origin}
        placeholder="Your town or city"
        onChange={(e) => setOrigin(e.target.value)}
      />
    </label>
  );
  const peopleInput = () => (
    <label>
      Travelers
      <div className="ps-stepper">
        <button
          aria-label="One fewer traveler"
          disabled={people === 1}
          onClick={() => setPeople((n) => Math.max(1, n - 1))}
        >
          −
        </button>
        <input
          aria-label="Traveler count"
          type="number"
          min="1"
          value={people}
          onChange={(e) => setPeople(Math.max(1, Number(e.target.value)))}
        />
        <button
          aria-label="One more traveler"
          onClick={() => setPeople((n) => n + 1)}
        >
          +
        </button>
      </div>
    </label>
  );
  const dates = () => (
    <div className="ps-dates">
      <fieldset>
        <legend>When do you want to go?</legend>
        <div className="ps-date-choices">
          {[
            ["open", "Dates can wait"],
            ["exact", "I know my dates"],
          ].map(([value, label]) => (
            <label key={value}>
              <input
                type="radio"
                name={`${id}-date-mode`}
                checked={dateMode === value}
                onChange={() => setDateMode(value)}
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      {dateMode === "exact" ? (
        <div className="ps-date-inputs">
          <label>
            Departure
            <input
              type="date"
              value={start}
              onInput={(e) => setStart(e.currentTarget.value)}
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
          <label>
            Finish
            <input
              type="date"
              min={start}
              value={end}
              onInput={(e) => setEnd(e.currentTarget.value)}
              onChange={(e) => setEnd(e.target.value)}
            />
          </label>
        </div>
      ) : (
        <label className="ps-duration">
          About
          <input
            aria-label="Desired trip days"
            type="number"
            min="1"
            value={days || ""}
            placeholder="—"
            onChange={(e) => setDays(Number(e.target.value))}
          />
          days away <small>or leave it open</small>
        </label>
      )}
    </div>
  );
  const addPlace = () => (
    <div className="ps-add">
      <label htmlFor={`${id}-place`}>Another place on your mind?</label>
      <div>
        <input
          id={`${id}-place`}
          value={newPlace}
          onChange={(e) => setNewPlace(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Town, region or country"
        />
        <button onClick={add} aria-label="Add destination">
          Add place +
        </button>
      </div>
    </div>
  );
  const routeRows = (compact = false) => (
    <div className={`ps-route-rows ${compact ? "ps-route-compact" : ""}`}>
      {visits.length === 0 ? (
        <p className="ps-empty">
          Your route is open. Add a place below to begin.
        </p>
      ) : (
        visits.map((v, i) => (
          <div className="ps-route-row" key={v.id}>
            <span className="ps-order">{i + 1}</span>
            <div>
              <strong>{v.name}</strong>
              <span>
                {v.nights === 0 ? "Day visit" : `${v.nights} stay nights`}
              </span>
            </div>
            <div className="ps-row-buttons">
              <button
                disabled={i === 0}
                aria-label={`Move ${v.name} earlier`}
                onClick={() => move(i, -1)}
              >
                ↑
              </button>
              <button
                disabled={i === visits.length - 1}
                aria-label={`Move ${v.name} later`}
                onClick={() => move(i, 1)}
              >
                ↓
              </button>
              <button
                aria-label={`Remove ${v.name}`}
                onClick={() => {
                  setVisits((vs) => vs.filter((p) => p.id !== v.id));
                  setMessage(`${v.name} removed from this design draft.`);
                }}
              >
                ×
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
  const allocation = () => (
    <div className="ps-allocation">
      {visits.map((v, i) => (
        <label key={v.id}>
          <span>
            {i + 1}. {v.name}
          </span>
          <input
            type="number"
            min="0"
            aria-label={`Stay nights in ${v.name}, visit ${i + 1}`}
            value={v.nights}
            onChange={(e) => allocate(v, Number(e.target.value))}
          />
          <small>stay nights</small>
        </label>
      ))}
      <label>
        <span>On the way</span>
        <input
          aria-label="Overnight travel nights"
          type="number"
          min="0"
          value={travel}
          onChange={(e) => setTravel(Math.max(0, Number(e.target.value)))}
        />
        <small>travel nights</small>
      </label>
    </div>
  );
  const timeStatus = () => (
    <div
      className={`ps-time-status ${conflict ? "ps-conflict" : ""}`}
      role="status"
    >
      <strong>
        {capacity === null ? "Duration open" : `${capacity} trip days`}
      </strong>
      <span>
        {nights} stay nights + {travel} travel nights
      </span>
      <p>
        {conflict
          ? `${-remaining!} nights over your time. Shorten a stay or add more days.`
          : remaining === null
            ? "Dates and total duration can come later."
            : `${remaining} ${remaining === 1 ? "night" : "nights"} still open.`}
      </p>
      <small>
        Travel days are inclusive. Journey hours and connections still need
        checking.
      </small>
    </div>
  );
  const action = (label = "See it all together") => (
    <button className="ps-action" onClick={showReview}>
      {label}
      <span aria-hidden="true">↗</span>
    </button>
  );
  return (
    <main className={`ps ps-study ps-${concept}`}>
      <div className="ps-review-bar">
        <Link href="/design/planner-studies">All six studies</Link>
        <span>{study.name}</span>
        <span>Fictional design draft · not your saved trip</span>
      </div>
      <header className="ps-brand">
        <Link href="/design/fieldtrip">elsewhere.</Link>
        <span>A little further from the usual.</span>
        <button className="ps-text-button" onClick={showReview}>
          Your trip <span>{visits.length} places</span>
        </button>
      </header>
      {concept === "sentence" && (
        <>
          <section className="ps-sentence-main">
            <p className="ps-whisper">Say it your way.</p>
            <h1>
              A little change
              <br />
              of scenery.
            </h1>
            <div className="ps-sentence-copy" aria-label="Trip basics">
              <span>I’m setting off from</span>
              <label>
                <span className="ps-sr-only">Starting location</span>
                <input
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                  placeholder="somewhere"
                />
              </label>
              <span>with</span>
              <label>
                <span className="ps-sr-only">Number of travelers</span>
                <input
                  type="number"
                  min="1"
                  value={people}
                  onChange={(e) =>
                    setPeople(Math.max(1, Number(e.target.value)))
                  }
                />
              </label>
              <span>of us, for about</span>
              <label>
                <span className="ps-sr-only">Trip duration in days</span>
                <input
                  type="number"
                  min="1"
                  value={days || ""}
                  onChange={(e) => setDays(Number(e.target.value))}
                  placeholder="?"
                />
              </label>
              <span>days.</span>
            </div>
            <p className="ps-sentence-aside">
              The dates can wait. The idea doesn’t have to.
            </p>
            <div className="ps-sentence-route">
              <span>Places I’m thinking about</span>
              {visits.map((v, i) => (
                <button
                  key={v.id}
                  onClick={() => allocate(v, v.nights + 1)}
                  aria-label={`Add a stay night in ${v.name}`}
                >
                  {v.name}
                  <small>
                    {v.nights} nights <b>+</b>
                  </small>
                </button>
              ))}
              <button
                onClick={() => setOpen((o) => (o === 1 ? 0 : 1))}
                aria-expanded={open === 1}
              >
                Somewhere else +
              </button>
            </div>
            {open === 1 && (
              <div className="ps-sentence-add">
                {addPlace()}
                {routeRows(true)}
              </div>
            )}
            <div className="ps-sentence-bottom">
              {timeStatus()}
              {action("Follow this thought")}
            </div>
          </section>
          <div className="ps-sentence-rule" aria-hidden="true">
            <span>A beginning.</span>
            <i />
            <span>Room for the unexpected.</span>
          </div>
        </>
      )}
      {concept === "contour" && (
        <div className="ps-contour-layout">
          <aside className="ps-contour-art">
            <Contours />
            <div>
              <span>A plan with a little breathing room.</span>
              <h1>
                Find your
                <br />
                own way.
              </h1>
              <p>{visits.length ? route : "Your route is still open."}</p>
            </div>
            <span className="ps-contour-caption">An outline, not a map.</span>
          </aside>
          <section className="ps-contour-form">
            <h2>Begin wherever you are.</h2>
            <p>A few details. A whole new direction.</p>
            <div className="ps-contour-row">
              <span>Start</span>
              {originInput()}
              {peopleInput()}
            </div>
            <div className="ps-contour-row">
              <span>Time</span>
              {dates()}
            </div>
            <div className="ps-contour-row">
              <span>Places</span>
              <div>
                {routeRows()}
                {addPlace()}
              </div>
            </div>
            <details className="ps-contour-duration">
              <summary>Give the route a little time</summary>
              {allocation()}
            </details>
            <div className="ps-contour-bottom">
              {timeStatus()}
              {action()}
            </div>
          </section>
        </div>
      )}
      {concept === "loom" && (
        <>
          <section className="ps-loom-intro">
            <div>
              <p>Places become days. Days become a journey.</p>
              <h1>
                Make time
                <br />
                for elsewhere.
              </h1>
            </div>
            <div className="ps-loom-basics">
              {originInput()}
              {peopleInput()}
              <label>
                Trip days
                <input
                  type="number"
                  min="1"
                  value={days || ""}
                  placeholder="Open"
                  onChange={(e) => setDays(Number(e.target.value))}
                />
              </label>
            </div>
          </section>
          <section className="ps-loom-canvas">
            <div className="ps-loom-key">
              <h2>Weave your route.</h2>
              <span>
                <i /> Stay nights
              </span>
              <span>
                <i /> Travel nights
              </span>
            </div>
            <div className="ps-ribbons">
              {visits.map((v, i) => (
                <article
                  key={v.id}
                  className={`ps-ribbon ps-ribbon-${i % 3}`}
                  style={
                    { "--nights": Math.min(v.nights, 16) } as CSSProperties
                  }
                >
                  <div className="ps-ribbon-top">
                    <span>Stay {i + 1}</span>
                    <button
                      aria-label={`Remove ${v.name}`}
                      onClick={() =>
                        setVisits((vs) => vs.filter((p) => p.id !== v.id))
                      }
                    >
                      ×
                    </button>
                  </div>
                  <h3>{v.name}</h3>
                  <div className="ps-thread-lines" aria-hidden="true">
                    {Array.from({ length: Math.min(v.nights, 12) }, (_, j) => (
                      <i key={j} />
                    ))}
                  </div>
                  <label>
                    <input
                      aria-label={`Stay nights in ${v.name}`}
                      type="number"
                      min="0"
                      value={v.nights}
                      onChange={(e) => allocate(v, Number(e.target.value))}
                    />
                    nights here
                  </label>
                  <div className="ps-ribbon-controls">
                    <button
                      disabled={i === 0}
                      aria-label={`Move ${v.name} earlier`}
                      onClick={() => move(i, -1)}
                    >
                      ←
                    </button>
                    <button
                      disabled={i === visits.length - 1}
                      aria-label={`Move ${v.name} later`}
                      onClick={() => move(i, 1)}
                    >
                      →
                    </button>
                  </div>
                </article>
              ))}
              <div className="ps-open-ribbon">
                <span>{remaining === null ? "?" : Math.max(0, remaining)}</span>
                <h3>Leave a little open.</h3>
                <p>
                  For another place.
                  <br />
                  Or nothing at all.
                </p>
                {addPlace()}
              </div>
            </div>
            <div className="ps-loom-travel">
              <span aria-hidden="true">∿∿∿</span>
              <label>
                Overnight travel
                <input
                  aria-label="Travel nights"
                  type="number"
                  min="0"
                  value={travel}
                  onChange={(e) =>
                    setTravel(Math.max(0, Number(e.target.value)))
                  }
                />
                nights
              </label>
              <p>
                Travel nights are separate from places to stay. Journey times
                remain unknown.
              </p>
            </div>
          </section>
          <div className="ps-loom-bottom">
            {timeStatus()}
            {action("Look at the whole journey")}
          </div>
        </>
      )}
      {concept === "round" && (
        <>
          <section className="ps-round-intro">
            <h1>
              Good company.
              <br />A different view.
            </h1>
            <p>
              Some plans start with a place.
              <br />
              This one starts with your people.
            </p>
          </section>
          <section className="ps-round-stage">
            <div className="ps-round-people" aria-label={`${people} travelers`}>
              {Array.from({ length: Math.min(people, 8) }, (_, i) => (
                <span
                  className="ps-person"
                  key={i}
                  style={
                    {
                      "--angle": `${(i * 360) / Math.min(people, 8) - 90}deg`,
                      "--reverse": `${-((i * 360) / Math.min(people, 8) - 90)}deg`,
                    } as CSSProperties
                  }
                >
                  <i aria-hidden="true" />
                  <b>{i === 0 ? "You" : `+ ${i}`}</b>
                </span>
              ))}
            </div>
            <div className="ps-round-center">
              <span>Your circle, somewhere new.</span>
              {originInput(true)}
              {peopleInput()}
              {people > 8 && <small>{people} travelers in your group</small>}
            </div>
            <span className="ps-round-sidenote">
              The route can change.
              <br />
              The good company stays.
            </span>
          </section>
          <div className="ps-round-bottom">
            <div>
              {dates()}
              {timeStatus()}
            </div>
            <section>
              <h2>Where you’ll go together.</h2>
              {routeRows()}
              {addPlace()}
              <details>
                <summary>Set stay & travel nights</summary>
                {allocation()}
              </details>
              {action("Bring the trip together")}
            </section>
          </div>
        </>
      )}
      {concept === "horizons" && (
        <>
          <section className="ps-horizon ps-horizon-start">
            <div className="ps-horizon-heading">
              <p>Every escape has a beginning.</p>
              <h1>From here.</h1>
            </div>
            <div className="ps-horizon-fields">
              {originInput(true)}
              {peopleInput()}
            </div>
            <span className="ps-horizon-marker" aria-hidden="true">
              ☀
            </span>
          </section>
          <section className="ps-horizon ps-horizon-time">
            <div className="ps-horizon-heading">
              <p>Something to look forward to.</p>
              <h2>A little time.</h2>
            </div>
            {dates()}
            <div className="ps-horizon-time-note">
              {capacity === null
                ? "No deadline for the idea."
                : `${capacity} days outside the usual.`}
              <small>Dates are editable. Space is part of the plan.</small>
            </div>
          </section>
          <section className="ps-horizon ps-horizon-places">
            <div className="ps-horizon-heading">
              <p>Follow what calls you.</p>
              <h2>
                Somewhere
                <br />
                new.
              </h2>
            </div>
            <div className="ps-horizon-route">
              {routeRows()}
              {addPlace()}
              <details>
                <summary>Time at each place</summary>
                {allocation()}
              </details>
            </div>
          </section>
          <footer className="ps-horizon-footer">
            {timeStatus()}
            {action("See the way through")}
          </footer>
        </>
      )}
      {concept === "unfolding" && (
        <section className="ps-unfold-main">
          <div className="ps-unfold-intro">
            <h1>
              You don’t need
              <br />
              it all figured out.
            </h1>
            <p>
              Just a beginning.
              <br />
              We’ll open the rest as you go.
            </p>
          </div>
          <div className="ps-leaves">
            {topics.map((topic, i) => (
              <section
                key={topic}
                className={`ps-leaf ps-leaf-${i} ${open === i ? "ps-leaf-open" : ""}`}
              >
                <button
                  className="ps-leaf-heading"
                  aria-expanded={open === i}
                  aria-controls={`${id}-leaf-${i}`}
                  onClick={() => setOpen(open === i ? -1 : i)}
                >
                  <span>{topic}</span>
                  <small>
                    {
                      [
                        `${origin || "Starting point open"} / ${people} travelers`,
                        dateMode === "exact" && start
                          ? `${start} to ${end || "…"}`
                          : days
                            ? `${days} days / dates open`
                            : "Duration open",
                        route || "Anywhere you like",
                        `${nights} stay nights / ${travel} travel nights`,
                        "Your trip outline",
                      ][i]
                    }
                  </small>
                  <b aria-hidden="true">{open === i ? "−" : "+"}</b>
                </button>
                {open === i && (
                  <div className="ps-leaf-body" id={`${id}-leaf-${i}`}>
                    {i === 0 ? (
                      <>
                        <div className="ps-leaf-origin">
                          {originInput(true)}
                          {peopleInput()}
                        </div>
                        <p>
                          These can change. Nothing here makes a reservation.
                        </p>
                      </>
                    ) : i === 1 ? (
                      dates()
                    ) : i === 2 ? (
                      <>
                        {routeRows()}
                        {addPlace()}
                      </>
                    ) : i === 3 ? (
                      <>
                        {allocation()}
                        {timeStatus()}
                        <button className="ps-text-button" onClick={suggest}>
                          Use an illustrative even split
                        </button>
                      </>
                    ) : (
                      <>
                        <h2>
                          {origin || "Your starting point"} /{" "}
                          {route || "somewhere new"}
                        </h2>
                        {timeStatus()}
                        <p>
                          Stays, transport and prices are still to choose. Your
                          days can remain open.
                        </p>
                        {action("Open the trip outline")}
                      </>
                    )}
                    {i < 4 && (
                      <button
                        className="ps-leaf-next"
                        onClick={() => setOpen(i + 1)}
                      >
                        Next: {topics[i + 1]}
                        <span aria-hidden="true">↘</span>
                      </button>
                    )}
                  </div>
                )}
              </section>
            ))}
          </div>
        </section>
      )}
      <div className="ps-message" role="status">
        {message}
      </div>
      <footer className="ps-study-footer">
        <span>{study.name} · interactive design study</span>
        <p>
          Fictional places and planning assumptions. No live routes, prices or
          reservations. Changes stay in this preview.
        </p>
        <nav aria-label="Compare planner studies">
          {studies.map((s) => (
            <Link
              key={s.id}
              href={`/design/planner-studies/${s.id}`}
              aria-current={concept === s.id ? "page" : undefined}
            >
              {s.name}
            </Link>
          ))}
        </nav>
      </footer>
      <dialog
        className="ps-dialog"
        ref={dialog}
        onClose={() => setReview(false)}
        aria-labelledby={`${id}-review-title`}
      >
        <div className="ps-dialog-top">
          <span>Fictional trip outline</span>
          <button
            aria-label="Close trip outline"
            onClick={() => dialog.current?.close()}
          >
            ×
          </button>
        </div>
        {review && (
          <>
            <h2 id={`${id}-review-title`}>
              A little idea,
              <br />
              all together.
            </h2>
            <p>
              From {origin || "a starting point to decide"} · {people} travelers
            </p>
            <p>
              {dateMode === "exact" && start && end
                ? `${start} to ${end}`
                : "Dates open"}
            </p>
            {routeRows()}
            {timeStatus()}
            {conflict && (
              <p className="ps-conflict">
                Your nights don’t fit yet. Change stay nights or total days
                before making a dated plan.
              </p>
            )}
            <div className="ps-dialog-gap">
              <strong>The details can come next.</strong>
              <p>
                Stay types, transport schedules and all costs are unpriced and
                unverified. This is a visual study, not an accepted itinerary.
              </p>
            </div>
            <button
              className="ps-action"
              onClick={() => dialog.current?.close()}
            >
              Keep shaping this idea
            </button>
          </>
        )}
      </dialog>
    </main>
  );
}
function Contours() {
  return (
    <svg
      className="ps-contours"
      viewBox="0 0 600 1000"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      {Array.from({ length: 16 }, (_, i) => (
        <path
          key={i}
          d={`M ${-280 + i * 27} -120 C ${160 + i * 24} ${70 + i * 8}, ${-150 + i * 18} ${290 + i * 13}, ${100 + i * 23} ${390 + i * 17} S ${50 + i * 23} ${760 + i * 9}, ${280 + i * 18} 1130`}
        />
      ))}
    </svg>
  );
}
