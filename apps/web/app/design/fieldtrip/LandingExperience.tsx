"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import ChapterArt from "./ChapterArt";
import DirectionIntro, { type Treatment } from "./DirectionIntro";
import { TripPass, RoutePreview, DatePreview } from "./product/TripPieces";
import {
  initialSample,
  currency,
  dateLabel,
  sampleSummary,
  type SampleTrip,
} from "./product/sample-trip";
import "./experience.css";
const placeOptions = [
  {
    id: "jibhi",
    name: "Jibhi",
    line: "Forest paths & a slow morning",
    nights: 3,
  },
  {
    id: "sainj",
    name: "Sainj",
    line: "Village walks & valley views",
    nights: 2,
  },
  {
    id: "shangarh",
    name: "Shangarh",
    line: "An open meadow. An open afternoon.",
    nights: 2,
  },
];
const tabs = ["Places", "Time", "Stay & travel"];
function Arrow() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path d="M4 12h16m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
export default function LandingExperience({
  paused,
  direction = "original",
  plannerDirection = direction,
  onPauseToggle,
  paletteControl,
  sampleOpen,
  onSampleOpenChange,
}: {
  direction?: Treatment;
  plannerDirection?: Treatment;
  paletteControl?: ReactNode;
  sampleOpen: boolean;
  onSampleOpenChange: (open: boolean) => void;
  paused: boolean;
  onPauseToggle: () => void;
}) {
  const [trip, setTrip] = useState<SampleTrip>(() =>
      structuredClone(initialSample),
    ),
    [tab, setTab] = useState(0),
    [rain, setRain] = useState(false),
    [status, setStatus] = useState("");
  const open = sampleOpen,
    setOpen = onSampleOpenChange;
  const dialog = useRef<HTMLDialogElement>(null),
    summary = sampleSummary(trip);
  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    else if (!open && node.open) node.close();
  }, [open]);
  function change(patch: Partial<SampleTrip>) {
    setTrip((t) => ({ ...t, ...patch }));
  }
  function togglePlace(p: (typeof placeOptions)[number]) {
    const included = trip.stops.some((s) => s.id === p.id);
    if (included && trip.stops.length === 1) return;
    change({
      stops: included
        ? trip.stops.filter((s) => s.id !== p.id)
        : [...trip.stops, { id: p.id, name: p.name, nights: p.nights }],
      accepted: false,
    });
    setRain(false);
    setStatus(
      `${p.name} ${included ? "saved for another time" : "added to the sample"}. Dates and estimate updated.`,
    );
  }
  function adjust(id: string, delta: number) {
    change({
      stops: trip.stops.map((stop) =>
        stop.id === id
          ? { ...stop, nights: Math.max(1, stop.nights + delta) }
          : stop,
      ),
    });
    setStatus("Stay length, dates and allowance updated together.");
  }
  const costRows = (
    <dl className="ep-cost-rows">
      <div>
        <dt>
          {summary.nights} nights ·{" "}
          {trip.stay === "hostel" ? "2 hostel beds" : "1 private room"}
        </dt>
        <dd>{currency(summary.stayTotal)}</dd>
      </div>
      <div>
        <dt>
          {trip.transport === "shared"
            ? "Shared travel allowance"
            : "Private transfer allowance"}
        </dt>
        <dd>{currency(summary.travelTotal)}</dd>
      </div>
      {trip.accepted ? (
        <div>
          <dt>Indoor alternative · 2 entries</dt>
          <dd>{currency(summary.activityTotal)}</dd>
        </div>
      ) : null}
    </dl>
  );
  return (
    <div
      className={`ep ${paused ? "ep-paused" : ""}`}
      data-direction={direction}
      data-planner-direction={plannerDirection}
    >
      {paletteControl}
      <nav className="ep-nav" aria-label="Discover Elsewhere">
        <a href="#about">What is Elsewhere?</a>
        <a href="#collect">Try a little planning</a>
        <a href="#weather">Room for change</a>
        <button aria-pressed={paused} onClick={onPauseToggle}>
          {paused ? "▷ Let it move" : "Ⅱ Pause the moments"}
        </button>
      </nav>
      {direction !== "original" ? (
        <DirectionIntro
          direction={direction}
          paused={paused}
          trip={trip}
          onSelect={setTab}
        />
      ) : (
        <>
          <section className="ep-about ep-section" id="about">
            <div className="ep-about-copy">
              <span className="ep-greeting">
                A little freedom. A little direction.
              </span>
              <h2>
                Your places, stays
                <br />
                and journeys.
                <br />
                One connected plan.
              </h2>
              <p>
                Choose where you want to go. Shape the days around your time,
                budget and pace. Keep the details together as your trip takes
                shape.
              </p>
              <a className="ep-text-link" href="#collect">
                See how it comes together <span>↓</span>
              </a>
            </div>
            <div className="ep-about-art">
              <div className="ep-about-scenery">
                <ChapterArt scene="discover" paused={paused} variant={2} />
              </div>
              <div
                className="ep-planning-ingredients"
                aria-label="What Elsewhere connects"
              >
                <a href="#collect" onClick={() => setTab(0)}>
                  <span aria-hidden="true">⌁</span>
                  <div>
                    <strong>Find your somewhere.</strong>
                    <small>Places that suit your pace.</small>
                  </div>
                  <Arrow />
                </a>
                <a href="#collect" onClick={() => setTab(2)}>
                  <span aria-hidden="true">⌂</span>
                  <div>
                    <strong>A place to settle in.</strong>
                    <small>Stays and journeys, considered together.</small>
                  </div>
                  <Arrow />
                </a>
                <a href="#collect" onClick={() => setTab(1)}>
                  <span aria-hidden="true">◷</span>
                  <div>
                    <strong>A little time to yourself.</strong>
                    <small>Days with room to breathe.</small>
                  </div>
                  <Arrow />
                </a>
              </div>
              <span className="ep-written-note">
                A feeling, with a plan behind it.
              </span>
            </div>
          </section>
        </>
      )}
      <section className="ep-demo ep-section" id="collect">
        <div className="ep-section-heading">
          <div>
            <span className="ep-greeting">Try a sample trip</span>
            <h2>
              A few small choices.
              <br />A trip that fits together.
            </h2>
          </div>
          <p>
            Add a place. Stay a little longer.
            <br />
            See the rest fall into place.
          </p>
        </div>
        <div className="ep-planner">
          <header className="ep-planner-header">
            <span>
              <i aria-hidden="true" />A little mountain escape
            </span>
            <span>2 travelers · starts in Delhi</span>
            <button
              onClick={() => {
                setTrip(structuredClone(initialSample));
                setRain(false);
                setStatus("Sample reset.");
              }}
            >
              Reset example ↻
            </button>
          </header>
          <div className="ep-planner-layout">
            <div className="ep-planner-work">
              <div
                className="ep-tabs"
                role="tablist"
                aria-label="Explore sample planning"
              >
                {tabs.map((name, i) => (
                  <button
                    key={name}
                    role="tab"
                    aria-selected={tab === i}
                    aria-controls={`ep-panel-${i}`}
                    id={`ep-tab-${i}`}
                    tabIndex={tab === i ? 0 : -1}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                        e.preventDefault();
                        const next =
                          (tab + (e.key === "ArrowRight" ? 1 : 2)) % 3;
                        setTab(next);
                        document.getElementById(`ep-tab-${next}`)?.focus();
                      }
                    }}
                    onClick={() => setTab(i)}
                  >
                    {name}
                    <span>
                      {i === 0
                        ? "Where you’ll go"
                        : i === 1
                          ? "Room for each place"
                          : "The practical bits"}
                    </span>
                  </button>
                ))}
              </div>
              <div
                role="tabpanel"
                id={`ep-panel-${tab}`}
                aria-labelledby={`ep-tab-${tab}`}
                className="ep-panel"
              >
                {tab === 0 ? (
                  <>
                    <div className="ep-panel-title">
                      <h3>What calls you?</h3>
                      <span>
                        A mountain example. Your own trip can go anywhere.
                      </span>
                    </div>
                    <div className="ep-place-choices">
                      {placeOptions.map((p, i) => {
                        const added = trip.stops.some((s) => s.id === p.id);
                        return (
                          <button
                            key={p.id}
                            className="ep-place-choice"
                            aria-pressed={added}
                            aria-label={`${added ? "Remove" : "Add"} ${p.name} ${added ? "from" : "to"} sample`}
                            disabled={added && trip.stops.length === 1}
                            onClick={() => togglePlace(p)}
                          >
                            <div className="ep-place-art">
                              <ChapterArt paused={paused} variant={i} />
                              <span className="ep-selection-mark">
                                {added ? "✓" : "+"}
                              </span>
                            </div>
                            <strong>{p.name}</strong>
                            <span>{p.line}</span>
                            <small>
                              {added
                                ? "In this journey"
                                : "Add to this journey"}
                            </small>
                          </button>
                        );
                      })}
                    </div>
                    <RoutePreview trip={trip} />
                    <button
                      className="ep-inline-next"
                      onClick={() => setTab(1)}
                    >
                      Give these places a little time <Arrow />
                    </button>
                  </>
                ) : null}
                {tab === 1 ? (
                  <>
                    <div className="ep-panel-title">
                      <h3>Stay a little. Or a little longer.</h3>
                      <label className="ep-sample-date">
                        Sample departure
                        <input
                          type="date"
                          onInput={(e) => {
                            if (e.currentTarget.value)
                              change({ start: e.currentTarget.value });
                          }}
                          onBlur={(e) => {
                            if (e.currentTarget.value)
                              change({ start: e.currentTarget.value });
                          }}
                          required
                          value={trip.start}
                          onChange={(e) => {
                            if (e.target.value)
                              change({ start: e.target.value });
                          }}
                        />
                      </label>
                    </div>
                    <DatePreview trip={trip} />
                    <div className="ep-nights">
                      {trip.stops.map((stop) => (
                        <div key={stop.id}>
                          <div>
                            <strong>{stop.name}</strong>
                            <span>Make room for the days you want.</span>
                          </div>
                          <div className="ep-stepper">
                            <button
                              aria-label={`Fewer nights in ${stop.name}`}
                              disabled={stop.nights === 1}
                              onClick={() => adjust(stop.id, -1)}
                            >
                              −
                            </button>
                            <span>
                              <b>{stop.nights}</b>{" "}
                              {stop.nights === 1 ? "night" : "nights"}
                            </span>
                            <button
                              aria-label={`More nights in ${stop.name}`}
                              onClick={() => adjust(stop.id, 1)}
                            >
                              +
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="ep-small-note">
                      This example moves the return date as you change nights.
                      In your trip, you can keep dates fixed or flexible.
                      Transfer schedules still need checking.
                    </p>
                    <button
                      className="ep-inline-next"
                      onClick={() => setTab(2)}
                    >
                      Find a way there and a place to land <Arrow />
                    </button>
                  </>
                ) : null}
                {tab === 2 ? (
                  <>
                    <div className="ep-panel-title">
                      <h3>Your kind of getting away.</h3>
                      <span>Sample allowances, not available offers.</span>
                    </div>
                    <fieldset className="ep-options">
                      <legend>A place to land</legend>
                      <div>
                        {(
                          [
                            {
                              id: "hostel",
                              name: "Hostel beds",
                              price: 650,
                              basis: "per person / night",
                            },
                            {
                              id: "room",
                              name: "A simple room",
                              price: 1800,
                              basis: "per room / night",
                            },
                            {
                              id: "comfort",
                              name: "A little more comfort",
                              price: 2600,
                              basis: "per room / night",
                            },
                          ] as const
                        ).map((option) => (
                          <button
                            key={option.id}
                            aria-pressed={trip.stay === option.id}
                            onClick={() => change({ stay: option.id })}
                          >
                            <span className="ep-option-check">
                              {trip.stay === option.id ? "●" : "○"}
                            </span>
                            <strong>{option.name}</strong>
                            <span>{currency(option.price)}</span>
                            <small>{option.basis}</small>
                          </button>
                        ))}
                      </div>
                    </fieldset>
                    <fieldset className="ep-options ep-travel-options">
                      <legend>The way between</legend>
                      <div>
                        <button
                          aria-pressed={trip.transport === "shared"}
                          onClick={() => change({ transport: "shared" })}
                        >
                          <strong>Bus, rail & local rides</strong>
                          <span>
                            {currency(1750)} <small>per traveler</small>
                          </span>
                          <small>
                            Route allowance · 1 overnight travel night
                          </small>
                        </button>
                        <button
                          aria-pressed={trip.transport === "private"}
                          onClick={() => change({ transport: "private" })}
                        >
                          <strong>More private transfers</strong>
                          <span>
                            {currency(6500)} <small>per vehicle</small>
                          </span>
                          <small>Route allowance · no overnight assumed</small>
                        </button>
                      </div>
                    </fieldset>
                    <p className="ep-small-note">
                      Bed prices use both travelers; room prices use one room.
                      Food, other activities, taxes and fees are still unpriced.
                    </p>
                  </>
                ) : null}
              </div>
              <div className="ep-demo-status" role="status">
                {status ||
                  "A sample to explore. Your personal trip starts fresh."}
              </div>
            </div>
            <aside className="ep-live-summary">
              <span className="ep-summary-label">The trip, taking shape</span>
              <h3>{trip.stops.map((stop) => stop.name).join(" & ")}</h3>
              <div className="ep-summary-date">
                <span>
                  {dateLabel(trip.start)} — {dateLabel(summary.finish)}
                </span>
                <small>
                  2 travelers · {summary.nights} stay nights
                  {summary.travelNights ? " + 1 travel night" : ""}
                </small>
              </div>
              {costRows}
              <div className="ep-total" aria-live="polite">
                <span>Illustrative group allowance</span>
                <strong key={summary.total}>{currency(summary.total)}</strong>
                <small>
                  {currency(Math.round(summary.total / 2))} per traveler
                </small>
              </div>
              <p>
                Some expenses remain unpriced. Selecting an option does not
                reserve it.
              </p>
              <button className="ep-button" onClick={() => setOpen(true)}>
                Inspect this sample <Arrow />
              </button>
            </aside>
          </div>
        </div>
      </section>
      <section className="ep-weather ep-section" id="weather">
        <div className="ep-section-heading">
          <div>
            <span className="ep-greeting">A little room for life</span>
            <h2>
              When the day changes,
              <br />
              your whole trip doesn’t have to.
            </h2>
          </div>
        </div>
        <div className="ep-weather-layout">
          <div>
            <div className="ep-weather-picture">
              <ChapterArt scene="weather" rain={rain} paused={paused} />
            </div>
            <div className="ep-weather-toggle">
              <div>
                <strong>
                  {rain ? "A passing shower" : "A clear little morning"}
                </strong>
                <span>Illustrated weather example · {trip.stops[0].name}</span>
              </div>
              <button
                aria-pressed={rain}
                onClick={() => {
                  setRain((value) => !value);
                  change({ accepted: false });
                }}
              >
                {rain ? "Bring back the sunshine" : "Try a little rain"}
                <span className="ep-switch">
                  <i />
                </span>
              </button>
            </div>
          </div>
          <div className="ep-revision">
            <header>
              <span>The same trip. Another way to spend the morning.</span>
              <small>
                {trip.accepted
                  ? "Revision kept"
                  : rain
                    ? "For you to review"
                    : "Room to wander"}
              </small>
            </header>
            <div className={`ep-morning ${rain ? "ep-morning-crossed" : ""}`}>
              <time>09:00</time>
              <div>
                <h3>A walk through the valley</h3>
                <p>
                  {rain
                    ? "Better saved for a dry morning."
                    : "A slow start, out in the fresh air."}
                </p>
              </div>
            </div>
            {rain ? (
              <div className="ep-new-morning">
                <div className="ep-morning">
                  <time>09:30</time>
                  <div>
                    <span>
                      {trip.accepted
                        ? "Your new morning"
                        : "How about this instead?"}
                    </span>
                    <h3>
                      A local studio.
                      <br />A longer breakfast.
                    </h3>
                    <p>
                      +{currency(450 * summary.people)} for two sample entries.
                    </p>
                  </div>
                </div>
                <div className="ep-revision-actions">
                  <button
                    className="ep-button"
                    disabled={trip.accepted}
                    onClick={() => {
                      change({ accepted: true });
                      setStatus(
                        "Indoor alternative accepted. The shared sample estimate and trip pass updated.",
                      );
                    }}
                  >
                    {trip.accepted
                      ? "This version is yours ✓"
                      : "Try this change"}
                  </button>
                  {!trip.accepted ? (
                    <button
                      onClick={() => {
                        setRain(false);
                        change({ accepted: false });
                      }}
                    >
                      Keep the original
                    </button>
                  ) : null}
                </div>
              </div>
            ) : (
              <p className="ep-revision-instruction">
                Bring in a little rain to see an alternative—without starting
                the trip again.
              </p>
            )}
            <div className="ep-fixed">
              <time>18:10</time>
              <div>
                <strong>The journey home</strong>
                <span>Your fixed evening transfer stays in place.</span>
              </div>
              <span>Keep fixed</span>
            </div>
            <small className="ep-small-note">
              A proposal, not an automatic booking change. Actual hours, routes
              and availability need checking.
            </small>
          </div>
        </div>
      </section>
      <section className="ep-outcome ep-section" id="overview">
        <div
          className="ep-travel-journal"
          aria-label="Preview of the sample itinerary"
        >
          <div className="ep-journal-spine" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
          <div className="ep-journal-route">
            <span>A little mountain escape</span>
            <h3>
              The way
              <br />
              through.
            </h3>
            <small>
              {dateLabel(trip.start)} — {dateLabel(summary.finish)}
            </small>
            <ol>
              {trip.stops.map((stop) => (
                <li key={stop.id}>
                  <strong>{stop.name}</strong>
                  <span>
                    {stop.nights} {stop.nights === 1 ? "night" : "nights"}
                  </span>
                </li>
              ))}
            </ol>
            <span className="ep-journal-return">↶ Back to Delhi</span>
          </div>
          <div className="ep-journal-day">
            <span>A morning in {trip.stops[0].name}</span>
            <time>{trip.accepted ? "09:30" : "09:00"}</time>
            <h3>
              {trip.accepted ? (
                <>
                  A local studio.
                  <br />A longer breakfast.
                </>
              ) : (
                <>
                  A forest walk.
                  <br />A slower start.
                </>
              )}
            </h3>
            <svg viewBox="0 0 150 90" aria-hidden="true">
              <path
                d="M30 35H97V61Q97 80 64 80Q30 80 30 61ZM98 42H111Q131 42 126 58Q121 68 98 64M18 84H113M47 25Q35 13 48 3M68 25Q56 13 69 3M87 25Q75 13 88 3"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
            <div className="ep-journal-fixed">
              <time>18:10</time>
              <span>
                The journey home<small>Keep fixed · unchanged</small>
              </span>
            </div>
            <button onClick={() => setOpen(true)}>
              Turn to the full itinerary <Arrow />
            </button>
          </div>
        </div>
        <div className="ep-outcome-copy">
          <span className="ep-greeting">
            From a little idea to a whole trip
          </span>
          <h2>
            All together.
            <br />
            Still yours to change.
          </h2>
          <p>
            The route, the days and the costs—in one editable plan. Open the
            details when you need them. Leave room for a different kind of day.
          </p>
          <button className="ep-text-link" onClick={() => setOpen(true)}>
            Open the sample itinerary <Arrow />
          </button>
          <a className="ep-button" href="/trips/new">
            Plan my own escape <Arrow />
          </a>
          <small>Your own trip starts fresh. Dates can come later.</small>
        </div>
      </section>
      <section className="ep-questions ep-section">
        <h2>Before you wander.</h2>
        <div>
          <details>
            <summary>
              Can I start without dates?<span>+</span>
            </summary>
            <p>
              Yes. Start with places or a rough duration. Dated offers and
              forecasts can be checked when you know more.
            </p>
          </details>
          <details>
            <summary>
              Does Elsewhere book the trip for me?<span>+</span>
            </summary>
            <p>
              No. Plan and compare here; complete reservations with the relevant
              provider. This preview uses illustrative data.
            </p>
          </details>
          <details>
            <summary>
              Who decides when the plan changes?<span>+</span>
            </summary>
            <p>
              You do. Review the proposed revision, costs and preserved
              commitments before keeping it.
            </p>
          </details>
        </div>
      </section>
      <footer className="ep-footer">
        <div>
          <span>A little out of the ordinary.</span>
          <h2>
            Make room for
            <br />
            your elsewhere.
          </h2>
          <a className="ep-button" href="/trips/new">
            Start planning <Arrow />
          </a>
        </div>
        <nav aria-label="Footer navigation">
          <a href="#collect">Explore the example</a>
          <a href="#weather">How changes work</a>
          <button onClick={() => setOpen(true)}>The sample itinerary</button>
          <a href="#top">Back to the view ↑</a>
        </nav>
        <a className="ep-footer-brand" href="#top">
          elsewhere.
        </a>
        <div className="ep-footer-note">
          <span>Places. Stays. Journeys. Connected.</span>
          <small>
            Interactive product preview · sample dates, costs and weather · no
            booking or live offers
          </small>
        </div>
      </footer>
      <dialog
        className="ep-sample-dialog"
        ref={dialog}
        onClose={() => setOpen(false)}
        onCancel={() => setOpen(false)}
        aria-labelledby="ep-dialog-title"
      >
        <header>
          <span>Try a sample trip</span>
          <button
            aria-label="Close sample itinerary"
            onClick={() => setOpen(false)}
          >
            Close ×
          </button>
        </header>
        <div className="ep-dialog-body">
          <h2 id="ep-dialog-title">A whole trip, connected.</h2>
          <p className="ep-small-note">
            This is the same example you’ve been editing. It is not your
            personal trip or a confirmed reservation.
          </p>
          <TripPass trip={trip} />
          <h3>The way through</h3>
          <DatePreview trip={trip} />
          <ol className="ep-itinerary">
            {trip.transport === "shared" ? (
              <li>
                <span>{dateLabel(trip.start)} · travel night</span>
                <strong>Delhi → {trip.stops[0].name}</strong>
                <p>
                  Illustrative overnight leg. Departure and arrival times need
                  checking.
                </p>
              </li>
            ) : null}
            {trip.stops.map((stop, i) => (
              <li key={stop.id}>
                <span>
                  {stop.name} · {stop.nights} nights
                </span>
                <strong>
                  {i === 0 && trip.accepted
                    ? "A local studio and a longer breakfast"
                    : i === 0
                      ? "A forest walk and a village morning"
                      : "An open afternoon, at your own pace"}
                </strong>
                <p>
                  Suggested activity, with room for free time. Actual hours and
                  durations need checking.
                </p>
              </li>
            ))}
            <li>
              <span>{dateLabel(summary.finish)} · 18:10</span>
              <strong>{trip.stops.at(-1)?.name} → Delhi</strong>
              <p>
                Sample fixed return transfer. Preserved during the rain
                revision.
              </p>
            </li>
          </ol>
          <h3>A little clarity on costs</h3>
          {costRows}
          <div className="ep-dialog-total">
            <span>Illustrative group allowance</span>
            <strong>{currency(summary.total)}</strong>
          </div>
          <p className="ep-small-note">
            Food, other activities, taxes and fees remain unpriced. No live
            forecast is connected; packing advice needs checked conditions.
          </p>
          <a className="ep-button" href="/trips/new">
            Start my own trip <Arrow />
          </a>
        </div>
      </dialog>
    </div>
  );
}
