"use client";
import type { WeatherSeed } from "../../lib/trips/weather-handoff";
import { useEffect, useRef, useState } from "react";
import type { Activity } from "../../lib/trips/adapter";
import { proposalAdapter } from "../../lib/trips/proposals";
import type { TimeChangeAccount } from "./TimeChangeReview";
import WeatherAlternatives from "./WeatherAlternatives";
import type { ActivityPlace } from "../../lib/trips/activity-search";
import ProposalReview from "./ProposalReview";

export default function WeatherChangeAction({ activities, date, review, reference, initial }: {
  initial?:WeatherSeed;
  reference:string;
  activities: Activity[];
  date: string;
  review?: TimeChangeAccount;
}) {
  const choices = activities.filter(a => !a.fixed && !a.booked && !a.completed)
    .sort((a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id));
  const [intent,setIntent]=useState<"leave_time_open"|"replace_place">(initial?"replace_place":"leave_time_open");
  const [replacement,setReplacement]=useState<ActivityPlace>();
  const [selected, setSelected] = useState(initial?.activityId??"");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [proposalId, setProposalId] = useState<string>();
  const active = useRef(true);
  const controller = useRef<AbortController | null>(null);
  const retry = useRef<{ body: string; key: string } | null>(null);
  const choice = choices.find(a => a.id === selected);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; controller.current?.abort(); };
  }, []);

  async function prepare() {
    if (!review || !choice || busy || (intent === "replace_place" && !replacement)) return;
    const input = { activity_id: choice.id, visit_date: date, intent, ...(intent === "replace_place" && replacement ? {replacement_place_id:replacement.id} : {}) };
    const body = JSON.stringify(input);
    if (retry.current?.body !== body) retry.current = { body, key: crypto.randomUUID() };
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setError("");
    try {
      const result = await proposalAdapter.weatherChange(review.account.id, review.account.versionEtag, input, retry.current.key, abort.signal);
      if (active.current) setProposalId(result.id);
    } catch (failure) {
      if (active.current && !abort.signal.aborted) setError(failure instanceof Error && failure.name !== "TimeoutError" ? failure.message : "Could not prepare this change. Your trip is unchanged. Try again to recover the same review.");
    } finally {
      if (active.current) setBusy(false);
    }
  }

  return <>
    <fieldset className="weather-change-controls" disabled={busy}>
      <legend>Make a little room for the weather</legend>
      <p>You choose what to reconsider. We don’t infer whether an activity is outdoors or unsafe.</p>
      {!review ? <p>Save the current draft to your account before preparing a reviewed change.</p> : choices.length ? <>
        <label>Activity to reconsider<select value={choice?.id ?? ""} onChange={e => { setSelected(e.target.value); setReplacement(undefined); setError(""); }}>
          <option value="">Choose an activity</option>
          {choices.map(a => <option key={a.id} value={a.id}>{a.start} · {a.title}</option>)}
        </select></label>
        <label>What would you prefer?<select value={intent} onChange={e=>{setIntent(e.target.value as "leave_time_open"|"replace_place");setReplacement(undefined);setError("");}}><option value="leave_time_open">Leave this time open</option><option value="replace_place">Choose a museum or gallery instead</option></select></label>
        {intent === "replace_place" && choice && <WeatherAlternatives key={choice.id} initialCategory={initial?.category} reference={reference} selected={replacement} onChoose={setReplacement} disabled={busy}/>}
        {replacement && intent === "replace_place" && <p role="status">{choice?.title} → {replacement.name}. Keep {choice?.start} for {choice?.minutes} minutes. Verify indoor access with the venue.</p>}
        <button type="button" disabled={!choice || (intent === "replace_place" && !replacement)} onClick={() => void prepare()}>Preview weather-related change</button>
        <small>We’ll retrieve the forecast again and preview your chosen change. Other activity times stay unchanged. This is for planning ahead; travel needs checking again.</small>
      </> : <p>No flexible activities are available. Fixed, booked and completed activities are protected.</p>}
    </fieldset>
    {busy && <p role="status">Checking the saved activity and forecast. Your trip is unchanged.</p>}
    {error && <p role="alert">{error}</p>}
    {proposalId && review && <ProposalReview account={review.account} proposalId={proposalId}
      onClose={() => setProposalId(undefined)} onDiscarded={() => { retry.current = null; }}
      onAccepted={async (confirmation) => { await review.onAccepted(confirmation??"Weather-related change accepted. Other activity times stay unchanged; recheck affected travel."); setProposalId(undefined); setSelected(""); setReplacement(undefined); setIntent("leave_time_open"); retry.current = null; }} />}
  </>;
}
