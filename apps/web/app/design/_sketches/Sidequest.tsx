"use client";
import { useState } from "react";
import { Header, Footer, Start, places, Questions } from "./Common";
import { HeroArt, MiniArt, Drawing, Person, Plane } from "./Art";
import "./sketches.css";
const chapters = [
  {
    title: "The mountain chapter",
    text: "A bus north. A room with a view. A few days of saying “we could stay another night.”",
    line: "A hillside guesthouse in Bir",
    route: ["Delhi", "Bir", "Dharamshala"],
  },
  {
    title: "The salty-haired chapter",
    text: "A train to the coast. Bare feet. Discovering that an afternoon can take an entire afternoon.",
    line: "A little stay near Gokarna",
    route: ["Bengaluru", "Gokarna", "Udupi"],
  },
  {
    title: "The curious-streets chapter",
    text: "A window seat. New streets. A very good lunch you never would have found in a spreadsheet.",
    line: "A lakeside haveli in Udaipur",
    route: ["Jaipur", "Udaipur", "Jodhpur"],
  },
];
export default function Sidequest() {
  const [chapter, setChapter] = useState(0);
  const [branch, setBranch] = useState<"cafe" | "museum" | null>(null);
  const [accepted, setAccepted] = useState(false);
  return (
    <main className="sx sx-sidequest">
      <Header label="Sidequest" cta="Start my story" />
      <section className="sq-hero">
        <div>
          <span className="sx-note">Same main character. Better scenery.</span>
          <h1>
            Your week
            <br />
            needs a<br />
            plot twist.
          </h1>
          <p>
            Get out of the tabs. Into the story.
            <br />A travel planner for taking the interesting way.
          </p>
          <a href="#chapter" className="sx-button sx-solid">
            Choose my next chapter
          </a>
        </div>
        <HeroArt kind="comic" />
        <span className="sq-hero-caption sx-note">
          Based on a very relatable true story.
        </span>
      </section>
      <section className="sq-chapter sx-section" id="chapter">
        <div className="sq-heading">
          <h2>
            Where does
            <br />
            the story go?
          </h2>
          <p>
            Follow a feeling.
            <br />
            The practical bits follow you.
          </p>
        </div>
        <div
          className="sq-chapter-tabs"
          role="group"
          aria-label="Choose a travel chapter"
        >
          {places.map((p, i) => (
            <button
              aria-pressed={chapter === i}
              key={p.name}
              onClick={() => setChapter(i)}
            >
              <MiniArt kind={p.kind} />
              <span className="sx-note">{chapters[i].title}</span>
              <span className="sq-choice">
                {chapter === i ? "This one! ✓" : "What about here?"}
              </span>
            </button>
          ))}
        </div>
        <div className="sq-synopsis" key={chapter} aria-live="polite">
          <span className="sx-note">In this episode…</span>
          <h3>{chapters[chapter].text}</h3>
          <p>{places[chapter].note}</p>
        </div>
      </section>
      <section className="sq-strip sx-section">
        <div>
          <h2>
            Even adventures
            <br />
            need a little continuity.
          </h2>
          <p>
            The journey between the good bits is part of the story. Keep places,
            nights, stays and transport connected.
          </p>
        </div>
        <div className="sq-journey-strip">
          {chapters[chapter].route.map((p, i) => (
            <article key={p}>
              <span className="sx-note">
                {["The departure", "The good bit", "The next chapter"][i]}
              </span>
              <h3>{p}</h3>
              {i === 0 ? (
                <Drawing
                  label="A paper airplane beginning the journey"
                  viewBox="0 0 350 200"
                >
                  <Plane x={85} y={55} />
                  <path d="M20 167q110-95 143-2t142-44" strokeDasharray="4 8" />
                </Drawing>
              ) : (
                <MiniArt kind={i === 1 ? places[chapter].kind : "town"} />
              )}
              <p>
                {
                  [
                    "Compare the journey and transfer times.",
                    chapters[chapter].line,
                    "Stay another night, or keep going.",
                  ][i]
                }
              </p>
            </article>
          ))}
        </div>
        <p className="sq-strip-note">
          Example route outline. Confirm connections and available stays for
          your dates.
        </p>
      </section>
      <section className="sq-rain sx-section">
        <div className="sq-rain-panel">
          <span className="sx-note">Then, a plot twist.</span>
          <Drawing label="A cartoon traveler surprised by an unexpected raincloud">
            <path
              d="M100 125q-10-50 43-51 21-51 69-14 59-20 75 28 59 1 29 47H100Z"
              fill="var(--sx-blue)"
            />
            {[115, 155, 195, 235, 275].map((x) => (
              <path key={x} d={`m${x} 160-10 20`} />
            ))}
            <Person x={204} y={223} scale={0.9} />
            <path
              d="M328 210h194v82H391l-40 29 4-29h-27Z"
              fill="var(--sx-paper)"
            />
            <text x="350" y="246" className="sx-svg-hand">
              Well. That’s new.
            </text>
            <text x="350" y="273" className="sx-svg-hand">
              What’s the plan?
            </text>
          </Drawing>
        </div>
        <div className="sq-rain-copy">
          <h2>
            The story doesn’t
            <br />
            stop for rain.
          </h2>
          <p>
            The outdoor walk won’t work. Choose another afternoon, then decide
            whether to keep it.
          </p>
          <div
            className="sq-branches"
            role="group"
            aria-label="Choose an alternative afternoon"
          >
            <button
              aria-pressed={branch === "cafe"}
              onClick={() => {
                setBranch("cafe");
                setAccepted(false);
              }}
            >
              A café and a book<small>More rest. No entry ticket.</small>
            </button>
            <button
              aria-pressed={branch === "museum"}
              onClick={() => {
                setBranch("museum");
                setAccepted(false);
              }}
            >
              A museum nearby<small>More exploring. Entry cost to check.</small>
            </button>
          </div>
          <div className="sq-decision" aria-live="polite">
            <span>
              {branch
                ? `14:30 · ${branch === "cafe" ? "A café and a book" : "Museum visit"}`
                : "Choose the next scene above."}
            </span>
            <strong>20:00 · Dinner with a friend stays fixed</strong>
            {branch && (
              <button
                className="sx-button sx-solid"
                disabled={accepted}
                onClick={() => setAccepted(true)}
              >
                {accepted
                  ? "Scene accepted in this sample ✓"
                  : "Keep this version"}
              </button>
            )}
          </div>
        </div>
      </section>
      <Questions />
      <Start title="Go on. Give yourself a good story." />
      <Footer current="sidequest" />
    </main>
  );
}
