"use client";
import { useState } from "react";
import Meadow from "./Meadow";
import LandingExperience from "./LandingExperience";
import "./fieldtrip.css";
import PaletteSwitcher, { type Palette } from "./PaletteSwitcher";
import "./palettes.css";
import "./responsive.css";

function Arrow() {
  return (
    <svg
      width="21"
      height="21"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path d="M4 12h16m-7-7 7 7-7 7" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
function Sun() {
  return (
    <svg
      viewBox="0 0 40 40"
      width="32"
      height="32"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="20" cy="20" r="7" stroke="currentColor" />
      <path
        d="M20 2v7m0 22v7M2 20h7m22 0h7M7 7l5 5m16 16 5 5M7 33l5-5m16-16 5-5"
        stroke="currentColor"
      />
    </svg>
  );
}
export default function FieldtripDesign({
  initialPalette = "original",
  showDirections = false,
}: {
  initialPalette?: Palette;
  showDirections?: boolean;
}) {
  const [palette, setPalette] = useState<Palette>(initialPalette);
  const [paused, setPaused] = useState(false),
    [locals, setLocals] = useState(false),
    [sampleOpen, setSampleOpen] = useState(false);
  return (
    <main className="ft" data-palette={palette}>
      <section className="ft-hero" id="top">
        <Meadow paused={paused} alert={locals} />
        <header className="ft-header">
          <p>
            A field guide
            <br />
            to getting away.
          </p>
          <a className="ft-brand" href="/design/fieldtrip">
            <Sun />
            elsewhere.
          </a>
          <a className="ft-top-action" href="/trips/new">
            Start planning <span>↗</span>
          </a>
        </header>
        <div className="ft-invitation">
          <h1>
            Leave the
            <br />
            usual behind.
          </h1>
          <p>
            Plan your places, stays and journeys together.
            <br />
            Leave a little room for life to happen.
          </p>
          <a className="ft-hero-action" href="/trips/new">
            Plan my escape{" "}
            <span>
              <Arrow />
            </span>
          </a>
          <div className="ft-hero-entry-links">
            <button onClick={() => setSampleOpen(true)}>
              See a sample trip
            </button>
            <span>Dates can come later.</span>
          </div>
        </div>
        <button
          className="ft-locals"
          aria-expanded={locals}
          aria-controls="ft-local-note"
          onClick={() => setLocals((v) => !v)}
        >
          <span className="ft-locals-ring" aria-hidden="true">
            +
          </span>
          <span>Meet the locals</span>
        </button>
        {locals && (
          <div className="ft-local-note" id="ft-local-note" role="status">
            <strong>Experts in taking it easy.</strong>
            <p>
              No calendar. Just grass.
              <br />
              There might be something in that.
            </p>
            <button
              aria-label="Close the meadow observation"
              onClick={() => setLocals(false)}
            >
              ×
            </button>
          </div>
        )}
        <div className="ft-hero-bottom">
          <button aria-pressed={paused} onClick={() => setPaused((p) => !p)}>
            <span aria-hidden="true">{paused ? "▷" : "Ⅱ"}</span>
            {paused ? "Let the meadow move" : "Hold this moment"}
          </button>
          <a href="#about">
            There’s a whole trip beyond the view <span>↓</span>
          </a>
          <span>
            Take your time.
            <br />
            That’s sort of the point.
          </span>
        </div>
      </section>
      <LandingExperience
        plannerDirection={palette === "original" ? "alpine" : undefined}
        direction={
          palette === "alpine"
            ? "alpine"
            : palette === "peach" || palette === "original"
              ? "peach"
              : "original"
        }
        paletteControl={
          showDirections ? (
            <PaletteSwitcher value={palette} onChange={setPalette} />
          ) : null
        }
        paused={paused}
        sampleOpen={sampleOpen}
        onSampleOpenChange={setSampleOpen}
        onPauseToggle={() => setPaused((value) => !value)}
      />
    </main>
  );
}
