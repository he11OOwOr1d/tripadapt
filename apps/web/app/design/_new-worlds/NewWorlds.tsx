"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import "./worlds.css";

const image = (name: string) => `/images/new-worlds/${name}.jpg`;
const sources = [
  "https://www.pexels.com/photo/aerial-view-of-desert-sand-dunes-at-sunset-28902496/",
  "https://www.pexels.com/photo/train-high-in-mountains-18620990/",
  "https://www.pexels.com/photo/downtown-city-street-in-rain-13283697/",
  "https://www.pexels.com/photo/aerial-view-of-tropical-island-coastline-34109832/",
  "https://www.pexels.com/photo/person-hiking-in-fog-shrouded-mountains-14912325/",
];
function World({ name, children }: { name: string; children: ReactNode }) {
  const [still, setStill] = useState(false);
  return (
    <main className={`nw nw-${name}${still ? " nw-still" : ""}`}>
      <a className="nw-skip" href="#experience">
        Skip to the experience
      </a>
      {children}
      <footer className="nw-foot">
        <a href="/design/options">All twenty directions</a>
        <span>elsewhere. / {name}</span>
        <button onClick={() => setStill((s) => !s)} aria-pressed={still}>
          {still ? "Motion off · turn on" : "Motion on · turn off"}
        </button>
        <small>
          Design exploration. Examples, prices and weather are illustrative. No
          live offers or bookings. Photos are landscape inspiration, not
          itinerary-location or property evidence. Photography:{" "}
          {sources.map((s, i) => (
            <a key={s} href={s} target="_blank" rel="noreferrer">
              Pexels {i + 1}
            </a>
          ))}
          .
        </small>
      </footer>
    </main>
  );
}
const Begin = ({ label = "Find your elsewhere" }: { label?: string }) => (
  <a className="nw-go" href="/trips/new">
    {label}
    <span aria-hidden="true">↗</span>
  </a>
);
const Back = () => (
  <a href="/design/options" className="nw-logo">
    elsewhere<span aria-hidden="true">✳</span>
  </a>
);
const Note = () => (
  <p className="nw-note">
    A sample interaction. Your real trip changes only after you review and
    accept a proposal.
  </p>
);

