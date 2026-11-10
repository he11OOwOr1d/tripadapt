"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  accountTripAdapter,
  SignInRequired,
} from "../../lib/trips/account-adapter";
import { authClient } from "../../lib/auth/client";
import { authConfigured } from "../../lib/auth/config";
import {
  emptyTrip,
  sampleTrip,
  mockTripAdapter,
  guestTripAdapter,
  mockSampleAdapter,
  isTrip,
  type Trip,
  type Activity,
} from "../../lib/trips/adapter";
import TripCreation from "./TripCreation";
import TripLibrary from "./TripLibrary";
import ItineraryWorkspace from "./ItineraryWorkspace";
import ActivityEditor from "./ActivityEditor";
import ProposalReview from "./ProposalReview";
import DayPlanning from "./DayPlanning";
import TripChat from "./TripChat";
import "./chat.css";
import { tripUrl } from "../../lib/trips/itinerary";
import { useTripAutosave } from "../../lib/trips/use-trip-autosave";
import "./workspace.css";
import "./creation.css";
import "./unfolding.css";
import "./journey-refinement.css";
import "./itinerary.css";

export default function TripWorkbench({
  initialView,
}: {
  initialView: "setup" | "itinerary";
}) {
  const allowLeave = useRef(false);
  const [ready, setReady] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryError, setLibraryError] = useState("");
  const [trip, setTrip] = useState<Trip>(() =>
    structuredClone(initialView === "setup" ? emptyTrip : sampleTrip),
  );
  const [view, setView] = useState(initialView);
  const [creationStep, setCreationStep] = useState(0);
  const [loadGeneration, setLoadGeneration] = useState(0);
  const adapter = initialView === "setup" ? mockTripAdapter : mockSampleAdapter;
  const [account, setAccount] = useState<{
    id: string;
    tripEtag: string;
    versionEtag: string;
  } | null>(null);
  const [accountRows, setAccountRows] = useState<
    { id: string; title: string }[] | null
  >(null);
  const [accountCursor, setAccountCursor] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [accountLoading, setAccountLoading] = useState(false);
  const [selected, setSelected] = useState("jaipur");
  const [day, setDay] = useState(1);
  const [notice, setNotice] = useState("");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Activity | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [planningOpen, setPlanningOpen] = useState(false);
  const [generatedProposalId, setGeneratedProposalId] = useState<
    string | undefined
  >();
  const [reviewOpen, setReviewOpen] = useState(false);
  const [removedActivity, setRemovedActivity] = useState<Activity | null>(null);
  const modalOpen = !!removing;
  useEffect(() => {
    if (!modalOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>(".trip-dialog");
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusables = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          "button:not(:disabled),input,select,textarea",
        ) ?? [],
      );
    focusables()[0]?.focus();
    function keydown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setEditing(null);
        setRemoving(null);
      }
      if (e.key === "Tab") {
        const nodes = focusables();
        const first = nodes[0];
        const last = nodes.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    }
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      document.body.style.overflow = oldOverflow;
      previous?.focus();
    };
  }, [modalOpen]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      if (!allowLeave.current) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(() => {
    if (initialView !== "setup") return;
    let active = true;
    async function restore() {
      try {
        const params = new URLSearchParams(window.location.search);
        const id = params.get("trip");
        if (params.get("view") === "itinerary") {
          setView("itinerary");
          const destination = params.get("stop");
          if (destination) setSelected(destination);
          const requestedDay = Number(params.get("day"));
          if (Number.isSafeInteger(requestedDay) && requestedDay > 0)
            setDay(requestedDay);
        }
        const pending = sessionStorage.getItem(
          "elsewhere.pending-account-save",
        );
        if (id && !pending && active) setAccountLoading(true);
        if (pending) {
          let pendingTrip: Trip | null = null;
          try {
            const stored = JSON.parse(pending);
            if (isTrip(stored.trip)) pendingTrip = stored.trip;
            if (
              active &&
              Number.isInteger(stored.step) &&
              stored.step >= 0 &&
              stored.step <= 5
            )
              setCreationStep(stored.step);
            if (
              active &&
              (stored.view === "setup" || stored.view === "itinerary")
            )
              setView(stored.view);
            if (active && typeof stored.selected === "string")
              setSelected(stored.selected);
            if (active && Number.isSafeInteger(stored.day) && stored.day > 0)
              setDay(stored.day);
            if (stored.account && active) setAccount(stored.account);
          } catch {
            /* Older pending marker denotes a new trip. */
          }
          try {
            const local = pendingTrip ?? (await mockTripAdapter.load());
            if (active && local) {
              setTrip(local);
              setDirty(true);
              setLoadGeneration((n) => n + 1);
              setNotice("");
            }
          } catch {
            if (active)
              setNotice(
                "Could not restore your browser draft. Your existing browser save has been kept.",
              );
          }
          sessionStorage.removeItem("elsewhere.pending-account-save");
        }
        if (!id && !pending) {
          try {
            const local = await guestTripAdapter.load();
            if (active && local) {
              setTrip(local);
              setLoadGeneration((n) => n + 1);
            }
          } catch {
            if (active)
              setNotice(
                "Your device copy could not be opened. You can still start a new trip.",
              );
          }
        }
        if (authConfigured) {
          try {
            const { data } = await authClient().auth.getUser();
            if (active) setSignedIn(!!data.user);
          } catch {
            if (active) setSignedIn(false);
          }
        }
        if (id && !pending) {
          if (active) setAccountLoading(true);
          try {
            const saved = await accountTripAdapter.load(id);
            if (active) {
              setTrip(saved.trip);
              setAccount(saved);
              setDirty(false);
              setLoadGeneration((n) => n + 1);
              setNotice("");
            }
          } catch (error) {
            if (active)
              setNotice(
                error instanceof Error
                  ? error.message
                  : "Could not open the account trip.",
              );
          } finally {
            if (active) setAccountLoading(false);
          }
        }
      } finally {
        if (active) setReady(true);
      }
    }
    void restore().catch(() => {
      if (active)
        setNotice(
          "Account connection is unavailable. Your browser draft is kept.",
        );
    });
    return () => {
      active = false;
    };
  }, [initialView]);
  const autosave = useTripAutosave({
    trip,
    dirty,
    ready: ready && initialView === "setup",
    signedIn,
    generation: loadGeneration,
    account,
    onSaved: (snapshot, reference, synced) => {
      if (reference) {
        setAccount(reference);
        window.history.replaceState(
          null,
          "",
          tripUrl(reference.id, { view, stop: selected, day }),
        );
      }
      if (
        (!signedIn || synced) &&
        JSON.stringify(snapshot) === JSON.stringify(trip)
      )
        setDirty(false);
    },
  });
  useEffect(() => {
    if (initialView !== "setup" || !ready || accountLoading) return;
    const current = trip.stops.find((s) => s.id === selected) ?? trip.stops[0];
    if (view === "itinerary" && current) {
      if (selected !== current.id) setSelected(current.id);
      if (day > current.nights + 1 || day < 1)
        setDay(Math.max(1, Math.min(current.nights + 1, day)));
    }
    window.history.replaceState(
      null,
      "",
      tripUrl(account?.id ?? null, { view, stop: current?.id ?? "", day }),
    );
  }, [
    view,
    selected,
    day,
    ready,
    accountLoading,
    account?.id,
    trip.stops,
    initialView,
  ]);
  async function signIn() {
    try {
      await mockTripAdapter.save(trip);
      sessionStorage.setItem(
        "elsewhere.pending-account-save",
        JSON.stringify({
          account,
          trip,
          step: creationStep,
          view,
          selected,
          day,
        }),
      );
      allowLeave.current = true;
      window.location.assign(
        `/sign-in?next=${encodeURIComponent(account ? `/trips/new?trip=${account.id}` : "/trips/new")}`,
      );
    } catch {
      setNotice(
        "Could not keep a device copy. Keep this page open and try again.",
      );
    }
  }
  async function newTrip() {
    try {
      await autosave.flush();
    } catch {
      setNotice(
        "Your current trip hasn’t synced. Resolve the saving error before starting another.",
      );
      return;
    }
    setRemovedActivity(null);
    setLibraryOpen(false);
    setAccount(null);
    setTrip(structuredClone(emptyTrip));
    setCreationStep(0);
    setDirty(false);
    setLoadGeneration((n) => n + 1);
    setView("setup");
    setNotice("");
    window.history.replaceState(null, "", "/trips/new");
  }
  async function signOut() {
    try {
      await autosave.flush();
      const { error } = await authClient().auth.signOut();
      if (error) throw error;
      setSignedIn(false);
      setAccount(null);
      setAccountRows(null);
      setLoadGeneration((n) => n + 1);
      window.history.replaceState(null, "", "/trips/new");
      setNotice(
        "Signed out. A device copy remains here; clear it on shared devices.",
      );
    } catch {
      setNotice(
        "Could not sign out safely. Your current edits are still here.",
      );
    }
  }
  async function listAccount(more = false) {
    setLibraryOpen(true);
    setLibraryError("");
    if (!more) setAccountRows(null);
    setBusy(true);
    try {
      if (!autosave.conflict) await autosave.flush();
      const page = await accountTripAdapter.list(
        more ? (accountCursor ?? undefined) : undefined,
      );
      setAccountRows((previous) =>
        more ? [...(previous ?? []), ...page.rows] : page.rows,
      );
      setAccountCursor(page.nextCursor);
    } catch (error) {
      setLibraryError(
        error instanceof SignInRequired
          ? "Sign in to see trips saved to your account."
          : error instanceof Error
            ? error.message
            : "Your trips could not be opened. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function openAccount(id: string) {
    try {
      if (autosave.conflict) {
        if (
          !window.confirm(
            "Open the saved version? Your unsynced edits are kept in the device copy.",
          )
        )
          return;
      } else await autosave.flush();
    } catch {
      setLibraryError(
        "Your current trip hasn’t synced yet. Resolve the saving error before opening another.",
      );
      return;
    }
    setAccountLoading(true);
    try {
      const saved = await accountTripAdapter.load(id);
      setRemovedActivity(null);
      setTrip(saved.trip);
      setAccount(saved);
      setLoadGeneration((n) => n + 1);
      setView(saved.trip.activities.length ? "itinerary" : "setup");
      setSelected(saved.trip.stops[0]?.id ?? "");
      setDay(1);
      setDirty(false);
      setAccountRows(null);
      window.history.replaceState(null, "", `/trips/new?trip=${id}`);
      setCreationStep(0);
      setLibraryOpen(false);
      setNotice("");
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Could not open this trip.",
      );
    } finally {
      setAccountLoading(false);
    }
  }
  const nights = trip.stops.reduce((n, s) => n + s.nights, 0);
  function update(patch: Partial<Trip>) {
    setTrip((t) => ({ ...t, ...patch }));
    setDirty(true);
    setNotice("");
  }
  function reorder(index: number, delta: number) {
    const stops = [...trip.stops];
    [stops[index], stops[index + delta]] = [stops[index + delta], stops[index]];
    update({ stops });
    setNotice(
      "Route reordered. Activities remain with their destinations. Stays and connecting transport need review; none are connected in this mock.",
    );
  }
  async function save() {
    setBusy(true);
    try {
      await adapter.save(trip);
      setDirty(false);
      setNotice(
        "Draft saved in this browser only. The accepted plan is unchanged.",
      );
    } catch {
      setNotice(
        "Save failed. Check numeric fields, or browser storage may be unavailable or full. Your edits remain on screen.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function load() {
    setBusy(true);
    try {
      const saved = await (
        initialView === "setup" && !signedIn ? guestTripAdapter : adapter
      ).load();
      if (saved) {
        try {
          await autosave.flush();
        } catch {
          setNotice("Resolve the sync error before opening a device copy.");
          return;
        }
        setTrip(saved);
        setAccount(null);
        window.history.replaceState(null, "", "/trips/new");
        setLoadGeneration((n) => n + 1);
        setView("setup");
        setDirty(false);
        setSelected(saved.stops[0]?.id ?? "");
        setDay(1);
        setNotice("");
      } else setNotice("No saved draft in this browser yet.");
    } catch {
      setNotice(
        "Could not read the saved draft. Your current edits remain on screen.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main
      className={`trip-app ${view === "setup" ? "trip-unfolding" : ""} ${view === "setup" && creationStep > 0 ? "trip-progressed" : ""}`}
    >
      <header className="trip-header trip-quiet-header">
        <Link href="/" className="trip-wordmark">
          elsewhere<span> / your journey</span>
        </Link>
        {initialView === "setup" ? (
          <div className="trip-header-actions">
            <span className="trip-save-state" role="status" aria-live="polite">
              {!ready ? "Opening your trip…" : autosave.status}
            </span>
            <button
              className="trip-library-trigger"
              onClick={() => void listAccount()}
              disabled={!ready}
            >
              My trips
            </button>
            <details
              className="trip-account-menu"
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.currentTarget.open = false;
                  e.currentTarget.querySelector("summary")?.focus();
                }
              }}
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget))
                  e.currentTarget.open = false;
              }}
              onClick={(e) => {
                if ((e.target as HTMLElement).closest("button"))
                  e.currentTarget.open = false;
              }}
            >
              <summary aria-label="Account options">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="8" r="3.5" />
                  <path d="M5 21v-2a7 7 0 0 1 14 0v2" />
                </svg>
              </summary>
              <div>
                <p>{signedIn ? "Your account" : "Keep your plans"}</p>
                {signedIn ? (
                  <>
                    <button
                      onClick={() => void newTrip()}
                      disabled={autosave.saving}
                    >
                      New trip
                    </button>
                    <button
                      onClick={() => void signOut()}
                      disabled={autosave.saving}
                    >
                      Sign out
                    </button>
                  </>
                ) : (
                  <button onClick={() => void signIn()}>Sign in to sync</button>
                )}
                <button onClick={() => void load()} disabled={autosave.saving}>
                  Open device copy
                </button>
              </div>
            </details>
          </div>
        ) : (
          <>
            <span className="trip-demo">Editable sample</span>
            <button onClick={save} disabled={busy}>
              Save sample
            </button>
          </>
        )}
      </header>
      <TripLibrary
        open={libraryOpen}
        loading={busy || accountLoading}
        error={libraryError}
        rows={accountRows}
        hasMore={!!accountCursor}
        onClose={() => setLibraryOpen(false)}
        onOpen={(id) => void openAccount(id)}
        onMore={() => void listAccount(true)}
        onNew={() => void newTrip()}
        onRetry={() => void listAccount()}
      />
      <div
        className="trip-shell"
        inert={
          (initialView === "setup" && !ready) || accountLoading || undefined
        }
      >
        {autosave.error && (
          <div className="trip-sync-error" role="alert">
            <p>{autosave.error}</p>
            {autosave.conflict ? (
              <button onClick={() => void listAccount()}>
                Open saved version
              </button>
            ) : (
              <button onClick={autosave.retry}>Retry sync</button>
            )}
            {(!signedIn || autosave.needsSignIn) && (
              <button onClick={() => void signIn()}>Sign in</button>
            )}
          </div>
        )}
        {view === "setup" && (
          <div className="trip-heading">
            <div>
              <p className="trip-kicker">A few places. One journey.</p>
              <h1>
                {view === "setup"
                  ? "Let’s make room for elsewhere."
                  : trip.title || "Your untitled journey"}
              </h1>
              <p>
                {view === "setup"
                  ? "A few choices. A journey of your own."
                  : `${trip.stops.length} destinations · ${nights} nights planned · ${trip.mode === "duration" ? "Dates open" : trip.mode === "window" ? "Tentative window" : "Exact dates"}`}
              </p>
            </div>
          </div>
        )}
        {removedActivity && (
          <div className="day-undo" role="status">
            Removed {removedActivity.title}.{" "}
            <button
              onClick={() => {
                if (trip.stops.some((s) => s.id === removedActivity.stopId)) {
                  update({ activities: [...trip.activities, removedActivity] });
                  setRemovedActivity(null);
                }
              }}
            >
              Undo
            </button>
            <button
              aria-label="Dismiss undo"
              onClick={() => setRemovedActivity(null)}
            >
              ×
            </button>
          </div>
        )}
        {notice && (
          <div className="trip-status" role="status">
            {notice}
          </div>
        )}
        {view === "itinerary" && (
          <nav className="trip-tabs" aria-label="Trip workspace">
            <button
              onClick={() => {
                setCreationStep(5);
                setLoadGeneration((n) => n + 1);
                setView("setup");
              }}
            >
              Trip outline
            </button>
            <button
              aria-current="page"
              onClick={() => {
                setView("itinerary");
                setChatOpen(false);
              }}
            >
              Plan your days
            </button>
            {account &&
              process.env.NEXT_PUBLIC_PLANNING_AI_ENABLED === "true" && (
                <button
                  aria-pressed={chatOpen}
                  onClick={() => setChatOpen((open) => !open)}
                >
                  Chat with Elsewhere
                </button>
              )}
            {initialView === "setup" && (
              <button
                disabled={
                  !account || dirty || autosave.saving || !!autosave.error
                }
                onClick={() => {
                  setGeneratedProposalId(undefined);
                  setReviewOpen(true);
                }}
              >
                Review plan
              </button>
            )}
          </nav>
        )}
        {view === "setup" ? (
          <TripCreation
            key={loadGeneration}
            trip={trip}
            accountSavingAvailable={initialView === "setup"}
            initialStep={creationStep}
            onStepChange={setCreationStep}
            update={update}
            reorder={reorder}
            remove={setRemoving}
            onOpen={() => {
              setSelected(trip.stops[0]?.id ?? "");
              setDay(1);
              setView("itinerary");
            }}
          />
        ) : (
          <div
            className={`trip-conversation-layout ${chatOpen ? "chat-open" : ""}`}
          >
            <div className="trip-plan-surface">
              <ItineraryWorkspace
                trip={trip}
                selected={selected}
                day={day}
                onSelect={setSelected}
                onDay={setDay}
                onEdit={setEditing}
                onAdd={setEditing}
                planningMode={
                  process.env.NEXT_PUBLIC_PLANNING_AI_ENABLED === "true"
                    ? "groq"
                    : "fixture"
                }
                onGenerate={
                  (process.env.NEXT_PUBLIC_PLANNING_AI_ENABLED === "true" ||
                    process.env.NEXT_PUBLIC_PLANNING_FIXTURES_ENABLED ===
                      "true") &&
                  account &&
                  !dirty &&
                  !autosave.saving &&
                  !autosave.error
                    ? () => setPlanningOpen(true)
                    : undefined
                }
                onUpdate={update}
                onSetup={(step = 5) => {
                  setCreationStep(step);
                  setLoadGeneration((n) => n + 1);
                  setView("setup");
                }}
              />
            </div>
            {chatOpen && account && (
              <TripChat
                key={account.id}
                account={account}
                stopId={selected}
                day={day}
                place={
                  trip.stops.find((s) => s.id === selected)?.name ??
                  "Selected destination"
                }
                canSend={!dirty && !autosave.saving && !autosave.error}
                onClose={() => setChatOpen(false)}
                onReview={(id) => {
                  setGeneratedProposalId(id);
                  setReviewOpen(true);
                }}
              />
            )}
          </div>
        )}
        {removing && (
          <div className="trip-overlay">
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="remove-title"
              className="trip-dialog"
            >
              <h2 id="remove-title">Remove this destination?</h2>
              <p>
                This also removes its{" "}
                {trip.activities.filter((a) => a.stopId === removing).length}{" "}
                activities from this draft, including any fixed or completed
                items. No supplier booking is cancelled.
              </p>
              <button autoFocus onClick={() => setRemoving(null)}>
                Keep destination
              </button>
              <button
                className="trip-danger"
                onClick={() => {
                  update({
                    stops: trip.stops.filter((s) => s.id !== removing),
                    activities: trip.activities.filter(
                      (a) => a.stopId !== removing,
                    ),
                  });
                  setRemoving(null);
                  setDay(1);
                }}
              >
                Remove destination and activities
              </button>
            </section>
          </div>
        )}
        {planningOpen && account && (
          <DayPlanning
            engine={
              process.env.NEXT_PUBLIC_PLANNING_AI_ENABLED === "true"
                ? "groq"
                : "fixture"
            }
            account={account}
            stopId={selected}
            day={day}
            place={
              trip.stops.find((s) => s.id === selected)?.name ??
              "Selected destination"
            }
            onClose={() => setPlanningOpen(false)}
            onReview={(id) => {
              setPlanningOpen(false);
              setGeneratedProposalId(id);
              setReviewOpen(true);
            }}
          />
        )}
        {reviewOpen && account && (
          <ProposalReview
            account={account}
            proposalId={generatedProposalId}
            onClose={() => setReviewOpen(false)}
            onAccepted={async () => {
              const saved = await accountTripAdapter.load(account.id);
              setAccount(saved);
              setTrip(saved.trip);
              setDirty(false);
              setLoadGeneration((n) => n + 1);
              setReviewOpen(false);
              setNotice(
                "Provisional plan accepted. You can keep editing your draft; later edits do not change the accepted snapshot.",
              );
            }}
          />
        )}
        {editing && (
          <ActivityEditor
            key={editing.id}
            initial={editing}
            trip={trip}
            onClose={() => setEditing(null)}
            onSave={(activity) => {
              update({
                activities: [
                  ...trip.activities.filter((a) => a.id !== activity.id),
                  activity,
                ],
              });
              setSelected(activity.stopId);
              setDay(activity.day);
              setEditing(null);
            }}
            onRemove={() => {
              if (
                (editing.fixed || editing.completed || editing.booked) &&
                !window.confirm(
                  "Remove this protected or completed item? This changes your plan only and does not cancel a reservation.",
                )
              )
                return;
              setRemovedActivity({ ...editing });
              update({
                activities: trip.activities.filter((a) => a.id !== editing.id),
              });
              setEditing(null);
            }}
          />
        )}
      </div>
    </main>
  );
}
