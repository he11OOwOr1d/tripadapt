"use client";
import Link from "next/link";
import { useId, useRef, useState } from "react";
import { concepts, type AuthConcept } from "./concepts";
import "./auth.css";
type Mode = "signin" | "signup" | "recover";
export default function AuthStudy({ concept }: { concept: AuthConcept }) {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const id = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const study = concepts.find((c) => c.id === concept)!;
  const signup = mode === "signup",
    recover = mode === "recover";
  const titles =
    concept === "open-door"
      ? ["Come on in.", "Your next chapter.", "Find your way back."]
      : concept === "little-room"
        ? [
            "A little space for you.",
            "Room for your next chapter.",
            "Let’s find the way back.",
          ]
        : ["Welcome back.", "Make yourself at home.", "A way back in."];
  function change(next: Mode) {
    setMode(next);
    setNotice("");
    setError("");
    setPassword("");
    setConfirm("");
    setShow(false);
    requestAnimationFrame(() => heading.current?.focus());
  }
  const switcher = (
    <nav className="au-mode-switch" aria-label="Account action">
      <button
        type="button"
        aria-current={mode === "signin" ? "page" : undefined}
        onClick={() => change("signin")}
      >
        Sign in
      </button>
      <button
        type="button"
        aria-current={signup ? "page" : undefined}
        onClick={() => change("signup")}
      >
        Create account
      </button>
    </nav>
  );
  const fields = (
    <>
      <label className="au-email" htmlFor={`${id}-email`}>
        Email address
        <input
          id={`${id}-email`}
          type="email"
          inputMode="email"
          autoComplete="off"
          required
          value={email}
          placeholder="you@example.com"
          onChange={(e) => {
            setEmail(e.target.value);
            setNotice("");
          }}
        />
      </label>
      {!recover && (
        <label className="au-password" htmlFor={`${id}-password`}>
          Password
          <div className="au-password-field">
            <input
              id={`${id}-password`}
              aria-label="Password"
              type={show ? "text" : "password"}
              autoComplete="new-password"
              required
              value={password}
              placeholder={signup ? "Choose a password" : "Your password"}
              onChange={(e) => {
                setPassword(e.target.value);
                setNotice("");
                setError("");
              }}
            />
            <button
              type="button"
              aria-label={show ? "Hide password" : "Show password"}
              aria-pressed={show}
              onClick={() => setShow((v) => !v)}
            >
              {show ? "Hide" : "Show"}
            </button>
          </div>
        </label>
      )}
      {signup && (
        <label className="au-confirm" htmlFor={`${id}-confirm`}>
          Confirm password
          <input
            id={`${id}-confirm`}
            type={show ? "text" : "password"}
            autoComplete="off"
            required
            value={confirm}
            placeholder="Once more"
            aria-invalid={!!error}
            aria-describedby={error ? `${id}-error` : undefined}
            onChange={(e) => {
              setConfirm(e.target.value);
              setError("");
              setNotice("");
            }}
          />
        </label>
      )}
    </>
  );
  const action = (
    <div className="au-action-area">
      <button className="au-submit" type="submit">
        {recover
          ? "Preview recovery"
          : signup
            ? "Preview account creation"
            : "Preview sign in"}
        <span aria-hidden="true">↗</span>
      </button>
      <p>No live authentication connected.</p>
    </div>
  );
  const form = (
    <form
      className="au-form"
      autoComplete="off"
      data-1p-ignore
      data-lpignore="true"
      onSubmit={(e) => {
        e.preventDefault();
        setNotice("");
        if (signup && password !== confirm) {
          setError(
            "The passwords don’t match. Enter the same password in both fields.",
          );
          return;
        }
        setError("");
        setNotice(
          recover
            ? "Recovery preview only. No email has been sent."
            : signup
              ? "Account creation preview only. No account has been created or password sent."
              : "Sign-in preview only. No credentials have been sent and you are not signed in.",
        );
        setPassword("");
        setConfirm("");
      }}
    >
      {fields}
      {error && (
        <p id={`${id}-error`} role="alert" className="au-error">
          {error}
        </p>
      )}
      {!signup && !recover && (
        <button
          className="au-forgot"
          type="button"
          onClick={() => change("recover")}
        >
          Forgot your password?
        </button>
      )}
      {notice && (
        <div className="au-notice" role="status">
          {notice}
        </div>
      )}
      {action}
    </form>
  );
  const copy = (
    <div className="au-form-copy">
      <p className="au-form-context">
        {recover
          ? "Password recovery"
          : signup
            ? "A new beginning"
            : "Your own little elsewhere"}
      </p>
      <h1 tabIndex={-1} ref={heading}>
        {titles[recover ? 2 : signup ? 1 : 0]}
      </h1>
      <p>
        {recover
          ? "Enter your email to preview the recovery flow."
          : signup
            ? "Keep your places, plans and possibilities together."
            : "Pick up the places and possibilities you left open."}
      </p>
    </div>
  );
  const accountSwitch = (
    <div className="au-account-switch">
      {recover ? (
        <button type="button" onClick={() => change("signin")}>
          Back to sign in
        </button>
      ) : (
        <>
          <span>
            {signup ? "Already have an account?" : "New to Elsewhere?"}
          </span>
          <button
            type="button"
            onClick={() => change(signup ? "signin" : "signup")}
          >
            {signup ? "Sign in" : "Create an account"}
          </button>
        </>
      )}
    </div>
  );
  return (
    <main className={`au au-study au-${concept}`}>
      <div className="au-review-bar">
        <Link href="/design/auth-studies">All three directions</Link>
        <span>{study.name}</span>
        <span>Design preview · use example details</span>
      </div>
      {concept === "return-path" ? (
        <div className="au-return-layout">
          <aside className="au-return-welcome">
            <Link className="au-wordmark" href="/">
              elsewhere.
            </Link>
            <div className="au-return-statement">
              <p>A little further from the usual.</p>
              <h2>
                {signup ? (
                  <>
                    There’s a whole
                    <br />
                    world ahead.
                  </>
                ) : (
                  <>
                    Find your
                    <br />
                    way back.
                  </>
                )}
              </h2>
              <p>
                {signup
                  ? "Start with a place. Make room for the rest."
                  : "To the places you chose. And the days you haven’t filled yet."}
              </p>
            </div>
            <ReturnLine />
            <div className="au-return-bottom">
              <span>Places. Stays. Journeys.</span>
              <span>Together.</span>
            </div>
          </aside>
          <section className="au-return-form">
            <div className="au-return-top">
              <Link href="/trips/new">Back to your plan</Link>
              <span>Dates can come later.</span>
            </div>
            <div className="au-return-content">
              {switcher}
              {copy}
              {form}
              {accountSwitch}
            </div>
            <p className="au-quiet-note">
              A plan starts with you.
              <br />
              The details can unfold from there.
            </p>
          </section>
        </div>
      ) : concept === "open-door" ? (
        <>
          <header className="au-door-header">
            <Link className="au-wordmark" href="/">
              elsewhere.
            </Link>
            <Link href="/trips/new">Keep planning</Link>
          </header>
          <div className="au-door-stage">
            <span className="au-door-side au-door-side-left">
              A different view.
            </span>
            <section className="au-door-sheet">
              <div className="au-door-symbol" aria-hidden="true">
                <svg viewBox="0 0 60 60">
                  <path d="M17 51V23a13 13 0 0 1 26 0v28M10 51h40M29 20v31l14-5V23M35 33v3" />
                </svg>
              </div>
              {copy}
              {switcher}
              {form}
              {accountSwitch}
            </section>
            <span className="au-door-side au-door-side-right">
              A little room for you.
            </span>
          </div>
          <p className="au-door-foot">
            Where a little idea becomes your next elsewhere.
          </p>
        </>
      ) : (
        <>
          <header className="au-room-header">
            <Link className="au-wordmark" href="/">
              elsewhere.
            </Link>
            <Link href="/trips/new">Return to your plan</Link>
          </header>
          <section className="au-room-intro">
            {copy}
            <div className="au-room-note">
              <span aria-hidden="true">✳</span>
              <p>
                Bring your curiosity. <br />
                We’ll leave room for <br />
                the unexpected.
              </p>
            </div>
          </section>
          <section className="au-room-rail">
            {switcher}
            {form}
            {accountSwitch}
          </section>
          <div className="au-room-ground">
            <span>
              {signup ? "A beginning worth making." : "Good to have you here."}
            </span>
            <p>
              Places to go.
              <br />
              Space to be yourself.
            </p>
            <span aria-hidden="true">⌁</span>
          </div>
        </>
      )}
      <footer className="au-study-footer">
        <p>
          Frontend preview only. Nothing is saved to an account. Use example
          details; this page does not send passwords or emails.
        </p>
        <nav aria-label="Compare authentication designs">
          {concepts.map((c) => (
            <Link
              key={c.id}
              aria-current={c.id === concept ? "page" : undefined}
              href={`/design/auth-studies/${c.id}`}
            >
              {c.name}
            </Link>
          ))}
        </nav>
      </footer>
    </main>
  );
}
function ReturnLine() {
  return (
    <svg
      className="au-return-line"
      viewBox="0 0 600 300"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <path d="M-60 270 C100 300 135 130 260 155 S390 255 460 145 S530 55 640 95" />
      <path d="M-60 286 C100 316 135 146 260 171 S390 271 460 161 S530 71 640 111" />
      <circle cx="460" cy="145" r="8" />
      <path
        className="au-return-horizon"
        d="M65 91h87m-43-43v86m-30-74 60 60m0-60-60 60"
      />
    </svg>
  );
}
