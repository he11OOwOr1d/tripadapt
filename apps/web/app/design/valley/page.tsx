"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import "./valley.css";

const scenes = [
  "The valley",
  "Come along",
  "Follow a feeling",
  "Connect the journey",
  "Your own pace",
  "A change of plans",
  "Back to the grass",
];
const spritePositions = [
  "0% 0%",
  "50% 0%",
  "100% 0%",
  "0% 100%",
  "50% 100%",
  "100% 100%",
];
const possibilities = [
  {
    name: "Mountain mornings",
    image: "/images/valley/landscape.webp",
    note: "A little perspective. A slower start.",
    type: "Mountain inspiration",
  },
  {
    name: "Somewhere by the sea",
    image: "/images/new-worlds/island.jpg",
    note: "Long afternoons. No particular hurry.",
    type: "Coastal inspiration",
  },
  {
    name: "A little beautifully lost",
    image: "/images/design/village.jpg",
    note: "New streets. A very long lunch.",
    type: "Town inspiration",
  },
];
const reasons = {
  Rain: {
    title: "Museum, then a slow coffee",
    time: "14:30",
    description: "A nearby indoor afternoon instead of the outdoor walk.",
    difference: "+₹300",
    label: "An indoor alternative",
  },
  "Running late": {
    title: "A shorter walk after arrival",
    time: "16:00",
    description:
      "Less to fit in after the transfer, with time to reach dinner.",
    difference: "₹0",
    label: "A little less, a little later",
  },
  "Taking it slower": {
    title: "A café, then nowhere to be",
    time: "15:00",
    description:
      "Trade the longer walk for a quiet afternoon close to your stay.",
    difference: "−₹200",
    label: "Room to recharge",
  },
};
type Reason = keyof typeof reasons;

function FlowingWorld() {
  return (
    <div className="vv-world" aria-hidden="true">
      <div className="vv-sky" />
      <div className="vv-artboard">
        <img
          className="vv-landscape"
          src="/images/valley/landscape.webp"
          alt=""
          fetchPriority="high"
        />
        <div className="vv-sun" />
        <img className="vv-clouds" src="/images/valley/clouds.webp" alt="" />
        <svg className="vv-river" viewBox="0 0 1672 941">
          <defs>
            <clipPath id="valley-river-clip">
              <path d="M819 529 C793 556 678 568 635 599 C548 652 658 684 727 728 C808 778 1003 800 1115 941 L1487 941 C1343 847 1136 783 1070 707 C1017 644 915 610 879 570 L859 529Z" />
            </clipPath>
            <pattern
              id="valley-ripples"
              width="135"
              height="60"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M12 18 Q35 11 59 18 M76 43 Q94 36 118 43"
                fill="none"
                stroke="#d9ffff"
                strokeWidth="1.3"
              />
            </pattern>
          </defs>
          <g clipPath="url(#valley-river-clip)">
            <rect
              className="vv-ripple-field"
              x="430"
              y="470"
              width="1100"
              height="650"
              fill="url(#valley-ripples)"
            />
          </g>
        </svg>
        <div className="vv-sunlight" />
        <svg className="vv-grass" viewBox="0 0 1672 941">
          {Array.from({ length: 72 }, (_, i) => {
            const x = i < 50 ? 20 + i * 11.3 : 1440 + (i - 50) * 10.4;
            const y = 870 + (i % 7) * 10;
            return (
              <g
                key={i}
                style={
                  { "--blade-delay": `${(i % 9) * -0.43}s` } as CSSProperties
                }
              >
                <path
                  d={`M${x} ${y} q-3 -24 -12 -39 M${x} ${y} q0 -29 9 -48 M${x} ${y} q-2 -16 18 -31`}
                  fill="none"
                  stroke={i % 3 ? "#80a851" : "#c5c776"}
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </g>
            );
          })}
        </svg>
        <img
          className="vv-backpack"
          src="/images/valley/backpack.webp"
          alt=""
        />
        <div className="vv-smoke">
          <i />
          <i />
          <i />
        </div>
      </div>
      <div className="vv-mobile-meadow" />
      <svg
        className="vv-mobile-river"
        viewBox="0 0 400 300"
        preserveAspectRatio="none"
      >
        <defs>
          <clipPath id="mobile-water-clip">
            <path d="M168 0 C184 75 166 135 138 190 C117 245 85 280 65 300 H342 C331 235 306 177 300 124 C294 70 315 29 322 0Z" />
          </clipPath>
        </defs>
        <g clipPath="url(#mobile-water-clip)">
          <image
            href="/images/valley/landscape.webp"
            x="-1200"
            y="-1700"
            width="2400"
            height="2000"
            preserveAspectRatio="none"
          />
          <rect width="400" height="300" fill="#75bac0" opacity=".12" />
        </g>
      </svg>
      <div className="vv-weather-wash" />
      <div className="vv-rain" />
      <div className="vv-lightning" />
    </div>
  );
}

