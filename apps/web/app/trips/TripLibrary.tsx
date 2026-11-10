"use client";
import { useEffect, useRef } from "react";
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
}) {
  const dialog = useRef<HTMLDialogElement>(null);
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
        <button className="library-new" onClick={onNew} disabled={loading}>
          ＋ Start a new trip
        </button>
        {loading && <p role="status">Opening your trips…</p>}
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
            <button
              key={row.id}
              onClick={() => onOpen(row.id)}
              disabled={loading}
            >
              <span aria-hidden="true">↗</span>
              <strong>{row.title}</strong>
              <span>Open trip</span>
            </button>
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
