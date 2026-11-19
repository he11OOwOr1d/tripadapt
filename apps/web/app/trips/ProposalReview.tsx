"use client";
import CostCoverage from "./CostCoverage";
import type { DelayEditHandler } from "../../lib/trips/delay-handoff";
import DayDelayLiveCheck from "./DayDelayLiveCheck";
import LiveAcceptanceCheck, { type LiveCheckChoice } from "./LiveAcceptanceCheck";
import PlaceAttribution from "./PlaceAttribution";
import { AccountError } from "../../lib/trips/account-adapter";
import { describeDayCheck, type DayCheckDiagnostic } from "../../lib/trips/day-check-feedback";
import { weatherCondition } from "../../lib/trips/weather";
import { useCallback, useEffect, useRef, useState } from "react";
import { proposalAdapter, type Proposal } from "../../lib/trips/proposals";
import { reviewSubmitKey, clearReviewSubmitKey } from "../../lib/trips/review-submit-retry";

export default function ProposalReview({
  account,
  proposalId,
  onClose,
  onAccepted,
  onDiscarded,
  onEditActivity,
  onProposalReady,
  onOpenPending,
}: {
  account: { id: string; versionEtag: string };
  proposalId?: string;
  onClose: () => void;
  onAccepted: (confirmation?:string,acceptedProposal?:Proposal) => Promise<void>;
  onDiscarded?: (proposal:Proposal) => void;
  onEditActivity?: DelayEditHandler;
  onProposalReady?: (proposal:Proposal)=>void;
  onOpenPending?: () => void;
}) {
  const readyCallback=useRef(onProposalReady);
  readyCallback.current=onProposalReady;
  const dialog = useRef<HTMLDialogElement>(null);
  const keys = useRef({
    submit: crypto.randomUUID(),
    submitScope: "",
    accept: crypto.randomUUID(),
  });
  const [dayCheck,setDayCheck] = useState<DayCheckDiagnostic>();
  const errorFocus = useRef<HTMLDivElement>(null);
  const [liveChoice,setLiveChoice] = useState<LiveCheckChoice>({enabled:false,input:null,scope:"live_check"});
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [acknowledged, setAcknowledged] = useState<string[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const changeLiveChoice = useCallback((choice: LiveCheckChoice) => {
    setLiveChoice(choice);
    setDayCheck(undefined);
    setError("");
  }, []);
  useEffect(() => { if (error) errorFocus.current?.focus(); }, [error, dayCheck]);

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
    const scope = JSON.stringify([account.id, account.versionEtag]);
    if (!proposalId && keys.current.submitScope !== scope) {
      const fallback = crypto.randomUUID();
      try { keys.current.submit = reviewSubmitKey(sessionStorage, account.id, account.versionEtag, fallback); } catch { keys.current.submit = fallback; }
      keys.current.submitScope = scope;
    }
    const submitKey = keys.current.submit;
    setLiveChoice({enabled:false,input:null,scope:"live_check"});
    setBusy(true);
    setError("");
    setDayCheck(undefined);
    (proposalId
      ? proposalAdapter.get(account.id, proposalId)
      : proposalAdapter.submit(
          account.id,
          account.versionEtag,
          submitKey,
        )
    )
      .then((result) => {
        if (active) {
          if (!proposalId) { try { clearReviewSubmitKey(sessionStorage, account.id, account.versionEtag, submitKey); } catch { /* Storage is optional. */ } }
          readyCallback.current?.(result);
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
            failure instanceof TypeError
              ? "Couldn’t connect to the trip service. Check your connection and try again."
              : failure instanceof Error && failure.name !== "TimeoutError"
              ? failure.message
              : "The review request took too long. It may still have been saved.",
          );
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [account.id, account.versionEtag, attempt, proposalId]);
  const budgetIssue = proposal?.validation.issues.find(i => i.code.startsWith("STRICT_BUDGET"));
  const blocked = proposal?.stale || proposal?.validation.issues.some((i) => i.blocking);
  const advisories =
    proposal?.validation.issues.filter((i) => i.acknowledgeable) ?? [];
  async function act(accept: boolean) {
    if (!proposal || busy) return;
    if (accept && liveChoice.enabled && !liveChoice.input) {
      setError("Complete the live-check choices before accepting. Nothing has changed.");
      return;
    }
    setBusy(true);
    setError("");
    setDayCheck(undefined);
    try {
      if (accept) {
        const result = await proposalAdapter.accept(
          account.id,
          proposal,
          acknowledged,
          keys.current.accept,
          liveChoice.enabled ? liveChoice.input : null,
          liveChoice.scope,
        );
        setProposal(result);
        await onAccepted(liveChoice.enabled && liveChoice.input ? "Accepted after the requested fresh hours and route checks for the displayed visits and journeys. Estimates do not confirm tickets, accessibility or the whole trip." : undefined, result);
      } else {
        await proposalAdapter.discard(account.id, proposal);
        onDiscarded?.(proposal);
        onClose();
      }
    } catch (failure) {
      setDayCheck(failure instanceof AccountError ? failure.dayCheck : undefined);
      setError(
        failure instanceof Error
          ? failure.message
          : "The request failed. Your draft is kept.",
      );
    } finally {
      setBusy(false);
    }
  }
  function editMap(activityId: string) {
    if (!proposal || busy || !onEditActivity) return;
    if (!onEditActivity(proposal, activityId)) setError("This activity or saved day changed. Close this review and open the latest day before editing its map location.");
  }
  const checkFeedback = proposal ? describeDayCheck(dayCheck, proposal) : undefined;
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
      {proposal?.plan.budget && <section className="proposal-budget" aria-label="Budget policy"><strong>{proposal.plan.budget.mode === "strict" ? "Strict whole-trip limit" : "Whole-trip budget target"}: {proposal.plan.display_currency} {Number(proposal.plan.budget.amount).toLocaleString(undefined,{maximumFractionDigits:2})}</strong><p>{proposal.plan.budget.mode === "strict" ? (budgetIssue?.code === "STRICT_BUDGET_EXCEEDED" ? "Your entered total exceeds this limit. Reduce the costs or explicitly change the budget before accepting." : budgetIssue?.code === "STRICT_BUDGET_FROM_ENTRIES" ? "Your confirmed entries fit this limit. Acknowledge that the check uses your own entries and rates before accepting." : "Complete cost coverage is unavailable. This strict-budget review cannot be accepted; your existing accepted plan stays unchanged.") : "This is a target, not a verified total. Stay and travel allowances do not cover every trip expense."}</p></section>}
      {proposal&&<CostCoverage source={{tripId:account.id,versionId:proposal.candidate_version_id}}/>}
      {busy && (
        <p role="status">
          {proposal ? "Updating your plan…" : "Checking your saved draft…"}
        </p>
      )}
      {error && (
        <div role="alert" className="editor-error" tabIndex={-1} ref={errorFocus}>
          {checkFeedback ? <><h3>{checkFeedback.subject}</h3><p>{checkFeedback.explanation}</p><p>{checkFeedback.nextStep}</p><p>Stopped at the first problem. Other visits or journeys may not have been checked. This review is still pending; your itinerary is unchanged.</p><details><summary>Service message</summary><p>{error}</p></details></> : <p>{error}</p>}
          {!proposal && (
            <>
              {!proposalId && <p>The review may have been saved even if its response was interrupted. Retrying here uses the same request. Preparing a review does not accept your plan.</p>}
              <button onClick={() => setAttempt((n) => n + 1)} disabled={busy}>
                Retry review
              </button>
              {!proposalId && onOpenPending && <button type="button" disabled={busy} onClick={onOpenPending}>Check pending reviews</button>}
            </>
          )}
        </div>
      )}
      {proposal && (
        <>
          {proposal.stale && proposal.status === "pending" && <p role="alert" className="editor-error">Your trip changed after this review was prepared. It can’t be accepted. Inspect or discard it, then prepare a fresh review from your current draft.</p>}
          <p className="proposal-state">
            {blocked
              ? "Needs a few adjustments"
              : proposal.status === "accepted"
                ? "Accepted provisional plan"
                : proposal.source === "fixture"
                  ? "Test fixture proposal · no AI or live data"
                  : proposal.source === "ai"
                    ? ["move_activity", "resize_activity", "remove_activity", "replace_activity"].includes(proposal.generation?.operation ?? "")
                      ? "Requested schedule change · local time"
                      : proposal.generation?.evidence === "mapped_places" ? "AI proposal · mapped places, estimated timing" : "AI-generated proposal · sample evidence"
                    : proposal.source === "restore" ? "Restoration proposal · provisional" : proposal.generation?.operation === "move_activity" ? "Requested time change · saved draft" : proposal.generation?.operation === "remaining_day" ? "Remaining-day timing · fresh context required" : proposal.generation?.operation === "delay_day" ? "User-reported delay · proposed day adjustment" : proposal.generation?.weather ? "Your requested change · daily forecast context" : "Provisional manual plan"}
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
          {proposal.generation?.weather && <section className="proposal-time-change" aria-label="Forecast context for this change">
            <h3>The outlook you’re planning around</h3>
            <p>{proposal.generation.weather.visit_date} · {proposal.generation.weather.timezone} · {weatherCondition(proposal.generation.weather.day.weather_code)}</p>
            <p>{proposal.generation.weather.day.temperature_min_c === null || proposal.generation.weather.day.temperature_max_c === null ? "Temperature range not fully reported" : `${proposal.generation.weather.day.temperature_min_c}–${proposal.generation.weather.day.temperature_max_c} °C`}. Precipitation: {proposal.generation.weather.day.precipitation_mm === null ? "not reported" : `${proposal.generation.weather.day.precipitation_mm} mm`}; chance: {proposal.generation.weather.day.precipitation_probability_percent === null ? "not reported" : `${proposal.generation.weather.day.precipitation_probability_percent}%`}.</p>
            <p>{proposal.generation.weather.date_basis === "check_only" ? "Check-only date: your flexible trip dates stay unchanged." : "Date from the saved trip schedule."} You chose this change; the forecast does not establish that an activity is unsafe or unsuitable.</p>
            <p>Daily destination forecast from <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a>, retrieved {new Date(proposal.generation.weather.retrieved_at).toLocaleString()}{proposal.generation.weather.cached ? " (cached)" : ""}. Review expires 15 minutes after retrieval. Refresh and prepare a new proposal after that.</p>
          </section>}
          {proposal.generation?.replacement && <section className="proposal-time-change" aria-label="Proposed replacement"><h3>{proposal.generation.replacement.before} → {proposal.generation.replacement.after}</h3><p>{proposal.generation.replacement.destination} · day {proposal.generation.replacement.day} · {proposal.generation.replacement.start} for {proposal.generation.replacement.duration_minutes} minutes</p><p>Same time slot. Every other activity stays in place. This map category does not confirm indoor access, admission, prices or availability. No reservation is changed.</p>{proposal.place_details?.[proposal.generation.replacement.place_id] && <PlaceAttribution place={proposal.place_details[proposal.generation.replacement.place_id]}/>}</section>}
          {proposal.generation?.removal && (
            <section className="proposal-time-change" aria-label="Activity proposed for removal">
              <h3>Remove {proposal.generation.removal.label}?</h3>
              <p>{proposal.generation.removal.destination} · day {proposal.generation.removal.day}</p>
              <p>{proposal.generation.removal.start} local time · {proposal.generation.removal.duration_minutes} minutes</p>
              <p>This activity will leave your itinerary. Everything else stays in place. No reservation is cancelled.</p>
            </section>
          )}
          {proposal.generation?.operation === "remaining_day" && <section className="proposal-time-change"><h3>Review the rest of day {proposal.generation.day}</h3>{proposal.generation.remaining_context&&<p>Reported start: {proposal.generation.remaining_context.location_name}, {proposal.generation.remaining_context.local_time} on {proposal.generation.remaining_context.local_date} ({proposal.generation.remaining_context.timezone}). {proposal.generation.remaining_context.mode==="DRIVE"?"Driving without traffic":"Walking"}, {proposal.generation.remaining_context.buffer_minutes}-minute arrival buffer.</p>}<p>Flexible start times only. Order, durations and commitments are preserved. Acceptance rechecks journeys from your reported starting point. Venue hours are provisional unless you enable the checks below; weather and reservations remain unverified. Your reported context must still be within five minutes.</p><ul>{proposal.generation.changes?.map(c=><li key={c.activity_id}>{c.label}: {c.before} → {c.after}</li>)}</ul></section>}
          {proposal.generation?.operation === "delay_day" && <section className="proposal-time-change" aria-label="Proposed day adjustment"><h3>Day {proposal.generation.day} in {proposal.generation.destination}</h3><p>Only these flexible start times change. Durations and existing gaps stay the same; other days and protected commitments are untouched.</p><ul className="delay-change-list">{proposal.generation.changes?.map(change=><li key={change.activity_id}><strong>{change.label}</strong><span>{change.before} → {change.after} · {change.minutes} minutes</span></li>)}</ul><p>Reported delay, not live disruption data. Venue hours, actual travel time, costs and reservations need separate checks.</p></section>}
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
          {proposal.generation?.summary && !["remaining_day", "move_activity", "resize_activity", "remove_activity", "replace_activity"].includes(proposal.generation.operation ?? "") && (
            <section className="planning-progress">
              <h3>{["move_activity","delay_day"].includes(proposal.generation.operation ?? "") ? "What changes" : "Why this shape works"}</h3>
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
          <details open={!["remaining_day", "delay_day", "move_activity", "resize_activity", "remove_activity", "replace_activity"].includes(proposal.generation?.operation ?? "")}>
            <summary>Complete itinerary</summary>
          <div className="proposal-route">
            {proposal.plan.stops.map((stop) => (
              <section key={stop.client_id}>
                <h3>{stop.name}</h3>
                <p>{stop.desired_nights ?? "Unallocated"} nights{proposal.source === "restore" && stop.timezone ? ` · ${stop.timezone}` : ""}</p>
                {stop.place_reference_id && proposal.location_references?.[stop.place_reference_id] ? <small>Selected map location retained · {proposal.location_references[stop.place_reference_id].source}</small> : <small>Manually entered location</small>}
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
                        {a.skipped ? ", didn’t happen" : ""}
                        {a.booked ? ", booked elsewhere" : ""})
                      </small>
                      {a.place_id && proposal.place_details?.[a.place_id] && <>{a.user_label !== proposal.place_details[a.place_id].name && <small>Map location: {proposal.place_details[a.place_id].name}</small>}<PlaceAttribution place={proposal.place_details[a.place_id]} /></>}
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
          {!proposal.stale && proposal.generation?.operation === "remaining_day" && proposal.status === "pending" && <DayDelayLiveCheck key={proposal.id} proposal={proposal} disabled={busy} onChange={changeLiveChoice} />}
          {!proposal.stale && proposal.generation?.operation === "delay_day" && proposal.status === "pending" && <DayDelayLiveCheck key={proposal.id} proposal={proposal} disabled={busy} onChange={changeLiveChoice} onEditActivity={onEditActivity ? editMap : undefined} />}
          {!proposal.stale && proposal.source === "user" && (proposal.generation?.operation === "move_activity" || proposal.generation?.operation === "replace_activity") && proposal.generation?.request && proposal.status === "pending" && <LiveAcceptanceCheck key={proposal.id} proposal={proposal} disabled={busy} onChange={changeLiveChoice} />}
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
                  (liveChoice.enabled && !liveChoice.input) ||
                  advisories.some((i) => !acknowledged.includes(i.id))
                }
                onClick={() => void act(true)}
              >
                {proposal.source === "restore" ? "Accept restoration" : proposal.generation?.operation === "remove_activity" ? "Accept removal" : proposal.generation?.operation === "replace_activity" ? "Accept replacement" : proposal.generation?.operation === "move_activity" ? "Accept time change" : proposal.generation?.operation === "remaining_day" ? (liveChoice.enabled?"Check hours and routes, then accept":"Check routes and accept timing") : proposal.generation?.operation === "delay_day" ? "Accept day adjustment" : "Accept provisional plan"}
              </button>
            )}
          </footer>
        </>
      )}
      {!proposal && !busy && <button onClick={onClose}>Back to my trip</button>}
    </dialog>
  );
}
