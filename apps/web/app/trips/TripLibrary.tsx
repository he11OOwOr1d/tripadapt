"use client";
import { useEffect, useRef, useState } from "react";
import { TRIP_ERASURE_DAYS, deletedNotice } from "../../lib/trips/trip-delete";
export default function TripLibrary({
  open,
  loading,
  error,
  rows,
  hasMore,
  onClose,
  onOpen,
  onMore,
  onNew,
  onRetry,
  onDelete,
}: {
  open: boolean;
  loading: boolean;
  error: string;
  rows: { id: string; title: string }[] | null;
  hasMore: boolean;
  onClose: () => void;
  onOpen: (id: string) => void;
  onMore: () => void;
  onNew: () => void;
  onRetry: () => void;
  /** Delete one trip. `problem` is null once it is gone, else says why it was not deleted; `eraseAfter` is when it will be erased. */
  onDelete: (id: string) => Promise<{ problem: string | null; eraseAfter: string | null }>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [failure, setFailure] = useState("");
  const keep = useRef<HTMLButtonElement>(null);
  const fresh = useRef<HTMLButtonElement>(null);
  // Asking "are you sure?" lands on the safe choice, so a stray Enter keeps the trip.
  useEffect(() => { if (confirming) keep.current?.focus(); }, [confirming]);
  // Backing out of the question puts the keyboard back on that trip's Delete button, not on the page behind the dialog.
  const [returnTo, setReturnTo] = useState<string | null>(null);
  useEffect(() => {
    if (!returnTo || confirming) return;
    dialog.current?.querySelector<HTMLButtonElement>(`[data-delete-for="${CSS.escape(returnTo)}"]`)?.focus();
    setReturnTo(null);
  }, [returnTo, confirming]);
  useEffect(() => { if (!open) { setConfirming(null); setNotice(""); setFailure(""); } }, [open]);
  async function remove(row: { id: string; title: string }) {
    setDeleting(row.id);
    setFailure("");
    const { problem, eraseAfter } = await onDelete(row.id);
    setDeleting(null);
    if (problem) { setFailure(problem); return; }
    setConfirming(null);
    setNotice(deletedNotice(row.title, eraseAfter));
    // The row is gone, so keyboard focus would be lost; start from the top of the list.
    fresh.current?.focus();
  }
  useEffect(() => {
    const node = dialog.current;
    if (open && !node?.open) node?.showModal();
    else if (!open && node?.open) node.close();
  }, [open]);
  return (
    <dialog
      ref={dialog}
      className="trip-library"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === dialog.current) onClose();
      }}
      aria-labelledby="trip-library-title"
    >
      <div className="trip-library-inner">
        <header>
          <div>
            <p>Your little elsewheres</p>
            <h2 id="trip-library-title">My trips</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close my trips">
            ×
          </button>
        </header>
        <button ref={fresh} className="library-new" onClick={onNew} disabled={loading}>
          ＋ Start a new trip
        </button>
        {loading && <p role="status">Opening your trips…</p>}
        {notice && <p role="status" className="library-notice">{notice}</p>}
        {error && (
          <div role="alert">
            <p>{error}</p>
            <button onClick={onRetry}>Try again</button>
          </div>
        )}
        {!loading && !error && rows?.length === 0 && (
          <p className="library-empty">
            Your first escape starts here. Once you begin, it’s saved
            automatically.
          </p>
        )}
        <div className="library-rows">
          {rows?.map((row) => (
            <div key={row.id} className="library-row">
              <button
                type="button"
                className="library-open"
                onClick={() => onOpen(row.id)}
                disabled={loading || deleting !== null}
              >
                <span aria-hidden="true">↗</span>
                <strong>{row.title}</strong>
                <span>Open trip</span>
              </button>
              {confirming === row.id ? (
                <div className="library-confirm" role="group" aria-label={`Delete ${row.title}?`}>
                  <p>
                    Delete “{row.title}”? It is hidden from your account now and permanently erased after {TRIP_ERASURE_DAYS} days. Any planning in progress stops. This can’t be undone from the app.
                  </p>
                  {failure && <p role="alert">{failure}</p>}
                  <div>
                    <button type="button" ref={keep} onClick={() => { setConfirming(null); setFailure(""); setReturnTo(row.id); }} disabled={deleting !== null}>
                      Keep it
                    </button>
                    <button type="button" className="library-danger" onClick={() => void remove(row)} disabled={deleting !== null}>
                      {deleting === row.id ? "Deleting…" : "Delete trip"}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="library-delete"
                  data-delete-for={row.id}
                  aria-label={`Delete ${row.title}`}
                  onClick={() => { setConfirming(row.id); setNotice(""); setFailure(""); }}
                  disabled={loading || deleting !== null}
                >
                  Delete
                </button>
              )}
            </div>
          ))}
        </div>
        {hasMore && (
          <button onClick={onMore} disabled={loading}>
            More trips
          </button>
        )}
        <p className="library-footnote">Your plans, ready when you are.</p>
      </div>
    </dialog>
  );
}
