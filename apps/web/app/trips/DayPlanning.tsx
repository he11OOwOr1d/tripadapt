"use client";
import { useEffect, useRef, useState } from "react";
import {
  planningJobAdapter,
  terminalJob,
  type PlanningJob,
} from "../../lib/trips/planning-jobs";

export default function DayPlanning({
  account,
  engine,
  stopId,
  day,
  place,
  onClose,
  onReview,
}: {
  account: { id: string; versionEtag: string };
  engine: "fixture" | "groq";
  stopId: string;
  day: number;
  place: string;
  onClose: () => void;
  onReview: (id: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const key = useRef(crypto.randomUUID());
  const storageKey = `elsewhere.planning-job:${account.id}`;
  const [job, setJob] = useState<PlanningJob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [resume, setResume] = useState(0);
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
    const stored = sessionStorage.getItem(storageKey);
    if (stored) {
      setBusy(true);
      planningJobAdapter
        .get(stored)
        .then((result) => {
          if (active) setJob(result);
        })
        .catch(() => {
          if (active) {
            setError(
              "The previous job could not be opened. Retry when your connection returns.",
            );
          }
        })
        .finally(() => {
          if (active) setBusy(false);
        });
    }
    return () => {
      active = false;
    };
  }, [storageKey, resume]);
  useEffect(() => {
    if (!job || terminalJob(job)) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const next = await planningJobAdapter.get(job.id);
        if (!active) return;
        setJob(next);
        setError("");
        if (!terminalJob(next))
          timer = setTimeout(poll, Math.max(2, next.poll_after_seconds) * 1000);
      } catch {
        if (active) {
          setError(
            "Progress is temporarily unavailable. Your job is kept; we’ll retry.",
          );
          timer = setTimeout(poll, 5000);
        }
      }
    };
    timer = setTimeout(poll, 2000);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [job?.id, job?.status]);
  async function start() {
    setBusy(true);
    setError("");
    try {
      const result = await planningJobAdapter.start(
        account,
        stopId,
        day,
        key.current,
        engine,
      );
      sessionStorage.setItem(storageKey, result.id);
      setJob(result);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not queue this day.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function cancel() {
    if (!job) return;
    setBusy(true);
    setError("");
    try {
      setJob(await planningJobAdapter.cancel(job.id));
    } catch {
      setError(
        "Cancellation could not be confirmed. Retry; the job may still be running.",
      );
    } finally {
      setBusy(false);
    }
  }
  const isAI = (job?.engine ?? engine) === "groq";
  return (
    <dialog
      className="day-editor proposal-review"
      ref={dialog}
      aria-labelledby="day-planning-title"
      onCancel={onClose}
    >
      <header>
        <div>
          <p>
            {isAI ? "A day shaped around you" : "A small planning rehearsal"}
          </p>
          <h2 id="day-planning-title">Make room in your day.</h2>
        </div>
        <button aria-label="Close day planner" onClick={onClose}>
          ×
        </button>
      </header>
      <p>
        {job?.destination_name ?? place} · day{" "}
        {job ? job.scope.local_day_offset + 1 : day} in this place
      </p>
      <p>
        {isAI
          ? "Groq AI will suggest a few additions using your pace, interests and open time. Place additions use retrieved map records; visit and break durations are estimates. Hours, prices and travel times are unverified. If discovery fails, no sample places are substituted. Existing items stay in place."
          : "This test planner adds up to two meal or break blocks into open time. It uses fixtures, not AI or live travel data. Your existing items stay in place."}
      </p>
      {job?.engine === "groq" && job.evidence !== "places" && <p>This earlier job used sample evidence. A new request uses mapped places.</p>}
      {error && (
        <p role="alert" className="editor-error">
          {error}
        </p>
      )}
      {job && (
        <section className="planning-progress" aria-live="polite">
          <h3>{job.stage}</h3>
          <p>
            {job.status === "queued"
              ? "Waiting for the local worker. You can close this and return later."
              : job.status === "running"
                ? "Preparing suggestions. Your current plan stays unchanged."
                : job.status === "succeeded"
                  ? "Review the proposed additions before accepting anything."
                  : job.status === "superseded"
                    ? "Your trip changed. Start a new request from the latest saved draft."
                    : job.status === "cancelled"
                      ? "Your current itinerary is unchanged."
                      : job.error_code === "AI_LOCATION_REQUIRED"
                ? "Choose a map location in Explore nearby places, then start a new request."
                : job.error_code?.startsWith("ACTIVITY_") || job.error_code === "AI_NO_PLACE_EVIDENCE"
                  ? "Place discovery could not provide usable evidence. Try nearby search later; no sample places were substituted."
              : job.error_code === "AI_RATE_LIMITED"
                        ? "Groq is rate-limiting requests. Try again later; your itinerary is unchanged."
                        : job.error_code === "AI_AUTH_FAILED"
                          ? "Groq authentication failed. Check the backend key; your itinerary is unchanged."
                          : "Planning could not finish. Your current itinerary is unchanged."}
          </p>
          {job.cancel_requested && !terminalJob(job) && (
            <p>Cancellation requested…</p>
          )}
        </section>
      )}
      {!job && !busy && (
        <button className="day-primary" onClick={() => void start()}>
          {isAI ? "Generate day proposal" : "Queue test suggestions"}
        </button>
      )}
      {!job && error && (
        <button disabled={busy} onClick={() => setResume((n) => n + 1)}>
          Retry previous job
        </button>
      )}
      {busy && <p role="status">Checking your request…</p>}
      {job && !terminalJob(job) && (
        <button
          disabled={busy || job.cancel_requested}
          onClick={() => void cancel()}
        >
          Cancel planning
        </button>
      )}
      {job?.status === "succeeded" && job.proposal_id && (
        <button
          className="day-primary"
          onClick={() => onReview(job.proposal_id!)}
        >
          {isAI ? "Review AI suggestions" : "Review test suggestions"}
        </button>
      )}
      {job && terminalJob(job) && (
        <button
          onClick={() => {
            sessionStorage.removeItem(storageKey);
            key.current = crypto.randomUUID();
            setJob(null);
            setError("");
          }}
        >
          Plan the selected day again
        </button>
      )}
      <p className="planning-footnote">
        Closing this window does not cancel a queued request.
      </p>
    </dialog>
  );
}
