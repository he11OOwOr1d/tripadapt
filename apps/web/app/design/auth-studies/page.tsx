import Link from "next/link";
import { concepts } from "./concepts";
import "./auth.css";
export default function Page() {
  return (
    <main className="au au-gallery">
      <header className="au-gallery-header">
        <Link className="au-wordmark" href="/">
          elsewhere.
        </Link>
        <Link href="/trips/new">Back to planning</Link>
      </header>
      <section className="au-gallery-intro">
        <p>Three ways to feel welcome.</p>
        <h1>
          A beginning.
          <br />
          Or a welcome back.
        </h1>
        <p>
          Sign-in and sign-up studies for the next part of Elsewhere. Open a
          direction and try both sides.
        </p>
      </section>
      <Link
        className="au-new-companion"
        href="/design/auth-studies/trail-companion"
      >
        <span>New · inspired by your recording</span>
        <strong>Meet your trail companion.</strong>
        <p>
          A little goat that follows along, covers its eyes for password entry,
          and turns away when you reveal it.
        </p>
        <b>Try the interactive direction ↗</b>
      </Link>
      <div className="au-concepts">
        {concepts.map((c, i) => (
          <Link href={`/design/auth-studies/${c.id}`} key={c.id}>
            <div className={`au-mini au-mini-${i}`} aria-hidden="true">
              {i === 0 ? (
                <>
                  <div>
                    <span>
                      Find your
                      <br />
                      way back.
                    </span>
                    <i>⌁</i>
                  </div>
                  <div>
                    <b>Welcome back.</b>
                    <i />
                    <i />
                    <small>Sign in</small>
                  </div>
                </>
              ) : i === 1 ? (
                <div>
                  <b>
                    A little
                    <br />
                    elsewhere.
                  </b>
                  <i />
                  <i />
                  <small>Come on in</small>
                </div>
              ) : (
                <>
                  <b>
                    Room for your
                    <br />
                    next chapter.
                  </b>
                  <div>
                    <i />
                    <i />
                  </div>
                  <small>Make yourself at home.</small>
                </>
              )}
            </div>
            <h2>
              {c.name}
              <span aria-hidden="true">↗</span>
            </h2>
            <p>{c.description}</p>
          </Link>
        ))}
      </div>
      <footer className="au-gallery-footer">
        Interactive frontend studies. No accounts created, credentials sent or
        recovery emails delivered.
      </footer>
    </main>
  );
}
