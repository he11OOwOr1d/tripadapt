import { Header, Footer, sketches } from "../_sketches/Common";
import "../_sketches/sketches.css";
export default function Sketches() {
  return (
    <main className="sx sx-gallery">
      <Header
        label="Six fresh directions"
        cta="Original sketchbook"
        href="/design/sketchbook"
      />
      <section className="sx-gallery-intro" id="begin">
        <span className="sx-note">
          Same curious spirit. Six very different pages.
        </span>
        <h1>
          New places
          <br />
          to take the pencil.
        </h1>
        <p>
          Six fresh takes on a playful travel planner. Open each one, try the
          little interactions and see which world feels like yours.
        </p>
      </section>
      <section className="sx-gallery-grid">
        {sketches.map((x) => (
          <a
            className="sx-gallery-item"
            key={x.slug}
            href={`/design/${x.slug}`}
          >
            <div style={{ background: x.color }}>
              <img
                src={`/images/sketches/${x.slug}.png`}
                alt={`${x.name} landing page preview`}
                loading="lazy"
              />
            </div>
            <h2>{x.name}</h2>
            <p>{x.description}</p>
            <span className="sx-note">Step inside {x.name}</span>
          </a>
        ))}
      </section>
      <div className="sx-start">
        <p>Where the pencil direction began.</p>
        <a className="sx-button" href="/design/sketchbook">
          Open the original Sketchbook
        </a>
      </div>
      <Footer current="" />
    </main>
  );
}