export default function ValleyLanding() {
  const root = useRef<HTMLElement>(null);
  const [scene, setScene] = useState(0);
  const [pose, setPose] = useState(0);
  const [weather, setWeather] = useState<"rain" | "clearing" | "sunny">("rain");
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [viewOnly, setViewOnly] = useState(false);
  const [thought, setThought] = useState(false);
  const [cottage, setCottage] = useState(false);
  const [chosen, setChosen] = useState(0);
  const [saved, setSaved] = useState<string[]>([]);
  const [nights, setNights] = useState([3, 4]);
  const [swapped, setSwapped] = useState(false);
  const [pace, setPace] = useState("A little of both");
  const [reason, setReason] = useState<Reason>("Rain");
  const [proposal, setProposal] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const change = reasons[reason];
  const stays = nights.reduce((a, b) => a + b, 0) * 2800;
  const number = (n: number) => `₹${n.toLocaleString("en-IN")}`;

  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      setReduced(media.matches);
      if (media.matches) {
        setPaused(true);
        setWeather("sunny");
      }
    };
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  useEffect(() => {
    if (paused || reduced || weather === "sunny") return;
    const timer = setTimeout(
      () => setWeather(weather === "rain" ? "clearing" : "sunny"),
      weather === "rain" ? 8000 : 4000,
    );
    return () => clearTimeout(timer);
  }, [weather, paused, reduced]);
  useEffect(() => {
    if (viewOnly) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting)
            setScene(Number((entry.target as HTMLElement).dataset.scene));
        });
      },
      { rootMargin: "-28% 0px -45% 0px", threshold: 0 },
    );
    root.current
      ?.querySelectorAll<HTMLElement>("[data-scene]")
      .forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [viewOnly]);
  useEffect(() => {
    const target =
      scene === 0 || scene === 6 ? 0 : scene === 5 ? 5 : scene >= 3 ? 4 : 3;
    if (paused || reduced || scene === 0) {
      setPose(target);
      return;
    }
    setPose(scene === 1 ? 1 : 2);
    const walking = setTimeout(() => setPose(scene === 6 ? 1 : 2), 450);
    const settle = setTimeout(() => setPose(target), 1150);
    return () => {
      clearTimeout(walking);
      clearTimeout(settle);
    };
  }, [scene, paused, reduced]);
  useEffect(() => {
    if (!thought) return;
    const t = setTimeout(() => setThought(false), 4800);
    return () => clearTimeout(t);
  }, [thought]);

  const goTo = (index: number) => {
    setViewOnly(false);
    document
      .getElementById(`valley-${index}`)
      ?.scrollIntoView({ behavior: paused || reduced ? "instant" : "smooth" });
  };
  return (
    <main
      ref={root}
      className={`valley-visit vv-scene-${scene} vv-weather-${weather}${paused || reduced ? " vv-still" : ""}${viewOnly ? " vv-view-only" : ""}${cottage ? " vv-cottage-lit" : ""}`}
    >
      <a className="vv-skip" href="#valley-1">
        Skip to the introduction
      </a>
      <FlowingWorld />
      <div className="vv-story-shade" />
      <div className={`vv-actor vv-pose-${pose}`} aria-hidden="true">
        <div className="vv-actor-shadow" />
        <div
          className="vv-traveler"
          style={{ backgroundPosition: spritePositions[pose] }}
        />
      </div>
      {(scene === 0 || scene === 6) && !viewOnly ? (
        <button
          className="vv-poke"
          aria-label="Say hello to the resting traveler"
          onClick={() => setThought((t) => !t)}
        >
          <span>Say hello</span>
        </button>
      ) : null}
      {thought ? (
        <div className="vv-thought" role="status">
          Don’t annoy me.
          <br />
          <span>I’m very busy doing absolutely nothing.</span>
        </div>
      ) : null}
      <header className="vv-nav">
        <a className="vv-brand" href="/design/options">
          <span aria-hidden="true">✳</span> elsewhere.
        </a>
        <span className="vv-nav-caption">
          A little further from the everyday.
        </span>
        <button
          className="vv-view-toggle"
          aria-pressed={viewOnly}
          onClick={() => {
            setViewOnly((v) => !v);
            if (!viewOnly) {
              setScene(0);
              window.scrollTo({ top: 0, behavior: "instant" });
            }
          }}
        >
          {viewOnly ? "Come back to the story" : "Just the view"}
          <span aria-hidden="true">↗</span>
        </button>
      </header>
      <div className="vv-controls">
        <div className="vv-weather-status">
          <span aria-hidden="true">
            {weather === "sunny" ? "☀" : weather === "clearing" ? "☁" : "☂"}
          </span>
          <div>
            {weather === "sunny"
              ? "Nowhere to rush."
              : weather === "clearing"
                ? "Here comes the sun."
                : "Even the rain gets a little break."}
            <small>
              {weather === "sunny"
                ? "Clear skies. A very good place to pause."
                : "Same valley. A little change in the weather."}
            </small>
          </div>
        </div>
        <div className="vv-scene-controls">
          {weather !== "sunny" ? (
            <button onClick={() => setWeather("sunny")}>
              Skip to sunshine
            </button>
          ) : (
            <button onClick={() => setWeather("rain")}>Replay the rain</button>
          )}
          <button aria-pressed={paused} onClick={() => setPaused((p) => !p)}>
            {paused ? "▷ Resume scene" : "Ⅱ Pause scene"}
          </button>
        </div>
      </div>
      <nav className="vv-chapters" aria-label="Chapters in the valley">
        {scenes.map((s, i) => (
          <button
            key={s}
            aria-label={`Go to ${s}`}
            aria-current={scene === i ? "step" : undefined}
            onClick={() => goTo(i)}
          >
            <i />
            <span>{s}</span>
          </button>
        ))}
      </nav>
      <div className="vv-story-content" aria-hidden={viewOnly}>
        <section className="vv-hero vv-section" id="valley-0" data-scene="0">
          <div className="vv-hero-copy">
            <p>Take a little time for a different view.</p>
            <h1>
              Some days, you need
              <br />a different view.
            </h1>
            <span>A little room to wander. A little time to stay.</span>
            <a className="vv-primary" href="/trips/new">
              Find my elsewhere <span>↗</span>
            </a>
          </div>
          <button className="vv-come-along" onClick={() => goTo(1)}>
            Come along. There’s a little more to this place.
            <span aria-hidden="true">↓</span>
          </button>
          <button
            className="vv-cottage-hotspot"
            aria-label="Look inside the little cottage"
            aria-pressed={cottage}
            onClick={() => setCottage((c) => !c)}
          >
            <span>⌂</span>
          </button>
          {cottage ? (
            <div className="vv-cottage-note" role="status">
              A little place to come back to.
              <small>Accommodation inspiration, not a bookable property.</small>
            </div>
          ) : null}
        </section>
        <section className="vv-section vv-meet" id="valley-1" data-scene="1">
          <div className="vv-narrative">
            <span className="vv-dialogue">
              “Come on, come on. You’ve seen the view…”
            </span>
            <h2>
              Want to feel
              <br />a little more like this?
            </h2>
            <p>
              I came for the mountains. Stayed for the very important business
              of doing nothing.
            </p>
            <p>
              The getting here? That took a little planning.
              <br />
              Let me show you how the pieces fit.
            </p>
            <button className="vv-text-link" onClick={() => goTo(2)}>
              Let’s have a look <span>↓</span>
            </button>
          </div>
          <div className="vv-trail-label" aria-hidden="true">
            A little curiosity looks good on you.
          </div>
        </section>
        <section
          className="vv-section vv-discover"
          id="valley-2"
          data-scene="2"
        >
          <div className="vv-discovery-panel">
            <span className="vv-dialogue">
              “I knew I needed a break. Where to go? Absolutely no idea.”
            </span>
            <h2>
              Follow what
              <br />
              catches your eye.
            </h2>
            <p>
              Mountains might be my thing. Yours could be a coast, a city, or a
              little of everything.
            </p>
            <div
              className="vv-possibilities"
              aria-label="Choose travel inspiration"
            >
              {possibilities.map((p, i) => (
                <button
                  className={chosen === i ? "vv-chosen" : ""}
                  aria-pressed={chosen === i}
                  key={p.name}
                  onClick={() => setChosen(i)}
                >
                  <img src={p.image} alt={p.type} loading="lazy" />
                  <span>{p.name}</span>
                </button>
              ))}
            </div>
            <div className="vv-place-note" aria-live="polite">
              <div>
                <strong>{possibilities[chosen].name}</strong>
                <p>{possibilities[chosen].note}</p>
                <small>
                  Landscape inspiration · no live prices or ratings.
                </small>
              </div>
              <button
                aria-pressed={saved.includes(possibilities[chosen].name)}
                onClick={() =>
                  setSaved((s) =>
                    s.includes(possibilities[chosen].name)
                      ? s.filter((x) => x !== possibilities[chosen].name)
                      : [...s, possibilities[chosen].name],
                  )
                }
              >
                {saved.includes(possibilities[chosen].name)
                  ? "Kept for this visit ✓"
                  : "+ Keep this possibility"}
              </button>
            </div>
            <details className="vv-research">
              <summary>
                A little more than a pretty picture.<span>+</span>
              </summary>
              <p>
                Explore available hours, photos, source links and attributed
                traveler reviews before adding a place. Missing details stay
                unknown. AI review summaries, if offered, are labeled as
                AI-generated and may contain mistakes.
              </p>
            </details>
            <div className="vv-saved" aria-live="polite">
              {saved.length
                ? `${saved.length} ${saved.length === 1 ? "possibility" : "possibilities"} kept. A good beginning.`
                : "No dates needed to get curious."}
              <button onClick={() => goTo(3)}>Unfold the map ↘</button>
            </div>
          </div>
        </section>
        <section
          className="vv-section vv-map-scene"
          id="valley-3"
          data-scene="3"
        >
          <div className="vv-map-introduction">
            <span className="vv-dialogue">
              “Then one place became three. This kept the journey making sense.”
            </span>
            <h2>
              A few places.
              <br />
              One journey.
            </h2>
          </div>
          <div className="vv-workspace">
            <div className="vv-workspace-head">
              <div>
                <span className="vv-map-emblem" aria-hidden="true">
                  ⌖
                </span>
                <div>
                  <strong>A few days in Rajasthan</strong>
                  <small>Sample trip · flexible dates · 2 travelers</small>
                </div>
              </div>
              <span className="vv-preview-pill">An editable outline</span>
            </div>
            {saved.length ? (
              <div className="vv-carried-ideas">
                From your possibilities: {saved.join(" / ")}
              </div>
            ) : null}
            <div className="vv-workspace-body">
              <div className="vv-stop-list">
                <span className="vv-start-stop">
                  Delhi · where the journey begins
                </span>
                {[
                  swapped ? "Udaipur" : "Jaipur",
                  swapped ? "Jaipur" : "Udaipur",
                ].map((city, i) => (
                  <div className="vv-stop" key={city}>
                    <div>
                      <span className="vv-route-dot" />
                      <h3>{city}</h3>
                      <small>
                        {city === "Jaipur"
                          ? "Old streets and a little discovery"
                          : "Time by the water"}
                      </small>
                    </div>
                    <div className="vv-night-controls">
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
                    <span className="vv-stay-anchor">
                      ⌂ A stay near your plans
                    </span>
                  </div>
                ))}
                <span className="vv-return-stop">
                  Delhi · return when you’re ready
                </span>
                <button
                  className="vv-reorder"
                  onClick={() => {
                    setSwapped((s) => !s);
                    setNights((n) => [...n].reverse());
                  }}
                >
                  ⇅ Swap the two stays
                </button>
                <small className="vv-estimate-note">
                  Changing the route affects stays and connections. Live travel
                  times still need checking.
                </small>
              </div>
              <div className="vv-paper-map">
                <svg viewBox="0 0 480 310" aria-hidden="true">
                  <path
                    className="vv-contours"
                    d="M-20 65Q100-20 190 65T500 60 M-20 95Q100 10 190 95T500 90 M-20 125Q100 40 190 125T500 120 M-20 155Q100 70 190 155T500 150 M-20 185Q100 100 190 185T500 180 M-20 215Q100 130 190 215T500 210 M-20 245Q100 160 190 245T500 240"
                  />
                  <path
                    className="vv-map-road"
                    d="M355 60Q300 180 225 133T95 245Q340 280 355 60"
                  />
                  <circle cx="355" cy="60" r="7" />
                  <circle cx="225" cy="133" r="7" />
                  <circle cx="95" cy="245" r="7" />
                  <text x="368" y="55">
                    Delhi
                  </text>
                  <text x="240" y="126">
                    {swapped ? "Udaipur" : "Jaipur"}
                  </text>
                  <text x="110" y="250">
                    {swapped ? "Jaipur" : "Udaipur"}
                  </text>
                </svg>
                <span>Route sketch · not a geographic map</span>
                <div className="vv-connection-note">
                  <strong>The journey belongs here, too.</strong>
                  <p>
                    Stays, transfers and local travel fit around your days.
                    Existing bookings can come with you.
                  </p>
                </div>
              </div>
            </div>
            <div className="vv-budget-strip">
              <div>
                <span>Stays</span>
                <strong>{number(stays)}</strong>
              </div>
              <div>
                <span>Travel allowance</span>
                <strong>₹5,400</strong>
              </div>
              <div>
                <span>Activity allowance</span>
                <strong>₹2,400</strong>
              </div>
              <div className="vv-budget-total" aria-live="polite">
                <span>Estimated subtotal</span>
                <strong>{number(stays + 7800)}</strong>
              </div>
            </div>
            <p className="vv-workspace-note">
              Illustrative allowances: ₹2,800 per room/night. Food, taxes and
              fees remain unpriced. Selecting a stay or a route does not book
              it.
            </p>
          </div>
        </section>
        <section
          className="vv-section vv-pace-scene"
          id="valley-4"
          data-scene="4"
        >
          <div className="vv-pace-panel">
            <span className="vv-dialogue">
              “My one condition: leave time for absolutely nothing.”
            </span>
            <h2>
              You don’t have to
              <br />
              fill every hour.
            </h2>
            <p>Your days can have direction and a little breathing room.</p>
            <div
              className="vv-pace-controls"
              aria-label="Try a sample travel pace"
            >
              {["Slow and spacious", "A little of both", "More exploring"].map(
                (p) => (
                  <button
                    key={p}
                    aria-pressed={pace === p}
                    onClick={() => setPace(p)}
                  >
                    {p}
                  </button>
                ),
              )}
            </div>
            <div className="vv-day" key={pace} aria-live="polite">
              <div>
                <time>09:30</time>
                <span>
                  A palace, then a little wandering.
                  <small>A sample morning in Jaipur.</small>
                </span>
              </div>
              <div>
                <time>12:30</time>
                <span>Lunch. A proper pause.</span>
              </div>
              {pace === "More exploring" ? (
                <div>
                  <time>14:00</time>
                  <span>
                    A museum and a market walk.
                    <small>More to see, with travel time to check.</small>
                  </span>
                </div>
              ) : (
                <div className="vv-free-time">
                  <time>14:00</time>
                  <span>
                    {pace === "Slow and spacious"
                      ? "Nowhere you need to be."
                      : "A walk, then a slow coffee."}
                    <small>
                      {pace === "Slow and spacious"
                        ? "Intentionally left open. This counts as a plan."
                        : "A little discovery. A little time to yourself."}
                    </small>
                  </span>
                  <i aria-hidden="true">☁</i>
                </div>
              )}
              <div className="vv-fixed">
                <time>20:00</time>
                <span>
                  Dinner with a view.<small>Keep fixed · eight o’clock</small>
                </span>
                <span className="vv-lock" aria-label="Fixed time">
                  ⌑
                </span>
              </div>
            </div>
            <small className="vv-demo-caption">
              A pace preview. Your accepted trip is unchanged.
            </small>
          </div>
        </section>
        <section
          className="vv-section vv-change-scene"
          id="valley-5"
          data-scene="5"
        >
          <div className="vv-change-panel">
            <span className="vv-dialogue">
              “The weather had other ideas. We worked around it.”
            </span>
            <h2>
              The day changed.
              <br />
              Your trip can too.
            </h2>
            <p>A little adjustment. The important things stay put.</p>
            <div
              className="vv-change-triggers"
              aria-label="Choose a sample change"
            >
              {(Object.keys(reasons) as Reason[]).map((r) => (
                <button
                  key={r}
                  aria-pressed={reason === r}
                  onClick={() => {
                    setReason(r);
                    setProposal(false);
                    setAccepted(false);
                  }}
                >
                  {r === "Rain" ? "☂ " : r === "Running late" ? "◷ " : "☁ "}
                  {r}
                </button>
              ))}
            </div>
            <div className="vv-revision-status" aria-live="polite">
              {accepted
                ? "Accepted in this demo"
                : proposal
                  ? "Proposed revision · not yet applied"
                  : "Your current afternoon"}
            </div>
            <div className="vv-revision-preview">
              <div className={proposal || accepted ? "vv-removed" : ""}>
                <time>14:00</time>
                <strong>A walk through the old city</strong>
                <small>
                  {proposal || accepted
                    ? "Replaced in this alternative"
                    : "Outdoors · flexible"}
                </small>
              </div>
              {proposal || accepted ? (
                <div className="vv-added" key={reason}>
                  <time>{change.time}</time>
                  <strong>{change.title}</strong>
                  <small>{change.description}</small>
                  <span>
                    {change.label} · estimated activity difference{" "}
                    {change.difference}
                  </span>
                </div>
              ) : null}
              <div className="vv-dinner-kept">
                <time>20:00</time>
                <strong>Dinner stays at eight.</strong>
                <small>Fixed commitment · unchanged</small>
              </div>
            </div>
            <div className="vv-revision-actions">
              {accepted ? (
                <button
                  className="vv-primary"
                  onClick={() => {
                    setAccepted(false);
                    setProposal(false);
                  }}
                >
                  Restore the original
                </button>
              ) : proposal ? (
                <>
                  <button
                    className="vv-primary"
                    onClick={() => setAccepted(true)}
                  >
                    Accept this change ✓
                  </button>
                  <button
                    className="vv-text-link"
                    onClick={() => setProposal(false)}
                  >
                    Keep my current plan
                  </button>
                </>
              ) : (
                <button
                  className="vv-primary"
                  onClick={() => setProposal(true)}
                >
                  Preview an alternative <span>↗</span>
                </button>
              )}
            </div>
            <p className="vv-demo-caption">
              Illustrative scenario, not a live forecast. No reservations are
              changed. Travel times, availability and any booking actions must
              be checked before a real revision.
            </p>
          </div>
        </section>
        <section
          className="vv-section vv-rest-scene"
          id="valley-6"
          data-scene="6"
        >
          <div className="vv-rest-copy">
            <span className="vv-dialogue">
              “Oh man. Enough productivity. My grass is waiting.”
            </span>
            <h2>
              He’s found his spot.
              <br />
              Where’s yours?
            </h2>
            <p>Somewhere new. A little room to be you.</p>
            <a className="vv-primary" href="/trips/new">
              Find my elsewhere <span>↗</span>
            </a>
            <a className="vv-direct" href="/trips/demo">
              Or explore a sample trip
            </a>
          </div>
          <footer className="vv-footer">
            <a href="/design/options">Back to all designs</a>
            <span>elsewhere. A little room for life.</span>
            <small>
              A layered 2D design, with illustrative trip details and generated
              artwork.
            </small>
          </footer>
        </section>
      </div>
    </main>
  );
}