const atlasPlaces = [
  {
    name: "Into the highlands",
    image: "mist",
    feel: "A different perspective",
    route: ["Manali", "Kasol", "Dharamshala"],
    copy: "A few mountain mornings. A place to linger. Enough time between stops.",
    x: 58,
    y: 31,
  },
  {
    name: "Along the water",
    image: "island",
    feel: "A little less hurry",
    route: ["Panaji", "Palolem", "Gokarna"],
    copy: "A colourful town, a quieter shore, and a long afternoon with nothing booked.",
    x: 76,
    y: 65,
  },
  {
    name: "Out past the ordinary",
    image: "dunes",
    feel: "Space to be surprised",
    route: ["Jodhpur", "Jaisalmer", "Bikaner"],
    copy: "New textures, winding streets and the kind of space that changes your pace.",
    x: 30,
    y: 47,
  },
  {
    name: "The journey is the point",
    image: "rail",
    feel: "A slower way there",
    route: ["Kalka", "Shimla", "Kufri"],
    copy: "Keep the view between destinations in the story. Leave time for the journey itself.",
    x: 45,
    y: 71,
  },
];
export function Meridian() {
  const [pin, setPin] = useState(0);
  const [extra, setExtra] = useState(false);
  const [layer, setLayer] = useState("Places");
  const [rain, setRain] = useState(false);
  const [approved, setApproved] = useState(false);
  const p = atlasPlaces[pin];
  return (
    <World name="meridian">
      <header className="me-nav">
        <Back />
        <span>A personal atlas of possibility.</span>
        <a href="#experience">Explore the map</a>
      </header>
      <section className="me-hero">
        <div className="me-title">
          <h1>
            Go off your
            <br />
            usual map.
          </h1>
          <p>
            Start with a feeling.
            <br />
            Find the places that belong to it.
          </p>
        </div>
        <div className="me-atlas">
          <div className="me-map">
            <svg viewBox="0 0 1000 600" aria-hidden="true">
              <defs>
                <pattern
                  id="atlas-grid"
                  width="60"
                  height="60"
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d="M60 0H0V60"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth=".5"
                  />
                </pattern>
              </defs>
              <rect width="1000" height="600" fill="url(#atlas-grid)" />
              <g className="me-land">
                <path d="M98 170 135 108 235 75 310 99 340 160 301 214 246 209 222 265 168 241 151 196Z M234 278 298 263 338 304 329 358 300 396 283 459 246 415 224 342Z M470 123 556 84 638 98 681 65 791 119 889 118 908 171 852 198 819 253 746 266 687 226 654 238 608 188 553 191 532 163 494 181Z M498 220 569 207 632 249 620 312 577 384 535 366 498 291Z M787 370 859 347 910 386 886 428 819 431 778 401Z" />
              </g>
              <path
                className="me-connection"
                d="M300 282 Q430 35 580 186 T760 390 Q620 490 450 426"
              />
              <g className="me-latitudes">
                <path d="M0 150H1000 M0 300H1000 M0 450H1000" />
              </g>
            </svg>
            {atlasPlaces.map((a, i) => (
              <button
                className={`me-pin ${pin === i ? "me-selected" : ""}`}
                style={{ left: `${a.x}%`, top: `${a.y}%` }}
                aria-label={`Explore ${a.name}`}
                aria-pressed={pin === i}
                key={a.name}
                onClick={() => {
                  setPin(i);
                  setExtra(false);
                }}
              >
                <span />
                <b>{a.name}</b>
              </button>
            ))}
            <span className="me-map-label">
              An imagined atlas · not a geographic route
            </span>
            <span className="me-compass" aria-hidden="true">
              N<br />✳
            </span>
          </div>
          <article className="me-inspector" key={p.name}>
            <img src={image(p.image)} alt={p.feel} fetchPriority="high" />
            <div>
              <small>{p.feel}</small>
              <h2>{p.name}.</h2>
              <p>{p.copy}</p>
              <a href="#experience">Make a little journey of it</a>
            </div>
          </article>
        </div>
      </section>
      <section className="me-route" id="experience">
        <div>
          <span>Your route, taking shape</span>
          <h2>
            Connect the places.
            <br />
            Keep the possibilities.
          </h2>
          <p>
            A trip can have several destinations, flexible dates and room to
            change its mind.
          </p>
        </div>
        <div className="me-route-ribbon" aria-live="polite">
          {p.route.map((a, i) => (
            <div key={a}>
              <span>{i === 0 ? "Begin" : i === 1 ? "Explore" : "Linger"}</span>
              <strong>{a}</strong>
              <small>{i + 2} nights suggested</small>
            </div>
          ))}
          {extra ? (
            <div>
              <span>Leave it open</span>
              <strong>Somewhere next</strong>
              <small>You decide the length</small>
            </div>
          ) : null}
        </div>
        <button className="me-add" onClick={() => setExtra((e) => !e)}>
          {extra ? "− Keep these three stops" : "+ Leave room for another stop"}
        </button>
      </section>
      <section className="me-layers">
        <h2>
          There’s more
          <br />
          beneath the surface.
        </h2>
        <div className="me-layer-buttons">
          {["Places", "Stays", "Connections", "Costs"].map((l) => (
            <button
              key={l}
              aria-pressed={layer === l}
              onClick={() => setLayer(l)}
            >
              {l}
            </button>
          ))}
        </div>
        <div className="me-layer-panel" key={layer}>
          <span aria-hidden="true">
            {layer === "Places"
              ? "⌖"
              : layer === "Stays"
                ? "⌂"
                : layer === "Connections"
                  ? "⇄"
                  : "≈"}
          </span>
          <div>
            <h3>
              {layer === "Places"
                ? "Know a little more before you go."
                : layer === "Stays"
                  ? "Wake up where your day begins."
                  : layer === "Connections"
                    ? "The space between stops matters."
                    : "See the trade-offs while they’re still choices."}
            </h3>
            <p>
              {layer === "Places"
                ? "Keep available hours, photos, attributed reviews and source links beside the places you save. Missing details stay unknown."
                : layer === "Stays"
                  ? "Compare accommodation, keep check-in dates in view, and add reservations you’ve already made. Selecting a stay here never books it."
                  : layer === "Connections"
                    ? "Bring local routes, intercity journeys and existing tickets into the plan. Travel time belongs on the itinerary, too."
                    : "Separate known prices, indicative allowances and unpriced items. A route can look affordable while still having unknown costs."}
            </p>
          </div>
        </div>
      </section>
      <section className="me-revision">
        <div>
          <h2>
            A new route through
            <br />
            the same afternoon.
          </h2>
          <p>Keep the commitments. Review the detour.</p>
          <button
            className="nw-line-button"
            onClick={() => {
              setRain((r) => !r);
              setApproved(false);
            }}
          >
            {rain ? "Restore clear skies" : "Imagine a rainy afternoon"}
          </button>
        </div>
        <div className="me-timeline">
          <div>
            <time>14:00</time>
            <span key={String(rain)}>
              {rain
                ? "An indoor gallery and a coffee"
                : "A long walk by the river"}
            </span>
          </div>
          <div>
            <time>20:00</time>
            <span>
              Dinner stays here.<small>Fixed time · preserved</small>
            </span>
          </div>
          {rain ? (
            <button
              className="nw-go"
              disabled={approved}
              onClick={() => setApproved(true)}
            >
              {approved
                ? "Accepted in this demo ✓"
                : "Accept the proposed detour"}
            </button>
          ) : null}
          <Note />
        </div>
      </section>
      <section className="me-end">
        <p>
          The world is wide.
          <br />
          Your plan can stay personal.
        </p>
        <Begin />
      </section>
    </World>
  );
}

