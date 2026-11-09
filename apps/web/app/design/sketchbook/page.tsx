"use client";

import { useState } from "react";
import {
  FoldedMap,
  LandscapeStrip,
  MarginTrail,
  PencilDefs,
  SunDoodle,
  Traveler,
  UmbrellaScene,
} from "./SketchArt";
import "./sketchbook.css";

const feelings = [
  {
    name: "Mountain mornings",
    note: "A little altitude. A lot less hurry.",
    route: ["Delhi", "Manali", "Kasol"],
  },
  {
    name: "Salt in the air",
    note: "A coastline and nowhere to rush.",
    route: ["Mumbai", "Goa", "Gokarna"],
  },
  {
    name: "Streets I haven’t met",
    note: "Get a little lost. Find a very good lunch.",
    route: ["Delhi", "Jaipur", "Udaipur"],
  },
];
const money = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const questions = [
  {
    q: "Can I start with absolutely no plan?",
    a: "Yes. Start with a feeling, a shortlist, or a destination. Dates can be tentative. Date-specific prices and forecasts need enough information before they can be checked.",
  },
  {
    q: "More than one place? More than a week?",
    a: "Both. Add destinations, change the order, stay longer, and leave free days. Your trip doesn’t need to fit a fixed destination count or a seven-day template.",
  },
  {
    q: "Will it change things I’ve already booked?",
    a: "No. Existing reservations and fixed times remain visible. The planner proposes alternatives for you to accept; reservation changes stay with you and the provider.",
  },
  {
    q: "Where does the information come from?",
    a: "The planned experience uses available provider data, source links and attributed review samples. Estimates and gaps stay labeled. This landing-page sketch uses examples, without live offers or real traveler reviews.",
  },
];

