"use client";
import { useState } from "react";
import { Header, Footer, Start, Questions, places } from "./Common";
import { HeroArt, MiniArt } from "./Art";
import "./sketches.css";
export default function Margin() {
  const [page, setPage] = useState(0);
  const [nights, setNights] = useState(3);
  const [rain, setRain] = useState(false);
  const [saved, setSaved] = useState(false);
  return (
    <main className="sx sx-margin">
      <Header label="Margin" cta="Open my journal" />
      <section className="mg-hero">
        <div className="mg-book">
          <div className="mg-left">
            <span className="sx-note">A journal for the days ahead.</span>
            <h1>
              Go somewhere.
              <br />
              Make a few
              <br />
              margin notes.
            </h1>
            <p>
              Not every good trip starts with a perfect plan. Sometimes it
              starts with a scribble.
            </p>
            <a className="sx-button sx-solid" href="#journal">
              Make the first mark
            </a>
            <span className="mg-written sx-note">
              leave room for the good bits.
            </span>
          </div>
          <div className="mg-rings" aria-hidden="true">
            {Array.from({ length: 7 }, (_, i) => (
              <i key={i} />
            ))}
          </div>
          <div className="mg-right">
            <div className="mg-page-head">
              <span>Somewhere I’d rather be</span>
              <span>p. {page + 1}</span>
            </div>
            <div className="mg-page" key={page}>
              <MiniArt kind={places[page].kind} />
              <h3>{places[page].name}</h3>
              <p>{places[page].feeling}</p>
              <div className="mg-underlined">
                {page === 0
                  ? "Learn the art of taking it easy."
                  : page === 1
                    ? "An afternoon with nowhere to rush."
                    : "Take the long way back."}
              </div>
              <span className="sx-note">
                {page === 0
                  ? "pack a sweater. and no expectations."
                  : page === 1
                    ? "sand in shoes is a good sign."
                    : "get lost. find a really good lunch."}
              </span>
            </div>
            <div className="mg-page-turn">
              <button
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous page
              </button>
              <button
                disabled={page === 2}
                onClick={() => setPage((p) => p + 1)}
              >
                Turn the page ↝
              </button>
            </div>
          </div>
        </div>
        <div className="mg-under-book">
          <span>Places, stays, travel, little changes.</span>
          <span className="sx-note">All on the same page. ↓</span>
        </div>
      </section>
      <section className="mg-discover sx-section">
        <div>
          <span className="sx-note">A few things to underline.</span>
          <h2>
            Find the places
            <br />
            you’ll write home about.
          </h2>
          <p>
            Gather the little cafés, the familiar peaks and the places you
            haven’t met yet. Keep what catches your eye before deciding what
            fits.
          </p>
          <button
            className="sx-button"
            aria-pressed={saved}
            onClick={() => setSaved((s) => !s)}
          >
            {saved
              ? "Bir saved in this sketch ✓"
              : "Save this little possibility"}
          </button>
        </div>
        <div className="mg-research">
          <HeroArt kind="journal" />
          <aside>
            <span className="sx-note">research note</span>
            <h3>A slower few days in Bir</h3>
            <p>
              Village walks, Tibetan cafés and a guesthouse with a view. Keep a
              spare afternoon for the weather.
            </p>
            <small>
              Destination idea; check local conditions before going.
            </small>
          </aside>
        </div>
      </section>
      <section id="journal" className="mg-editor sx-section">
        <div className="mg-editor-label">
          <h2>A plan in pencil.</h2>
          <p>
            Change the nights.
            <br />
            Keep the journey together.
          </p>
        </div>
        <div className="mg-ledger">
          <div className="mg-ledger-top">
            <span>My Himachal notes</span>
            <span className="sx-note">nothing set in stone</span>
          </div>
          <div className="mg-row">
            <span>Delhi</span>
            <p>
              Leave in the evening.
              <small>Overnight bus; service to be confirmed.</small>
            </p>
          </div>
          <div className="mg-row">
            <span>Bir</span>
            <p>
              Slow breakfasts. A hillside stay.
              <small>Example stay allowance: ₹1,800 / night.</small>
            </p>
            <div className="sx-stepper">
              <button
                aria-label="Fewer nights in Bir"
                disabled={nights === 1}
                onClick={() => setNights((n) => n - 1)}
              >
                −
              </button>
              <span aria-live="polite">{nights} nights</span>
              <button
                aria-label="More nights in Bir"
                onClick={() => setNights((n) => n + 1)}
              >
                +
              </button>
            </div>
          </div>
          <div className="mg-row">
            <span>Dharamshala</span>
            <p>
              New streets. A different view.
              <small>2 nights; road transfer needs checking.</small>
            </p>
          </div>
          <div className="mg-total" aria-live="polite">
            <span>Pencilled stay allowance</span>
            <b>₹{((nights + 2) * 1800).toLocaleString("en-IN")}</b>
          </div>
          <small>
            Illustrative stay subtotal only. Travel, food, taxes and activities
            are not included.
          </small>
        </div>
      </section>
      <section className="mg-rain sx-section">
        <div className="mg-rain-note">
          <span className="sx-note">A little rain in the margin.</span>
          <h2>
            Cross out a plan.
            <br />
            Keep the good day.
          </h2>
          <p>
            A change doesn’t have to unravel the trip. See an alternative before
            making it yours.
          </p>
          <button className="sx-button" onClick={() => setRain((r) => !r)}>
            {rain
              ? "Restore the sunny afternoon"
              : "Pencil in a rainy afternoon"}
          </button>
        </div>
        <div className="mg-corrections" aria-live="polite">
          <span>Tuesday’s page</span>
          <p className={rain ? "sx-cross" : ""}>14:00 · A long hillside walk</p>
          {rain && (
            <p className="sx-hand sx-new-mark">
              14:30 · Art gallery, then chai ✓
            </p>
          )}
          <p>
            20:00 · Dinner with a friend <small>fixed</small>
          </p>
          <span className="sx-note">
            {rain
              ? "A sample alternative. Dinner stays put."
              : "Good plans leave room for the weather."}
          </span>
        </div>
      </section>
      <Questions />
      <Start title="A blank page. A good beginning." />
      <Footer current="margin" />
    </main>
  );
}
