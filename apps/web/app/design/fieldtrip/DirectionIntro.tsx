import ChapterArt from "./ChapterArt";
import type { SampleTrip } from "./product/sample-trip";
import { dateLabel, sampleSummary } from "./product/sample-trip";
import "./directions.css";
export type Treatment = "original" | "alpine" | "peach";
const features = [
  {
    title: "Find your somewhere",
    detail: "Collect the places that call you.",
    tab: 0,
    symbol: "⌁",
  },
  {
    title: "Give it a little time",
    detail: "Shape the days around your pace.",
    tab: 1,
    symbol: "◷",
  },
  {
    title: "Connect the practical bits",
    detail: "Stays and travel, in the same plan.",
    tab: 2,
    symbol: "⌂",
  },
];
export default function DirectionIntro({
  direction,
  paused,
  trip,
  onSelect,
}: {
  direction: Exclude<Treatment, "original">;
  paused: boolean;
  trip: SampleTrip;
  onSelect: (index: number) => void;
}) {
  const summary = sampleSummary(trip);
  if (direction === "alpine")
    return (
      <section className="ed-alpine-intro ep-section" id="about">
        <div className="ed-alpine-heading">
          <div>
            <span className="ed-caption">Elsewhere, explained.</span>
            <h2>
              A clear way
              <br />
              to get away.
            </h2>
          </div>
          <div>
            <p>
              Places you want to see. A stay you’ll look forward to. A journey
              that gives them both room.
            </p>
            <p>
              Elsewhere brings the details into one editable plan—and helps you
              work around a change.
            </p>
            <a href="#collect" onClick={() => onSelect(0)}>
              Explore a connected trip <span>↘</span>
            </a>
          </div>
        </div>
        <div className="ed-valley-window">
          <ChapterArt variant={0} paused={paused} />
          <div className="ed-window-top">
            <span>Space to wander. Details in place.</span>
            <span>Illustrated mountain escape</span>
          </div>
          <div className="ed-window-route">
            <span>
              Delhi<small>Begin</small>
            </span>
            <i aria-hidden="true" />
            {trip.stops.map((stop) => (
              <span key={stop.id}>
                {stop.name}
                <small>{stop.nights} nights</small>
              </span>
            ))}
            <span className="ed-window-date">
              {dateLabel(trip.start)} — {dateLabel(summary.finish)}
              <small>Your sample journey</small>
            </span>
          </div>
        </div>
        <div className="ed-alpine-features">
          {features.map((feature) => (
            <a
              key={feature.title}
              href="#collect"
              onClick={() => onSelect(feature.tab)}
            >
              <span aria-hidden="true">{feature.symbol}</span>
              <div>
                <h3>{feature.title}</h3>
                <p>{feature.detail}</p>
              </div>
              <b aria-hidden="true">↗</b>
            </a>
          ))}
        </div>
      </section>
    );
  return (
    <section className="ed-peach-intro ep-section" id="about">
      <div className="ed-peach-copy">
        <span className="ed-caption">
          For the days you need a different view.
        </span>
        <h2>
          A feeling
          <br />
          worth
          <br />
          following.
        </h2>
        <p>
          Make a little room for the places, people and moments that pull you
          out of the everyday.
        </p>
        <p>
          Elsewhere connects the dates, stays and journeys behind your escape.
          So the feeling can become a plan.
        </p>
        <a
          className="ed-peach-start"
          href="#collect"
          onClick={() => onSelect(0)}
        >
          Let’s see where it leads <span>↗</span>
        </a>
      </div>
      <div className="ed-peach-collage">
        <div className="ed-peach-postcard">
          <span className="ed-postcard-tape" aria-hidden="true" />
          <ChapterArt variant={2} paused={paused} />
          <div>
            <span>Somewhere with a little more sky.</span>
            <strong>A mountain kind of day.</strong>
          </div>
        </div>
        <div className="ed-peach-stamp" aria-hidden="true">
          <span>Take your time</span>
          <b>☀</b>
          <span>Find your elsewhere</span>
        </div>
        <a
          href="#collect"
          onClick={() => onSelect(1)}
          className="ed-peach-note"
        >
          <span>A note to self</span>
          <strong>
            Less rushing.
            <br />
            More being here.
          </strong>
          <small>Make room in the days ↗</small>
        </a>
        <div className="ed-peach-bookmark">
          <span>A small idea for your next chapter</span>
          <strong>{trip.stops.map((s) => s.name).join(" + ")}</strong>
          <small>{summary.nights} nights to make your own.</small>
        </div>
      </div>
      <div className="ed-peach-feature-strip">
        {features.map((feature) => (
          <a
            href="#collect"
            key={feature.title}
            onClick={() => onSelect(feature.tab)}
          >
            <span>{feature.symbol}</span>
            <strong>{feature.title}</strong>
            <small>{feature.detail}</small>
            <b aria-hidden="true">↗</b>
          </a>
        ))}
      </div>
    </section>
  );
}
