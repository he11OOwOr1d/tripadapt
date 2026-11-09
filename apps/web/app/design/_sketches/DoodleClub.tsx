"use client";
import { useState } from "react";
import { Header, Footer, Start, places, Questions } from "./Common";
import { HeroArt, MiniArt, Drawing, Backpack } from "./Art";
import "./sketches.css";
export default function DoodleClub() {
  const [packed, setPacked] = useState<number[]>([]);
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState<string[]>(["A place to sleep"]);
  const [rain, setRain] = useState(false);
  function pack(i: number) {
    setPacked((p) => (p.includes(i) ? p.filter((n) => n !== i) : [...p, i]));
    setOpen(false);
  }
  return (
    <main className="sx sx-club">
      <Header label="Doodle Club" cta="Count me in" />
      <section className="dc-hero">
        <span className="dc-membership sx-note">
          No membership. Just a little curiosity.
        </span>
        <div className="dc-hero-grid">
          <div>
            <h1>
              Less blah.
              <br />
              More
              <br />
              “let’s go.”
            </h1>
            <p>
              A few saved places. One connected plan. A really good excuse to
              get out there.
            </p>
            <a className="sx-button sx-solid" href="#sticker-sheet">
              Find my happy place
            </a>
          </div>
          <HeroArt kind="club" />
        </div>
        <div className="dc-ticket">
          <span>Admit one very overdue break</span>
          <span className="sx-note">you’re on the list ☺</span>
        </div>
      </section>
      <section className="dc-pack sx-section" id="sticker-sheet">
        <div className="dc-section-heading">
          <h2>Pick. Stick. Go.</h2>
          <p>
            Collect a few possibilities.
            <br />
            The route can come next.
          </p>
        </div>
        <div className="dc-pack-layout">
          <div className="dc-stickers">
            {places.map((p, i) => (
              <button
                className={`dc-sticker dc-sticker-${i} ${packed.includes(i) ? "dc-packed" : ""}`}
                key={p.name}
                aria-pressed={packed.includes(i)}
                onClick={() => pack(i)}
              >
                <MiniArt kind={p.kind} />
                <strong>{p.name}</strong>
                <span className="sx-note">{p.feeling}</span>
                <span className="dc-sticker-check">
                  {packed.includes(i) ? "✓ Packed" : "+ Pack this place"}
                </span>
              </button>
            ))}
          </div>
          <div className="dc-bag">
            <Drawing
              viewBox="0 0 350 330"
              label="Your bag of destination possibilities"
            >
              <Backpack x={70} y={25} />
              {packed.map((p, i) => (
                <g
                  key={p}
                  transform={`translate(${95 + i * 38} 153) rotate(${i * 8 - 8})`}
                >
                  <rect width="43" height="35" fill="var(--sx-paper)" />
                  <text x="6" y="25" className="sx-svg-hand">
                    {["△", "≈", "⌂"][p]}
                  </text>
                </g>
              ))}
            </Drawing>
            <p className="sx-note" aria-live="polite">
              {packed.length
                ? `${packed.length} good ${packed.length === 1 ? "idea" : "ideas"} in the bag.`
                : "Looking a little empty in here."}
            </p>
            <button
              className="sx-button sx-solid"
              disabled={!packed.length}
              onClick={() => setOpen((o) => !o)}
            >
              {open ? "Close my sample route" : "Unpack a sample route"}
            </button>
          </div>
        </div>
        {open && (
          <div className="dc-unpacked" aria-live="polite">
            <span className="sx-note">
              Your collection, in the order you picked it.
            </span>
            <h3>{packed.map((i) => places[i].name).join(" ⇢ ")}</h3>
            <p>
              Now compare travel between stops and choose dates. A route sketch
              doesn’t yet confirm a feasible connection.
            </p>
            <a className="sx-text-link" href="/trips/new">
              Build this into a trip
            </a>
          </div>
        )}
      </section>
      <section className="dc-inventory sx-section">
        <div>
          <span className="sx-note">
            The less glamorous stuff? Also packed.
          </span>
          <h2>
            Good trips have
            <br />
            good little details.
          </h2>
          <p>
            The interesting places are only the beginning. Keep the practical
            bits beside them so your whole trip makes sense.
          </p>
          <MiniArt kind="cup" />
        </div>
        <div className="dc-checklist">
          <h3>A trip that fits together</h3>
          {[
            "A place to sleep",
            "The ride between stops",
            "A budget with breathing room",
            "An afternoon with nothing booked",
          ].map((x, i) => (
            <label key={x}>
              <input
                type="checkbox"
                checked={checked.includes(x)}
                onChange={() =>
                  setChecked((s) =>
                    s.includes(x) ? s.filter((v) => v !== x) : [...s, x],
                  )
                }
              />
              <span>
                <b>{x}</b>
                <small>
                  {
                    [
                      "Compare location, nights and available rates.",
                      "See intercity transfers alongside your itinerary.",
                      "Separate known estimates from unpriced items.",
                      "Leave a little space for being there.",
                    ][i]
                  }
                </small>
              </span>
            </label>
          ))}
          <span className="sx-note" aria-live="polite">
            {checked.length === 4
              ? "Look at you. Practically ready."
              : `${checked.length} of 4 planning ideas ticked in this sample.`}
          </span>
        </div>
      </section>
      <section className="dc-rain sx-section">
        <span className="dc-rain-sticker" aria-hidden="true">
          ☂
          <small>
            detour
            <br />
            approved
          </small>
        </span>
        <div>
          <h2>
            Plot twist?
            <br />
            We packed for that.
          </h2>
          <p>
            Rain. A delayed bus. A sudden desire to do less. Review a different
            plan, with the important stuff kept in place.
          </p>
          <div className="dc-plan-change" aria-live="polite">
            <strong>
              {rain ? "14:30 · Gallery + chai" : "14:00 · Outdoor market"}
            </strong>
            <span>20:00 · Reserved dinner stays fixed</span>
          </div>
          <button className="sx-button" onClick={() => setRain((v) => !v)}>
            {rain ? "Restore the market" : "Try a rainproof afternoon"}
          </button>
          <small>Interactive alternative; does not modify a booking.</small>
        </div>
      </section>
      <Questions />
      <Start title="A good idea deserves a little adventure." />
      <Footer current="doodle-club" />
    </main>
  );
}
