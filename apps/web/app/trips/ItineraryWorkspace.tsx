"use client";
import type { RebalanceSummary } from "../../lib/trips/stay-rebalance";
import StayRebalance from "./StayRebalance";
import { canResumeDelay, type DelaySeed, type DelayReturn } from "../../lib/trips/delay-handoff";
import type { WeatherSeed } from "../../lib/trips/weather-handoff";
import DayWeather from "./DayWeather";
import DayDelayReview from "./DayDelayReview";
import ReplanningReadiness from "./ReplanningReadiness";
import { recoveryIsAccepted, type ReadinessEditHandler, type ReadinessReturn } from "../../lib/trips/readiness-edit";
import type { TimeChangeAccount } from "./TimeChangeReview";
import JourneyCheck from "./JourneyCheck";
import ActivityDiscovery from "./ActivityDiscovery";
import PlaceAttribution from "./PlaceAttribution";
import { useEffect, useRef, useState } from "react";
import type { Activity, Trip } from "../../lib/trips/adapter";
import {
  routeSchedule,
  provisionalDate,
  displayDate,
  dayTimeline,
  dayConflicts,
  clock,
  clockMinutes,
  itineraryStats,
  visibleDayEntries,
  activityOutcomeLabel,
} from "../../lib/trips/itinerary";
import { planningCosts, planningProblems } from "../../lib/trips/planning";
const kindName = {
  custom: "Activity",
  meal: "Meal",
  rest: "Break",
  free_time: "Free time",
};
export default function ItineraryWorkspace({
  trip,
  onRebalanced,
  lifecycle,
  selected,
  day,
  onSelect,
  onDay,
  onEdit,
  onAdd,
  onGenerate,
  planningMode,
  onUpdate,
  onSetup,
  timeChangeReview,
  delayReturn,
  onDismissDelayReturn,
  editorOpen = false,
  weatherSeed,
  readinessRequest,
  onReadinessRequestHandled,
  onReadinessEdit,
  readinessReturn,
  onDismissReadinessReturn,
  onReviewCorrections,
  onRefreshReviewStatus,
  recoveryStatusBusy=false,
}: {
  onReadinessEdit?:ReadinessEditHandler;
  readinessReturn?:ReadinessReturn;
  onDismissReadinessReturn?:()=>void;
  onReviewCorrections?:()=>void;
  onRefreshReviewStatus?:()=>void;
  recoveryStatusBusy?:boolean;
  readinessRequest?:{key:string};
  onReadinessRequestHandled?:()=>void;
  weatherSeed?: WeatherSeed;
  timeChangeReview?: TimeChangeAccount;
  delayReturn?: DelayReturn | null;
  onDismissDelayReturn?: () => void;
  editorOpen?: boolean;
  lifecycle?: string;
  onRebalanced?:(result:RebalanceSummary)=>void;
  trip: Trip;
  selected: string;
  day: number;
  onSelect: (id: string) => void;
  onDay: (day: number) => void;
  onEdit: (activity: Activity) => void;
  onAdd: (activity: Activity) => void;
  onGenerate?: () => void;
  planningMode?: "fixture" | "groq";
  onUpdate: (patch: Partial<Trip>) => void;
  onSetup: (step?: number) => void;
}) {
  const [delayOpen,setDelayOpen]=useState(false);
  const [readinessOpen,setReadinessOpen]=useState(false);
  const [readinessBasis,setReadinessBasis]=useState<"accepted"|"draft">("accepted");
  const readinessReturnFocus=useRef<HTMLDivElement>(null);
  const reviewStatusTrigger=useRef<HTMLButtonElement>(null);
  const reviewStatusWasBusy=useRef(false);
  useEffect(()=>{
    if(reviewStatusWasBusy.current&&!recoveryStatusBusy&&document.activeElement===document.body) {
      (reviewStatusTrigger.current??readinessReturnFocus.current)?.focus({preventScroll:true});
    }
    reviewStatusWasBusy.current=recoveryStatusBusy;
  },[recoveryStatusBusy]);
  const [delaySeed,setDelaySeed]=useState<DelaySeed>();
  const returnFocus = useRef<HTMLDivElement>(null);
  const wasEditing = useRef(editorOpen);
  useEffect(() => { if(wasEditing.current && !editorOpen) (readinessReturn?readinessReturnFocus:returnFocus).current?.focus(); wasEditing.current=editorOpen; }, [editorOpen,readinessReturn]);
  const [overview, setOverview] = useState(false);
  const [showRecorded, setShowRecorded] = useState(true);
  const readinessTrigger=useRef<HTMLButtonElement>(null),readinessWasOpen=useRef(false);
  useEffect(()=>{if(readinessRequest&&timeChangeReview&&!editorOpen){setOverview(false);setReadinessBasis("accepted");setReadinessOpen(true);onReadinessRequestHandled?.();}},[readinessRequest,timeChangeReview,editorOpen,onReadinessRequestHandled]);
  useEffect(()=>{if(readinessWasOpen.current&&!readinessOpen)readinessTrigger.current?.focus();readinessWasOpen.current=readinessOpen;},[readinessOpen]);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);
  useEffect(() => {
    setOverview(false);
  }, [selected, day]);
  const schedule = routeSchedule(trip),
    current = schedule.find((s) => s.stop.id === selected) ?? schedule[0];
  const stats = itineraryStats(trip),
    costs = planningCosts(trip),
    problems = planningProblems(trip);
  if (!current)
    return (
      <section className="day-empty-route">
        <h2>A day needs a place.</h2>
        <p>
          Add your destinations, then make room for the things you want to do.
        </p>
        <button className="day-primary" onClick={() => onSetup(2)}>
          Choose your places
        </button>
      </section>
    );
  const localDay = Math.max(1, Math.min(current.days, day)),
    globalDay = current.arrivalDay + localDay - 1,
    date = provisionalDate(trip, globalDay);
  const activities = trip.activities.filter(
    (a) => a.stopId === current.stop.id && a.day === localDay,
  );
  const entries = dayTimeline(activities),
    conflicts = dayConflicts(trip, current.stop.id, localDay);
  const transfers = [
    ...(localDay === 1 && current.inbound
      ? [{ leg: current.inbound, label: "Arriving" }]
      : []),
    ...(localDay === current.days && current.outbound
      ? [{ leg: current.outbound, label: "Moving on" }]
      : []),
  ];
  function add(
    kind: Activity["kind"] = "custom",
    start = "09:00",
    minutes = kind === "rest" ? 30 : 60,
  ) {
    onAdd({
      id: crypto.randomUUID(),
      stopId: current.stop.id,
      day: localDay,
      title:
        kind === "rest" ? "Break" : kind === "free_time" ? "Free time" : "",
      kind,
      start,
      minutes,
      fixed: false,
      completed: false,
      booked: false,
    });
  }
  const compactDays =
    current.days <= 9
      ? Array.from({ length: current.days }, (_, i) => i + 1)
      : Array.from(
          new Set([
            1,
            ...Array.from({ length: 7 }, (_, i) => localDay - 3 + i).filter(
              (n) => n > 0 && n <= current!.days,
            ),
            current.days,
          ]),
        ).sort((a, b) => a - b);
  const firstGap = entries.find(
    (e) => e.type === "gap" && e.end - Math.max(e.start, 540) >= 60,
  );
  const nextStart =
    firstGap?.type === "gap" ? clock(Math.max(firstGap.start, 540)) : "09:00";
  return (
    <div className="day-workspace">
      <aside className="day-route">
        <div className="day-route-title">
          <p>Your route</p>
          <button onClick={() => onSetup(2)}>Edit</button>
        </div>
        <h2>{trip.title || "Your next elsewhere"}</h2>
        <nav aria-label="Trip destinations">
          {schedule.map((s, i) => (
            <button
              key={s.stop.id}
              aria-current={s.stop.id === current.stop.id ? "page" : undefined}
              onClick={() => {
                onSelect(s.stop.id);
                onDay(1);
                setOverview(false);
              }}
            >
              <span className="day-route-number">{i + 1}</span>
              <span>
                <strong>{s.stop.name}</strong>
                <small>
                  {s.stop.nights === 0
                    ? "Day visit"
                    : `${s.stop.nights} nights`}{" "}
                  · trip days {s.arrivalDay}
                  {s.departureDay !== s.arrivalDay ? `–${s.departureDay}` : ""}
                </small>
              </span>
            </button>
          ))}
        </nav>
        <button
          className="day-overview-button"
          aria-pressed={overview}
          onClick={() => setOverview((v) => !v)}
        >
          {overview ? "Back to this day" : "See the whole trip"}
        </button>
        {timeChangeReview && (
          <StayRebalance
            tripId={timeChangeReview.account.id}
            etag={timeChangeReview.account.versionEtag}
            currency={trip.currency}
            stops={trip.stops.map((s) => ({ id: s.id, name: s.name, nights: s.nights }))}
            onApplied={async(message,result)=>{await timeChangeReview.onAccepted(message);onRebalanced?.(result);}}
          />
        )}
        <div className="day-cost-note">
          <span>Your estimated stay & travel</span>
          <strong>
            {costs.known
              ? `${trip.currency} ${costs.total.toLocaleString()}`
              : "Estimates not entered"}
          </strong>
          {trip.budget!==""&&<span>{trip.budgetMode==="strict"?"Strict limit":"Budget target"}: {trip.currency} {Number(trip.budget).toLocaleString()}</span>}
          <small>Activities and local spending are extra.</small>
        </div>
      </aside>
      <section className="day-main">
        {overview ? (
          <>
            <header className="day-title">
              <p>Room for the whole journey</p>
              <h1>Your trip, day by day.</h1>
              <span>
                {stats.days ? `${stats.days} days` : "Dates open"} ·{" "}
                {activityOutcomeLabel(trip.activities)}
              </span>
            </header>
            <div className="day-overview">
              {schedule.map((s) => (
                <section key={s.stop.id}>
                  <div>
                    <h2>{s.stop.name}</h2>
                    <p>
                      Trip days {s.arrivalDay}–{s.departureDay} ·{" "}
                      {s.stop.nights} nights
                    </p>
                  </div>
                  <p>
                    {activityOutcomeLabel(trip.activities.filter((a) => a.stopId === s.stop.id))}
                  </p>
                  <button
                    onClick={() => {
                      onSelect(s.stop.id);
                      onDay(1);
                      setOverview(false);
                    }}
                  >
                    Open these days
                  </button>
                </section>
              ))}
              {stats.unallocated !== null && stats.unallocated > 0 && (
                <p className="day-open-note">
                  {stats.unallocated} nights are still open in your trip.{" "}
                  <button onClick={() => onSetup(3)}>Adjust your route</button>
                </p>
              )}
            </div>
          </>
        ) : (
          <>
            <header className="day-title">
              <p>{current.stop.name}</p>
              <h1>
                {date ? displayDate(date) : `Day ${globalDay}, your way.`}
              </h1>
              <span>
                Day {localDay} in this place · {current.stop.timezone}
              </span>
            </header>
            <div className="day-pagination">
              <button
                aria-label="Previous day"
                disabled={localDay === 1}
                onClick={() => onDay(localDay - 1)}
              >
                ←
              </button>
              <div role="group" aria-label="Days at this destination">
                {compactDays.map((d, i) => (
                  <span key={d}>
                    {i > 0 && d > compactDays[i - 1] + 1 && (
                      <span className="day-ellipsis" aria-hidden="true">
                        …
                      </span>
                    )}
                    <button
                      aria-label={`Day ${d} in ${current.stop.name}`}
                      aria-current={d === localDay ? "date" : undefined}
                      onClick={() => onDay(d)}
                    >
                      {d}
                    </button>
                  </span>
                ))}
              </div>
              <button
                aria-label="Next day"
                disabled={localDay === current.days}
                onClick={() => onDay(localDay + 1)}
              >
                →
              </button>
            </div>
            {current.days > 9 && (
              <label className="day-jump">
                Go to day
                <input
                  type="number"
                  min={1}
                  max={current.days}
                  value={localDay}
                  onChange={(e) =>
                    onDay(
                      Math.max(
                        1,
                        Math.min(current.days, Number(e.target.value) || 1),
                      ),
                    )
                  }
                />
                <span>of {current.days}</span>
              </label>
            )}
            {date && (
              <details className="day-date-note">
                <summary>Provisional plan date</summary>
                <p>
                  Based on your start date and allocated nights. Actual
                  departure times, time-zone changes and arrival dates still
                  need checking. Shared transfer days appear at both
                  destinations.
                </p>
              </details>
            )}
            {!!transfers.length && (
              <div className="day-transfers">
                {transfers.map(({ leg, label }) => {
                  const pref = trip.travelPreferences?.[leg.key];
                  return (
                    <section key={leg.key}>
                      <span aria-hidden="true">↗</span>
                      <div>
                        <small>{label}</small>
                        <h3>
                          {leg.from} → {leg.to}
                        </h3>
                        <p>
                          {pref?.mode || "Transport to decide"}
                          {pref?.hours ? ` · about ${pref.hours} hours` : ""}
                          {pref?.overnight
                            ? ` · ${pref.overnight} nights on the move`
                            : ""}
                        </p>
                        <p className="day-transfer-caveat">
                          Departure time and arrival buffer not set.
                        </p>
                      </div>
                      <button
                        aria-label={`Edit transfer from ${leg.from} to ${leg.to}`}
                        onClick={() => onSetup(4)}
                      >
                        Edit
                      </button>
                    </section>
                  );
                })}
              </div>
            )}
            {!!Object.keys(conflicts).length && (
              <div className="day-conflict-banner" role="status">
                <strong>Some timings overlap.</strong>
                <span>
                  Open a highlighted item to change its time or move it to
                  another day.
                </span>
              </div>
            )}
            <ActivityDiscovery key={`${current.stop.id}:${current.stop.location?.reference_id ?? "manual"}`} stop={current.stop} day={localDay} onChoose={onAdd} onLocate={place => onUpdate({ stops: trip.stops.map(stop => stop.id === current.stop.id ? { ...stop, name: place.label, timezone: place.timezone, location: place } : stop) })} />
            <div className="day-plan-heading">
              <div>
                <h2>
                  {activities.length
                    ? "A little shape to the day."
                    : "A day with room to breathe."}
                </h2>
                <p>
                  {activities.length
                    ? activityOutcomeLabel(activities)
                    : "Add your first activity, or leave the day open."}
                </p>
              </div>
              <button
                className="day-primary"
                onClick={() => add("custom", nextStart)}
              >
                ＋ Add activity
              </button>
            </div>
            {onGenerate && (
              <p className="day-test-planner">
                <button onClick={onGenerate}>
                  {planningMode === "groq"
                    ? "Plan this day with AI"
                    : "Try day planner (test)"}
                </button>
                <span>
                  {planningMode === "groq"
                    ? "AI proposals · mapped places, estimated timing"
                    : "Meal and break fixtures · no AI or live data"}
                </span>
              </p>
            )}
            {timeChangeReview && activities.some(a=>!a.completed) && <p className="day-test-planner"><button type="button" onClick={()=>{setDelaySeed(undefined);setDelayOpen(true);}}>Running late? Adjust the rest of this day</button><span>Review a user-reported delay before anything changes.</span></p>}
            {delayReturn && delayReturn.seed.stopId === current.stop.id && delayReturn.seed.day === localDay && <div className="delay-return" ref={returnFocus} tabIndex={-1} role="region" aria-label="Continue your delay adjustment"><strong>Your delay adjustment is still here.</strong><p>The original review stays pending. Prepare a fresh review after editing; nothing from it is applied automatically.</p>{!timeChangeReview ? <p>Waiting for account saving to finish. Resolve any save error above before continuing.</p> : !canResumeDelay(trip,delayReturn.seed) ? <p>The starting activity moved or is no longer available. Begin a new delay adjustment for this day.</p> : <p>Your starting activity and {delayReturn.seed.readyTime} ready time are kept. Confirm you can still be there before previewing.</p>}<button type="button" disabled={!timeChangeReview||editorOpen||!canResumeDelay(trip,delayReturn.seed)} onClick={()=>{setDelaySeed(delayReturn.seed);setDelayOpen(true);}}>Continue delay adjustment</button><button type="button" onClick={onDismissDelayReturn}>Dismiss return reminder</button></div>}
            {timeChangeReview && <p className={`day-test-planner ${lifecycle === "active" ? "day-current-start" : ""}`}><button ref={readinessTrigger} type="button" disabled={editorOpen} onClick={()=>{setReadinessBasis("accepted");setReadinessOpen(true);}}>Check a fresh start for today</button><span>Confirm your local time, location and remaining activities.</span></p>}
            {readinessReturn&&<div ref={readinessReturnFocus} tabIndex={-1} role="region" aria-label="Continue your readiness check" className="delay-return">
              <strong>{timeChangeReview&&recoveryIsAccepted(readinessReturn,timeChangeReview.account)?"Corrections accepted. Check your day afresh.":readinessReturn.edited?"Your corrections are in the draft":"Return to your day check"}</strong>
              <p>{timeChangeReview&&recoveryIsAccepted(readinessReturn,timeChangeReview.account)?"The accepted plan now includes this reviewed draft. Confirm your current time and location again; acceptance does not verify the rest of today.":readinessReturn.edited?"Saving a correction does not change your accepted plan. Review the whole saved draft before accepting it.":"Confirm your current time and location again before checking this day."}</p>
              {readinessReturn.receiptUnavailable&&<p>The saved review status could not be checked. Retry the status check or open plan history. No acceptance was retried.</p>}
              {!timeChangeReview&&<p>Waiting for your draft to finish saving. Resolve any saving error above before continuing.</p>}
              {readinessReturn.edited&&onReviewCorrections&&!(timeChangeReview&&recoveryIsAccepted(readinessReturn,timeChangeReview.account))&&<button type="button" disabled={editorOpen||!timeChangeReview||recoveryStatusBusy} onClick={onReviewCorrections}>{readinessReturn.proposalId?"Resume saved review":"Review saved corrections"}</button>}
              <button type="button" disabled={editorOpen||!timeChangeReview||recoveryStatusBusy} onClick={()=>{setReadinessBasis(timeChangeReview&&recoveryIsAccepted(readinessReturn,timeChangeReview.account)?"accepted":"draft");setReadinessOpen(true);onDismissReadinessReturn?.();}}>{timeChangeReview&&recoveryIsAccepted(readinessReturn,timeChangeReview.account)?"Check accepted day again":"Check this day again"}</button>
              {readinessReturn.proposalId&&onRefreshReviewStatus&&<button type="button" disabled={editorOpen||!timeChangeReview||recoveryStatusBusy} ref={reviewStatusTrigger} onClick={onRefreshReviewStatus}>{recoveryStatusBusy?"Checking review status…":readinessReturn.receiptUnavailable?"Retry review status":"Check review status"}</button>}
              {recoveryStatusBusy&&<p role="status">Reading your saved review. Nothing is being accepted or submitted.</p>}
              <button type="button" onClick={onDismissReadinessReturn}>Dismiss check reminder</button>
            </div>}
            {readinessOpen && timeChangeReview && <ReplanningReadiness key={`${current.stop.id}:${localDay}`} tripId={timeChangeReview.account.id} onEditActivity={onReadinessEdit} initialBasis={readinessBasis} onAccepted={timeChangeReview.onAccepted} stopId={current.stop.id} day={localDay-1} onClose={()=>setReadinessOpen(false)} />}
            {delayOpen && timeChangeReview && <DayDelayReview key={`${current.stop.id}:${localDay}`} activities={activities} place={current.stop.name} timezone={current.stop.timezone} review={timeChangeReview} initial={delaySeed} onEditActivity={timeChangeReview.onEditActivity ? (proposal,id)=>{const opened=timeChangeReview.onEditActivity!(proposal,id);if(opened)setDelayOpen(false);return opened;} : undefined} onClose={()=>setDelayOpen(false)} />}
            <p className="day-window">
              Local times · open gaps shown around an 08:00–22:00 planning day
              {transfers.length ? " · allow for untimed transfers" : ""}
            </p>
            <DayWeather key={`${current.stop.id}:${localDay}:${date??"flexible"}:${current.stop.location?.reference_id??"unmapped"}:${weatherSeed?.key??"manual"}`} stop={current.stop} visitDate={date} activities={activities} review={timeChangeReview} initial={weatherSeed} />
            <JourneyCheck key={JSON.stringify(activities.map(a => [a.id, a.start, a.minutes, a.place?.id, a.kind, a.title]).concat([[date, current.stop.timezone]]))} activities={activities} onEdit={onEdit} timeChangeReview={timeChangeReview} visitDate={date} timezone={current.stop.timezone} />
            {activities.some(a=>a.completed||a.skipped)&&<div className="day-recorded-controls"><label><input type="checkbox" checked={showRecorded} onChange={e=>setShowRecorded(e.target.checked)}/> Show recorded outcomes</label>{!showRecorded&&<p role="status">{activities.filter(a=>a.completed||a.skipped).length} completed or missed {activities.filter(a=>a.completed||a.skipped).length===1?"record":"records"} hidden. Completed time stays occupied; missed activities leave their time open.</p>}</div>}
            <div className="day-timeline">
              {visibleDayEntries(entries, showRecorded).map((entry) =>
                entry.type === "gap" ? (
                  <div className="day-gap" key={`gap-${entry.start}`}>
                    <time>
                      {clock(entry.start)}
                      <span>–{clock(entry.end)}</span>
                    </time>
                    <div>
                      <strong>Unplanned time</strong>
                      <span>
                        {Math.floor((entry.end - entry.start) / 60) > 0
                          ? `${Math.floor((entry.end - entry.start) / 60)}h `
                          : ""}
                        {(entry.end - entry.start) % 60
                          ? `${(entry.end - entry.start) % 60}m`
                          : ""}{" "}
                        to leave open
                      </span>
                    </div>
                    <button
                      aria-label={`Plan the gap at ${clock(entry.start)}`}
                      onClick={() =>
                        add(
                          "free_time",
                          clock(entry.start),
                          Math.min(120, entry.end - entry.start),
                        )
                      }
                    >
                      ＋
                    </button>
                  </div>
                ) : (
                  <article
                    className={`day-activity ${conflicts[entry.activity.id] ? "has-conflict" : ""} ${entry.activity.completed ? "is-completed" : ""} ${entry.activity.skipped ? "is-skipped" : ""}`}
                    key={entry.activity.id}
                  >
                    <time>
                      {entry.activity.start}
                      <span>
                        {clock(
                          clockMinutes(entry.activity.start) +
                            entry.activity.minutes,
                        )}
                      </span>
                    </time>
                    <div className="day-activity-body">
                      <div className="day-item-kind">
                        {kindName[entry.activity.kind ?? "custom"]}
                        {entry.activity.fixed ? " · Fixed" : ""}
                        {entry.activity.booked ? " · Booked elsewhere" : ""}
                        {entry.activity.skipped ? " · Didn’t happen" : ""}
                      </div>
                      <h3>{entry.activity.title}</h3>
                      <p>{entry.activity.minutes} minutes</p>
                      {entry.activity.place && <>{entry.activity.title !== entry.activity.place.name && <small>Map location: {entry.activity.place.name}</small>}<PlaceAttribution place={entry.activity.place} /></>}
                      {conflicts[entry.activity.id]?.map((issue) => (
                        <p className="day-item-conflict" key={issue}>
                          {issue}
                        </p>
                      ))}
                      <div className="day-item-actions">
                        <button onClick={() => onEdit({ ...entry.activity })}>
                          Edit or move
                        </button>
                        <label>
                          <input
                            type="checkbox"
                            checked={entry.activity.completed}
                            onChange={(e) =>
                              onUpdate({
                                activities: trip.activities.map((a) =>
                                  a.id === entry.activity.id
                                    ? { ...a, completed: e.target.checked, ...(e.target.checked ? { skipped: false } : {}) }
                                    : a,
                                ),
                              })
                            }
                          />
                          Done
                        </label>
                      </div>
                    </div>
                  </article>
                ),
              )}
            </div>
            <div className="day-bottom-actions">
              <button onClick={() => add("meal", nextStart)}>
                ＋ Add a meal
              </button>
              <button onClick={() => add("rest", nextStart)}>
                ＋ Add a break
              </button>
            </div>
            <p className="day-source-note">
              Your own plan. Opening hours and journey times haven’t been
              verified.
            </p>
          </>
        )}
        {!!stats.needsDay.length && (
          <aside className="day-needs-attention">
            <h2>These items need a new day</h2>
            <p>Your route changed. These activities are still kept here.</p>
            {stats.needsDay.map((a) => (
              <button key={a.id} onClick={() => onEdit({ ...a })}>
                {a.title} · choose a day
              </button>
            ))}
          </aside>
        )}
        {!!problems.length && (
          <aside className="day-needs-attention">
            <h2>Your route needs attention</h2>
            {problems.map((p) => (
              <p key={p}>{p}</p>
            ))}
            <button onClick={() => onSetup(3)}>Adjust trip time</button>
          </aside>
        )}
      </section>
    </div>
  );
}
