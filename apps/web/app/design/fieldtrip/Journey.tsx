"use client";
import { useEffect, useRef, useState } from "react";
import { Cabin, type Landscape } from "./TravelWorld";
import ChapterArt from "./ChapterArt";

const escapes: {
  name: string;
  kind: Landscape;
  origin: string;
  stops: { name: string; detail: string; tag: string; x: number; y: number }[];
}[] = [
  {
    name: "Into the mountains",
    kind: "mountain",
    origin: "Delhi",
    stops: [
      {
        name: "Jibhi",
        detail: "A wooden stay, a forest trail, and the sound of water.",
        tag: "For a slower morning",
        x: 34,
        y: 62,
      },
      {
        name: "Sainj",
        detail:
          "Village paths and a valley with a little more room to breathe.",
        tag: "For the long way round",
        x: 77,
        y: 66,
      },
      {
        name: "Shangarh",
        detail: "An open meadow. A picnic. An afternoon you leave unplanned.",
        tag: "For doing very little",
        x: 23,
        y: 83,
      },
    ],
  },
  {
    name: "Along the coast",
    kind: "coast",
    origin: "Kochi",
    stops: [
      {
        name: "Varkala",
        detail: "A cliffside walk and a morning that follows the tide.",
        tag: "For a little sea air",
        x: 29,
        y: 67,
      },
      {
        name: "Fort Kochi",
        detail: "Old streets, small cafés and the water never far away.",
        tag: "For wandering on foot",
        x: 78,
        y: 76,
      },
      {
        name: "Marari",
        detail: "A stretch of sand, palms, and a very good place to pause.",
        tag: "For a quieter shore",
        x: 52,
        y: 72,
      },
    ],
  },
  {
    name: "A different everyday",
    kind: "town",
    origin: "Chennai",
    stops: [
      {
        name: "Puducherry",
        detail: "Shaded courtyards and a street you have not walked before.",
        tag: "For a change of rhythm",
        x: 26,
        y: 59,
      },
      {
        name: "Mamallapuram",
        detail: "Stone-carving lanes, a little history and the sea beyond.",
        tag: "For following your curiosity",
        x: 72,
        y: 61,
      },
      {
        name: "Auroville",
        detail: "Green lanes, a studio visit and time for a longer lunch.",
        tag: "For an open afternoon",
        x: 55,
        y: 78,
      },
    ],
  },
];
type Stop = { name: string; nights: number };
function Arrow() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      aria-hidden="true"
    >
      <path d="M4 12h16m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
