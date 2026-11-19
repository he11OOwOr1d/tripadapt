"use client";
import { useEffect, useRef, useState } from "react";
import { accountTripAdapter, AccountError } from "../../lib/trips/account-adapter";
import { tripCapabilities } from "../../lib/trips/lifecycle";

type Metadata = {
  id: string;
  lifecycle?: string;
  tripEtag: string;
  currentVersionId?: string | null;
};
const actions = {
  planning: {
    target: "active", label: "Start trip", heading: "Ready to start your trip?",
    detail: "Your accepted plan stays in place. AI day generation pauses; chat can explain your day or open a fresh time and location check. Your latest draft is not automatically accepted.",
  },
  active: {
    target: "completed", label: "Finish trip", heading: "Finished this trip?",
    detail: "Your plan and conversation stay saved. New AI requests and remaining-day checks close. Activities won’t be marked completed. You can resume this trip later.",
  },
  completed: {
    target: "active", label: "Resume trip", heading: "Continue your trip?",
    detail: "Chat and fresh remaining-day checks become available again. Your accepted plan and activity completion marks stay unchanged.",
  },
} as const;

export default function TripLifecycle({ account, disabled, onChanged }: {
  account: Metadata;
  disabled: boolean;
  onChanged: (value: Metadata) => void;
}) {
  const policy = tripCapabilities(account.lifecycle);
  const action = policy.lifecycle && policy.lifecycle !== "archived"
    ? actions[policy.lifecycle] : undefined;
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const node = dialog.current;
    node?.showModal();
    return () => { node?.close(); trigger.current?.focus(); };
  }, [open]);

  async function confirm() {
    if (!action || disabled || busy || error) return;
    setBusy(true);
    setError("");
    try {
      const updated = await accountTripAdapter.transition(account, action.target);
      onChanged(updated);
      setOpen(false);
    } catch (e) {
      setError(e instanceof AccountError && e.status === 412
        ? "This trip changed in another tab. Refresh trip status before trying again. Your draft is kept."
        : e instanceof Error ? `${e.message} Refresh trip status before retrying.`
        : "Trip status could not be confirmed. Refresh status before trying again.");
    } finally { setBusy(false); }
  }
  async function refresh() {
    setBusy(true);
    try {
      onChanged(await accountTripAdapter.metadata(account.id));
      setOpen(false);
      setError("");
    } catch {
      setError("Trip status could not be loaded. Check your connection and try again. Your plan is kept.");
    } finally { setBusy(false); }
  }
  const needsAccepted = action?.target === "active" && !account.currentVersionId;
  return (
    <section className="trip-lifecycle" aria-label="Trip status">
      <div>
        <strong>{policy.title}</strong>
        <p>{policy.description}</p>
        {needsAccepted && <p>Review and accept a plan before starting your trip.</p>}
        {disabled && action && <p>Finish editing and wait for saving before changing trip status.</p>}
      </div>
      {action && <button type="button" ref={trigger} disabled={disabled}
        onClick={() => { setError(""); setOpen(true); }}>{action.label}</button>}
      {open && action && (
        <dialog className="day-editor proposal-review trip-lifecycle-dialog" ref={dialog}
          aria-labelledby="trip-lifecycle-title"
          onCancel={event => { if (busy) event.preventDefault(); else setOpen(false); }}>
          <header>
            <h2 id="trip-lifecycle-title">{action.heading}</h2>
            <button type="button" aria-label="Close trip status confirmation" disabled={busy}
              onClick={() => setOpen(false)}>×</button>
          </header>
          <p>{action.detail}</p>
          <p>Changing status makes older AI work and pending agent suggestions stale. It doesn’t make or cancel reservations.</p>
          {needsAccepted && <p>There is no accepted plan yet. Close this dialog and review your plan first.</p>}
          {error && <p role="alert">{error}</p>}
          <footer>
            <button type="button" disabled={busy} onClick={() => setOpen(false)}>Keep current status</button>
            <button type="button" className="day-primary" disabled={busy || disabled || needsAccepted || !!error}
              onClick={() => void confirm()}>{busy ? "Checking trip status…" : action.label}</button>
            {error && <button type="button" disabled={busy} onClick={() => void refresh()}>Refresh trip status</button>}
          </footer>
        </dialog>
      )}
    </section>
  );
}