const outboundIdeas = [
  {
    name: "Higher",
    image: "mist",
    description: "For mountain air and a little perspective.",
  },
  {
    name: "Further",
    image: "dunes",
    description: "For somewhere outside your ordinary.",
  },
  {
    name: "Slower",
    image: "rail",
    description: "For the views between the destinations.",
  },
];
export function Outbound() {
  const [idea, setIdea] = useState(0);
  const [nights, setNights] = useState(8);
  const [decision, setDecision] = useState("Rain");
  const [kept, setKept] = useState(false);
  return (
    <World name="outbound">
      <header className="ob-nav">
        <Back />
        <span>Good plans. Better detours.</span>
        <a href="#experience">Get out there ↙</a>
      </header>
      <section className="ob-hero">
        <div>
          <span>A little less same old.</span>
          <h1>
            GET
            <br />
            OUT
            <br />
            THERE.
          </h1>
          <a
            href="#experience"
            className="ob-round"
            aria-label="Explore the Outbound experience"
          >
            ↘
          </a>
        </div>
        <div className="ob-accordion">
          {outboundIdeas.map((x, i) => (
            <button
              key={x.name}
              className={idea === i ? "ob-open" : ""}
              aria-pressed={idea === i}
              onClick={() => setIdea(i)}
            >
              <img
                src={image(x.image)}
                alt=""
                fetchPriority={i === 0 ? "high" : "auto"}
              />
              <span className="ob-image-shade" />
              <span className="ob-ac-number">0{i + 1}</span>
              <strong>{x.name}</strong>
              <small>{x.description}</small>
            </button>
          ))}
        </div>
      </section>
      <section className="ob-statement" id="experience">
        <span>Travel planning, minus the tab collection.</span>
        <h2>
          LESS ADMIN.
          <br />
          MORE ALIVE.
        </h2>
        <p>
          Places to see. Somewhere to stay. A way between them. Put the whole
          trip in one plan, then make room for a change of heart.
        </p>
      </section>
      <section className="ob-receipt">
        <div>
          <h2>
            YOUR TIME.
            <br />
            YOUR TERMS.
          </h2>
          <p>
            Multiple stops. Dates that can stay tentative.
            <br />
            Enough time to actually be there.
          </p>
          <label htmlFor="ob-nights">
            Try a different length <strong>{nights} nights</strong>
          </label>
          <input
            id="ob-nights"
            type="range"
            min="3"
            max="30"
            value={nights}
            onChange={(e) => setNights(Number(e.target.value))}
          />
          <small>
            This demo range illustrates duration; the product has no 30-night
            trip limit.
          </small>
        </div>
        <div className="ob-paper">
          <span>A very good use of your time.</span>
          <div>
            <b>Mountain mornings</b>
            <span>{Math.ceil(nights * 0.4)} nights</span>
          </div>
          <div>
            <b>A town to get lost in</b>
            <span>{nights - Math.ceil(nights * 0.4)} nights</span>
          </div>
          <hr />
          <div>
            <b>Stay allowance</b>
            <span>₹{(nights * 2400).toLocaleString("en-IN")}</span>
          </div>
          <p>
            ₹2,400 per night, one room. An illustrative stay budget, excluding
            transport, food, fees and activities.
          </p>
          <span className="ob-receipt-bottom">
            No need to fill every minute.
          </span>
        </div>
      </section>
      <section className="ob-twist">
        <h2>
          PLOT TWIST?
          <br />
          STILL YOUR TRIP.
        </h2>
        <div className="ob-tabs">
          {["Rain", "A delay", "Low energy"].map((d) => (
            <button
              key={d}
              aria-pressed={decision === d}
              onClick={() => {
                setDecision(d);
                setKept(false);
              }}
            >
              {d}
            </button>
          ))}
        </div>
        <div className="ob-decision" key={decision}>
          <span>New situation</span>
          <h3>
            {decision === "Rain"
              ? "The sky has other plans."
              : decision === "A delay"
                ? "Arriving a little later."
                : "You’d rather do a little less."}
          </h3>
          <div>
            <p>
              {decision === "Rain"
                ? "Swap the outdoor afternoon for a museum and a café."
                : decision === "A delay"
                  ? "Shorten the flexible afternoon, leaving time for the transfer."
                  : "Keep one favourite place. Make the rest of the afternoon free."}
            </p>
            <p>
              Keep: your 20:00 dinner.
              <br />
              Review: the changed activity and any new costs.
            </p>
          </div>
          <button className="nw-go" onClick={() => setKept((k) => !k)}>
            {kept ? "Preview accepted · undo" : "Accept this sample revision"}
          </button>
          <Note />
        </div>
      </section>
      <section className="ob-directory">
        <h2>
          THE WHOLE
          <br />
          THING, TOGETHER.
        </h2>
        <div>
          {[
            {
              name: "Find your places",
              copy: "Discover photos, provider-available reviews and the practical details behind the feeling.",
            },
            {
              name: "Fit the stays",
              copy: "Keep accommodation near your plans, with dates, occupancy and price assumptions visible.",
            },
            {
              name: "Connect the dots",
              copy: "See transfers and local travel beside the time you want to spend exploring.",
            },
            {
              name: "Know the numbers",
              copy: "Estimated costs, missing costs and budget trade-offs belong in the same view.",
            },
          ].map((x) => (
            <details key={x.name}>
              <summary>
                {x.name}
                <span>+</span>
              </summary>
              <p>{x.copy}</p>
            </details>
          ))}
        </div>
      </section>
      <section className="ob-end">
        <span>You’ve got places to be.</span>
        <h2>
          GO MAKE
          <br />A STORY.
        </h2>
        <Begin label="Start your next chapter" />
      </section>
    </World>
  );
}

