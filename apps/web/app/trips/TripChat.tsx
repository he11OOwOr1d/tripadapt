"use client";
import { useEffect, useRef, useState } from "react";
import {
  conversationAdapter,
  progressWords,
  type ConversationTurn,
} from "../../lib/trips/conversation";
import { planningJobAdapter, terminalJob } from "../../lib/trips/planning-jobs";

export default function TripChat({
  account,
  stopId,
  day,
  place,
  canSend,
  onClose,
  onReview,
}: {
  account: { id: string; versionEtag: string };
  stopId: string;
  day: number;
  place: string;
  canSend: boolean;
  onClose: () => void;
  onReview: (id: string) => void;
}) {
  const [turns, setTurns] = useState<ConversationTurn[]>([]),
    [cursor, setCursor] = useState<string | null>(null),
    [text, setText] = useState(""),
    [loading, setLoading] = useState(true),
    [sending, setSending] = useState(false),
    [error, setError] = useState(""),
    [refresh, setRefresh] = useState(0),
    [tick, setTick] = useState(Date.now());
  const initialized = useRef(false);
  const draftKey = `elsewhere.chat-draft:${account.id}`;
  useEffect(() => {
    try {
      setText(sessionStorage.getItem(draftKey) ?? "");
    } catch {}
  }, [draftKey]);
  const retryKey = useRef<{ body: string; key: string } | null>(null);
  const log = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const submitted = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const pending = turns.find((t) => !terminalJob(t.job));
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const node = panel.current;
    heading.current?.focus({ preventScroll: true });
    const media = window.matchMedia("(max-width: 1150px)");
    const align = () => {
      if (media.matches)
        node?.scrollIntoView({ block: "start", behavior: "instant" });
    };
    align();
    media.addEventListener("change", align);
    return () => {
      media.removeEventListener("change", align);
      if (
        previous?.isConnected &&
        (document.activeElement === document.body ||
          node?.contains(document.activeElement))
      )
        previous.focus({ preventScroll: !media.matches });
    };
  }, []);
  useEffect(() => {
    if (!sending && submitted.current) {
      composer.current?.focus({ preventScroll: true });
      submitted.current = false;
    }
  }, [sending]);
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const page = await conversationAdapter.list(account.id);
        if (!active) return;
        setTurns((old) => {
          const newest = new Map(page.turns.map((t) => [t.id, t]));
          return [...old.filter((t) => !newest.has(t.id)), ...page.turns];
        });
        if (!initialized.current) {
          setCursor(page.next_cursor);
          initialized.current = true;
        }
        setError("");
        if (page.turns.some((t) => !terminalJob(t.job)))
          timer = setTimeout(poll, 2000);
      } catch {
        if (active)
          setError(
            "Chat could not be refreshed. Your conversation is saved; retry when the connection returns.",
          );
      } finally {
        if (active) setLoading(false);
      }
    }
    void poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [account.id, refresh]);
  useEffect(() => {
    if (!pending) return;
    const timer = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [pending?.id]);
  useEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [turns.at(-1)?.id, turns.at(-1)?.assistant_text]);
  async function send(value = text) {
    if (!value.trim() || sending || pending || !canSend) return;
    submitted.current = true;
    setSending(true);
    setError("");
    const body = JSON.stringify({
      text: value.trim(),
      etag: account.versionEtag,
      stopId,
      day,
    });
    if (retryKey.current?.body !== body)
      retryKey.current = { body, key: crypto.randomUUID() };
    try {
      const turn = await conversationAdapter.send(
        account,
        value.trim(),
        stopId,
        day,
        retryKey.current.key,
      );
      setTurns((old) => [...old.filter((t) => t.id !== turn.id), turn]);
      setText("");
      try {
        sessionStorage.removeItem(draftKey);
      } catch {}
      retryKey.current = null;
      setRefresh((n) => n + 1);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Your message could not be sent. It is still here.",
      );
    } finally {
      setSending(false);
    }
  }
  async function older() {
    if (!cursor) return;
    try {
      const page = await conversationAdapter.list(account.id, cursor);
      setTurns((old) => [
        ...page.turns,
        ...old.filter((t) => !page.turns.some((p) => p.id === t.id)),
      ]);
      setCursor(page.next_cursor);
    } catch {
      setError("Earlier messages could not be loaded. Please retry.");
    }
  }
  async function cancel(id: string) {
    try {
      await planningJobAdapter.cancel(id);
      setRefresh((n) => n + 1);
    } catch {
      setError(
        "Cancellation could not be confirmed. The request may still be running.",
      );
    }
  }
  return (
    <aside
      ref={panel}
      className="trip-chat"
      aria-labelledby="trip-chat-title"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onClose();
        }
      }}
    >
      <header className="chat-header">
        <div>
          <p>Your travel companion</p>
          <h2 id="trip-chat-title" tabIndex={-1} ref={heading}>
            A little back and forth.
          </h2>
        </div>
        <button onClick={onClose} aria-label="Back to plan">
          <span className="chat-close-desktop">×</span>
          <span className="chat-close-phone">Back to plan</span>
        </button>
      </header>
      <p className="chat-context">
        {place} · day {day} in this place
      </p>
      <div
        className="chat-log"
        ref={log}
        role="log"
        aria-label="Trip conversation"
        aria-relevant="additions text"
      >
        {cursor && (
          <button className="chat-older" onClick={() => void older()}>
            Earlier messages
          </button>
        )}
        {!turns.length && !loading && (
          <div className="chat-welcome">
            <p>
              Ask about your route, or make a little room in this day. I’ll show
              you a proposal before changing anything.
            </p>
            <div className="chat-choices">
              {[
                "Explain this day",
                "Summarize my route",
                "Suggest a rest break",
              ].map((choice) => (
                <button
                  key={choice}
                  disabled={!canSend || sending}
                  onClick={() => void send(choice)}
                >
                  {choice}
                </button>
              ))}
            </div>
          </div>
        )}
        {loading && <p role="status">Opening your conversation…</p>}
        {turns.map((turn) => (
          <section className="chat-turn" key={turn.id}>
            <div className="chat-user">
              <span>You</span>
              <p>{turn.user_text}</p>
            </div>
            {turn.assistant_text && (
              <div className="chat-reply">
                <span>Elsewhere</span>
                <p>{turn.assistant_text}</p>
                {turn.job.proposal_id && (
                  <button
                    className="chat-proposal"
                    onClick={() => onReview(turn.job.proposal_id!)}
                  >
                    Open proposed changes
                    <span>Your itinerary changes after acceptance.</span>
                  </button>
                )}
                {turn.id === turns.at(-1)?.id && (
                  <div className="chat-choices">
                    {turn.choices.map((choice) => (
                      <button
                        key={choice}
                        disabled={!canSend || !!pending || sending}
                        onClick={() => void send(choice)}
                      >
                        {choice}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {!terminalJob(turn.job) && (
              <div className="chat-progress" role="status">
                <span className="chat-trail" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
                <span>
                  {turn.job.cancel_requested
                    ? "Cancellation requested…"
                    : progressWords(turn.job.stage, turn.id)}
                </span>
                <button
                  disabled={turn.job.cancel_requested}
                  onClick={() => void cancel(turn.job.id)}
                >
                  Cancel
                </button>
                {tick - Date.parse(turn.created_at) > 30000 && (
                  <small>
                    This is taking longer than usual. Your trip is unchanged.
                  </small>
                )}
              </div>
            )}
            {terminalJob(turn.job) && !turn.assistant_text && (
              <p className="chat-terminal">
                {turn.job.status === "cancelled"
                  ? "Request cancelled. Your trip is unchanged."
                  : turn.job.status === "superseded"
                    ? "Your saved trip changed. Ask again using the latest plan."
                    : turn.job.error_code === "AI_RATE_LIMITED"
                      ? "Groq is rate-limiting requests. Please try again later."
                      : "This request could not finish. Your trip is unchanged."}
              </p>
            )}
          </section>
        ))}
      </div>
      {error && (
        <div className="chat-error" role="alert">
          <p>{error}</p>
          <button onClick={() => setRefresh((n) => n + 1)}>
            Retry connection
          </button>
        </div>
      )}
      <form
        className="chat-composer"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <label htmlFor="trip-chat-message">What’s on your mind?</label>
        <textarea
          ref={composer}
          id="trip-chat-message"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            try {
              sessionStorage.setItem(draftKey, e.target.value);
            } catch {}
          }}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              void send();
            }
          }}
          disabled={sending}
          maxLength={2000}
          rows={2}
          placeholder="Ask about this day, suggest a break, or move an activity to 11:00 AM…"
        />
        <div>
          <small>
            {!canSend
              ? "Waiting for your trip edits to save…"
              : "AI uses sample activity evidence. No live prices or bookings."}
          </small>
          <button
            className="day-primary"
            disabled={
              !text.trim() || !canSend || !!pending || sending || loading
            }
            type="submit"
          >
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
      </form>
    </aside>
  );
}
