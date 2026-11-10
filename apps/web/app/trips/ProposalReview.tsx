"use client";
import { useEffect, useRef, useState } from "react";
import { proposalAdapter, type Proposal } from "../../lib/trips/proposals";

export default function ProposalReview({
  account,
  proposalId,
  onClose,
  onAccepted,
}: {
  account: { id: string; versionEtag: string };
  proposalId?: string;
  onClose: () => void;
  onAccepted: () => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const keys = useRef({
    submit: crypto.randomUUID(),
    accept: crypto.randomUUID(),
  });
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [acknowledged, setAcknowledged] = useState<string[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const node = dialog.current;
    node?.showModal();
    return () => {
      node?.close();
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  useEffect(() => {
    let active = true;
    setBusy(true);
    setError("");
    (proposalId
      ? proposalAdapter.get(account.id, proposalId)
      : proposalAdapter.submit(
          account.id,
          account.versionEtag,
          keys.current.submit,
        )
    )
      .then((result) => {
        if (active) {
          setProposal(result);
          if (result.status === "accepted")
            setAcknowledged(
              result.validation.issues
                .filter((i) => i.acknowledgeable)
                .map((i) => i.id),
            );
        }
      })
      .catch((failure) => {
        if (active)
          setError(
            failure instanceof Error
              ? failure.message
              : "Could not prepare this review.",
          );
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [account.id, account.versionEtag, attempt, proposalId]);
  const blocked = proposal?.validation.issues.some((i) => i.blocking);
  const advisories =
    proposal?.validation.issues.filter((i) => i.acknowledgeable) ?? [];
  async function act(accept: boolean) {
    if (!proposal || busy) return;
    setBusy(true);
    setError("");
    try {
      if (accept) {
        const result = await proposalAdapter.accept(
          account.id,
          proposal,
          acknowledged,
          keys.current.accept,
        );
        setProposal(result);
        await onAccepted();
      } else {
        await proposalAdapter.discard(account.id, proposal);
        onClose();
      }
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "The request failed. Your draft is kept.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      className="day-editor proposal-review"
      ref={dialog}
      aria-labelledby="proposal-title"
      onCancel={(e) => {
        if (busy) e.preventDefault();
        else onClose();
      }}
    >
      <header>
        <div>
          <p>Your plan, before you settle on it</p>
          <h2 id="proposal-title">A moment to review.</h2>
        </div>
        <button
          aria-label="Close plan review"
          disabled={busy}
          onClick={onClose}
        >
          ×
        </button>
      </header>
      <p>
        Accepting keeps a separate snapshot and applies approved additions to
        your editable draft. No reservations are made.
      </p>
      {busy && (
        <p role="status">
          {proposal ? "Updating your plan…" : "Checking your saved draft…"}
        </p>
      )}
      {error && (
        <div role="alert" className="editor-error">
          <p>{error}</p>
          {!proposal && (
            <button onClick={() => setAttempt((n) => n + 1)} disabled={busy}>
              Retry review
            </button>
          )}
        </div>
      )}
      {proposal && (
        <>
          <p className="proposal-state">
            {blocked
              ? "Needs a few adjustments"
              : proposal.status === "accepted"
                ? "Accepted provisional plan"
                : proposal.source === "fixture"
                  ? "Test fixture proposal · no AI or live data"
                  : proposal.source === "ai"
                    ? "AI-generated proposal · sample evidence"
                    : "Provisional manual plan"}
          </p>
          {proposal.generation?.summary && (
            <section className="planning-progress">
              <h3>Why this shape works</h3>
              <p>{proposal.generation.summary}</p>
              <details>
                <summary>Reasons for each addition</summary>
                {proposal.generation.additions?.map((a, i) => (
                  <p key={i}>
                    {a.start} · {a.reason}
                  </p>
                ))}
              </details>
            </section>
          )}
          <div className="proposal-route">
            {proposal.plan.stops.map((stop) => (
              <section key={stop.client_id}>
                <h3>{stop.name}</h3>
                <p>{stop.desired_nights ?? "Unallocated"} nights</p>
                {proposal.plan.activities
                  .filter((a) => a.stop_logical_id === stop.client_id)
                  .sort(
                    (a, b) =>
                      a.local_day_offset - b.local_day_offset ||
                      a.local_start_time.localeCompare(b.local_start_time),
                  )
                  .map((a) => (
                    <p key={a.logical_id}>
                      Day {a.local_day_offset + 1} ·{" "}
                      {a.local_start_time.slice(0, 5)} · {a.user_label}{" "}
                      <small>
                        ({a.duration_minutes} min{a.fixed ? ", fixed" : ""}
                        {a.completed ? ", completed" : ""}
                        {a.booked ? ", booked elsewhere" : ""})
                      </small>
                    </p>
                  ))}
              </section>
            ))}
          </div>
          {proposal.validation.issues
            .filter((i) => i.blocking)
            .map((issue) => (
              <p key={issue.id} className="editor-error">
                {issue.detail}
              </p>
            ))}
          {advisories.map((issue) => (
            <label className="proposal-ack" key={issue.id}>
              <input
                type="checkbox"
                disabled={busy || proposal.status !== "pending"}
                checked={acknowledged.includes(issue.id)}
                onChange={(e) =>
                  setAcknowledged((ids) =>
                    e.target.checked
                      ? [...ids, issue.id]
                      : ids.filter((id) => id !== issue.id),
                  )
                }
              />
              <span>I understand: {issue.detail}</span>
            </label>
          ))}
          <footer>
            <button
              disabled={busy || proposal.status !== "pending"}
              onClick={() => void act(false)}
            >
              Discard review
            </button>
            {blocked ? (
              <button className="day-primary" disabled={busy} onClick={onClose}>
                Back to editing
              </button>
            ) : (
              <button
                className="day-primary"
                disabled={
                  busy ||
                  proposal.status !== "pending" ||
                  advisories.some((i) => !acknowledged.includes(i.id))
                }
                onClick={() => void act(true)}
              >
                Accept provisional plan
              </button>
            )}
          </footer>
        </>
      )}
      {!proposal && !busy && <button onClick={onClose}>Back to my trip</button>}
    </dialog>
  );
}