const frames = [
  {
    image: "city",
    title: "Same view. Different day.",
    text: "Sometimes the everyday needs an intermission.",
  },
  {
    image: "rail",
    title: "Take the scenic cut.",
    text: "Give the journey a place in the story.",
  },
  {
    image: "dunes",
    title: "Leave the ordinary out of frame.",
    text: "Keep a little space for something unexpected.",
  },
  {
    image: "island",
    title: "Stay for the feeling.",
    text: "A good plan makes room to just be there.",
  },
];
export function Cutaway() {
  const [frame, setFrame] = useState(1);
  const [rewrite, setRewrite] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const f = frames[frame];
  return (
    <World name="cutaway">
      <header className="ct-nav">
        <Back />
        <span>A change of scene.</span>
        <a href="#experience">Explore the story</a>
      </header>
      <section className="ct-screen">
        <img
          src={image(f.image)}
          alt={f.title}
          key={f.image}
          fetchPriority="high"
        />
        <div className="ct-vignette" />
        <div className="ct-title">
          <p>There’s a life outside the usual.</p>
          <h1>
            A different
            <br />
            kind of plot.
          </h1>
          <a href="#experience">
            Find your next scene <span>↓</span>
          </a>
        </div>
        <div className="ct-screen-caption">
          <span>{f.title}</span>
          <span>Travel inspiration / still {frame + 1} of 4</span>
        </div>
      </section>
      <section className="ct-edit" id="experience">
        <div>
          <span>Choose the feeling.</span>
          <p aria-live="polite">{f.text}</p>
        </div>
        <div className="ct-filmstrip">
          {frames.map((x, i) => (
            <button
              key={x.image}
              aria-label={`Show scene ${i + 1}: ${x.title}`}
              aria-pressed={frame === i}
              onClick={() => setFrame(i)}
            >
              <img src={image(x.image)} alt="" loading="lazy" />
              <span>
                {i + 1 < 10 ? "0" : ""}
                {i + 1}
              </span>
            </button>
          ))}
        </div>
        <label htmlFor="ct-scrub">Move through the story</label>
        <input
          id="ct-scrub"
          type="range"
          min="0"
          max="3"
          value={frame}
          onChange={(e) => setFrame(Number(e.target.value))}
        />
        <small>A photographic storyboard, not a video player.</small>
      </section>
      <section className="ct-act">
        <div>
          <span>The beginning</span>
          <h2>
            It starts with
            <br />
            what moves you.
          </h2>
          <p>
            Save the places, photos and traveler perspectives that catch your
            attention. You can decide how they fit after you know what you’re
            drawn to.
          </p>
        </div>
        <img
          src={image("dunes")}
          alt="Soft pink sand dunes, viewed from above"
          loading="lazy"
        />
      </section>
      <section className="ct-act ct-act-reverse">
        <div>
          <span>The middle</span>
          <h2>
            Give the story
            <br />
            some structure.
          </h2>
          <p>
            Destinations, stays, travel and spending, together in one itinerary.
            Time for the transfers. Space for the moments you can’t schedule.
          </p>
          <div className="ct-script">
            <p>
              Morning <b>A place worth waking up for</b>
            </p>
            <p>
              Afternoon <b>A journey with enough time</b>
            </p>
            <p>
              Evening <b>Nothing booked. Keep it that way.</b>
            </p>
          </div>
        </div>
        <img
          src={image("rail")}
          alt="A train travelling through green mountain slopes"
          loading="lazy"
        />
      </section>
      <section className="ct-rewrite">
        <span>The unexpected</span>
        <h2>
          Change a scene.
          <br />
          Keep the story.
        </h2>
        <div className="ct-rewrite-head">
          <p>
            An afternoon outdoors. A dinner you’ve already booked.
            <br />
            What happens when rain enters the picture?
          </p>
          <button
            className="nw-line-button"
            onClick={() => {
              setRewrite((v) => !v);
              setAccepted(false);
            }}
          >
            {rewrite ? "Back to the original" : "Try the rainy-day cut"}
          </button>
        </div>
        <div className="ct-script-lines">
          <p className={rewrite ? "ct-crossed" : ""}>
            <time>14:00</time>A walk through the old city.
          </p>
          {rewrite ? (
            <p className="ct-new-line">
              <time>14:30</time>A gallery, then a slow coffee.
              <small>
                {accepted ? "Accepted in this demo" : "Proposed replacement"} ·
                estimated +₹300
              </small>
            </p>
          ) : null}
          <p>
            <time>20:00</time>Dinner. Exactly where you left it.
            <small>Fixed commitment</small>
          </p>
        </div>
        {rewrite ? (
          <button className="nw-go" onClick={() => setAccepted((v) => !v)}>
            {accepted ? "Sample edit accepted · undo" : "Accept this edit"}
          </button>
        ) : null}
        <Note />
      </section>
      <section className="ct-credits">
        <h2>
          Know what’s
          <br />
          behind the picture.
        </h2>
        <dl>
          <div>
            <dt>Places and perspectives</dt>
            <dd>Source links and attributed review samples, when available.</dd>
          </div>
          <div>
            <dt>Prices and timings</dt>
            <dd>Estimates stay labeled. Missing information stays visible.</dd>
          </div>
          <div>
            <dt>The final say</dt>
            <dd>
              You review revisions. Reservations never change on their own.
            </dd>
          </div>
        </dl>
      </section>
      <section className="ct-end">
        <p>There’s more to the story.</p>
        <h2>
          You should
          <br />
          be in it.
        </h2>
        <Begin label="Begin your next chapter" />
      </section>
    </World>
  );
}

