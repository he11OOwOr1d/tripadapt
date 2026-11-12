"use client";
import { useEffect, useRef, useState } from "react";
import type { Activity } from "../../lib/trips/adapter";
import { proposalAdapter } from "../../lib/trips/proposals";
import ProposalReview from "./ProposalReview";
export type TimeChangeAccount = {account:{id:string;versionEtag:string};onAccepted:()=>Promise<void>};
export default function TimeChangeReview({activity,review}:{activity:Activity;review:TimeChangeAccount}) {
  const key=useRef(crypto.randomUUID()),controller=useRef<AbortController|null>(null),active=useRef(true);
  const [proposalId,setProposalId]=useState<string>();
  const [busy,setBusy]=useState(false),[error,setError]=useState("");
  useEffect(()=>{active.current=true;return()=>{active.current=false;controller.current?.abort();};},[]);
  async function create() {
    const abort=new AbortController();controller.current=abort;setBusy(true);setError("");
    try{const proposal=await proposalAdapter.timeChange(review.account.id,review.account.versionEtag,activity.id,activity.start,key.current,abort.signal);if(active.current)setProposalId(proposal.id);}
    catch(failure){if(active.current&&!abort.signal.aborted)setError(failure instanceof Error?failure.message:"Could not prepare a saved review. Your trip is unchanged.");}
    finally{if(active.current)setBusy(false);}
  }
  return <><button type="button" disabled={busy} onClick={()=>void create()}>{busy?"Checking saved plan…":"Review as a saved proposal"}</button><small>Checks the latest saved draft. Nothing changes until you accept the proposal. Preview checks are not stored. In the review, you can opt into fresh Google checks at acceptance.</small>{error&&<p role="alert">{error}</p>}{proposalId&&<ProposalReview account={review.account} proposalId={proposalId} onClose={()=>setProposalId(undefined)} onAccepted={review.onAccepted} onDiscarded={()=>{key.current=crypto.randomUUID();}}/>}</>;
}
