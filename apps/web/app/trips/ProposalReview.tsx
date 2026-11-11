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
  const points = proposal ? [
    { id: `origin:${proposal.plan.origin?.label ?? ""}`, label: proposal.plan.origin?.label || "Starting location" },
    ...proposal.plan.stops.map(stop => ({ id: stop.client_id, label: stop.name })),
  ] : [];
  if (proposal?.plan.preferences?.return_to_origin) points.push({ id: `finish:${proposal.plan.origin?.label ?? ""}`, label: proposal.plan.origin?.label || "Starting location" });
  else if (proposal?.plan.return_location) points.push({ id: `finish:${proposal.plan.return_location.label}`, label: proposal.plan.return_location.label });
  const travelLegs = points.slice(0, -1).map((from, i) => ({ from: from.label, to: points[i + 1].label, preference: proposal?.plan.preferences?.travel_preferences[JSON.stringify([from.id, points[i + 1].id])] }));
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
        Accepting keeps a separate snapshot and applies approved changes to
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
                    ? ["move_activity", "resize_activity", "remove_activity"].includes(proposal.generation?.operation ?? "")
                      ? "Requested schedule change · local time"
                      : "AI-generated proposal · sample evidence"
                    : proposal.source === "restore" ? "Restoration proposal · provisional" : "Provisional manual plan"}
          </p>
          {proposal.generation?.restoration && <section className="proposal-time-change" aria-label="Restoration summary">
            <h3>Restore version {proposal.generation.restoration.version_number}?</h3>
            <p>Activity changes: {proposal.generation.restoration.added} returning, {proposal.generation.restoration.removed} removed, {proposal.generation.restoration.changed} changed.</p>
            <p>{proposal.generation.restoration.settings_changed ? "Route or trip settings also change. Review the full snapshot below." : "Route and trip settings stay the same."}</p>
            <p>Acceptance replaces your editable draft and creates a new accepted version. Earlier versions are kept. No supplier reservations are changed. Historical records and sample suggestions have not been rechecked.</p>
          </section>}
          {proposal.source === "restore" && <section aria-label="Restored trip settings">
            <h3>The trip you would restore</h3>
            <p>{proposal.plan.origin?.label || "Starting location left open"} · {proposal.plan.traveler_count} travelers · {proposal.plan.room_count} {proposal.plan.room_count === 1 ? "room" : "rooms"}</p>
            <p>{proposal.plan.date_mode === "exact" ? `Dates: ${proposal.plan.start_date} to ${proposal.plan.end_date || "open end"}` : proposal.plan.date_mode === "window" ? `Window: ${proposal.plan.window_start} to ${proposal.plan.window_end}` : "Dates flexible"}{proposal.plan.desired_days ? ` · ${proposal.plan.desired_days} days` : ""}</p>
            <p>{proposal.plan.budget ? `Budget: ${proposal.plan.display_currency} ${proposal.plan.budget.amount} (${proposal.plan.budget.mode})` : "Budget left open"}</p>
            <details><summary>Stay and travel preferences to restore</summary>
              <p>Pace: {proposal.plan.preferences?.pace}; interests: {proposal.plan.preferences?.interests.join(", ") || "left open"}. Preferred transport: {proposal.plan.preferences?.preferred_modes.join(", ") || "left open"}.</p>
              {proposal.plan.stops.map(stop => { const stay = proposal.plan.preferences?.stay_preferences[stop.client_id]; return stay ? <p key={stop.client_id}>{stop.name}: {stay.style || "style open"}, {stay.rate ? `${proposal.plan.display_currency} ${stay.rate} per ${stay.basis} per night` : "allowance unknown"}.</p> : null; })}
              {travelLegs.map((leg, i) => <p key={i}>{leg.from} → {leg.to}: {leg.preference ? `${leg.preference.mode || "mode open"}; ${leg.preference.hours || "unknown"} hours; ${leg.preference.overnight} overnight travel nights; ${leg.preference.rate ? `${proposal.plan.display_currency} ${leg.preference.rate} per ${leg.preference.basis}` : "allowance unknown"}` : "preferences left open"}.</p>)}
              <p>Finish: {proposal.plan.preferences?.return_to_origin ? "return to starting location" : proposal.plan.return_location?.label || "left open"}. Allowances are not live prices or reservations.</p>
            </details>
          </section>}
          {proposal.generation?.removal && (
            <section className="proposal-time-change" aria-label="Activity proposed for removal">
              <h3>Remove {proposal.generation.removal.label}?</h3>
              <p>{proposal.generation.removal.destination} · day {proposal.generation.removal.day}</p>
              <p>{proposal.generation.removal.start} local time · {proposal.generation.removal.duration_minutes} minutes</p>
              <p>This activity will leave your itinerary. Everything else stays in place. No reservation is cancelled.</p>
            </section>
          )}
          {proposal.generation?.change && (
            <section className="proposal-time-change" aria-label="Proposed schedule change">
              <h3>{proposal.generation.change.label}</h3>
              <p>{proposal.generation.change.destination || "This destination"} · local time</p>
              <dl>
                <div><dt>Current · day {proposal.generation.change.day}</dt><dd>{proposal.generation.change.before}</dd></div>
                <div><dt>Proposed · day {proposal.generation.change.destination_day ?? proposal.generation.change.day}</dt><dd>{proposal.generation.change.after}</dd></div>
              </dl>
              <p>{proposal.generation.operation === "resize_activity" ? `Starts at ${proposal.generation.change.start} as before. Everything else stays in place.` : "Same duration. Everything else stays in place."}</p>
            </section>
          )}
          {proposal.generation?.summary && !["move_activity", "resize_activity", "remove_activity"].includes(proposal.generation.operation ?? "") && (
            <section className="planning-progress">
              <h3>{proposal.generation.operation === "move_activity" ? "What changes" : "Why this shape works"}</h3>
              <p>{proposal.generation.summary}</p>
              {!!proposal.generation.additions?.length && <details>
                <summary>Reasons for each addition</summary>
                {proposal.generation.additions?.map((a, i) => (
                  <p key={i}>
                    {a.start} · {a.reason}
                  </p>
                ))}
              </details>}
            </section>
          )}
          <details open={!["move_activity", "resize_activity", "remove_activity"].includes(proposal.generation?.operation ?? "")}>
            <summary>Complete itinerary</summary>
          <div className="proposal-route">
            {proposal.plan.stops.map((stop) => (
              <section key={stop.client_id}>
                <h3>{stop.name}</h3>
                <p>{stop.desired_nights ?? "Unallocated"} nights{proposal.source === "restore" && stop.timezone ? ` · ${stop.timezone}` : ""}</p>
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
          </details>
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
                {proposal.source === "restore" ? "Accept restoration" : proposal.generation?.operation === "remove_activity" ? "Accept removal" : "Accept provisional plan"}
              </button>
            )}
          </footer>
        </>
      )}
      {!proposal && !busy && <button onClick={onClose}>Back to my trip</button>}
    </dialog>
  );
}