function Pin({ small = false }: { small?: boolean }) {
  return (
    <svg
      width={small ? 17 : 29}
      height={small ? 21 : 36}
      viewBox="0 0 30 38"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M15 36S2 23 2 15a13 13 0 0 1 26 0c0 8-13 21-13 21Z"
        fill="currentColor"
      />
      <circle cx="15" cy="15" r="4" fill="#fff1cb" />
    </svg>
  );
}
function WeatherIcon({ rain = false }: { rain?: boolean }) {
  return (
    <svg
      viewBox="0 0 40 40"
      width="28"
      height="28"
      fill="none"
      aria-hidden="true"
    >
      {rain ? (
        <>
          <path
            d="M8 24C0 22 5 11 13 13C15 2 32 6 31 16C40 16 40 26 31 26H9"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <path
            d="m13 30-3 6m13-6-3 6m13-6-3 6"
            stroke="currentColor"
            strokeWidth="1.6"
          />
        </>
      ) : (
        <>
          <circle
            cx="20"
            cy="20"
            r="7"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M20 1v7m0 24v7M1 20h7m24 0h7M6 6l5 5m18 18 5 5M6 34l5-5m18-18 5-5"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </>
      )}
    </svg>
  );
}
function TravelBus({ privateRide = false }: { privateRide?: boolean }) {
  if (privateRide)
    return (
      <svg viewBox="0 0 92 60" width="80" height="52" aria-hidden="true">
        <path
          d="M5 33L15 28L26 13H60L73 28L85 33V44H5Z"
          fill="#9eae8a"
          stroke="#5b6850"
          strokeWidth="2"
        />
        <path d="M29 18H56L65 28H21Z" fill="#c8d9ce" />
        <path d="M43 18V29" stroke="#7e9277" strokeWidth="3" />
        <path d="M6 36H84" stroke="#d6d9b5" strokeWidth="2" />
        <circle cx="23" cy="43" r="8" fill="#3e5043" />
        <circle cx="69" cy="43" r="8" fill="#3e5043" />
        <circle cx="23" cy="43" r="3" fill="#bfc4a9" />
        <circle cx="69" cy="43" r="3" fill="#bfc4a9" />
      </svg>
    );
  return (
    <svg viewBox="0 0 92 60" width="80" height="52" aria-hidden="true">
      <path
        d="M7 11Q6 6 14 6H73Q83 6 85 17L89 42H4V22Z"
        fill="#d8c8a0"
        stroke="#5b6850"
        strokeWidth="2"
      />
      <path d="M13 13H72L77 27H13Z" fill="#9ab9af" />
      <path d="M28 13V27m16-14V27m16-14V27" stroke="#d8c8a0" strokeWidth="3" />
      <path d="M6 33H86M57 33V41" stroke="#b18a65" strokeWidth="3" />
      <circle cx="22" cy="43" r="8" fill="#3e5043" />
      <circle cx="72" cy="43" r="8" fill="#3e5043" />
      <circle cx="22" cy="43" r="3" fill="#bfc4a9" />
      <circle cx="72" cy="43" r="3" fill="#bfc4a9" />
      <path d="M16 3H65" stroke="#746a52" strokeWidth="3" />
    </svg>
  );
}
function TrailMap({
  stops,
  origin,
  ride,
}: {
  stops: Stop[];
  origin: string;
  ride: boolean;
}) {
  const [preview,setPreview]=useState(0);
  const points = stops.map((stop, i) => ({
    ...stop,
    x: (0.26 + (0.73 / stops.length) * (i + 0.5)) * 1100,
    y: i % 2 ? 194 : 155,
  }));
  const routePoints = [{ x: 63, y: 178 }, ...points, { x: 1060, y: 181 }];
  const road = routePoints.reduce((path, point, i) => {
    if (!i) return `M${point.x} ${point.y}`;
    const prev = routePoints[i - 1];
    const dx = (point.x - prev.x) * 0.45;
    const bend = Math.min(76, (point.x - prev.x) * 0.28);
    return `${path} C${prev.x + dx} ${prev.y + bend},${point.x - dx} ${point.y - bend * 0.7},${point.x} ${point.y}`;
  }, "");
  return (
    <div className="fw-route-world"><button className="fw-preview-route" onClick={()=>setPreview(value=>value+1)}>▷ Preview the journey</button>
      <svg viewBox="0 0 1100 290" aria-hidden="true" className="fw-route-art">
        <path
          d="M-40 193Q106 138 244 197T520 163T790 185T1150 152V310H-40Z"
          fill="#dfe6c7"
        />
        <path
          d="M-40 249Q187 192 366 242T713 225T1150 241V310H-40Z"
          fill="#cbd9ac"
        />
        <path d={road} stroke="#b5a181" strokeWidth="22" fill="none" />
        <path d={road} stroke="#f5ecd1" strokeWidth="15" fill="none" />
        <path
          d={road}
          stroke="#abb28e"
          strokeWidth="1.4"
          strokeDasharray="3 8"
          fill="none"
        />
        <g>
          {routePoints.slice(0, -1).map((point, i) => (
            <g key={i}>
              <circle
                cx={point.x}
                cy={point.y}
                r="7"
                fill="#faf4dd"
                stroke="#426c50"
                strokeWidth="1.5"
              />
              <circle cx={point.x} cy={point.y} r="2.5" fill="#426c50" />
            </g>
          ))}
        </g>
        <g
          key={preview}
          className={`fw-route-moving ${preview ? "fw-route-playing" : ""}`}
          style={{ offsetPath: `path('${road}')` }}
        >
          <rect x="-18" y="-17" width="36" height="18" rx="4" fill="#b0c099" stroke="#426c50"/><path d="M-12-13H12V-6H-12Z" fill="#f5ecd1"/><circle cx="-10" cy="1" r="4" fill="#426c50"/><circle cx="10" cy="1" r="4" fill="#426c50"/>
        </g>
      </svg>
      <div
        className="fw-map-origin"
        style={{ left: `${63 / 11}%`, top: `${178 / 2.9}%` }}
      >
        <span>{origin}</span>
        <i />
      </div>
      <div className="fw-map-stops">
        {points.map((stop, i) => (
          <div
            key={stop.name}
            className="fw-map-stop"
            style={{ left: `${stop.x / 11}%`, top: `${stop.y / 2.9}%` }}
          >
            <span>{stop.name}</span>
            <small>
              {stop.nights} {stop.nights === 1 ? "night" : "nights"}
            </small>
            <i />

          </div>
        ))}
      </div>
    </div>
  );
}