const packIdeas = [
  { name: "Mountain air", symbol: "△", image: "mist" },
  { name: "A window seat", symbol: "↗", image: "rail" },
  { name: "Nowhere to rush", symbol: "≈", image: "island" },
  { name: "Something new", symbol: "✳", image: "dunes" },
];
export function Pocket() {
  const [packed, setPacked] = useState<string[]>(["Mountain air"]);
  const [open, setOpen] = useState(false);
  const [rain, setRain] = useState(false);
  const toggle = (name: string) =>
    setPacked((p) =>
      p.includes(name) ? p.filter((x) => x !== name) : [...p, name],
    );
  return (
    <World name="pocket">
      <header className="pk-nav">
        <Back />
        <a href="#experience">What are you packing?</a>
        <span>A little room for possibility.</span>
      </header>
      <section className="pk-hero">
        <div>
          <p>Take what makes you feel good.</p>
          <h1>
            Pack a little
            <br />
            possibility.
          </h1>
          <p>
            Ideas first. Plans when you’re ready.
            <br />A whole trip, with space for a little spontaneity.
          </p>
          <a href="#experience" className="nw-go">
            Open up your options <span>↓</span>
          </a>
        </div>
        <div className={`pk-case-wrap ${open ? "pk-case-open" : ""}`}>
          <div className="pk-case-handle" />
          <button
            className="pk-case"
            aria-label={open ? "Close the suitcase" : "Open the suitcase"}
            aria-pressed={open}
            onClick={() => setOpen((o) => !o)}
          >
            <span className="pk-case-ribs" />
            <span className="pk-case-label">
              good things
              <br />
              ahead.
            </span>
            <span className="pk-case-stickers">
              {packed.map((name, i) => (
                <span style={{ "--sticker": i } as CSSProperties} key={name}>
                  {packIdeas.find((x) => x.name === name)?.symbol}
                  <small>{name}</small>
                </span>
              ))}
            </span>
            <span className="pk-case-bottom">elsewhere / take a break.</span>
          </button>
          <span className="pk-wheel pk-wheel-left" />
          <span className="pk-wheel pk-wheel-right" />
          <div className="pk-case-inside" aria-live="polite">
            <strong>
              {open ? "A very good beginning." : "Ready when you are."}
            </strong>
            <p>
              {packed.length}{" "}
              {packed.length === 1 ? "possibility" : "possibilities"} packed.
              <br />
              {open
                ? "Now let’s make them a trip."
                : "Tap the suitcase to open it."}
            </p>
          </div>
        </div>
      </section>
      <section className="pk-pack" id="experience">
        <div>
          <h2>
            What feels
            <br />
            like you?
          </h2>
          <p>
            Tap a tag to pack it.
            <br />
            You can take more than one feeling.
          </p>
        </div>
        <div className="pk-tags">
          {packIdeas.map((x) => (
            <button
              key={x.name}
              aria-pressed={packed.includes(x.name)}
              onClick={() => toggle(x.name)}
            >
              <span>{x.symbol}</span>
              <strong>{x.name}</strong>
              <small>
                {packed.includes(x.name)
                  ? "Packed ✓"
                  : "Add to your possibilities +"}
              </small>
            </button>
          ))}
        </div>
        <p className="pk-packed-status" aria-live="polite">
          {packed.length
            ? `In your pocket: ${packed.join(", ")}.`
            : "A little empty space. A good place to start."}
        </p>
      </section>
      <section className="pk-unpack">
        <h2>
          Ideas don’t have
          <br />
          to stay ideas.
        </h2>
        <div className="pk-photo-tape">
          {(packed.length ? packed : packIdeas.map((x) => x.name)).map(
            (name) => {
              const x = packIdeas.find((a) => a.name === name)!;
              return (
                <figure key={name}>
                  <img
                    src={image(x.image)}
                    alt={`${name} landscape inspiration`}
                    loading="lazy"
                  />
                  <figcaption>{name}</figcaption>
                </figure>
              );
            },
          )}
        </div>
        <div className="pk-trip-bits">
          <div>
            <span>Pick your places</span>
            <p>One stop, a few stops, or a route that keeps growing.</p>
          </div>
          <div>
            <span>Make it practical</span>
            <p>
              Fit stays, connections and estimated costs around the feeling.
            </p>
          </div>
          <div>
            <span>Leave a little room</span>
            <p>Free mornings and unscheduled ideas belong in a plan, too.</p>
          </div>
        </div>
      </section>
      <section className="pk-pockets">
        <h2>
          A pocket for
          <br />
          every little detail.
        </h2>
        <div>
          {[
            {
              title: "Somewhere to sleep",
              text: "Compare accommodation options, associate the right nights with each stay, and add reservations you already have.",
            },
            {
              title: "A way to get there",
              text: "Keep intercity connections, local routes and existing tickets beside your daily plan. Travel takes time; leave it some.",
            },
            {
              title: "A budget you understand",
              text: "See what’s estimated, what’s known and what still needs pricing. Choosing an option doesn’t reserve or pay for anything.",
            },
            {
              title: "A little traveler context",
              text: "Explore available reviews with author and source attribution. Selected samples are never presented as a complete review history.",
            },
          ].map((p) => (
            <details key={p.title}>
              <summary>
                {p.title}
                <span>↗</span>
              </summary>
              <p>{p.text}</p>
            </details>
          ))}
        </div>
      </section>
      <section className="pk-weather">
        <span aria-hidden="true">{rain ? "☂" : "☀"}</span>
        <div>
          <h2>
            Keep the good bits.
            <br />
            Change the rest.
          </h2>
          <p>
            {rain
              ? "Try an indoor afternoon. Your booked dinner stays at eight. This is a proposal, ready for you to review."
              : "A walk, a café, a dinner you’ve booked. A good little day, with a plan if the sky changes."}
          </p>
          <button className="nw-go" onClick={() => setRain((r) => !r)}>
            {rain ? "Return to the original" : "What if it rains?"}
          </button>
          <Note />
        </div>
      </section>
      <section className="pk-end">
        <span className="pk-end-tag">Return with stories.</span>
        <h2>
          Your kind
          <br />
          of baggage.
        </h2>
        <Begin label="Make a little trip of it" />
      </section>
    </World>
  );
}

