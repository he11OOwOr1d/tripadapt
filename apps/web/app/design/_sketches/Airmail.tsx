"use client";
import { useState } from "react";
import { Header, Footer, Start, places, Questions } from "./Common";
import { HeroArt, MiniArt } from "./Art";
import "./sketches.css";
export default function Airmail() {
  const [to, setTo] = useState(0);
  const [back, setBack] = useState(false);
  const [rain, setRain] = useState(false);
  return (
    <main className="sx sx-airmail">
      <Header label="Airmail" cta="Write my getaway" />
      <section className="am-hero">
        <div className="am-hero-copy">
          <span className="sx-note">
            For the version of you who needs a break.
          </span>
          <h1>
            Dear future me,
            <br />
            wish you
            <br />
            were here.
          </h1>
          <p>
            Somewhere the mornings last longer. Somewhere your plans feel a
            little lighter.
          </p>
          <a className="sx-button sx-solid" href="#reply">
            Let’s find that somewhere
          </a>
          <p className="sx-note am-signature">Love, your next trip.</p>
        </div>
        <div className="am-envelope">
          <HeroArt kind="mail" />
          <span className="am-stamp sx-note">
            No return to routine, please.
          </span>
        </div>
      </section>
      <section className="am-reply sx-section" id="reply">
        <div>
          <h2>
            Where shall
            <br />
            we send you?
          </h2>
          <p>
            You don’t need the whole journey yet. Just a place you’d like to be.
          </p>
        </div>
        <div className="am-reply-slip">
          <span className="sx-note">A small change of address</span>
          <div className="am-address">
            <span>To:</span>
            <div role="group" aria-label="Choose your destination">
              {places.map((p, i) => (
                <button
                  key={p.name}
                  aria-pressed={to === i}
                  onClick={() => {
                    setTo(i);
                    setBack(false);
                  }}
                >
                  {p.name}
                  <small>{p.region}</small>
                </button>
              ))}
            </div>
          </div>
          <div className="am-reply-bottom" aria-live="polite">
            <span className="sx-note">{places[to].feeling}</span>
            <span>Somewhere, India ☺</span>
          </div>
        </div>
      </section>
      <section className="am-route sx-section">
        <div className="am-route-intro">
          <h2>
            Every stop,
            <br />
            part of the letter.
          </h2>
          <p>
            Research the place. Find a stay. Connect the journey. There’s room
            for all of it.
          </p>
        </div>
        <div className="am-postal-route">
          <article>
            <span className="am-postmark">
              a place
              <br />
              to begin
            </span>
            <h3>{to === 0 ? "Delhi" : to === 1 ? "Bengaluru" : "Jaipur"}</h3>
            <p>
              Your starting point.
              <br />
              Your dates can come later.
            </p>
          </article>
          <span className="am-dotline" aria-hidden="true" />
          <article>
            <span className="am-postmark">
              stay
              <br />a while
            </span>
            <h3>{places[to].name}</h3>
            <p>
              {places[to].stay}.<br />A few mornings, all yours.
            </p>
          </article>
          <span className="am-dotline" aria-hidden="true" />
          <article>
            <span className="am-postmark">
              room for
              <br />a detour
            </span>
            <h3>{to === 0 ? "Dharamshala" : to === 1 ? "Udupi" : "Jodhpur"}</h3>
            <p>
              Add another stop.
              <br />
              Keep the whole journey together.
            </p>
          </article>
        </div>
      </section>
      <section className="am-letter-section sx-section">
        <div
          className={`am-letter ${back ? "am-letter-back" : ""}`}
          key={`${to}-${back}`}
        >
          <div className="am-letter-top">
            <span>A little note from {places[to].name}</span>
            <span>✳</span>
          </div>
          {back ? (
            <div className="am-letter-message">
              <span className="sx-note">The practical little details.</span>
              <h3>Away, with a plan.</h3>
              <dl>
                <div>
                  <dt>Getting there</dt>
                  <dd>{places[to].travel}</dd>
                </div>
                <div>
                  <dt>Somewhere to stay</dt>
                  <dd>{places[to].stay}</dd>
                </div>
                <div>
                  <dt>Worth knowing</dt>
                  <dd>{places[to].note}</dd>
                </div>
              </dl>
              <small>
                Example ideas. Confirm timetables, rates and availability for
                your dates.
              </small>
            </div>
          ) : (
            <>
              <MiniArt kind={places[to].kind} />
              <h3>{places[to].feeling}</h3>
              <p className="sx-note">
                The sort of place you meant to make time for.
              </p>
            </>
          )}
          <button className="sx-button" onClick={() => setBack((v) => !v)}>
            {back
              ? "Turn back to the daydream"
              : "Turn over for the little details"}{" "}
            ↻
          </button>
        </div>
        <div>
          <span className="sx-note">More than a pretty postcard.</span>
          <h2>
            A lovely idea.
            <br />A workable plan.
          </h2>
          <p>
            Keep the feeling. Add the useful bits: a place to sleep, the journey
            between stops and a clear view of what’s still unknown.
          </p>
          <p>
            Save interesting places before you fill your days. Leave a little
            space between them.
          </p>
        </div>
      </section>
      <section className="am-ps sx-section">
        <span className="am-ps-mark">P.S.</span>
        <div>
          <h2>The weather didn’t read your letter.</h2>
          <p>
            That’s fine. Your afternoon can change without moving your eight
            o’clock dinner.
          </p>
          <div className="am-weather" aria-live="polite">
            <span className={rain ? "sx-cross" : ""}>A walk by the water</span>
            {rain && <strong>A museum + a long coffee instead</strong>}
            <small>Dinner at 20:00 remains fixed.</small>
          </div>
          <button className="sx-button" onClick={() => setRain((v) => !v)}>
            {rain ? "Put the walk back" : "See the rainy-day version"}
          </button>
        </div>
      </section>
      <Questions />
      <Start title="Send yourself somewhere lovely." />
      <Footer current="airmail" />
    </main>
  );
}