export default function Journey({
  paused,
  onPauseToggle,
}: {
  paused: boolean;
  onPauseToggle: () => void;
}) {
  const [feeling, setFeeling] = useState(0);
  const [place, setPlace] = useState(0);
  const [stops, setStops] = useState<Stop[]>([
    { name: "Jibhi", nights: 3 },
    { name: "Sainj", nights: 2 },
  ]);
  const [comfort, setComfort] = useState(false);
  const [ride, setRide] = useState(false);
  const [rain, setRain] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [notice, setNotice] = useState(
    "Two places to begin. Add one that calls you.",
  );
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          entry.target.classList.toggle("fw-in-view", entry.isIntersecting);
        });
      },
      { rootMargin: "100px" },
    );
    node
      .querySelectorAll(".fw-motion-scene")
      .forEach((scene) => observer.observe(scene));
    return () => observer.disconnect();
  }, []);
  const escape = escapes[feeling];
  const selected = escape.stops[place];
  const nights = stops.reduce((sum, stop) => sum + stop.nights, 0);
  const rate = comfort ? 2600 : 1800;
  const transfer = ride ? 6500 : 3500;
  const total = nights * rate + transfer + (accepted ? 450 : 0);
  const inTrip = stops.some((stop) => stop.name === selected.name);
  const currency = (n: number) => `₹${n.toLocaleString("en-IN")}`;
  function chooseFeeling(index: number) {
    if (index === feeling) return;
    setFeeling(index);
    setPlace(0);
    setRain(false);
    setAccepted(false);
    setStops(
      escapes[index].stops
        .slice(0, 2)
        .map((stop, i) => ({ name: stop.name, nights: i === 0 ? 3 : 2 })),
    );
    setNotice("A new direction. Two places to begin.");
  }
  function addStop() {
    if (inTrip) return;
    setStops((current) => [...current, { name: selected.name, nights: 2 }]);
    setNotice(
      `${selected.name} added. Your journey now has ${stops.length + 1} stops.`,
    );
  }
  function changeNights(name: string, delta: number) {
    setStops((current) =>
      current.map((stop) =>
        stop.name === name
          ? { ...stop, nights: Math.max(1, stop.nights + delta) }
          : stop,
      ),
    );
  }
  const morning =
    feeling === 0
      ? "The waterfall trail"
      : feeling === 1
        ? "A walk along the shore"
        : "The old-quarter walk";
  return (
    <div className={`fw ${paused ? "fw-paused" : ""}`} ref={root}>
      <div className="fw-earth-edge" aria-hidden="true">
        <svg viewBox="0 0 1440 90" preserveAspectRatio="none">
          <path d="M0 0H1440V14Q1247 76 1036 41T595 46T0 43Z" fill="#ad8463" />
          <path
            d="M0 42Q266 60 489 43T926 57T1440 21"
            fill="none"
            stroke="#b7c995"
            strokeWidth="9"
            opacity=".8"
          />
        </svg>
      </div>
      <div className="fw-path" aria-hidden="true">
        <svg viewBox="0 0 1400 3200" preserveAspectRatio="none">
          <path
            d="M1180 0C1450 300 1030 490 1110 850S60 790 170 1240S1300 1250 1210 1770S100 1890 160 2360S1140 2600 1090 3200"
            fill="none"
            stroke="#c7c9aa"
            strokeWidth="2"
            strokeDasharray="4 12"
          />
        </svg>
      </div>
      <nav className="fw-wayfinding" aria-label="Explore the journey">
        <span className="fw-trail-sign">
          A little further this way <span aria-hidden="true">↘</span>
        </span>
        <div>
          <a href="#collect">Find a place</a>
          <a href="#thread">Join the dots</a>
          <a href="#weather">Let life happen</a>
        </div>
        <button aria-pressed={paused} onClick={onPauseToggle}>
          {paused ? "▷ Play the little moments" : "Ⅱ Pause the little moments"}
        </button>
      </nav>

      <section
        className="fw-discover fw-section"
        id="collect"
        aria-labelledby="fw-discover-title"
      >
        <div className="fw-section-heading">
          <div>
            <span className="fw-trail-dot" aria-hidden="true" />
            <h2 id="fw-discover-title">
              Where does your
              <br />
              mind wander?
            </h2>
          </div>
          <p>
            Follow a feeling.
            <br />
            Then find a place inside it.
          </p>
        </div>
        <div
          className="fw-feelings"
          role="group"
          aria-label="Choose your landscape"
        >
          {escapes.map((item, i) => (
            <button
              key={item.name}
              aria-pressed={feeling === i}
              onClick={() => chooseFeeling(i)}
            >
              <span aria-hidden="true">
                {i === 0 ? "⌁" : i === 1 ? "≈" : "⌂"}
              </span>
              {item.name}
            </button>
          ))}
        </div>
        <div className="fw-place-gallery">{escape.stops.map((stop,i)=>{
          const added=stops.some(item=>item.name===stop.name);
          return <article className="fw-destination" key={stop.name}>
            <div className="fw-destination-art fw-motion-scene"><ChapterArt kind={escape.kind} variant={i} paused={paused}/><span>{stop.tag}</span></div>
            <div className="fw-destination-title"><h3>{stop.name}</h3><button aria-label={`${added?"Remove":"Add"} ${stop.name} ${added?"from":"to"} journey`} disabled={added&&stops.length===1} aria-pressed={added} onClick={()=>{
              if(added){setStops(current=>current.filter(item=>item.name!==stop.name));setNotice(`${stop.name} saved for another time.`);}
              else{setStops(current=>[...current,{name:stop.name,nights:2}]);setNotice(`${stop.name} added to your journey.`);}
              setRain(false);setAccepted(false);
            }}>{added?"✓ Added":"+ Add stop"}</button></div>
            <p>{stop.detail}</p>
          </article>
        })}</div>
        <div className="fw-collect-footer">
          <p role="status">{notice}</p>
          <a href="#thread">
            Let’s see how it fits <Arrow />
          </a>
        </div>
      </section>

      <section
        className="fw-build fw-section"
        id="thread"
        aria-labelledby="fw-build-title"
      >
        <div className="fw-section-heading">
          <div>
            <span className="fw-trail-dot" aria-hidden="true" />
            <h2 id="fw-build-title">
              A few places.
              <br />
              Your own pace.
            </h2>
          </div>
          <div className="fw-build-intro">
            <p>The way between is part of the trip.</p>
            <button
              className="fw-subtle-button"
              onClick={() => {
                setStops((current) => [...current].reverse());
                setRain(false);
                setAccepted(false);
                setNotice(
                  "The stops have switched places. Your stays come with them.",
                );
              }}
            >
              Try the other way round <span aria-hidden="true">⇄</span>
            </button>
          </div>
        </div>
        <div className="fw-route-wrap fw-motion-scene">
          <TrailMap stops={stops} origin={escape.origin} ride={ride} />
        </div>
        <div
          className="fw-stay-lengths"
          style={{ gridTemplateColumns: `repeat(${stops.length},1fr)` }}
        >
          {stops.map((stop) => (
            <div key={stop.name}>
              <span>{stop.name}</span>
              <div className="fw-stepper">
                <button
                  disabled={stop.nights === 1}
                  onClick={() => changeNights(stop.name, -1)}
                  aria-label={`Fewer nights in ${stop.name}`}
                >
                  −
                </button>
                <span>
                  <strong>{stop.nights}</strong>{" "}
                  {stop.nights === 1 ? "night" : "nights"}
                </span>
                <button
                  onClick={() => changeNights(stop.name, 1)}
                  aria-label={`More nights in ${stop.name}`}
                >
                  +
                </button>
              </div>
              {stops.length > 1 ? (
                <button
                  className="fw-remove"
                  aria-label={`Remove ${stop.name} from journey`}
                  onClick={() => {
                    setStops((current) =>
                      current.filter((item) => item.name !== stop.name),
                    );
                    if (stop.name === stops[0].name) {
                      setRain(false);
                      setAccepted(false);
                    }
                    setNotice(`${stop.name} removed from the journey.`);
                  }}
                >
                  Leave for another time
                </button>
              ) : null}
            </div>
          ))}
        </div>
        <div className="fw-stay-workspace">
          <div className="fw-window-side fw-motion-scene">
            <ChapterArt scene="stay" kind={escape.kind} paused={paused} comfort={comfort} />
            <p>
              Choose a stay style. Watch the porch change.
            </p>
          </div>
          <div className="fw-stay-controls">
            <div>
              <span className="fw-soft-label">Make yourself at home</span>
              <h3>Your kind of slow morning.</h3>
              <div
                className="fw-choice-pair"
                role="group"
                aria-label="Stay style"
              >
                <button
                  aria-pressed={!comfort}
                  onClick={() => setComfort(false)}
                >
                  <span className="fw-choice-icon" aria-hidden="true">
                    ⌂
                  </span>
                  <span>
                    Simple porch<small>{currency(1800)} / night</small>
                  </span>
                </button>
                <button aria-pressed={comfort} onClick={() => setComfort(true)}>
                  <span className="fw-choice-icon" aria-hidden="true">
                    ☷
                  </span>
                  <span>
                    Cushion & tea set<small>{currency(2600)} / night</small>
                  </span>
                </button>
              </div>
            </div>
            <div className="fw-transfer-choice">
              <span className="fw-soft-label">And the way there?</span>
              <div
                className="fw-transfer-options"
                role="group"
                aria-label="Travel style"
              >
                <button aria-pressed={!ride} onClick={() => setRide(false)}>
                  Bus, rail & local rides
                  <small>{currency(3500)} allowance</small>
                </button>
                <button aria-pressed={ride} onClick={() => setRide(true)}>
                  More private transfers
                  <small>{currency(6500)} allowance</small>
                </button>
              </div>
            </div>
            <div className="fw-estimate">
              <div>
                <span>A little clarity</span>
                <strong key={total}>{currency(total)}</strong>
              </div>
              <p>
                {nights} {nights === 1 ? "night" : "nights"} · {stops.length}{" "}
                {stops.length === 1 ? "stop" : "stops"}
                <br />
                Stay + travel{accepted ? " + rain alternative" : ""}
              </p>
            </div>
            <small className="fw-data-note">
              Illustrative allowances, not live prices. Food, other activities,
              taxes and fees are extra.
            </small>
          </div>
        </div>
        <a className="fw-next-moment" href="#weather">
          <span>And if the weather has other plans?</span>
          <span aria-hidden="true">↓</span>
        </a>
      </section>

      <section
        className="fw-weather fw-section"
        id="weather"
        aria-labelledby="fw-weather-title"
      >
        <div className="fw-section-heading">
          <div>
            <span className="fw-trail-dot" aria-hidden="true" />
            <h2 id="fw-weather-title">
              A change in the sky.
              <br />
              Not the whole trip.
            </h2>
          </div>
          <p>
            Try a little rain.
            <br />
            See what we can work around.
          </p>
        </div>
        <div className={`fw-weather-layout ${rain ? "fw-raining" : ""}`}>
          <div className="fw-weather-scene fw-motion-scene">
            <ChapterArt
              scene="weather"
              kind={escape.kind}
              rain={rain}
              paused={paused}
            />
            <div className="fw-weather-control">
              <WeatherIcon rain={rain} />
              <div>
                <span>
                  {rain ? "A passing shower" : "A clear little morning"}
                </span>
                <button
                  aria-pressed={rain}
                  onClick={() => {
                    setRain((value) => !value);
                    setAccepted(false);
                  }}
                >
                  {rain ? "Bring the sunshine back" : "Bring in a little rain"}
                  <span className="fw-toggle">
                    <i />
                  </span>
                </button>
              </div>
            </div>
            <p className="fw-weather-location">
              <Pin small />
              {stops[0].name}
              <span>Illustrated weather demo</span>
            </p>
          </div>
          <div className="fw-day-plan">
            <div className="fw-day-plan-head">
              <span>Your little day plan</span>
              <span>
                {accepted
                  ? "Revision saved"
                  : rain
                    ? "One thing to rethink"
                    : "A little room to wander"}
              </span>
            </div>
            <div
              className={`fw-day-item fw-outdoor ${rain ? "fw-postponed" : ""}`}
            >
              <time>09:00</time>
              <div>
                <h3>{morning}</h3>
                <span>
                  {rain
                    ? "Better saved for a dry morning"
                    : "A slow start, out in the fresh air"}
                </span>
              </div>
              <span aria-hidden="true">{rain ? "↷" : "⌁"}</span>
            </div>
            <div
              className={`fw-alternative ${rain ? "fw-alternative-open" : ""}`}
              aria-hidden={!rain}
            >
              <div className="fw-day-item">
                <time>09:30</time>
                <div>
                  <span className="fw-proposal-label">
                    {accepted ? "Your new morning" : "How about this instead?"}
                  </span>
                  <h3>
                    A local studio.
                    <br />A longer breakfast.
                  </h3>
                  <span>Indoors · +₹450 sample entry</span>
                </div>
                <span aria-hidden="true">{accepted ? "✓" : "+"}</span>
              </div>
              {rain ? (
                <button
                  className="fw-action"
                  disabled={accepted}
                  onClick={() => setAccepted(true)}
                >
                  {accepted ? "This version is yours ✓" : "Keep this version"}
                  {!accepted ? <Arrow /> : null}
                </button>
              ) : null}
            </div>
            <div className="fw-day-item fw-fixed">
              <time>18:10</time>
              <div>
                <h3>The journey home</h3>
                <span>Exactly where you left it.</span>
              </div>
              <span className="fw-fixed-label">
                <svg
                  width="12"
                  height="14"
                  viewBox="0 0 12 14"
                  fill="none"
                  aria-hidden="true"
                >
                  <rect
                    x="1"
                    y="6"
                    width="10"
                    height="7"
                    rx="1"
                    stroke="currentColor"
                  />
                  <path d="M3 6V3a3 3 0 0 1 6 0v3" stroke="currentColor" />
                </svg>
                Fixed
              </span>
            </div>
            <p className="fw-day-message" role="status">
              {accepted
                ? "Morning reimagined. Your fixed transfer stays put."
                : rain
                  ? "Only the outdoor stop changes. You choose whether to keep the proposal."
                  : "Your plans have a little breathing room."}
            </p>
          </div>
        </div>
      </section>

      <section
        className="fw-departure fw-section"
        aria-labelledby="fw-end-title"
      >
        <div className="fw-departure-copy">
          <span>A little closer to getting away.</span>
          <h2 id="fw-end-title">
            Let’s make room
            <br />
            for your elsewhere.
          </h2>
          <div className="fw-trip-ticket">
            <span>
              <Pin small />
              {stops.map((stop) => stop.name).join(" → ")}
            </span>
            <span>
              {nights} {nights === 1 ? "night" : "nights"}, at your pace
            </span>
          </div>
          <a className="fw-action" href="/trips/new">
            Make this feeling a trip <Arrow />
          </a>
          <a className="fw-sample-link" href="/trips/demo">
            Take a look inside a sample trip
          </a>
        </div>
        <div className="fw-practical">
          <h3>Before you wander.</h3>
          <details>
            <summary>
              Can I leave the dates open?<span>+</span>
            </summary>
            <p>
              Start with places and a rough duration. Live availability and
              forecasts need dates before they can be checked.
            </p>
          </details>
          <details>
            <summary>
              More places? A longer trip?<span>+</span>
            </summary>
            <p>
              Yes. Add stops and change the nights as you go. This small example
              does not limit the length of a trip.
            </p>
          </details>
          <details>
            <summary>
              Who decides when the plan changes?<span>+</span>
            </summary>
            <p>
              You do. Review a proposed change before accepting it. Existing
              supplier bookings need separate action.
            </p>
          </details>
        </div>
      </section>
      <footer className="fw-footer fw-footer-redesign">
        <div className="fw-footer-invitation">
          <span>Good places. Looser plans.</span>
          <a href="/trips/new">
            There’s a little more out there. <Arrow />
          </a>
        </div>
        <nav aria-label="Footer navigation">
          <div>
            <span>Find your way</span>
            <a href="#collect">Explore places</a>
            <a href="#thread">Shape your journey</a>
            <a href="#weather">Room for a change</a>
          </div>
          <div>
            <span>Take a closer look</span>
            <a href="/trips/demo">A sample trip</a>
            <a href="/trips/new">Start planning</a>
            <a href="/design/options">Design studies</a>
          </div>
        </nav>
        <a className="fw-footer-wordmark" href="#top">
          elsewhere.<span>Back to the view ↑</span>
        </a>
        <div className="fw-footer-baseline">
          <span>Made for a little out of the ordinary.</span>
          <small>
            Interactive concept. Routes, weather and prices are illustrative.
          </small>
        </div>
      </footer>
    </div>
  );
}
