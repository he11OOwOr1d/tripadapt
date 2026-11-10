"use client";
import Link from "next/link";
import { useId, useRef, useState } from "react";
import { authErrorMessage } from "../../../../lib/auth/errors";
import { authClient } from "../../../../lib/auth/client";
import { authConfigured } from "../../../../lib/auth/config";
import CompanionScene from "./CompanionScene";
import "./companion.css";

type Mode = "signup" | "signin" | "recover";
export default function AuthForm({
  live = false,
  initialMode = "signup",
  returnTo = "/trips/new",
  linkExpired = false,
}: {
  live?: boolean;
  initialMode?: Mode;
  returnTo?: string;
  linkExpired?: boolean;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [pending, setPending] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [focused, setFocused] = useState<"email" | "password" | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const id = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const signup = mode === "signup",
    recover = mode === "recover";
  const length = Array.from(password).length;
  function change(next: Mode) {
    if (pending) return;
    setMode(next);
    setShow(false);
    setFocused(null);
    setPassword("");
    setConfirm("");
    setNotice("");
    setError("");
    requestAnimationFrame(() => heading.current?.focus());
  }
  return (
    <main className="tc">
      {!live && (
        <div className="tc-preview">
          <Link href="/design/auth-studies">Auth design studies</Link>
          <span>New direction · Trail companion</span>
          <span>Interactive preview · example details only</span>
        </div>
      )}
      <header className="tc-header">
        <Link className="tc-logo" href="/">
          elsewhere.
        </Link>
        <Link href={returnTo}>Back to your plan</Link>
      </header>
      <div className="tc-layout">
        <section className="tc-scene-panel" aria-label="Your meadow companion">
          <div className="tc-art">
            <CompanionScene
              revealed={show && !recover}
              focused={focused}
              look={Math.min(1, email.length / 30)}
            />
            <span className="tc-art-note">Your little lookout.</span>
          </div>
          <div className="tc-scene-caption">
            <span aria-hidden="true">⌁</span>
            <p aria-live="polite">
              {show && !recover
                ? "Turned away. Not a peek."
                : focused === "password"
                  ? "Eyes covered. Take your time."
                  : focused === "email"
                    ? "Following along with you."
                    : "Hello, you. Let’s go somewhere."}
            </p>
          </div>
          <div className="tc-invitation">
            <p>From a little idea</p>
            <h2>
              To your own
              <br />
              elsewhere.
            </h2>
            <span>
              Places to follow. People to go with.
              <br />A little room for whatever comes next.
            </span>
          </div>
        </section>
        <section className="tc-form-panel">
          <nav className="tc-switch" aria-label="Account action">
            <button
              aria-current={mode === "signin" ? "page" : undefined}
              onClick={() => change("signin")}
            >
              Sign in
            </button>
            <button
              aria-current={signup ? "page" : undefined}
              onClick={() => change("signup")}
            >
              Create account
            </button>
          </nav>
          <div className="tc-title">
            <p>
              {recover
                ? "Find your way back"
                : signup
                  ? "A new beginning"
                  : "Your next chapter, continued"}
            </p>
            <h1 ref={heading} tabIndex={-1}>
              {recover
                ? "A way back in."
                : signup
                  ? "Your next escape starts here."
                  : "Welcome back to elsewhere."}
            </h1>
            <p>
              {recover
                ? "Enter your email to find your way back."
                : signup
                  ? "A place for your plans, your maybes, and the days still to come."
                  : "Pick up your plans. Leave a little room for a different kind of day."}
            </p>
          </div>
          {live && !authConfigured && (
            <p className="tc-notice" role="status">
              Sign-in is awaiting Supabase configuration. Your trip remains in
              this browser.
            </p>
          )}
          {live && linkExpired && (
            <p className="tc-error" role="alert">
              This link could not be used. Sign in or request a new recovery
              email.
            </p>
          )}
          <form
            autoComplete="off"
            data-1p-ignore
            data-lpignore="true"
            onSubmit={async (e) => {
              e.preventDefault();
              if (pending) return;
              const fields = new FormData(e.currentTarget);
              const submittedEmail = String(fields.get("email") ?? "").trim();
              const submittedPassword = String(fields.get("password") ?? "");
              const submittedConfirm = String(fields.get("confirm") ?? "");
              setError("");
              setNotice("");
              if (signup && submittedPassword !== submittedConfirm) {
                setError(
                  "The passwords don’t match. Enter the same password in both fields.",
                );
                return;
              }
              if (live) {
                setPending(true);
                try {
                  const client = authClient();
                  const accountEmail = submittedEmail;
                  const callback = `${window.location.origin}/auth/callback?next=${encodeURIComponent(returnTo)}`;
                  if (recover) {
                    const { error } = await client.auth.resetPasswordForEmail(
                      accountEmail,
                      {
                        redirectTo: `${window.location.origin}/auth/callback?recovery=1`,
                      },
                    );
                    if (error) throw error;
                    setNotice(
                      "If an account exists for this email, you’ll receive a recovery link. Check your inbox.",
                    );
                  } else if (signup) {
                    const { data, error } = await client.auth.signUp({
                      email: accountEmail,
                      password: submittedPassword,
                      options: { emailRedirectTo: callback },
                    });
                    if (error) throw error;
                    if (data.session) {
                      window.location.assign(returnTo);
                      return;
                    }
                    setNotice(
                      "Check your email to confirm your account, then return here to sign in. Your trip is kept in this browser.",
                    );
                  } else {
                    const { error } = await client.auth.signInWithPassword({
                      email: accountEmail,
                      password: submittedPassword,
                    });
                    if (error) {
                      setError(authErrorMessage(error));
                      return;
                    }
                    window.location.assign(returnTo);
                    return;
                  }
                  setPassword("");
                  setConfirm("");
                  setShow(false);
                } catch (failure) {
                  setError(authErrorMessage(failure));
                } finally {
                  setPending(false);
                }
                return;
              }
              setNotice(
                recover
                  ? "Recovery preview only. No email has been sent."
                  : signup
                    ? "Account creation preview only. Nothing has been sent or saved to an account."
                    : "Sign-in preview only. No credentials have been sent and you are not signed in.",
              );
              setPassword("");
              setConfirm("");
              setShow(false);
            }}
          >
            <label htmlFor={`${id}-email`}>
              Email address
              <input
                name="email"
                id={`${id}-email`}
                type="email"
                inputMode="email"
                autoComplete={live ? "email" : "off"}
                required
                disabled={pending}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setNotice("");
                }}
                onFocus={() => setFocused("email")}
                onBlur={() => setFocused(null)}
                placeholder="you@example.com"
              />
            </label>
            {live && signup && (
              <p className="tc-password-note">
                Use a real inbox you can open to confirm your account.
              </p>
            )}
            {!recover && (
              <>
                <div className="tc-password-label">
                  <label htmlFor={`${id}-password`}>
                    {signup ? "Create a password" : "Password"}
                  </label>
                  {signup && (
                    <span>
                      {length ? `${length} characters` : "Make it your own"}
                    </span>
                  )}
                </div>
                <div className="tc-password">
                  <input
                    name="password"
                    id={`${id}-password`}
                    aria-label={signup ? "Create a password" : "Password"}
                    aria-describedby={signup ? `${id}-length-note` : undefined}
                    type={show ? "text" : "password"}
                    autoComplete={
                      live && !signup ? "current-password" : "new-password"
                    }
                    required
                    disabled={pending}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setNotice("");
                      setError("");
                    }}
                    onFocus={() => setFocused("password")}
                    onBlur={() => setFocused(null)}
                    placeholder={
                      signup ? "A phrase only you would know" : "Your password"
                    }
                  />
                  <button
                    type="button"
                    onClick={() => setShow((v) => !v)}
                    aria-label={show ? "Hide password" : "Show password"}
                    aria-pressed={show}
                  >
                    <Eye closed={show} />
                  </button>
                </div>
              </>
            )}
            {signup && (
              <>
                <p className="tc-password-note" id={`${id}-length-note`}>
                  Use a unique password or passphrase. Your little lookout keeps
                  its eyes to itself.
                </p>
                <label htmlFor={`${id}-confirm`}>
                  Confirm password
                  <input
                    name="confirm"
                    id={`${id}-confirm`}
                    autoComplete="new-password"
                    type={show ? "text" : "password"}
                    required
                    disabled={pending}
                    onFocus={() => setFocused("password")}
                    onBlur={() => setFocused(null)}
                    value={confirm}
                    onChange={(e) => {
                      setConfirm(e.target.value);
                      setError("");
                    }}
                    placeholder="Once more, just to be sure"
                    aria-invalid={!!error}
                    aria-describedby={error ? `${id}-error` : undefined}
                  />
                </label>
              </>
            )}
            {!signup && !recover && (
              <button
                className="tc-forgot"
                type="button"
                onClick={() => change("recover")}
              >
                Forgot your password?
              </button>
            )}
            {error && (
              <p className="tc-error" id={`${id}-error`} role="alert">
                {error}
              </p>
            )}
            {notice && (
              <p className="tc-notice" role="status">
                {notice}
              </p>
            )}
            <button
              className="tc-submit"
              type="submit"
              disabled={pending || (live && !authConfigured)}
            >
              {pending
                ? "Working…"
                : live
                  ? recover
                    ? "Send recovery link"
                    : signup
                      ? "Create account"
                      : "Sign in"
                  : recover
                    ? "Preview recovery"
                    : signup
                      ? "Preview account creation"
                      : "Preview sign in"}
              <span aria-hidden="true">↗</span>
            </button>
            <p className="tc-form-footnote">
              {live
                ? "You can return to your trip at any time."
                : "No live authentication connected."}
            </p>
          </form>
          <div className="tc-account-switch">
            {recover ? (
              <button onClick={() => change("signin")}>Back to sign in</button>
            ) : (
              <>
                <span>
                  {signup
                    ? "Already have a little elsewhere?"
                    : "New to Elsewhere?"}
                </span>
                <button onClick={() => change(signup ? "signin" : "signup")}>
                  {signup ? "Sign in" : "Create an account"}
                </button>
              </>
            )}
          </div>
        </section>
      </div>
      {!live && (
        <footer className="tc-footer">
          <span>A companion from the meadow. A form that responds to you.</span>
          <p>
            Frontend preview. No accounts created, passwords stored, or emails
            sent.
          </p>
        </footer>
      )}
    </main>
  );
}
function Eye({ closed }: { closed: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="23"
      height="23"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      {closed && <path d="m3 3 18 18" />}
    </svg>
  );
}
