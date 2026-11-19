"use client";
import { delayEditTarget, type DelayReturn } from "../../lib/trips/delay-handoff";
import { proposalAdapter, type Proposal } from "../../lib/trips/proposals";
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
import PendingReviews from "./PendingReviews";
import PlanHistory from "./PlanHistory";
import DayPlanning from "./DayPlanning";
import { recoveryStorageKey, storeRecovery, recoverRecovery, bindRecoveryReview, discardRecoveryReview, sameRecoveryAttempt } from "../../lib/trips/recovery-storage";
import { reviewSubmitRetryKey } from "../../lib/trips/review-submit-retry";
import { acceptedRecoveryReturn, readinessEditTarget, type ReadinessReturn } from "../../lib/trips/readiness-edit";
import type { ReadinessContext, ReadinessReport } from "../../lib/trips/replanning";
import { canOpenRemaining } from "../../lib/trips/remaining-handoff";
import { weatherHandoffSeed, type WeatherSeed } from "../../lib/trips/weather-handoff";
import TripChat from "./TripChat";
import MovedPlaceRepairs from "./MovedPlaceRepairs";
import { movedPlaceTarget, movedPlaceStorageKey, advanceMovedPlaceRepairs, reconcileMovedPlaceRepairs, restoreMovedPlaceRepair, storeMovedPlaceRepair, type MovedPlaceRepair } from "../../lib/trips/moved-place-repair";
import TripLifecycle from "./TripLifecycle";
import { type RecoveryChoice } from "../../lib/trips/activity-recovery";
import { tripCapabilities } from "../../lib/trips/lifecycle";
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
    lifecycle?: string;
  currentVersionId?: string | null;
    tripEtag: string;
    versionEtag: string;
  } | null>(null);
  const [accountRows, setAccountRows] = useState<
    { id: string; title: string }[] | null
  >(null);
  const [accountCursor, setAccountCursor] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const recoveryOwner=useRef<string|null>(null);
  const [accountLoading, setAccountLoading] = useState(false);
  const requestedAccountId=useRef<string|null>(null);
  const [selected, setSelected] = useState("jaipur");
  const [day, setDay] = useState(1);
  const [notice, setNotice] = useState("");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mapRepair,setMapRepair]=useState<MovedPlaceRepair|null>(null);
  const [editing, setEditing] = useState<Activity | null>(null);
  const [editMapFirst, setEditMapFirst] = useState(false);
  const [editStatusFirst,setEditStatusFirst]=useState(false);
  const [recoveryChoice,setRecoveryChoice]=useState<RecoveryChoice>();
  const [readinessReturn,setReadinessReturn]=useState<ReadinessReturn|null>(null);
  const [recoveryStatusBusy,setRecoveryStatusBusy]=useState(false);
  const recoveryAttempt=useRef(0);
  const [delayReturn, setDelayReturn] = useState<DelayReturn | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [remainingRequest,setRemainingRequest]=useState<{key:string;tripId:string;baseEtag:string;stopId:string;day:number}|null>(null);
  const [weatherSeed,setWeatherSeed]=useState<(WeatherSeed & {tripId:string;baseEtag:string})|null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [planningOpen, setPlanningOpen] = useState(false);
  const [generatedProposalId, setGeneratedProposalId] = useState<
    string | undefined
  >();
  const [reviewOpen, setReviewOpen] = useState(false);
  const [pendingOpen,setPendingOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
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
        requestedAccountId.current=id;
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
            if (active) {setSignedIn(!!data.user);recoveryOwner.current=data.user?.id??null;}
          } catch {
            if (active) setSignedIn(false);
          }
        }
        if (id && !pending) {
          if (active) setAccountLoading(true);
          try {
            let saved = await accountTripAdapter.load(id);
            const owner=recoveryOwner.current;
            let reminder:ReadinessReturn|null=null;
            if(owner){try{reminder=await recoverRecovery(sessionStorage.getItem(recoveryStorageKey),owner,saved.trip,saved,proposalId=>proposalAdapter.get(saved.id,proposalId,AbortSignal.timeout(10000)),Date.now(),async()=>{saved=await accountTripAdapter.load(id);return {account:saved,trip:saved.trip};});}catch{}}
            if (active) {
              setTrip(saved.trip);
              setReadinessReturn(recoveryOwner.current===owner?reminder:null);
              try { setMapRepair(owner&&recoveryOwner.current===owner?restoreMovedPlaceRepair(sessionStorage.getItem(movedPlaceStorageKey),owner,saved.trip,saved.id):null); } catch { setMapRepair(null); }
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
      ) {
        setDirty(false);
        if (synced && reference) {
          if(mapRepair?.tripId===reference.id&&recoveryOwner.current){
            const repair=reconcileMovedPlaceRepairs(snapshot,reference.id,mapRepair);
            setMapRepair(repair);
            try{if(repair)sessionStorage.setItem(movedPlaceStorageKey,storeMovedPlaceRepair(repair,recoveryOwner.current));else sessionStorage.removeItem(movedPlaceStorageKey);}catch{}
          }
          setReadinessReturn(current => current?.edited && current.tripId === reference.id && !current.boundEtag
            ? { ...current, boundEtag: reference.versionEtag } : current);
        }
      }
    },
  });
  useEffect(() => {
    if (initialView !== "setup" || !ready || accountLoading || (!account&&requestedAccountId.current)) return;
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
  useEffect(()=>{
    if(!ready||accountLoading||!signedIn||!account||dirty||autosave.saving||autosave.error||!recoveryOwner.current)return;
    try {
      const value=readinessReturn?storeRecovery(readinessReturn,recoveryOwner.current,account):null;
      if(value)sessionStorage.setItem(recoveryStorageKey,value);else sessionStorage.removeItem(recoveryStorageKey);
      if(readinessReturn?.boundEtag&&readinessReturn.boundEtag!==account.versionEtag)setReadinessReturn(null);
    } catch { /* Storage is optional; keep the in-memory return path. */ }
  },[ready,accountLoading,signedIn,account,dirty,autosave.saving,autosave.error,readinessReturn]);
  useEffect(()=>{
    if(!authConfigured)return;
    const {data}=authClient().auth.onAuthStateChange((event,session)=>{
      if(event==="SIGNED_OUT"||(recoveryOwner.current&&session?.user.id&&recoveryOwner.current!==session.user.id)){
        requestedAccountId.current=null;
        setMapRepair(null);
        recoveryOwner.current=null;setReadinessReturn(null);
        try{sessionStorage.removeItem(recoveryStorageKey);sessionStorage.removeItem(movedPlaceStorageKey);sessionStorage.removeItem(reviewSubmitRetryKey);}catch{}
      }
    });
    return ()=>data.subscription.unsubscribe();
  },[]);
  const recoveryLatest=useRef({owner:recoveryOwner.current,account,marker:readinessReturn,dirty,editing:!!editing,saving:autosave.saving});
  recoveryLatest.current={owner:recoveryOwner.current,account,marker:readinessReturn,dirty,editing:!!editing,saving:autosave.saving};
  useEffect(()=>()=>{recoveryAttempt.current++;},[]);
  async function refreshRecoveryStatus(){
    const owner=recoveryOwner.current,marker=readinessReturn;
    if(!owner||!account||!marker?.proposalId||dirty||editing||autosave.saving||autosave.error||recoveryStatusBusy)return;
    const start={owner,tripId:account.id,tripEtag:account.tripEtag,draftEtag:account.versionEtag,marker};
    const attempt=++recoveryAttempt.current;
    setRecoveryStatusBusy(true);
    try {
      const raw=storeRecovery(marker,owner,account);
      let saved=await accountTripAdapter.load(account.id,AbortSignal.timeout(10000));
      const next=await recoverRecovery(raw,owner,saved.trip,saved,id=>proposalAdapter.get(saved.id,id,AbortSignal.timeout(10000)),Date.now(),async()=>{saved=await accountTripAdapter.load(start.tripId,AbortSignal.timeout(10000));return {account:saved,trip:saved.trip};});
      if(attempt!==recoveryAttempt.current||!sameRecoveryAttempt(start,{...recoveryLatest.current,owner:recoveryOwner.current}))return;
      setAccount(saved);setTrip(saved.trip);setReadinessReturn(next);setLoadGeneration(n=>n+1);
      if(!next)setNotice("This review no longer matches the saved plan. Your plan is available; open plan history or begin a fresh day check.");
    } catch {
      if(attempt===recoveryAttempt.current&&sameRecoveryAttempt(start,{...recoveryLatest.current,owner:recoveryOwner.current}))setReadinessReturn({...marker,receiptUnavailable:true});
    } finally {if(attempt===recoveryAttempt.current)setRecoveryStatusBusy(false);}
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
    requestedAccountId.current=null;
    setMapRepair(null);
    setReadinessReturn(null);
    try{sessionStorage.removeItem(recoveryStorageKey);sessionStorage.removeItem(movedPlaceStorageKey);sessionStorage.removeItem(reviewSubmitRetryKey);}catch{}
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
      recoveryOwner.current=null;setReadinessReturn(null);
      try{sessionStorage.removeItem(recoveryStorageKey);sessionStorage.removeItem(movedPlaceStorageKey);sessionStorage.removeItem(reviewSubmitRetryKey);}catch{}
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
      let saved = await accountTripAdapter.load(id);
      const owner=recoveryOwner.current;
      let reminder:ReadinessReturn|null=null;
      if(owner){try{reminder=await recoverRecovery(sessionStorage.getItem(recoveryStorageKey),owner,saved.trip,saved,proposalId=>proposalAdapter.get(saved.id,proposalId,AbortSignal.timeout(10000)),Date.now(),async()=>{saved=await accountTripAdapter.load(id);return {account:saved,trip:saved.trip};});}catch{}}
      setReadinessReturn(recoveryOwner.current===owner?reminder:null);
      try { setMapRepair(owner&&recoveryOwner.current===owner?restoreMovedPlaceRepair(sessionStorage.getItem(movedPlaceStorageKey),owner,saved.trip,saved.id):null); } catch { setMapRepair(null); }
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
  function editReadinessActivity(context:ReadinessContext,report:ReadinessReport,activityId:string,choice?:RecoveryChoice){
    if(!account||dirty||autosave.saving||autosave.error||editing)return false;
    const activity=readinessEditTarget(trip,account,context,report,activityId,selected,day);
    if(!activity)return false;
    setReadinessReturn({tripId:account.id,stopId:selected,day,activityId});
    setRecoveryChoice(choice);setEditMapFirst(false);setEditStatusFirst(true);setEditing(activity);return true;
  }
  function editDelayActivity(proposal: Proposal, activityId: string) {
    if (!account || dirty || autosave.saving || autosave.error) return false;
    const target = delayEditTarget(trip, proposal, activityId);
    if (!target) return false;
    setDelayReturn({tripId: account.id, reviewId: proposal.id, editedActivityId: activityId, seed: target.seed});
    setReviewOpen(false); setPendingOpen(false); setHistoryOpen(false);
    setView("itinerary"); setSelected(target.activity.stopId); setDay(target.activity.day);
    setEditStatusFirst(false);setEditMapFirst(true); setEditing(target.activity);
    return true;
  }
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
        {view === "itinerary" && account && <TripLifecycle key={account.id} account={account} disabled={recoveryStatusBusy||dirty||autosave.saving||!!autosave.error||!!editing||planningOpen||reviewOpen||pendingOpen||historyOpen} onChanged={metadata=>{setAccount(current=>current?.id===metadata.id?{...current,...metadata}:current);setLoadGeneration(n=>n+1);setRemainingRequest(null);setWeatherSeed(null);setDelayReturn(null);setReadinessReturn(null);}} />}
        {mapRepair&&account?.id===mapRepair.tripId&&<MovedPlaceRepairs trip={trip} accountId={account.id} repair={mapRepair} busy={dirty||autosave.saving||!!autosave.error} editing={!!editing} onDismiss={()=>{setMapRepair(null);try{sessionStorage.removeItem(movedPlaceStorageKey);}catch{}}} onChoose={id=>{
          if(dirty||autosave.saving||autosave.error||editing)return;
          const activity=movedPlaceTarget(trip,account.id,mapRepair,id);
          if(!activity){setNotice("This activity has changed. Review its current day in the planner.");return;}
          setSelected(activity.stopId);setDay(activity.day);setView("itinerary");setEditStatusFirst(false);setEditMapFirst(true);setEditing(activity);
        }}/>}
        {view === "itinerary" && account?.lifecycle === "completed" && <section className="trip-outcome-recap" aria-label="Activity outcome recap"><h2>Your trip, as recorded</h2><p>Based on your editable draft. Changes to the draft may differ from your accepted plan.</p><ul><li>{trip.activities.filter(a=>a.completed).length} completed</li><li>{trip.activities.filter(a=>a.skipped).length} didn’t happen</li><li>{trip.activities.filter(a=>!a.completed&&!a.skipped).length} still planned</li></ul><p>These are the outcomes you recorded. Finishing a trip does not mark activities done or cancel reservations.</p></section>}
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
                  setPendingOpen(true);
                }}
              >
                Review plan
              </button>
            )}
            {account && <button disabled={dirty || autosave.saving || !!autosave.error} onClick={() => setHistoryOpen(true)}>Plan history</button>}
          </nav>
        )}
        {view === "setup" ? (
          <TripCreation
            key={loadGeneration}
            trip={trip}
            accountSavingAvailable={initialView === "setup"}
            costAccount={account&&!dirty&&!autosave.saving&&!autosave.error?account:undefined}
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
                onRebalanced={result=>{if(account){const repair=advanceMovedPlaceRepairs(account.id,mapRepair,result);setMapRepair(repair);try{if(repair&&recoveryOwner.current)sessionStorage.setItem(movedPlaceStorageKey,storeMovedPlaceRepair(repair,recoveryOwner.current));else sessionStorage.removeItem(movedPlaceStorageKey);}catch{}}}}
                onReadinessEdit={editReadinessActivity}
                readinessReturn={readinessReturn?.tripId===account?.id&&readinessReturn?.stopId===selected&&readinessReturn?.day===day?readinessReturn:undefined}
                onDismissReadinessReturn={()=>setReadinessReturn(null)}
                recoveryStatusBusy={recoveryStatusBusy}
                onRefreshReviewStatus={()=>void refreshRecoveryStatus()}
                onReviewCorrections={()=>{if(!account||dirty||autosave.saving||autosave.error)return;setReadinessReturn(current=>current?{...current,reviewEtag:account.versionEtag}:null);setGeneratedProposalId(readinessReturn?.proposalId);setReviewOpen(true);}}
                readinessRequest={remainingRequest?.tripId===account?.id&&remainingRequest?.baseEtag===account?.versionEtag&&remainingRequest?.stopId===selected&&remainingRequest?.day===day?remainingRequest:undefined}
                onReadinessRequestHandled={()=>setRemainingRequest(null)}
                weatherSeed={weatherSeed?.tripId===account?.id&&weatherSeed?.baseEtag===account?.versionEtag&&weatherSeed?.stopId===selected&&weatherSeed?.day===day?weatherSeed:undefined}
                lifecycle={account?.lifecycle}
                trip={trip}
                selected={selected}
                day={day}
                onSelect={id=>{setRemainingRequest(null);setWeatherSeed(null);setSelected(id);}}
                onDay={value=>{setRemainingRequest(null);setWeatherSeed(null);setDay(value);}}
                timeChangeReview={account && tripCapabilities(account.lifecycle).remaining && !dirty && !autosave.saving && !autosave.error ? {account, onEditActivity: editDelayActivity, onAccepted: async (message?:string) => {const saved = await accountTripAdapter.load(account.id);setAccount(saved);setTrip(saved.trip);setDirty(false);setLoadGeneration(n=>n+1);setDelayReturn(null);setNotice(message ?? "Time change accepted. Recheck hours and onward travel for the updated day.");}} : undefined}
                delayReturn={delayReturn?.tripId === account?.id ? delayReturn : null}
                onDismissDelayReturn={() => setDelayReturn(null)}
                editorOpen={!!editing}
                onEdit={activity => {setEditStatusFirst(false);setEditMapFirst(false);setEditing(activity);}}
                onAdd={activity => {setEditStatusFirst(false);setEditMapFirst(false);setEditing(activity);}}
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
                  tripCapabilities(account.lifecycle).generate &&
                  !dirty &&
                  !autosave.saving &&
                  !autosave.error
                    ? () => setPlanningOpen(true)
                    : undefined
                }
                onUpdate={update}
                onSetup={(step = 5) => {
                  setWeatherSeed(null);
                  setCreationStep(step);
                  setLoadGeneration((n) => n + 1);
                  setView("setup");
                }}
              />
            </div>
            {chatOpen && account && (
              <TripChat
                key={account.id}
                lifecycle={account.lifecycle}
                account={account}
                stopId={selected}
                day={day}
                place={
                  trip.stops.find((s) => s.id === selected)?.name ??
                  "Selected destination"
                }
                exactDates={trip.mode==="exact"}
                canSend={!dirty && !autosave.saving && !autosave.error}
                canOpenRemainingRequest={turn=>!editing&&canOpenRemaining(trip,account,turn,selected,day)}
                onRemainingRequest={turn=>{if(dirty||autosave.saving||autosave.error||editing||!canOpenRemaining(trip,account,turn,selected,day)){setNotice("This request no longer matches your saved day. Finish saving, then ask again.");return;}setRemainingRequest({key:crypto.randomUUID(),tripId:account.id,baseEtag:account.versionEtag,stopId:selected,day});setView("itinerary");setChatOpen(false);}}
                canOpenWeatherRequest={turn=>!!weatherHandoffSeed(trip,account,turn,selected,day)}
                onWeatherRequest={turn=>{
                  const seed=!dirty&&!autosave.saving&&!autosave.error?weatherHandoffSeed(trip,account,turn,selected,day):undefined;
                  if(!seed){setNotice("This replacement request no longer matches your saved day. Ask again from the latest plan.");return;}
                  setWeatherSeed({...seed,key:crypto.randomUUID(),tripId:account.id,baseEtag:account.versionEtag});setChatOpen(false);
                }}
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
        {pendingOpen && account && <PendingReviews tripId={account.id} onClose={()=>setPendingOpen(false)} onDraft={()=>{setPendingOpen(false);setGeneratedProposalId(undefined);setReviewOpen(true);}} onReview={id=>{setPendingOpen(false);setGeneratedProposalId(id);setReviewOpen(true);}} />}
        {historyOpen && account && <PlanHistory account={account} onClose={() => setHistoryOpen(false)} onReview={id => { setHistoryOpen(false); setGeneratedProposalId(id); setReviewOpen(true); }} />}
        {reviewOpen && account && (
          <ProposalReview
            account={account}
            proposalId={generatedProposalId}
            onOpenPending={()=>{setReviewOpen(false);setPendingOpen(true);}}
            onProposalReady={proposal=>{
              const marker=bindRecoveryReview(readinessReturn,account,proposal);
              if(!marker)return;
              if(recoveryOwner.current){try{const raw=storeRecovery(marker,recoveryOwner.current,account);if(raw)sessionStorage.setItem(recoveryStorageKey,raw);}catch{}}
              setReadinessReturn(marker);
            }}
            onDiscarded={proposal=>setReadinessReturn(current=>discardRecoveryReview(current,proposal.id))}
            onEditActivity={editDelayActivity}
            onClose={() => setReviewOpen(false)}
            onAccepted={async (confirmation,acceptedProposal) => {
              const saved = await accountTripAdapter.load(account.id);
              setReadinessReturn(current=>acceptedRecoveryReturn(current,saved,acceptedProposal)??current);
              setAccount(saved);
              setTrip(saved.trip);
              setDirty(false);
              setLoadGeneration((n) => n + 1);
              setReviewOpen(false);
              setDelayReturn(null);
              setNotice(
                confirmation??"Provisional plan accepted. You can keep editing your draft; later edits do not change the accepted snapshot.",
              );
            }}
          />
        )}
        {editing && (
          <ActivityEditor
            key={editing.id}
            initial={editing}
            focusLocation={editMapFirst}
            focusStatus={editStatusFirst && (!recoveryChoice || recoveryChoice === "finished")}
            recoveryChoice={editStatusFirst ? recoveryChoice : undefined}
            trip={trip}
            onClose={() => setEditing(null)}
            onSave={(activity) => {
              update({
                activities: [
                  ...trip.activities.filter((a) => a.id !== activity.id),
                  activity,
                ],
              });
              const checkReturn=editStatusFirst&&readinessReturn?.tripId===account?.id&&readinessReturn?.activityId===activity.id?readinessReturn:null;
              if(checkReturn&&JSON.stringify(activity)!==JSON.stringify(editing))setReadinessReturn({...checkReturn,edited:true,boundEtag:undefined,proposalId:undefined,receiptUnavailable:undefined,reviewEtag:undefined,acceptedVersionId:undefined,acceptedDraftEtag:undefined});
              setSelected(checkReturn?.stopId??activity.stopId);
              setDay(checkReturn?.day??activity.day);
              setEditStatusFirst(false);
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
              if(editStatusFirst&&readinessReturn?.activityId===editing.id)setReadinessReturn({...readinessReturn,edited:true,boundEtag:undefined,proposalId:undefined,receiptUnavailable:undefined,reviewEtag:undefined,acceptedVersionId:undefined,acceptedDraftEtag:undefined});
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