export function Unbusy() {
  const [space, setSpace] = useState(55);
  const [quiet, setQuiet] = useState(false);
  const [tab, setTab] = useState("Staying");
  const hours = Math.round((100 - space) * 0.08);
  return (
    <World name="unbusy">
      <header className="un-nav">
        <Back />
        <a href="#experience">A slower kind of planning</a>
      </header>
      <section className="un-hero">
        <div>
          <p>A little time, returned to you.</p>
          <h1>
            Do less.
            <br />
            Feel more.
          </h1>
          <p>
            You don’t have to see everything.
            <br />
            Just a few things that stay with you.
          </p>
          <a href="#experience">
            Leave a little space <span>↓</span>
          </a>
        </div>
        <figure>
          <img
            src={image("mist")}
            alt="A lone walker on a mountain ridge in soft fog"
            fetchPriority="high"
          />
          <figcaption>Room for a different kind of day.</figcaption>
        </figure>
        <span className="un-side-note">The art of being somewhere.</span>
      </section>
      <section className="un-space" id="experience">
        <div>
          <span>Begin with your pace.</span>
          <h2>
            How much of a day
            <br />
            would you leave open?
          </h2>
          <p>
            There’s no right answer. Explore a little.
            <br />
            Leave room to notice where you are.
          </p>
        </div>
        <div
          className="un-space-dial"
          style={{ "--open": `${space}%` } as CSSProperties}
        >
          <div>
            <strong>{space}%</strong>
            <span>left unplanned</span>
          </div>
        </div>
        <div className="un-space-input">
          <label htmlFor="un-space">Make a little room</label>
          <input
            id="un-space"
            type="range"
            min="10"
            max="90"
            value={space}
            onChange={(e) => setSpace(Number(e.target.value))}
          />
          <span aria-live="polite">
            Around {hours} of 8 daytime hours planned.
            <br />
            The rest can just be yours.
          </span>
        </div>
      </section>
      <section className="un-landscape">
        <img
          src={image("rail")}
          alt="An alpine train winding through open green hills"
          loading="lazy"
        />
        <div>
          <p>
            Some of the best parts
            <br />
            happen between places.
          </p>
          <span>The journey gets a place in your plan.</span>
        </div>
      </section>
      <section className="un-day">
        <span>A little shape. A little give.</span>
        <h2>
          Enough direction.
          <br />
          No need to rush.
        </h2>
        <div className="un-day-strip">
          <time>Morning</time>
          <p>
            A good breakfast.
            <br />A place you’ve been curious about.
          </p>
          <span>Start gently</span>
        </div>
        <div className="un-day-strip un-day-space">
          <time>Afternoon</time>
          <p>
            {quiet
              ? "A slow coffee. Then nothing in particular."
              : "A walk, if you feel like it."}
          </p>
          <button onClick={() => setQuiet((q) => !q)}>
            {quiet ? "Bring back the walk" : "Make this afternoon quieter"}
          </button>
        </div>
        <div className="un-day-strip">
          <time>20:00</time>
          <p>Dinner you’ve already booked.</p>
          <span>Keep this time fixed</span>
        </div>
        <Note />
      </section>
      <section className="un-reading">
        <h2>
          The practical things,
          <br />
          quietly considered.
        </h2>
        <div className="un-tabs">
          {["Staying", "Moving", "Spending", "Knowing"].map((t) => (
            <button key={t} aria-pressed={tab === t} onClick={() => setTab(t)}>
              {t}
            </button>
          ))}
        </div>
        <div className="un-reading-text" key={tab}>
          <span>{tab}</span>
          <p>
            {tab === "Staying"
              ? "A place near the things you want to do. Check-in and check-out times that fit your journey. Room for stays you’ve already booked."
              : tab === "Moving"
                ? "Multiple destinations, connected by real travel time. Local routes and intercity transfers, with breathing room between arrival and the next thing."
                : tab === "Spending"
                  ? "The stay, the journey, the small things along the way. Estimated costs in one view. Unpriced items remain visible, rather than disappearing from the total."
                  : "Photos, source links and attributed traveler reviews. Live information when available; clear uncertainty when it isn’t. AI summaries, if offered, labeled as AI and fallible."}
          </p>
        </div>
      </section>
      <section className="un-invite">
        <p>You can begin without knowing every detail.</p>
        <h2>
          Somewhere.
          <br />
          At your own pace.
        </h2>
        <Begin label="Plan a little time away" />
        <a href="/trips/demo">Or wander through a sample trip.</a>
      </section>
    </World>
  );
}

