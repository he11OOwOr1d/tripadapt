"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { authClient } from "../../lib/auth/client";
import "../design/auth-studies/trail-companion/companion.css";
export default function Page() {
  const [ready, setReady] = useState(false),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("Checking your recovery session…");
  useEffect(() => {
    let active = true;
    async function check() {
      try {
        const { data, error } = await authClient().auth.getUser();
        if (active) {
          setReady(!error && !!data.user);
          setMessage(
            error || !data.user
              ? "Open a valid recovery link from your email to change your password."
              : "Choose a unique password or passphrase.",
          );
        }
      } catch {
        if (active) setMessage("Recovery is awaiting Supabase configuration.");
      }
    }
    void check();
    return () => {
      active = false;
    };
  }, []);
  return (
    <main className="tc">
      <header className="tc-header">
        <Link className="tc-logo" href="/">
          elsewhere.
        </Link>
        <Link href="/sign-in">Back to sign in</Link>
      </header>
      <section
        className="tc-form-panel"
        style={{ maxWidth: 460, margin: "50px auto", padding: "0 24px" }}
      >
        <div className="tc-title">
          <h1>A fresh way in.</h1>
        </div>
        <p role="status">{message}</p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy || !ready) return;
            if (password !== confirm) {
              setMessage(
                "The passwords don’t match. Enter the same password in both fields.",
              );
              return;
            }
            setBusy(true);
            try {
              const { error } = await authClient().auth.updateUser({
                password,
              });
              if (error) {
                setMessage(
                  "Could not update your password. Try a different password or request a fresh link.",
                );
                return;
              }
              setPassword("");
              setConfirm("");
              await authClient().auth.signOut();
              setReady(false);
              setMessage(
                "Password updated. Sign in with your new password to return to your trip.",
              );
            } catch {
              setMessage("Connection failed. Try again.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            New password
            <input
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={!ready}
            />
          </label>
          <label>
            Confirm password
            <input
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              disabled={!ready}
            />
          </label>
          <button className="tc-submit" disabled={!ready || busy}>
            {busy ? "Updating…" : "Update password"}
          </button>
        </form>
        <Link href="/sign-in">Sign in</Link>
      </section>
    </main>
  );
}
