"use client";
import { useEffect, useRef, useState } from "react";
import { revisionAdapter, type Revision } from "../../lib/trips/revisions";

export default function PlanHistory({ account, onClose, onReview }: {
  account: { id: string; versionEtag: string };
  onClose: () => void;
  onReview: (id: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const retryKeys = useRef(new Map<string, string>());
  const [rows, setRows] = useState<Revision[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const node = dialog.current;
    node?.showModal();
    return () => { node?.close(); if (previous?.isConnected) previous.focus(); };
  }, []);
  useEffect(() => {
    let active = true;
    setBusy(true); setError("");
    revisionAdapter.list(account.id).then(page => {
      if (active) { setRows(page.revisions); setCursor(page.next_before); }
    }).catch(failure => { if (active) setError(failure instanceof Error ? failure.message : "History could not load."); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [account.id, attempt]);
  async function older() {
    if (!cursor || busy) return;
    setBusy(true); setError("");
    try { const page = await revisionAdapter.list(account.id, cursor); setRows(old => [...old, ...page.revisions]); setCursor(page.next_before); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Earlier plans could not load."); }
    finally { setBusy(false); }
  }
  async function review(row: Revision) {
    setBusy(true); setError("");
    if (!retryKeys.current.has(row.id)) retryKeys.current.set(row.id, crypto.randomUUID());
    try { const proposal = await revisionAdapter.restore(account.id, row.id, account.versionEtag, retryKeys.current.get(row.id)!); onReview(proposal.id); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "This restoration could not be prepared. Your draft is unchanged."); }
    finally { setBusy(false); }
  }
  return <dialog ref={dialog} className="day-editor proposal-review plan-history" aria-labelledby="history-title" onCancel={e => { if (busy) e.preventDefault(); else onClose(); }}>
    <header><div><p>Your journey, as it evolved</p><h2 id="history-title">Plans worth keeping.</h2></div><button onClick={onClose} disabled={busy} aria-label="Close plan history">×</button></header>
    <p>Accepted plans are kept here. Review an earlier version before restoring it; your draft stays unchanged until acceptance.</p>
    <p>Restoring includes its dates, travelers, route, preferences, budget and activities. It never restores or cancels supplier reservations.</p>
    {error && <div role="alert" className="editor-error"><p>{error}</p><button disabled={busy} onClick={() => setAttempt(n => n + 1)}>Reload history</button></div>}
    {busy && <p role="status">Opening your saved plans…</p>}
    {!busy && !error && !rows.length && <p>No accepted plans yet. Use Review plan to accept your first snapshot. Your editable draft is saved separately.</p>}
    <ol className="history-list">{rows.map(row => <li key={row.id}>
      <h3>Version {row.version_number}{row.current ? " · current plan" : ""}</h3>
      <p>{row.accepted_at ? new Date(row.accepted_at).toLocaleString() : "Acceptance time unavailable"}</p>
      <p>{row.destinations.join(" → ")}</p>
      <p>{row.activity_count} activities · {row.traveler_count} travelers{row.source === "restore" ? " · restored snapshot" : ""}</p>
      <button disabled={busy} onClick={() => void review(row)}>Review restore of version {row.version_number}</button>
    </li>)}</ol>
    {cursor && <button disabled={busy} onClick={() => void older()}>Earlier accepted plans</button>}
    <footer><button onClick={onClose} disabled={busy}>Back to my trip</button></footer>
  </dialog>;
}