export function Parallel() {
  const [reveal, setReveal] = useState(56);
  const [day, setDay] = useState(0);
  const [change, setChange] = useState(false);
  const [applied, setApplied] = useState(false);
  const days = ["A change of view", "A change of pace", "A change of plan"];
  return (
    <World name="parallel">
      <header className="pa-nav">
        <Back />
        <span>Same you. A different week.</span>
        <a href="#experience">Explore the other side ↙</a>
      </header>
      <section
        className="pa-hero"
        style={{ "--reveal": `${100 - reveal}%` } as CSSProperties}
      >
        <div className="pa-city">
          <img
            src={image("city")}
            alt="An everyday rainy city street"
            fetchPriority="high"
          />
        </div>
        <div className="pa-away">
          <img
            src={image("island")}
            alt="Open blue water around a quiet green island"
            fetchPriority="high"
          />
        </div>
        <div className="pa-title">
          <p>Somewhere between here and what’s next.</p>
          <h1>
            Another version
            <br />
            of your week.
          </h1>
        </div>
        <div className="pa-divider">
          <span aria-hidden="true">↔</span>
        </div>
        <div className="pa-reveal-control">
          <label htmlFor="pa-reveal">A little more elsewhere</label>
          <input
            id="pa-reveal"
            type="range"
            min="5"
            max="95"
            value={reveal}
            onChange={(e) => setReveal(Number(e.target.value))}
          />
          <div>
            <span>Your usual view</span>
            <span>Something different</span>
          </div>
        </div>
      </section>
      <section className="pa-week" id="experience">
        <div>
          <p>The details make the difference.</p>
          <h2>
            You don’t need
            <br />a different life.
          </h2>
          <span>Just a little time outside the usual one.</span>
        </div>
        <div className="pa-week-tabs">
          {days.map((d, i) => (
            <button key={d} aria-pressed={day === i} onClick={() => setDay(i)}>
              {d}
            </button>
          ))}
        </div>
        <div className="pa-versions" key={day}>
          <div>
            <span>This week</span>
            <h3>
              {day === 0
                ? "Same streets."
                : day === 1
                  ? "Every minute spoken for."
                  : "One change. Ten tabs."}
            </h3>
            <p>
              {day === 0
                ? "The route you could walk with your eyes closed."
                : day === 1
                  ? "The usual full calendar. Always one more thing."
                  : "A delay or a downpour, and the plan starts to unravel."}
            </p>
          </div>
          <div>
            <span>Your week, elsewhere</span>
            <h3>
              {day === 0
                ? "A new way to look."
                : day === 1
                  ? "A little room between things."
                  : "A different plan. Still your trip."}
            </h3>
            <p>
              {day === 0
                ? "Gather places that make you curious. Shape a route when you’re ready."
                : day === 1
                  ? "Set your own pace. Leave free time without making the trip feel unfinished."
                  : "Review an alternative with your commitments and cost changes clearly in view."}
            </p>
          </div>
        </div>
      </section>
      <section className="pa-rails">
        <h2>
          The feeling of escape.
          <br />
          The details, connected.
        </h2>
        <div>
          <article>
            <span>Places</span>
            <strong>Follow the curiosity.</strong>
            <p>
              Research, photos and available traveler perspectives. A shortlist
              before a schedule.
            </p>
          </article>
          <article>
            <span>Stays + journeys</span>
            <strong>Make the pieces fit.</strong>
            <p>
              Accommodation, intercity transfers and local routes beside the
              right days.
            </p>
          </article>
          <article>
            <span>Time + budget</span>
            <strong>See what a choice changes.</strong>
            <p>
              Flexible dates, estimates and breathing room. Unknowns stay in the
              picture.
            </p>
          </article>
        </div>
      </section>
      <section className="pa-change">
        <div>
          <h2>
            One afternoon.
            <br />
            Two possibilities.
          </h2>
          <p>
            Move between the original plan and a rainy-day proposal. Your booked
            dinner stays at eight.
          </p>
          <button
            className="nw-go"
            onClick={() => {
              setChange((c) => !c);
              setApplied(false);
            }}
          >
            {change ? "Show the original" : "Reveal the rainy-day proposal"}
          </button>
        </div>
        <div className={`pa-plan-duo ${change ? "pa-changed" : ""}`}>
          <div>
            <small>Original afternoon</small>
            <time>14:00</time>
            <h3>A wandering walk.</h3>
            <span>Outdoors. Flexible.</span>
          </div>
          <div>
            <small>
              {change ? "Proposed afternoon" : "An alternative, if needed"}
            </small>
            <time>14:30</time>
            <h3>
              Museum. Coffee.
              <br />
              No umbrella required.
            </h3>
            <span>Illustrative cost difference: +₹300</span>
          </div>
          <p>20:00 · Dinner remains fixed in both plans.</p>
        </div>
        {change ? (
          <button
            className="nw-line-button pa-accept"
            onClick={() => setApplied((a) => !a)}
          >
            {applied
              ? "Accepted in this demo · undo"
              : "Accept this alternative"}
          </button>
        ) : null}
        <Note />
      </section>
      <section className="pa-trust">
        <h2>
          A clearer picture.
          <br />
          Even of the unknowns.
        </h2>
        <div>
          <p>
            Know where information came from, when it was checked and which
            costs are still estimates.
          </p>
          <p>
            Review samples remain attributed. AI summaries are labeled,
            fallible, and linked back to their sources.
          </p>
          <p>
            Choosing an option doesn’t book it. Accepting an itinerary revision
            doesn’t change supplier reservations.
          </p>
        </div>
      </section>
      <section className="pa-end">
        <span>There’s another way this week could go.</span>
        <h2>
          Meet yourself
          <br />
          somewhere else.
        </h2>
        <Begin />
      </section>
    </World>
  );
}
