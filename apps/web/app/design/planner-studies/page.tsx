import Link from "next/link";
import { studies } from "./studies";
import "./studies.css";
export default function Page() {
  return (
    <main className="ps ps-index">
      <header className="ps-brand">
        <Link href="/design/fieldtrip">elsewhere.</Link>
        <span>New ways to begin</span>
        <Link href="/trips/new">Working planner</Link>
      </header>
      <div className="ps-index-intro">
        <p>Six fresh planner studies</p>
        <h1>
          The feeling continues.
          <br />
          The form takes a new shape.
        </h1>
        <p>
          Different ways to turn a little idea into a journey. Open one, try the
          controls, and see what feels like Elsewhere.
        </p>
      </div>
      <div className="ps-gallery">
        {studies.map((s, i) => (
          <Link
            className={`ps-preview ps-preview-${s.id}`}
            key={s.id}
            href={`/design/planner-studies/${s.id}`}
          >
            <div className="ps-mini" aria-hidden="true">
              {i === 0 ? (
                <p>
                  I’m leaving
                  <br />
                  <u>the everyday</u>
                  <br />
                  with <u>my people.</u>
                </p>
              ) : i === 1 ? (
                <>
                  <div className="mini-contour">≋</div>
                  <div>
                    <b>Where to begin?</b>
                    <i />
                    <i />
                    <i />
                  </div>
                </>
              ) : i === 2 ? (
                <>
                  <span className="mini-ribbon">
                    Lisbon<small>4 nights</small>
                  </span>
                  <span className="mini-thread" />
                  <span className="mini-ribbon">
                    Porto<small>3 nights</small>
                  </span>
                </>
              ) : i === 3 ? (
                <div className="mini-orbit">
                  <span>you</span>
                  <b>elsewhere.</b>
                  <span>+ one</span>
                </div>
              ) : i === 4 ? (
                <>
                  <div>From here.</div>
                  <div>A little time.</div>
                  <div>Somewhere new.</div>
                </>
              ) : (
                <>
                  <div>
                    Where you begin <span>−</span>
                  </div>
                  <div>
                    When you go <span>+</span>
                  </div>
                  <div>
                    Places to follow <span>+</span>
                  </div>
                </>
              )}
            </div>
            <div className="ps-preview-title">
              <h2>{s.name}</h2>
              <span aria-hidden="true">↗</span>
            </div>
            <p>{s.description}</p>
          </Link>
        ))}
      </div>
      <footer className="ps-index-footer">
        Interactive design studies · fictional route · no saved-trip access · no
        live services
      </footer>
    </main>
  );
}
