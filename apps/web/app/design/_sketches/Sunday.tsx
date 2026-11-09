"use client";
import { useState } from "react";
import { Header, Footer, Start, Questions } from "./Common";
import { HeroArt, Drawing, Cup, Person } from "./Art";
import "./sketches.css";
export default function Sunday() {
  const [pace, setPace] = useState(2);
  const [packed, setPacked] = useState<string[]>(["A good book"]);
  const [nights, setNights] = useState(3);
  const [stay, setStay] = useState<"simple" | "view">("simple");
  const [rain, setRain] = useState(false);
  const activities = [
    "A slow breakfast",
    "A walk by the water",
    "A little old-town exploring",
    "A gallery visit",
  ];
  return (
    <main className="sx sx-sunday">
      <Header label="Sunday" cta="Make time for away" />
      <section className="su-hero">
        <div>
          <span className="sx-note">Permission to do a little less.</span>
          <h1>
            Out of office.
            <br />
            Into absolutely
            <br />
            no hurry.
          </h1>
          <p>
            A place you want to be.
            <br />A plan that lets you actually be there.
          </p>
          <a className="sx-button sx-solid" href="#afternoon">
            Find my slower days
          </a>
        </div>
        <HeroArt kind="sunday" />
        <div className="su-horizon">
          <span>A trip can be full of things.</span>
          <span className="sx-note">Or full of this feeling.</span>
        </div>
      </section>
      <section className="su-afternoon sx-section" id="afternoon">
        <div>
          <span className="sx-note">Let’s start with your kind of day.</span>
          <h2>
            How much nothing
            <br />
            sounds about right?
          </h2>
          <p>
            There’s no prize for the fullest itinerary. Set your pace; the plan
            should leave room to match.
          </p>
          <label className="su-slider">
            Nothing booked{" "}
            <input
              aria-label="Number of planned activities"
              type="range"
              min="0"
              max="4"
              value={pace}
              onChange={(e) => setPace(Number(e.target.value))}
            />
            <span>A few gentle plans</span>
          </label>
          <p className="sx-note su-pace-note" aria-live="polite">
            {pace === 0
              ? "The whole afternoon is a beautiful blank."
              : pace === 4
                ? "A curious day, with a little room between the good bits."
                : `${pace} gentle ${pace === 1 ? "plan" : "plans"}. Plenty of room to wander.`}
          </p>
        </div>
        <div className="su-clock">
          <div className="su-clock-face">
            <span className="su-clock-twelve">12</span>
            <span className="su-clock-three">3</span>
            <span className="su-clock-six">6</span>
            <span className="su-clock-nine">9</span>
            <div
              className="su-clock-wedge"
              style={{ transform: `rotate(${pace * 30 - 60}deg)` }}
            />
            <div className="su-clock-center">
              <Drawing
                viewBox="0 0 130 135"
                label="A coffee with time to enjoy it"
              >
                <Cup />
              </Drawing>
              <span className="sx-note">time, on your side.</span>
            </div>
          </div>
          <span className="su-clock-label sx-note">
            an afternoon, loosely speaking.
          </span>
        </div>
      </section>
      <section className="su-day-strip sx-section">
        <div>
          <h3>Here’s how that could feel.</h3>
          <span className="sx-note">A sample day in Udaipur</span>
        </div>
        <div className="su-day-items" aria-live="polite">
          {activities.slice(0, pace).map((a, i) => (
            <article key={a}>
              <span>{["09:30", "11:00", "14:00", "16:00"][i]}</span>
              <strong>{a}</strong>
            </article>
          ))}
          <article className="su-free-time">
            <span>{pace === 0 ? "All afternoon" : "Between the plans"}</span>
            <strong>Whatever you feel like.</strong>
            <small>Then dinner at 20:00, kept fixed.</small>
          </article>
        </div>
      </section>
      <section className="su-picnic sx-section">
        <div className="su-picnic-art">
          <Drawing label="A sketched picnic blanket with a book, coffee and a contented resting traveler">
            <path d="m61 151 378-29 95 299-416 24Z" fill="var(--sx-blue)" />
            <path
              d="M95 165 158 428m10-270 64 264m8-272 65 267m8-272 65 267m10-272 65 267M86 214l376-25M99 267l379-25M113 319l383-25M126 373l388-27"
              opacity=".3"
            />
            <Person x={122} y={252} rest scale={1.2} />
            <Cup x={385} y={275} scale={0.75} />
            <path d="m343 177 68-9 12 71-67 9Z" fill="var(--sx-paper)" />
            <path d="m355 191 43-7m-41 18 43-7m-41 18 43-7" />
            <text x="68" y="83" className="sx-svg-hand">
              Less to carry. More to look forward to.
            </text>
          </Drawing>
        </div>
        <div>
          <h2>
            Bring the essentials.
            <br />
            Leave the rush.
          </h2>
          <p>
            What makes your kind of break? Keep your interests in the plan, even
            when you’re doing less.
          </p>
          <div className="su-checks">
            {[
              "A good book",
              "Somewhere to wander",
              "Coffee without a takeaway lid",
              "Absolutely no early alarm",
            ].map((s) => (
              <label key={s}>
                <input
                  type="checkbox"
                  checked={packed.includes(s)}
                  onChange={() =>
                    setPacked((p) =>
                      p.includes(s) ? p.filter((x) => x !== s) : [...p, s],
                    )
                  }
                />
                <span>{s}</span>
              </label>
            ))}
          </div>
          <span className="sx-note" aria-live="polite">
            {packed.length} little{" "}
            {packed.length === 1 ? "pleasure" : "pleasures"} on your sample
            list.
          </span>
        </div>
      </section>
      <section className="su-receipt-section sx-section">
        <div>
          <span className="sx-note">The practical side of taking it easy.</span>
          <h2>
            Keep the costs clear.
            <br />
            The mornings open.
          </h2>
          <p>
            Connect the stay, the travel and the nights. Know what you’ve
            allowed for, and what still needs pricing.
          </p>
          <div
            className="su-stay-options"
            role="group"
            aria-label="Choose a sample stay allowance"
          >
            <button
              aria-pressed={stay === "simple"}
              onClick={() => setStay("simple")}
            >
              A simple little room<small>₹1,600 / night allowance</small>
            </button>
            <button
              aria-pressed={stay === "view"}
              onClick={() => setStay("view")}
            >
              A room with a view<small>₹2,400 / night allowance</small>
            </button>
          </div>
        </div>
        <div className="su-receipt">
          <span className="sx-note">A little Udaipur escape</span>
          <h3>No rush. A rough budget.</h3>
          <div className="sx-stepper">
            <button
              aria-label="Fewer nights"
              disabled={nights === 1}
              onClick={() => setNights((n) => n - 1)}
            >
              −
            </button>
            <span aria-live="polite">{nights} nights</span>
            <button
              aria-label="More nights"
              onClick={() => setNights((n) => n + 1)}
            >
              +
            </button>
          </div>
          <dl>
            <div>
              <dt>Stay allowance</dt>
              <dd>
                ₹
                {(nights * (stay === "simple" ? 1600 : 2400)).toLocaleString(
                  "en-IN",
                )}
              </dd>
            </div>
            <div>
              <dt>Train + transfers allowance</dt>
              <dd>₹2,000</dd>
            </div>
            <div className="su-receipt-total">
              <dt>Estimated subtotal</dt>
              <dd aria-live="polite">
                ₹
                {(
                  nights * (stay === "simple" ? 1600 : 2400) +
                  2000
                ).toLocaleString("en-IN")}
              </dd>
            </div>
          </dl>
          <p>
            Illustrative allowances, not supplier quotes. Food, activities,
            taxes and fees remain unpriced.
          </p>
          <span className="sx-note">Room for you. And a little extra.</span>
        </div>
      </section>
      <section className="su-rain sx-section">
        <h2>
          Even a slower day
          <br />
          can change its mind.
        </h2>
        <div>
          <p>
            {rain
              ? "Rain at the lake? Stay in for a gallery and coffee. Dinner at 20:00 stays fixed."
              : "A walk by the lake is pencilled in. But the afternoon doesn’t have to depend on sunshine."}
          </p>
          <button className="sx-button" onClick={() => setRain((r) => !r)}>
            {rain
              ? "Restore the lakeside walk"
              : "See the rainy-day alternative"}
          </button>
          <small>Example alternative for you to review.</small>
        </div>
      </section>
      <Questions />
      <Start title="A little time, entirely your own." />
      <Footer current="sunday" />
    </main>
  );
}
