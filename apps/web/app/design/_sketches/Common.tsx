import type { ReactNode } from "react";
export const sketches = [
  {
    slug: "margin",
    name: "Margin",
    note: "A journey between the lines.",
    description:
      "An open travel journal, pencilled discoveries and pages you can turn.",
    color: "#eef0df",
  },
  {
    slug: "airmail",
    name: "Airmail",
    note: "A letter to your future self.",
    description:
      "Peach paper, postal marks and an invitation you can turn over.",
    color: "#fbe4d9",
  },
  {
    slug: "doodle-club",
    name: "Doodle Club",
    note: "Collect a little happy.",
    description:
      "A lilac sticker sheet. Pack your possibilities, then unpack a journey.",
    color: "#e8dff2",
  },
  {
    slug: "blue-hour",
    name: "Blue Hour",
    note: "Somewhere under the same sky.",
    description:
      "White pencil constellations and a route drawn by the places you choose.",
    color: "#294c79",
  },
  {
    slug: "sidequest",
    name: "Sidequest",
    note: "The plot could use a detour.",
    description:
      "A choose-your-own-travel comic. You decide what happens next.",
    color: "#fff5cb",
  },
  {
    slug: "sunday",
    name: "Sunday",
    note: "A very good day for very little.",
    description:
      "A lounging sun, a pencil clock and a plan with breathing room.",
    color: "#f3ce61",
  },
];
export const places = [
  {
    name: "Bir",
    region: "Himachal Pradesh",
    kind: "mountains" as const,
    feeling: "Small cafés. Big skies.",
    stay: "A hillside guesthouse",
    travel: "Overnight bus from Delhi",
    note: "Walkable village lanes; check seasonal bus schedules.",
  },
  {
    name: "Gokarna",
    region: "Karnataka",
    kind: "sea" as const,
    feeling: "Salt air. Slow mornings.",
    stay: "A simple beachside stay",
    travel: "Train to Gokarna Road + taxi",
    note: "Allow time for the station transfer; beaches vary by season.",
  },
  {
    name: "Udaipur",
    region: "Rajasthan",
    kind: "town" as const,
    feeling: "Old streets. Lakeside evenings.",
    stay: "A small haveli near the lake",
    travel: "Train from Jaipur",
    note: "Walk the old city; confirm attraction hours for your dates.",
  },
];
export function Header({
  label,
  cta = "Start a trip",
  href = "#begin",
}: {
  label: string;
  cta?: string;
  href?: string;
}) {
  return (
    <header className="sx-header">
      <a className="sx-logo" href="/design/sketches">
        elsewhere<span aria-hidden="true">✳</span>
      </a>
      <a className="sx-current" href="/design/sketches">
        {label} / six pencil studies
      </a>
      <a className="sx-button" href={href}>
        {cta}
      </a>
    </header>
  );
}
export function Footer({ current }: { current: string }) {
  return (
    <footer className="sx-footer">
      <div>
        <a className="sx-logo" href="/design/sketches">
          elsewhere<span aria-hidden="true">✳</span>
        </a>
        <p>Plan a connected trip. Leave room for life.</p>
      </div>
      <nav aria-label="Compare pencil designs">
        {sketches.map((x) => (
          <a
            aria-current={current === x.slug ? "page" : undefined}
            href={`/design/${x.slug}`}
            key={x.slug}
          >
            {x.name}
          </a>
        ))}
      </nav>
      <small>
        Interactive design study. Destinations, routes and costs are examples;
        no live availability or bookings.
      </small>
      <a href="/design/options">All design explorations</a>
    </footer>
  );
}
export function Start({
  children,
  title = "Your next chapter starts somewhere.",
}: {
  children?: ReactNode;
  title?: string;
}) {
  return (
    <section className="sx-start" id="begin">
      <h2>{title}</h2>
      <p>
        {children ||
          "Start with a place, a feeling, or a few days you want to call your own."}
      </p>
      <a href="/trips/new" className="sx-button sx-solid">
        Create my trip
      </a>
      <a className="sx-text-link" href="/trips/demo">
        Explore a sample trip
      </a>
    </section>
  );
}
export function Questions() {
  return (
    <section className="sx-questions">
      <h2>A few things worth knowing.</h2>
      <div>
        <details>
          <summary>Do I need all my dates figured out?</summary>
          <p>
            No. Research with a tentative window or duration, and add exact
            dates when you have them. Availability and forecasts need dates.
          </p>
        </details>
        <details>
          <summary>Can I plan more than one destination?</summary>
          <p>
            Yes. Connect multiple stops, change their order and give each place
            as many nights as you want. Transfers belong in the same plan.
          </p>
        </details>
        <details>
          <summary>Will my bookings move when a plan changes?</summary>
          <p>
            No. Review alternatives before accepting. Fixed commitments stay
            visible, and reservation changes need your action with the provider.
          </p>
        </details>
      </div>
    </section>
  );
}