export default function Sketchbook() {
  const [still, setStill] = useState(false);
  const [hello, setHello] = useState(false);
  const [feeling, setFeeling] = useState(0);
  const [saved, setSaved] = useState<string[]>([]);
  const [tab, setTab] = useState("The route");
  const [nights, setNights] = useState([2, 3]);
  const [reverse, setReverse] = useState(false);
  const [rate, setRate] = useState(2400);
  const [transfer, setTransfer] = useState(4800);
  const [revision, setRevision] = useState<0 | 1 | 2>(0);
  const [pace, setPace] = useState(45);
  const f = feelings[feeling];
  const places = reverse ? [f.route[2], f.route[1]] : [f.route[1], f.route[2]];
  const totalNights = nights.reduce((a, b) => a + b, 0);
  const stayCost = totalNights * rate;
  const freeHours = Math.round((100 - pace) * 0.08);
  const save = () =>
    setSaved((s) =>
      s.includes(f.name) ? s.filter((v) => v !== f.name) : [...s, f.name],
    );

  return (
    <main className={`sketchbook${still ? " sk-still" : ""}`}>
      <PencilDefs />
      <div className="sk-paper-grain" aria-hidden="true" />
      <a className="sk-skip" href="#sk-explore">
        Skip to the possibilities
      </a>
      <header className="sk-header">
        <a className="sk-brand" href="/design/options">
          elsewhere<span aria-hidden="true">✳</span>
        </a>
        <nav aria-label="Sketchbook navigation">
          <a href="#sk-planner">A little plan</a>
          <a href="#sk-changes">A little flexibility</a>
        </nav>
        <a className="sk-button sk-nav-button" href="/trips/new">
          Let’s go somewhere <span aria-hidden="true">↗</span>
        </a>
      </header>
      <section className="sk-hero">
        <div className="sk-hero-copy">
          <span className="sk-hand-note sk-first-note">
            for the days that need a little different.
          </span>
          <h1>
            A little out
            <br />
            of the ordinary.
          </h1>
          <p>
            A few places you’d love to be.
            <br />A plan that leaves room to actually be there.
          </p>
          <a className="sk-button sk-blue-button" href="#sk-explore">
            Find my kind of away <span aria-hidden="true">↗</span>
          </a>
          <div className="sk-hero-aside">
            <svg viewBox="0 0 70 50" aria-hidden="true">
              <path d="M61 6Q15 1 18 33 M8 23l10 14 11-13" />
            </svg>
            <span className="sk-hand-note">no 47 open tabs required.</span>
          </div>
        </div>
        <div className="sk-hero-drawing">
          <FoldedMap />
          <button
            className="sk-hello"
            aria-label="Psst, say hello to the resting traveler"
            aria-expanded={hello}
            onClick={() => setHello((h) => !h)}
          >
            <span className="sk-hand-note">
              psst. click the expert
              <br />
              in doing nothing.
            </span>
            <svg viewBox="0 0 70 65" aria-hidden="true">
              <path d="M52 4q-38 1-29 39 M12 34l13 13 11-14" />
            </svg>
          </button>
          {hello ? (
            <div className="sk-hello-note" role="status">
              Shhh.
              <span>
                Very important doing-nothing
                <br />
                in progress.
              </span>
              <button
                aria-label="Close the traveler’s note"
                onClick={() => setHello(false)}
              >
                ×
              </button>
            </div>
          ) : null}
        </div>
        <div className="sk-hero-bottom">
          <p>Somewhere to go. Some room to change your mind.</p>
          <a href="#sk-explore">
            Let’s join a few dots <span aria-hidden="true">↓</span>
          </a>
        </div>
      </section>
      <div className="sk-section-seam" aria-hidden="true">
        <MarginTrail />
      </div>
      <section className="sk-explore sk-section" id="sk-explore">
        <div className="sk-explore-heading">
          <div>
            <span className="sk-hand-note">First, a little curiosity.</span>
            <h2>What makes you go “ooh”?</h2>
          </div>
          <p>
            Start with a feeling. Keep a few possibilities.
            <br />
            The dates and the details can come later.
          </p>
        </div>
        <div className="sk-landscape-choices">
          <LandscapeStrip active={feeling} />
          <div
            className="sk-feeling-buttons"
            aria-label="Choose a travel feeling"
          >
            {feelings.map((x, i) => (
              <button
                key={x.name}
                aria-pressed={feeling === i}
                onClick={() => {
                  setFeeling(i);
                  setReverse(false);
                }}
              >
                <span className="sk-choice-dot" aria-hidden="true">
                  {feeling === i ? "✓" : ""}
                </span>
                {x.name}
                <svg
                  className="sk-choice-circle"
                  viewBox="0 0 300 60"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <path d="M284 10Q139-7 16 9-3 31 19 48q134 14 263-2 20-15 2-36Z" />
                </svg>
              </button>
            ))}
          </div>
        </div>
        <div className="sk-feeling-result">
          <div aria-live="polite">
            <strong>{f.name}.</strong>
            <span className="sk-hand-note">{f.note}</span>
          </div>
          <button
            className="sk-button"
            aria-pressed={saved.includes(f.name)}
            onClick={save}
          >
            {saved.includes(f.name)
              ? "Pinned for this visit ✓"
              : "Put a pin in it +"}
          </button>
        </div>
        <div className="sk-pinned" aria-live="polite">
          <span>
            {saved.length
              ? `${saved.length} ${saved.length === 1 ? "possibility" : "possibilities"} pinned: ${saved.join(" / ")}.`
              : "A shortlist is a perfectly good place to begin."}
          </span>
          <small>
            Illustrated inspiration. You’re choosing a feeling, not a travel
            offer.
          </small>
        </div>
        <details className="sk-research-note">
          <summary>
            And when you want to look a little closer?<span>+</span>
          </summary>
          <p>
            Explore available opening hours, photos, source links and attributed
            review samples. Keep facts separate from estimates. Missing details
            stay unknown; AI summaries, when offered, are labeled and may
            contain mistakes.
          </p>
        </details>
      </section>
      <section className="sk-planning sk-section" id="sk-planner">
        <div className="sk-planning-copy">
          <span className="sk-hand-note">Now, a little shape.</span>
          <h2>
            A few maybes.
            <br />
            One actual plan.
          </h2>
          <p>
            The places, the stays, the getting-between-them. Keep the pieces
            together, without planning the life out of the trip.
          </p>
          <p>
            Multiple stops. Flexible dates.
            <br />
            Room for “let’s stay another night.”
          </p>
          <a href="/trips/new" className="sk-text-link">
            Start with your own places ↗
          </a>
          <div className="sk-margin-doodle">
            <svg viewBox="0 0 180 160" aria-hidden="true">
              <g className="sk-pencil-mark">
                <path
                  d="M32 13 135 22 125 145 22 136Z"
                  fill="#ececd8"
                  stroke="#293b53"
                  strokeWidth="1.5"
                />
                <path
                  d="m48 40 60 5 M47 53l48 4 M44 70l62 5 M42 86l49 4 M39 104l59 6"
                  fill="none"
                  stroke="#91a3b5"
                  strokeWidth="1.1"
                />
                <path
                  d="m124 92 23-66 9-8 2 12-24 67-12 12Z"
                  fill="#e5bc50"
                  stroke="#293b53"
                  strokeWidth="1.4"
                />
                <path d="m123 109 1-17 10 5Z" fill="#e9d2b2" stroke="#293b53" />
                <path d="m124 107 4-9 M147 27l10 4" stroke="#293b53" />
                <path
                  d="m35 122 8 5 14-12"
                  fill="none"
                  stroke="#5c8353"
                  strokeWidth="2"
                />
              </g>
            </svg>
            <span className="sk-hand-note">
              pencil it in.
              <br />
              nothing’s set in stone.
            </span>
          </div>
        </div>
        <div className="sk-notebook">
          <div className="sk-book-top">
            <span className="sk-hand-note">a little escape, taking shape</span>
            <span className="sk-book-clip" aria-hidden="true" />
          </div>
          <div
            className="sk-book-tabs"
            aria-label="Explore the planning notebook"
          >
            {["The route", "Stays", "Getting there", "The numbers"].map((t) => (
              <button
                key={t}
                aria-pressed={tab === t}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="sk-book-content" key={tab}>
            {tab === "The route" ? (
              <>
                <div className="sk-origin">
                  <span aria-hidden="true">○</span>
                  {f.route[0]} <small>where this one begins</small>
                </div>
                {places.map((city, i) => (
                  <div className="sk-route-stop" key={city}>
                    <div>
                      <span className="sk-route-mark" aria-hidden="true">
                        ✳
                      </span>
                      <h3>{city}</h3>
                      <small>
                        {i === 0 ? "A little exploring" : "A little lingering"}
                      </small>
                    </div>
                    <div className="sk-night-stepper">
                      <button
                        aria-label={`One fewer night in ${city}`}
                        disabled={nights[i] === 1}
                        onClick={() =>
                          setNights((n) =>
                            n.map((v, k) => (i === k ? v - 1 : v)),
                          )
                        }
                      >
                        −
                      </button>
                      <span>{nights[i]} nights</span>
                      <button
                        aria-label={`One more night in ${city}`}
                        onClick={() =>
                          setNights((n) =>
                            n.map((v, k) => (i === k ? v + 1 : v)),
                          )
                        }
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  className="sk-swap"
                  onClick={() => {
                    setReverse((r) => !r);
                    setNights((n) => [...n].reverse());
                  }}
                >
                  ⇅ What if we went the other way?
                </button>
                <p className="sk-small">
                  Changing the order affects connections and stays. This is an
                  outline; travel times still need checking.
                </p>
              </>
            ) : tab === "Stays" ? (
              <>
                <h3>Somewhere to wake up.</h3>
                <p>
                  A stay beside the right destination and nights. Existing
                  reservations can come along, too.
                </p>
                <div
                  className="sk-stay-options"
                  aria-label="Choose a sample stay allowance"
                >
                  {[
                    { label: "A simple little guesthouse", value: 1800 },
                    { label: "A little more comfort", value: 2400 },
                  ].map((r) => (
                    <button
                      key={r.value}
                      aria-pressed={rate === r.value}
                      onClick={() => setRate(r.value)}
                    >
                      <span>
                        {rate === r.value ? "✓" : "○"} {r.label}
                      </span>
                      <small>{money(r.value)} / room / night</small>
                    </button>
                  ))}
                </div>
                <span className="sk-hand-note sk-allowance">
                  {totalNights} nights, one room: {money(stayCost)}
                </span>
                <p className="sk-small">
                  Sample allowances for two sharing. No live availability,
                  property offer or reservation.
                </p>
              </>
            ) : tab === "Getting there" ? (
              <>
                <h3>The in-between bits count.</h3>
                <p>
                  Put transfers and local travel beside the days they belong to.
                  A beautiful itinerary still needs time to get there.
                </p>
                <div
                  className="sk-stay-options"
                  aria-label="Choose a sample transport allowance"
                >
                  {[
                    { label: "A slower bus connection", value: 2400 },
                    { label: "A private transfer", value: 4800 },
                  ].map((r) => (
                    <button
                      aria-pressed={transfer === r.value}
                      key={r.value}
                      onClick={() => setTransfer(r.value)}
                    >
                      <span>
                        {transfer === r.value ? "✓" : "○"} {r.label}
                      </span>
                      <small>{money(r.value)} illustrative allowance</small>
                    </button>
                  ))}
                </div>
                <p className="sk-small">
                  Actual route, schedules, duration and prices require a
                  provider check. Choosing an option here books nothing.
                </p>
              </>
            ) : (
              <>
                <h3>Less mental maths.</h3>
                <dl className="sk-money-list">
                  <div>
                    <dt>{totalNights} nights / one room</dt>
                    <dd>{money(stayCost)}</dd>
                  </div>
                  <div>
                    <dt>Travel allowance</dt>
                    <dd>{money(transfer)}</dd>
                  </div>
                  <div>
                    <dt>A few things to do</dt>
                    <dd>₹2,100</dd>
                  </div>
                </dl>
                <div className="sk-total">
                  <span>Estimated subtotal</span>
                  <strong>{money(stayCost + transfer + 2100)}</strong>
                </div>
                <p className="sk-small">
                  Food, taxes and fees are still unpriced. Estimates help
                  compare choices; they aren’t a promised final total.
                </p>
              </>
            )}
          </div>
          <div className="sk-book-bottom">
            <span>{totalNights} nights / dates still flexible</span>
            <span className="sk-hand-note">your trip. your handwriting.</span>
          </div>
        </div>
      </section>
      <section
        className={`sk-changes sk-section${revision ? " sk-it-rains" : ""}`}
        id="sk-changes"
      >
        <div className="sk-weather-illustration">
          <UmbrellaScene />
          <span className="sk-hand-note">
            the weather didn’t read the itinerary.
          </span>
        </div>
        <div className="sk-change-copy">
          <span className="sk-hand-note">And then, real life happens.</span>
          <h2>
            A little change
            <br />
            of plans.
          </h2>
          <p>
            Rain turns up. You’re running late. Or you’d rather take it slow.
            The trip can bend a little.
          </p>
          <div className="sk-afternoon" aria-live="polite">
            <div className={revision ? "sk-crossed-plan" : ""}>
              <time>14:00</time>
              <span>A wandering walk outdoors.</span>
              {revision ? <small>Cross this one out for now.</small> : null}
            </div>
            {revision ? (
              <div className="sk-new-plan">
                <time>14:30</time>
                <span>A museum, then a slow coffee.</span>
                <small>
                  {revision === 2
                    ? "Accepted in this sketch"
                    : "Proposed indoor alternative"}{" "}
                  / estimated +₹300
                </small>
                <svg
                  viewBox="0 0 380 12"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <path d="M2 8Q110 0 186 6T378 5" />
                </svg>
              </div>
            ) : null}
            <div className="sk-dinner">
              <time>20:00</time>
              <span>Dinner with a view.</span>
              <small>Keep this fixed. Dinner is important.</small>
              <svg
                viewBox="0 0 350 85"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <path d="M329 13Q157-8 19 9-11 39 20 70q144 21 309-3 30-27 0-54Z" />
              </svg>
            </div>
          </div>
          <div className="sk-change-actions">
            {revision === 0 ? (
              <button
                className="sk-button sk-blue-button"
                onClick={() => setRevision(1)}
              >
                Let it rain. Show me a plan. <span>☂</span>
              </button>
            ) : revision === 1 ? (
              <>
                <button
                  className="sk-button sk-blue-button"
                  onClick={() => setRevision(2)}
                >
                  Yes, pencil that in ✓
                </button>
                <button className="sk-text-link" onClick={() => setRevision(0)}>
                  Keep my original
                </button>
              </>
            ) : (
              <>
                <span className="sk-accepted">✓ Accepted in this sketch</span>
                <button className="sk-text-link" onClick={() => setRevision(0)}>
                  Undo that change
                </button>
              </>
            )}
          </div>
          <p className="sk-small">
            An illustrative afternoon, not a live forecast. You review every
            change. Supplier reservations are never changed automatically.
          </p>
        </div>
      </section>
      <section className="sk-pace sk-section">
        <div className="sk-pace-heading">
          <SunDoodle />
          <div>
            <span className="sk-hand-note">
              Something very important to plan.
            </span>
            <h2>A little absolutely nothing.</h2>
          </div>
        </div>
        <p>
          A slow breakfast. A longer lunch. Space for the place to surprise you.
          <br />
          An open afternoon is a choice, not an unfinished itinerary.
        </p>
        <div className="sk-pace-demo">
          <div className="sk-pace-ruler">
            <label htmlFor="sk-pace">How full should the day feel?</label>
            <input
              id="sk-pace"
              type="range"
              min="0"
              max="100"
              step="5"
              value={pace}
              onChange={(e) => setPace(Number(e.target.value))}
            />
            <div className="sk-ruler-ticks" aria-hidden="true">
              {Array.from({ length: 21 }, (_, i) => (
                <i key={i} />
              ))}
            </div>
            <div className="sk-pace-labels">
              <span className="sk-hand-note">more breathing room</span>
              <span className="sk-hand-note">more exploring</span>
            </div>
          </div>
          <div className="sk-pace-note" aria-live="polite" key={freeHours}>
            <span className="sk-hand-note">
              your afternoon, roughly speaking:
            </span>
            <strong>
              {freeHours >= 5
                ? "Nowhere you need to be."
                : freeHours >= 2
                  ? "A walk. A coffee. A little wandering."
                  : "A few more things to be curious about."}
            </strong>
            <p>
              Around {freeHours} of 8 daytime hours left open.
              <br />
              Dinner stays at eight, whichever pace you choose.
            </p>
          </div>
        </div>
      </section>
      <section className="sk-questions sk-section">
        <div>
          <span className="sk-hand-note">Before we wander off.</span>
          <h2>
            A few little
            <br />
            questions.
          </h2>
          <svg
            className="sk-question-arrow"
            viewBox="0 0 150 75"
            aria-hidden="true"
          >
            <path d="M5 18q70-42 123 23 M115 26l17 19-25 2" />
          </svg>
        </div>
        <div>
          {questions.map((q) => (
            <details key={q.q}>
              <summary>
                {q.q}
                <span>+</span>
              </summary>
              <p>{q.a}</p>
            </details>
          ))}
        </div>
      </section>
      <section className="sk-closing">
        <div className="sk-closing-drawing">
          <svg
            className="sk-closing-tree"
            viewBox="0 0 340 300"
            aria-hidden="true"
          >
            <g
              className="sk-pencil-mark"
              fill="none"
              stroke="#293b53"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <path
                d="M83 228 91 87 73 60 80 51 99 72 122 35 133 41 104 88 100 229"
                fill="#c9b899"
              />
              <path
                d="M62 100Q5 104 20 57 9 26 48 23 64-9 102 11q39-19 58 16 48-6 44 33 20 40-24 49-33 25-62-5-29 20-56-4Z"
                fill="#b9cbab"
              />
              <path
                d="M42 56q15-11 25 0 m54-19 13 9 m-11 25 21 2 m28-14 13 9 M90 103l-7 76 M29 232q94-15 208-4"
                opacity=".5"
              />
              <path d="m33 230 7-12 3 12 m123 1 5-10 5 9" stroke="#839c73" />
            </g>
          </svg>
          <Traveler />
          <span className="sk-hand-note">
            Right. Back to my extremely
            <br />
            busy afternoon.
          </span>
        </div>
        <div>
          <p className="sk-hand-note">A little maybe can go a long way.</p>
          <h2>
            Your next good story
            <br />
            starts somewhere.
          </h2>
          <a href="/trips/new" className="sk-button sk-blue-button">
            Find my elsewhere <span>↗</span>
          </a>
          <a href="/trips/demo" className="sk-text-link sk-demo-link">
            Or take a peek at a sample trip
          </a>
        </div>
      </section>
      <footer className="sk-footer">
        <a href="/design/options" className="sk-brand">
          elsewhere<span aria-hidden="true">✳</span>
        </a>
        <span>A little room for life.</span>
        <a href="/design/options">All the design explorations</a>
        <button aria-pressed={still} onClick={() => setStill((s) => !s)}>
          {still ? "Let the doodles move" : "Pause the doodles"}
        </button>
        <small>
          Interactive design sketch. Illustrations are imagination; itinerary
          details and costs are examples. No live offers, bookings or actual
          traveler reviews. Your choices reset when this page reloads.
        </small>
      </footer>
    </main>
  );
}
