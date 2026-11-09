"use client";
import { useState } from "react";
import { Header, Footer, Start, places, Questions } from "./Common";
import { HeroArt, Drawing, Peaks, Sea, Town, Sun } from "./Art";
import "./sketches.css";
export default function BlueHour() {
  const [route, setRoute] = useState<number[]>([0]);
  const [focus, setFocus] = useState(0);
  const [rain, setRain] = useState(false);
  const [accepted, setAccepted] = useState(false);
  function choose(i: number) {
    setRoute((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]));
    setFocus(i);
  }
  return (
    <main className="sx sx-bluehour">
      <Header label="Blue Hour" cta="Chart my journey" />
      <section className="bh-hero">
        <div>
          <span className="sx-note">The world is still out there.</span>
          <h1>
            You could be
            <br />
            somewhere
            <br />
            under this sky.
          </h1>
          <p>
            Follow a little curiosity. Connect the places. Make room for
            everything you haven’t planned yet.
          </p>
          <a className="sx-button" href="#chart">
            Find my coordinates
          </a>
        </div>
        <HeroArt kind="night" />
        <div className="bh-hero-bottom">
          <span>A little less screen time. A little more sky.</span>
          <span className="sx-note">Draw your own constellation. ↓</span>
        </div>
      </section>
      <section className="bh-chart sx-section" id="chart">
        <div className="bh-section-head">
          <h2>
            Places become
            <br />a constellation.
          </h2>
          <p>
            Select the places you’re drawn to.
            <br />
            Your first marks don’t have to be final.
          </p>
        </div>
        <div className="bh-chart-map">
          <Drawing
            viewBox="0 0 1000 430"
            label="An imaginary travel atlas connecting selected mountain, coast and city ideas"
          >
            <path
              d="M80 270q160-330 520-166t330 93M70 359Q335 95 920 313M210 34q-21 278 305 379M560 11q-16 227 158 388"
              opacity=".2"
            />
            <Peaks x={75} y={78} scale={0.68} />
            <Sea x={380} y={113} scale={0.68} />
            <Town x={710} y={75} scale={0.68} />
            {route.length > 1 && (
              <polyline
                className="bh-chart-line"
                points={route
                  .map((i) => `${[200, 500, 820][i]},${[300, 335, 280][i]}`)
                  .join(" ")}
                stroke="var(--sx-yellow)"
                strokeWidth="3"
                strokeDasharray="5 10"
              />
            )}
            {[0, 1, 2].map((i) => (
              <g key={i}>
                <circle
                  cx={[200, 500, 820][i]}
                  cy={[300, 335, 280][i]}
                  r={route.includes(i) ? 12 : 6}
                  fill={route.includes(i) ? "var(--sx-yellow)" : "none"}
                />
              </g>
            ))}
          </Drawing>
          <div
            className="bh-map-controls"
            role="group"
            aria-label="Plot destinations"
          >
            {places.map((p, i) => (
              <button
                key={p.name}
                aria-pressed={route.includes(i)}
                onClick={() => choose(i)}
              >
                <span>{route.includes(i) ? "✦" : "+"}</span>
                {p.name}
                <small>{p.feeling}</small>
              </button>
            ))}
          </div>
        </div>
        <div className="bh-route-status" aria-live="polite">
          <span className="sx-note">
            {route.length
              ? route.map((i) => places[i].name).join(" ⤳ ")
              : "A blank sky. Pick a first place."}
          </span>
          <p>
            Discovery sketch; compare distances and travel times before
            connecting far-apart stops.
          </p>
        </div>
      </section>
      <section className="bh-manifest sx-section">
        <div>
          <span className="sx-note">And when the sun comes up…</span>
          <h2>
            A daydream,
            <br />
            with the details.
          </h2>
          <p>
            The best routes work on the ground, too. Research the place, choose
            a stay and see how you’ll get there.
          </p>
          <div
            className="bh-tabs"
            role="group"
            aria-label="Inspect destination details"
          >
            {places.map((p, i) => (
              <button
                key={p.name}
                aria-pressed={focus === i}
                onClick={() => setFocus(i)}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
        <div className="bh-manifest-paper" key={focus} aria-live="polite">
          <span className="sx-note">Notes for {places[focus].region}</span>
          <h3>{places[focus].name}</h3>
          <dl>
            <div>
              <dt>A place to sleep</dt>
              <dd>{places[focus].stay}</dd>
            </div>
            <div>
              <dt>A way to get there</dt>
              <dd>{places[focus].travel}</dd>
            </div>
            <div>
              <dt>A little research</dt>
              <dd>{places[focus].note}</dd>
            </div>
          </dl>
          <p>Dates still open. Rates and schedules still to check.</p>
          <span className="bh-paper-star" aria-hidden="true">
            ✧
          </span>
        </div>
      </section>
      <section className="bh-weather sx-section">
        <div className="bh-weather-art">
          <Drawing label="A cloud passing over a pencil sun">
            <Sun x={270} y={183} r={70} />
            <path
              d="M148 268q-32-61 30-79 5-70 78-45 41-49 83-1 80-6 64 76 63 56-25 68H170Z"
              fill="var(--sx-base)"
            />
            {rain &&
              [180, 230, 280, 330, 380].map((x) => (
                <path key={x} d={`m${x} 320-12 25`} />
              ))}
            <text x="144" y="392" className="sx-svg-hand">
              Clouds are allowed to change their minds.
            </text>
          </Drawing>
        </div>
        <div>
          <h2>
            A change in the sky.
            <br />A change in the plan.
          </h2>
          <p>
            Keep your commitments. Review a new afternoon. You choose which
            version becomes your trip.
          </p>
          <div className="bh-weather-plan" aria-live="polite">
            <span>
              {rain
                ? "14:30 · A museum close to your stay"
                : "14:00 · A walk through the old town"}
            </span>
            <span>20:00 · Dinner remains fixed</span>
            <small>
              {accepted
                ? "Alternative accepted in this sample."
                : rain
                  ? "A proposed alternative; +₹300 indicative entry allowance."
                  : "Original afternoon. The sky is looking good."}
            </small>
          </div>
          <button
            className="sx-button"
            onClick={() => {
              setRain((r) => !r);
              setAccepted(false);
            }}
          >
            {rain ? "Restore the original" : "What if it rains?"}
          </button>
          {rain && !accepted && (
            <button
              className="sx-button bh-accept"
              onClick={() => setAccepted(true)}
            >
              Accept this sample change
            </button>
          )}
        </div>
      </section>
      <Questions />
      <Start title="A new set of coordinates." />
      <Footer current="blue-hour" />
    </main>
  );
}
