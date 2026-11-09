"use client";

import { useState } from "react";
import "./stillwater.css";
import NatureScene, { SceneMotionProvider } from "./NatureScene";
import type { SceneKind } from "./NatureScene";

const moods = [
  {
    name: "A little altitude",
    line: "Where the view does the talking.",
    description:
      "Mornings in the mountains. A window that stays open. Time to take the longer walk home.",
    position: "50% 58%",
    scene: "valley" as SceneKind,
    alt: "A code-drawn illustration of a mountain halt, a river and a wildflower meadow",
    place: "Bir & the Kangra valley",
    note: "For mountain air and slower village days.",
  },
  {
    name: "By the water",
    line: "A different coast. A slower current.",
    description:
      "Find somewhere to sit, watch the light move and stay a little longer than you meant to.",
    position: "50% 50%",
    scene: "coast" as SceneKind,
    alt: "A code-drawn illustration of a narrow coastal path leading to a blue cove",
    place: "Lakeside afternoons",
    note: "Keep a little room for the places you find along the way.",
  },
  {
    name: "A place to linger",
    line: "The kind of stay that becomes a memory.",
    description:
      "A book you might not finish. A path you haven’t taken. The lovely feeling of having nowhere else to be.",
    position: "62% 50%",
    scene: "inn" as SceneKind,
    alt: "A code-drawn illustration of a garden guesthouse with an open window and a shaded veranda",
    place: "Forest paths & quiet stays",
    note: "Start with a feeling. Choose the actual destination next.",
  },
];
const stops = [
  {
    name: "Bir",
    subtitle: "A hillside beginning",
    nights: 3,
    stay: "A small guesthouse above the village",
    travel: "Overnight bus from Delhi; check the service and arrival stop.",
    note: "Tibetan cafés, village paths and a slower start. Keep an afternoon free for the valley.",
    rate: 1800,
  },
  {
    name: "Tirthan",
    subtitle: "A little further into the green",
    nights: 3,
    stay: "A riverside homestay in the valley",
    travel: "Road transfer from Bir; route, driver and travel time to confirm.",
    note: "Riverside walks and forest air. Check access, local conditions and any required permits before a longer trail.",
    rate: 2200,
  },
];
function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d={diagonal ? "M6 18 18 6M6 6h12v12" : "M4 12h15m-6-6 6 6-6 6"}
        stroke="currentColor"
        strokeWidth="1.4"
      />
    </svg>
  );
}
function Mark() {
  return (
    <svg
      viewBox="0 0 32 32"
      width="28"
      height="28"
      aria-hidden="true"
      fill="none"
    >
      <path
        d="M16 27C4 24 1 9 6 5c9 0 18 9 10 22Zm0 0C28 24 31 9 26 5c-9 0-18 9-10 22ZM6 5l10 22L26 5"
        stroke="currentColor"
        strokeWidth="1.3"
      />
    </svg>
  );
}
function Topography({
  active,
  onSelect,
}: {
  active: number;
  onSelect: (n: number) => void;
}) {
  return (
    <div className="sw-map">
      <svg
        viewBox="0 0 600 550"
        role="img"
        aria-label="Illustrative route sketch from Delhi through Bir to Tirthan; not a navigation map"
      >
        <g fill="none" stroke="#779385" strokeWidth="1" opacity=".35">
          <path d="M-70 74C81 12 104 109 231 77S448 4 658 46M-70 94C81 32 104 129 231 97S448 24 658 66M-70 114C81 52 104 149 231 117S448 44 658 86M-70 134C81 72 104 169 231 137S448 64 658 106M-70 154C81 92 104 189 231 157S448 84 658 126M-70 174C81 112 104 209 231 177S448 104 658 146M-70 194C81 132 104 229 231 197S448 124 658 166" />
          <path d="M-35 440C133 315 259 514 401 403S557 325 648 368M-35 461C133 336 259 535 401 424S557 346 648 389M-35 482C133 357 259 556 401 445S557 367 648 410M-35 503C133 378 259 577 401 466S557 388 648 431M-35 524C133 399 259 598 401 487S557 409 648 452M-35 545C133 420 259 619 401 508S557 430 648 473" />
          <path d="M595 188q-162-81-194 16t98 112q86 30 139-7M601 207q-143-79-172 2t83 89q65 24 111-7M606 226q-125-79-150-13t70 67q47 17 82-5M608 245q-91-75-121-29t48 47q35 9 61-4" />
        </g>
        <path
          d="M-20 298q148-82 266-25t210-11q70-31 165-10"
          stroke="#a6c9cf"
          strokeWidth="16"
          fill="none"
          opacity=".55"
        />
        <path
          d="M130 435C75 358 178 322 198 242S335 121 445 149"
          fill="none"
          stroke="#6d8979"
          strokeWidth="2"
          strokeDasharray="3 7"
        />
        <path
          key={active}
          className="sw-map-progress"
          d={
            active === 0
              ? "M130 435C75 358 178 322 198 242"
              : "M130 435C75 358 178 322 198 242S335 121 445 149"
          }
          fill="none"
          stroke="#315951"
          strokeWidth="2.5"
        />
        <circle cx="130" cy="435" r="5" fill="#315951" />
        <circle cx="198" cy="242" r={active === 0 ? "9" : "5"} fill="#315951" />
        <circle cx="445" cy="149" r={active === 1 ? "9" : "5"} fill="#315951" />
        <g fill="#43665d" fontFamily="SwBody,sans-serif" fontSize="13">
          <text x="147" y="445">
            Delhi
          </text>
          <text x="40" y="45" fontSize="11">
            The mountains, loosely speaking.
          </text>
          <text x="495" y="490" fontSize="11">
            N ↑
          </text>
        </g>
        <g stroke="#43665d" strokeWidth="1.2" fill="none">
          <path d="m285 62 14-24 15 24m-8-12 9-17 17 29M58 202l8-17 9 17m-16-6h14m-7 6v13m20-19 10-20 10 20m-18-7h15m-7 7v15M345 354l9-20 10 20m-17-7h14m-7 7v13m20-8 9-20 10 20m-16-7h14m-7 7v12" />
        </g>
      </svg>
      <button
        className={`sw-map-place sw-map-bir ${active === 0 ? "sw-map-selected" : ""}`}
        aria-pressed={active === 0}
        onClick={() => onSelect(0)}
      >
        Bir<span>stay a while</span>
      </button>
      <button
        className={`sw-map-place sw-map-tirthan ${active === 1 ? "sw-map-selected" : ""}`}
        aria-pressed={active === 1}
        onClick={() => onSelect(1)}
      >
        Tirthan<span>follow the river</span>
      </button>
      <span className="sw-map-caption">
        Route sketch. Connections need checking for your dates.
      </span>
    </div>
  );
}
export default function Stillwater() {
  const [quiet, setQuiet] = useState(false);
  const [paused, setPaused] = useState(false);
  const [breezy, setBreezy] = useState(false);
  const [mood, setMood] = useState(1);
  const [saved, setSaved] = useState<number[]>([]);
  const [stop, setStop] = useState(0);
  const [nights, setNights] = useState([3, 3]);
  const [detail, setDetail] = useState<"stay" | "travel" | "budget">("stay");
  const [rain, setRain] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const total = nights.reduce((sum, n, i) => sum + n * stops[i].rate, 0) + 3500;
  const chosen = stops[stop];
  return (
    <SceneMotionProvider paused={paused} breezy={breezy}>
      <main
        className={`sw sw-original sw-code-scene ${breezy ? "sw-breezy" : ""} ${quiet ? "sw-quiet" : ""} ${paused ? "sw-paused" : ""}`}
      >
        <section
          className="sw-hero"
          aria-label="An illustrated invitation to get away"
        >
          <div className="sw-hero-art">
            <NatureScene
              kind="valley"
              hero
              label="A frontend-built mountain valley with independently flowing river water, drifting clouds, swaying meadow grass and a small hillside shelter"
            />
          </div>
          <div className="sw-hero-shade" />
          <header className="sw-header">
            <a href="/design/stillwater" className="sw-brand">
              <Mark />
              elsewhere.
            </a>
            <nav aria-label="Page navigation">
              <a href="#feeling">Find a feeling</a>
              <a href="#journey">The little details</a>
            </nav>
            <a className="sw-nav-cta" href="/trips/new">
              Plan a getaway <Arrow diagonal />
            </a>
          </header>
          <div className="sw-hero-copy">
            <div className="sw-opening">
              <span className="sw-line" />A little further from the everyday.
            </div>
            <h1>
              A little further.
              <br />A little lighter.
            </h1>
            <p>
              Somewhere new. A pace that feels like you.
              <br />
              Let’s make a little room for getting away.
            </p>
            <a href="#feeling" className="sw-button sw-light">
              Find my kind of away <Arrow />
            </a>
          </div>
          <div className="sw-hero-bottom">
            <a href="#feeling" className="sw-scroll">
              <span className="sw-scroll-line" aria-hidden="true" />
              Follow the journey
            </a>
            <div className="sw-scene-controls">
              <button
                onClick={() => setPaused((v) => !v)}
                aria-label={
                  paused ? "Resume scene motion" : "Pause scene motion"
                }
              >
                {paused ? "▷" : "Ⅱ"}
              </button>
              <button
                className="sw-breeze-toggle"
                aria-pressed={breezy}
                onClick={() => setBreezy((v) => !v)}
              >
                {breezy ? "Softer breeze" : "A little more breeze"}
                <span aria-hidden="true">≈</span>
              </button>
              <button
                className="sw-view-toggle"
                aria-pressed={quiet}
                onClick={() => setQuiet((v) => !v)}
              >
                {quiet ? "Back to the journey" : "Just the view"}
                <span aria-hidden="true">{quiet ? "↙" : "↗"}</span>
              </button>
            </div>
          </div>
        </section>
        <section className="sw-intro">
          <span className="sw-small-leaf" aria-hidden="true">
            <Mark />
          </span>
          <h2>
            A different place.
            <br />A gentler pace.
          </h2>
          <div>
            <p>
              Less fitting everything in.
              <br />
              More being where you are.
            </p>
            <p>
              Find places that feel like you. Bring the stays, the journeys and
              the days into one plan. Leave space for the unexpected.
            </p>
          </div>
        </section>
        <section className="sw-feeling" id="feeling">
          <div className="sw-feeling-copy">
            <span className="sw-section-note">
              Begin with what you’re drawn to.
            </span>
            <h2>
              Follow a feeling.
              <br />
              Find your place.
            </h2>
            <div
              className="sw-mood-list"
              role="group"
              aria-label="Explore travel moods"
            >
              {moods.map((m, i) => (
                <button
                  key={m.name}
                  aria-pressed={mood === i}
                  onClick={() => setMood(i)}
                >
                  <span>{m.name}</span>
                  <Arrow />
                </button>
              ))}
            </div>
            <p className="sw-mood-description" aria-live="polite">
              {moods[mood].description}
            </p>
            <button
              className="sw-save"
              aria-pressed={saved.includes(mood)}
              onClick={() =>
                setSaved((s) =>
                  s.includes(mood) ? s.filter((x) => x !== mood) : [...s, mood],
                )
              }
            >
              <span aria-hidden="true">{saved.includes(mood) ? "✓" : "+"}</span>
              {saved.includes(mood)
                ? "Saved to this daydream"
                : "Keep this feeling"}
            </button>
            <small aria-live="polite">
              {saved.length
                ? `${saved.length} ${saved.length === 1 ? "idea" : "ideas"} saved in this sample.`
                : "You can decide on the destination later."}
            </small>
          </div>
          <figure className="sw-mood-picture">
            <div className="sw-mood-crop">
              <NatureScene kind={moods[mood].scene} label={moods[mood].alt} />
              <span className="sw-photo-corner" aria-hidden="true">
                ✧
              </span>
            </div>
            <figcaption>
              <span>{moods[mood].line}</span>
              <small>
                An illustrated daydream, not a destination photograph.
              </small>
            </figcaption>
          </figure>
        </section>
        <section className="sw-stay-story">
          <figure>
            <NatureScene
              kind="inn"
              label="Code-drawn garden guesthouse with a gently moving curtain, veranda tea and flowers"
            />
            <figcaption>A place to arrive. A reason to stay.</figcaption>
          </figure>
          <div>
            <span className="sw-section-note">
              The small things make the stay.
            </span>
            <h2>
              A window open.
              <br />A morning
              <br />
              left unplanned.
            </h2>
            <p>
              The place you sleep shapes the place you experience. Keep the
              location, the nights and the little practical details beside the
              things you came for.
            </p>
            <a href="#journey" className="sw-stay-link">
              Bring the stay into the journey <Arrow diagonal />
            </a>
            <div className="sw-stay-details">
              <span>Somewhere to rest</span>
              <p>Compare stays by location and allowance.</p>
              <span>Somewhere to explore</span>
              <p>Keep saved places close to the days they fit.</p>
            </div>
          </div>
        </section>
        <section className="sw-bridge">
          <p>The feeling is the beginning.</p>
          <h2>
            The rest can
            <br />
            find its rhythm.
          </h2>
          <span>
            Somewhere to stay. A way to get there.
            <br />
            Days with a little room between them.
          </span>
        </section>
        <section className="sw-journey" id="journey">
          <div className="sw-journey-top">
            <div>
              <span className="sw-section-note">A journey taking shape</span>
              <h2>
                A few dots.
                <br />
                One lovely thread.
              </h2>
            </div>
            <p>
              Connect more than a destination.
              <br />
              Keep your places, nights and journeys together, with the important
              details in view.
            </p>
          </div>
          <div className="sw-workspace">
            <div className="sw-workspace-header">
              <span>A little time in Himachal</span>
              <span>
                Sample journey{" "}
                <span className="sw-open-date">Dates still open</span>
              </span>
            </div>
            <div className="sw-workspace-body">
              <Topography active={stop} onSelect={setStop} />
              <div className="sw-destination">
                <div
                  className="sw-stop-tabs"
                  role="group"
                  aria-label="Inspect a destination"
                >
                  {stops.map((s, i) => (
                    <button
                      key={s.name}
                      aria-pressed={stop === i}
                      onClick={() => setStop(i)}
                    >
                      {s.name}
                      <span>{nights[i]} nights</span>
                    </button>
                  ))}
                </div>
                <div className="sw-destination-heading">
                  <div>
                    <span>{chosen.subtitle}</span>
                    <h3>{chosen.name}</h3>
                  </div>
                  <div className="sw-night-control">
                    <button
                      aria-label={`Fewer nights in ${chosen.name}`}
                      disabled={nights[stop] === 1}
                      onClick={() =>
                        setNights((ns) =>
                          ns.map((n, i) =>
                            i === stop ? Math.max(1, n - 1) : n,
                          ),
                        )
                      }
                    >
                      −
                    </button>
                    <span aria-live="polite">{nights[stop]} nights</span>
                    <button
                      aria-label={`More nights in ${chosen.name}`}
                      onClick={() =>
                        setNights((ns) =>
                          ns.map((n, i) => (i === stop ? n + 1 : n)),
                        )
                      }
                    >
                      +
                    </button>
                  </div>
                </div>
                <p className="sw-place-note">{chosen.note}</p>
                <div
                  className="sw-detail-tabs"
                  role="group"
                  aria-label="Inspect planning details"
                >
                  {(["stay", "travel", "budget"] as const).map((d) => (
                    <button
                      key={d}
                      aria-pressed={detail === d}
                      onClick={() => setDetail(d)}
                    >
                      {d === "stay"
                        ? "A place to stay"
                        : d === "travel"
                          ? "Getting there"
                          : "The spending"}
                    </button>
                  ))}
                </div>
                <div
                  className="sw-detail-content"
                  aria-live="polite"
                  key={`${detail}-${stop}`}
                >
                  {detail === "stay" ? (
                    <>
                      <span className="sw-detail-icon" aria-hidden="true">
                        ⌂
                      </span>
                      <h4>{chosen.stay}</h4>
                      <p>
                        Close enough to the things you came for. Quiet enough to
                        enjoy doing less.
                      </p>
                      <div className="sw-detail-foot">
                        <span>Stay allowance</span>
                        <b>₹{chosen.rate.toLocaleString("en-IN")} / night</b>
                      </div>
                      <small>
                        Example allowance. Compare location, rates and
                        availability for your dates.
                      </small>
                    </>
                  ) : detail === "travel" ? (
                    <>
                      <span className="sw-detail-icon" aria-hidden="true">
                        ↝
                      </span>
                      <h4>A journey between the good bits.</h4>
                      <p>{chosen.travel}</p>
                      <div className="sw-detail-foot">
                        <span>Travel allowance for the whole route</span>
                        <b>₹3,500</b>
                      </div>
                      <small>
                        Indicative budget only. Schedules, transfer times and
                        supplier prices are unconfirmed.
                      </small>
                    </>
                  ) : (
                    <>
                      <h4>A clear view of the little costs.</h4>
                      <dl>
                        {stops.map((s, i) => (
                          <div key={s.name}>
                            <dt>
                              {s.name} · {nights[i]} nights
                            </dt>
                            <dd>
                              ₹{(nights[i] * s.rate).toLocaleString("en-IN")}
                            </dd>
                          </div>
                        ))}
                        <div>
                          <dt>Travel allowance</dt>
                          <dd>₹3,500</dd>
                        </div>
                        <div className="sw-budget-total">
                          <dt>Estimated subtotal</dt>
                          <dd>₹{total.toLocaleString("en-IN")}</dd>
                        </div>
                      </dl>
                      <small>
                        Illustrative allowances. Food, activities, taxes and
                        fees are still unpriced.
                      </small>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="sw-workspace-bottom">
              <span>Room for a longer stay. Room to change your mind.</span>
              <a href="/trips/new">
                Start my own journey <Arrow diagonal />
              </a>
            </div>
          </div>
          <div className="sw-journey-footnote">
            <span>Good plans leave a little unscheduled.</span>
            <small>Interactive preview. Travel details are examples.</small>
          </div>
        </section>
        <section
          className={`sw-weather ${rain ? "sw-weather-rain" : ""}`}
          id="changes"
        >
          <div className="sw-weather-intro">
            <span className="sw-section-note">
              Life happens between the plans.
            </span>
            <h2>
              New weather.
              <br />
              Still your day.
            </h2>
            <p>
              When the weather shifts, a transfer runs late or you just want to
              slow down, explore a different day. Keep the things that matter.
            </p>
            <figure className="sw-rain-illustration">
              <NatureScene
                kind="rain"
                label="Code-drawn café window with moving rain outside and rising steam from a cup of chai"
              />
              <figcaption>Another kind of good afternoon.</figcaption>
            </figure>
            <button
              className="sw-weather-toggle"
              onClick={() => {
                setRain((r) => !r);
                setAccepted(false);
              }}
            >
              <span aria-hidden="true">{rain ? "☀" : "☂"}</span>
              {rain ? "Bring back the clear skies" : "What if it rains?"}
              <Arrow />
            </button>
          </div>
          <div className="sw-afternoon">
            <div className="sw-afternoon-top">
              <span>Your afternoon, in Bir</span>
              <span className="sw-weather-label">
                {rain ? "Passing rain" : "Clear skies"}
              </span>
            </div>
            <div className={`sw-activity ${rain ? "sw-activity-old" : ""}`}>
              <span className="sw-time">14:00</span>
              <div>
                <h3>A walk into the valley</h3>
                <p>Take the trail. Stop wherever the view asks you to.</p>
              </div>
              <span className="sw-activity-mark" aria-hidden="true">
                {rain ? "−" : "○"}
              </span>
            </div>
            {rain && (
              <div className="sw-activity sw-activity-new">
                <span className="sw-time">14:30</span>
                <div>
                  <span className="sw-alternative-label">
                    {accepted
                      ? "Accepted in this preview"
                      : "A little change to consider"}
                  </span>
                  <h3>Art, then a long cup of chai</h3>
                  <p>
                    A gallery nearby, with time to sit and wait out the weather.
                  </p>
                  <small>
                    +₹300 illustrative entry allowance; opening hours to check.
                  </small>
                </div>
                <span className="sw-activity-mark" aria-hidden="true">
                  {accepted ? "✓" : "+"}
                </span>
              </div>
            )}
            <div className="sw-activity sw-activity-fixed">
              <span className="sw-time">20:00</span>
              <div>
                <h3>Dinner with a friend</h3>
                <p>Right where you left it.</p>
              </div>
              <span className="sw-fixed-label">
                <svg
                  width="13"
                  height="14"
                  viewBox="0 0 13 14"
                  aria-hidden="true"
                  fill="none"
                >
                  <rect
                    x="2"
                    y="6"
                    width="9"
                    height="7"
                    rx="1"
                    stroke="currentColor"
                  />
                  <path d="M4 6V3a2.5 2.5 0 0 1 5 0v3" stroke="currentColor" />
                </svg>
                Fixed
              </span>
            </div>
            <div className="sw-afternoon-bottom" aria-live="polite">
              <p>
                {accepted
                  ? "A new afternoon. The rest of your day stays yours."
                  : rain
                    ? "Review the alternative. Your plans only change when you choose."
                    : "A good afternoon, with a little room for the unexpected."}
              </p>
              {rain && (
                <button
                  className="sw-button sw-dark"
                  disabled={accepted}
                  onClick={() => setAccepted(true)}
                >
                  {accepted ? "Alternative accepted" : "Keep this afternoon"}
                  <span aria-hidden="true">{accepted ? "✓" : <Arrow />}</span>
                </button>
              )}
            </div>
          </div>
        </section>
        <section className="sw-questions">
          <div>
            <span className="sw-section-note">
              A little clarity before you go.
            </span>
            <h2>
              Not everything
              <br />
              needs figuring out
              <br />
              all at once.
            </h2>
          </div>
          <div>
            <details>
              <summary>
                What if I don’t have dates yet?<span>+</span>
              </summary>
              <p>
                Start with places and a rough duration. Research, collect ideas
                and sketch a route. Availability and forecasts need dates, so
                those details come later.
              </p>
            </details>
            <details>
              <summary>
                Can my trip have more than one destination?<span>+</span>
              </summary>
              <p>
                Yes. Add multiple stops, reorder them and decide how long to
                stay at each. Travel between the stops belongs in the same
                itinerary.
              </p>
            </details>
            <details>
              <summary>
                Will a new plan change my bookings?<span>+</span>
              </summary>
              <p>
                No. You review and accept suggestions. Fixed commitments remain
                visible, and changing or cancelling supplier reservations is
                always a separate action for you.
              </p>
            </details>
            <details>
              <summary>
                Can I leave some days open?<span>+</span>
              </summary>
              <p>
                Absolutely. An unscheduled afternoon is a valid part of a trip.
                Keep ideas nearby without putting every one of them on the
                clock.
              </p>
            </details>
          </div>
        </section>
        <section className="sw-closing">
          <div className="sw-closing-picture">
            <NatureScene
              kind="coast"
              label="Code-drawn coastal cove with flowing water, moving grass and a small cottage"
            />
          </div>
          <div className="sw-closing-copy">
            <Mark />
            <span>Somewhere, a different day is waiting.</span>
            <h2>
              Make a little
              <br />
              room for away.
            </h2>
            <p>
              The places will be there.
              <br />
              Give yourself the time to be there, too.
            </p>
            <a href="/trips/new" className="sw-button sw-light">
              Begin my journey <Arrow />
            </a>
            <a href="/trips/demo" className="sw-closing-demo">
              Or explore a sample trip
            </a>
          </div>
        </section>
        <footer className="sw-footer">
          <a href="/design/stillwater" className="sw-brand">
            <Mark />
            elsewhere.
          </a>
          <span>A little further from the everyday.</span>
          <nav aria-label="More design explorations">
            <a href="/design/options">All designs</a>
            <a href="/design/sketches">Pencil collection</a>
          </nav>
          <small>
            Interactive design concept. Scenery drawn in the frontend; travel
            details are illustrative.
          </small>
        </footer>
      </main>
    </SceneMotionProvider>
  );
}
