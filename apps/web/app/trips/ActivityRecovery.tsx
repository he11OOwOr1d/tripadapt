"use client";
import { useId, useState } from "react";
import { recoveryChoices, type RecoveryChoice } from "../../lib/trips/activity-recovery";
export default function ActivityRecovery({label,protectedItem,disabled,onReview}: {
  label:string;
  protectedItem:boolean;
  disabled:boolean;
  onReview:(choice:RecoveryChoice)=>void;
}) {
  const groupName=useId();
  const [choice,setChoice]=useState<RecoveryChoice>();
  const selected=choice?recoveryChoices[choice]:undefined;
  return <div className="activity-recovery">
    <fieldset disabled={disabled}>
      <legend>What happened with {label}?</legend>
      <div className="recovery-choices">
        {(Object.keys(recoveryChoices) as RecoveryChoice[]).map(value=><label key={value}>
          <input type="radio" name={groupName} checked={choice===value} onChange={()=>setChoice(value)}/>
          {recoveryChoices[value].label}
        </label>)}
      </div>
    </fieldset>
    {selected&&<div className="recovery-guidance"><p>{selected.guidance}</p>
      <p>Choosing an answer changes nothing. Confirm your record in the editor, then save.</p>
      {protectedItem&&<p>Fixed or booked commitment: check the original arrangement before changing it. Removing an item never cancels a reservation.</p>}
      <button type="button" disabled={disabled} aria-label={`${selected.action} for ${label}`} onClick={()=>choice&&onReview(choice)}>{selected.action}</button>
    </div>}
  </div>;
}
