"use client";
import { useEffect, useState } from "react";
import { costMoney, loadCostCoverage, type CostCoverage as Coverage, type CostSource, type RecordRow } from "../../lib/trips/cost-coverage";
const units={room_night:"room-nights",bed_night:"bed-nights",person_trip:"travelers for this leg",vehicle_trip:"vehicle for this leg"};
const categories={food:"Meals",activity:"Activity",accommodation:"Stay",transport:"Transport",taxes_fees:"Taxes & fees",miscellaneous:"Other"};
function recordBasis(row:RecordRow,currency:string){
 const times=row.travelers===null?`${row.quantity} × group`:`${row.travelers} ${row.travelers===1?"traveler":"travelers"} × ${row.quantity}`;
 return `${categories[row.category]} · ${times}${row.unit_amount!==null?` × ${costMoney(row.unit_amount,row.currency)}`:" · amount unknown"}`;
}
export default function CostCoverage({source}:{source?:CostSource}) {
 const [data,setData]=useState<Coverage|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false),[attempt,setAttempt]=useState(0);
 useEffect(()=>{
  setData(null);setError("");if(!source){setBusy(false);return;}
  const abort=new AbortController();setBusy(true);
  loadCostCoverage(source,AbortSignal.any([abort.signal,AbortSignal.timeout(10000)])).then(value=>{if(!abort.signal.aborted)setData(value);}).catch(e=>{if(!abort.signal.aborted)setError(e instanceof Error?e.message:"Cost coverage could not be loaded. Your trip is unchanged.");}).finally(()=>{if(!abort.signal.aborted)setBusy(false);});
  return()=>abort.abort();
 },[source?.tripId,source?.versionId,source?.etag,attempt]);
 const estimates=data?data.known_allowances+data.estimated_records:0;
 return <details className="cost-coverage"><summary>What these costs cover</summary>
  {!source&&<p>Cost coverage is available after the draft finishes saving. Your entered allowances remain above.</p>}
  {busy&&<p role="status">Reading saved cost coverage…</p>}
  {error&&<div role="alert"><p>{error}</p><button type="button" onClick={()=>setAttempt(n=>n+1)}>Retry cost coverage</button></div>}
  {data&&<><p>{data.notice}</p><dl className="cost-coverage-totals"><div><dt>Your estimates</dt><dd>{estimates?costMoney(data.estimated_subtotal,data.currency):"Unknown"}</dd></div><div><dt>Recorded as paid</dt><dd>{data.paid_records?costMoney(data.recorded_paid_subtotal,data.currency):"Not recorded"}</dd></div><div><dt>Complete trip total</dt><dd>{data.coverage_complete&&data.total?`${costMoney(data.total,data.currency)} · from your entries`:"Unknown"}</dd></div></dl>
  <p>{data.known_allowances} {data.known_allowances===1?"allowance":"allowances"} entered; {data.unknown_allowances} still unknown. Zero means an explicitly entered free allowance.</p>
  <ul className="cost-coverage-rows">{data.rows.map(row=><li key={row.key}><strong>{row.label}</strong><span>{row.quantity===null?"Nights not allocated":`${row.quantity} ${units[row.unit]}`}{row.unit_amount!==null?` × ${costMoney(row.unit_amount,data.currency)}`:" · rate unknown"}</span><span>{row.estimated_amount===null?"Unknown":costMoney(row.estimated_amount,data.currency)}{row.amount_status==="estimated"?" · your allowance":""}</span>{row.covered_by_records && Number(row.covered_by_records)>0 && <span>{costMoney(row.covered_by_records,data.currency)} already covered by linked entries; counted once in the total.</span>}</li>)}</ul>
  {data.records.length>0&&<><h4 className="cost-coverage-heading">Your cost entries</h4>
  <p>{data.estimated_records} estimated, {data.paid_records} recorded as paid, {data.unknown_records} with unknown amounts{data.unconverted_records?`, including ${data.unconverted_records} in another currency without a rate`:""}.</p>{data.tax_unknown_records>0&&<p>{data.tax_unknown_records} {data.tax_unknown_records===1?"entry has":"entries have"} unknown tax, so the subtotal may be low.</p>}
  <ul className="cost-coverage-rows">{data.records.map(row=><li key={row.key}><strong>{row.label}</strong>{row.linked_to&&<span>For {row.linked_to}</span>}{row.link_removed&&<span>Its linked item was removed; the payment is still recorded.</span>}<span>{recordBasis(row,data.currency)}</span><span>{row.conversion!=="none"&&row.original_amount!==null?`${costMoney(row.original_amount,row.currency)} → `:""}{row.amount===null?"Unknown":costMoney(row.amount,data.currency)}{row.entered_status==="paid"?" · you recorded this as paid":" · your estimate"}</span>{row.conversion==="converted"&&row.conversion_rate&&<span>At your rate: 1 {row.currency} = {row.conversion_rate} {data.currency}{row.rate_note?` · ${row.rate_note}`:""}{row.rate_date?` · ${row.rate_date}`:""}</span>}{row.tax_amount!==null&&<span>Includes {costMoney(row.tax_amount,row.currency)} tax ({row.tax_percent}%) added on top</span>}{row.original_amount!==null&&!row.tax_known&&<span>Tax not known yet, so this may be incomplete.</span>}{row.conversion==="missing_rate"&&<span>No conversion rate entered, so this stays out of {data.currency} totals.</span>}</li>)}</ul></>}
  {data.unpriced_categories.length>0&&<p><strong>No entries yet:</strong> {data.unpriced_categories.join(", ")}. These are not included as zero.</p>}
  <p>Entries describe only what you added; a category with an entry may still be incomplete.</p>
  {data.estimates_exceed_budget&&<p>Your estimates and recorded payments already exceed your {data.budget_mode==="strict"?"strict limit":"target"}.</p>}
  {!data.coverage_complete&&<><p><strong>Before a complete total is possible:</strong></p><ul>{data.missing.map(m=><li key={m}>{m}</li>)}</ul></>}<p>{data.budget_mode==="strict"?(data.coverage_complete?"Your strict limit is checked against your own entries and rates, not live prices. You’ll be asked to acknowledge that before accepting.":"Strict-budget acceptance stays blocked until the items above are resolved."):data.budget_mode==="target"?"A subtotal below your target does not mean the whole trip fits your budget.":data.coverage_complete?"No overall budget limit is set. The total uses your confirmed entries.":"These entries are not a complete trip budget."}</p></>}
 </details>;
}
