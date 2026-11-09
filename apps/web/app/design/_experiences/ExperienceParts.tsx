"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export const photo = (name: string) => `/images/design/${name}.jpg`;
export const money = (amount: number) => `${amount < 0 ? "−" : ""}₹${Math.abs(amount).toLocaleString("en-IN")}`;

export function Experience({ name, children }: { name: string; children: ReactNode }) {
  const root = useRef<HTMLElement>(null);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const span = document.documentElement.scrollHeight - innerHeight;
        root.current?.style.setProperty("--journey-progress", String(span > 0 ? scrollY / span : 0));
      });
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);
  return (
    <main className={`x-world x-${name}${paused ? " x-paused" : ""}`} ref={root}>
      <a className="x-skip" href="#explore">Skip to the experience</a>
      <div className="x-progress" aria-hidden="true" />
      <header className="x-nav">
        <a href="/design/options" className="x-brand"><span aria-hidden="true">✳</span> elsewhere.</a>
        <nav aria-label="Explore this design"><a href="#explore">The possibilities</a><a href="#route">Your journey</a><a href="#questions">Good to know</a></nav>
        <a className="x-button x-nav-cta" href="/trips/new">Make a little time</a>
      </header>
      {children}
      <footer className="x-footer">
        <a href="/design/options" className="x-brand">elsewhere.</a>
        <p>A connected plan. Room for the unexpected.</p>
        <a href="/design/options">Compare all 14 designs</a>
        <button aria-pressed={paused} onClick={() => setPaused(p => !p)}>{paused ? "Resume motion" : "Pause motion"}</button>
        <small>Interactive design sample. Prices, itineraries and weather are illustrative; selections reset on reload. Landscape photography is inspiration, not a specific property or destination offer. Additional photography: <a href="https://www.pexels.com/photo/landscape-photography-of-cabin-near-forest-976919/" target="_blank" rel="noreferrer">Pexels / lakeside stay</a>, <a href="https://www.pexels.com/photo/colorful-italian-coastal-town-overlooking-the-sea-36803728/" target="_blank" rel="noreferrer">Pexels / coastal town</a>.</small>
      </footer>
    </main>
  );
}

export function Intro({ title, children, aside }: { title: ReactNode; children?: ReactNode; aside?: string }) {
  return <div className="x-section-intro"><div>{aside ? <span className="x-kicker">{aside}</span> : null}<h2>{title}</h2></div>{children ? <p>{children}</p> : null}</div>;
}

const inspirations = [
  { id: "mountains", title: "A higher point of view.", note: "Mountain air. Unhurried mornings.", category: "Mountains" },
  { id: "village", title: "Get a little lost.", note: "Small streets. Long lunches.", category: "Coast" },
  { id: "cabin", title: "Stay close to quiet.", note: "A lakeside pause. Time to yourself.", category: "Quiet corners" },
];
export function Inspiration() {
  const [filter, setFilter] = useState("All possibilities");
  const [saved, setSaved] = useState<string[]>([]);
  const shown = filter === "All possibilities" ? inspirations : inspirations.filter(x => x.category === filter);
  return <section className="x-section x-inspiration" id="explore">
    <Intro title={<>What would a little<br />away feel like?</>} aside="Follow a feeling">You don’t need an itinerary yet. Start with what draws you in. Keep the places, photos and ideas you want to come back to.</Intro>
    <div className="x-filter" aria-label="Filter landscape inspiration">{["All possibilities", "Mountains", "Coast", "Quiet corners"].map(f => <button key={f} aria-pressed={filter === f} onClick={() => setFilter(f)}>{f}</button>)}</div>
    <div className="x-inspiration-grid">{shown.map((x, i) => <article className={`x-inspire-card x-inspire-${i}`} key={x.id}><div className="x-inspire-image"><img src={photo(x.id)} alt={x.note} loading="lazy" /><button aria-pressed={saved.includes(x.id)} aria-label={`${saved.includes(x.id) ? "Remove" : "Save"} ${x.category} inspiration`} onClick={() => setSaved(s => s.includes(x.id) ? s.filter(id => id !== x.id) : [...s, x.id])}>{saved.includes(x.id) ? "✓ Saved" : "+ Keep this"}</button></div><small>{x.category}</small><h3>{x.title}</h3><p>{x.note}</p></article>)}</div>
    <details className="x-research-note"><summary>There’s more to a place than a photograph.<span aria-hidden="true">+</span></summary><div><p><strong>The practical details.</strong> Check available opening hours, location and source links before fitting a place into your day. Missing information stays unknown.</p><p><strong>A little traveler context.</strong> Read provider-available ratings and attributed review samples. An AI summary should be clearly labeled, link to its sources and remind you that AI can make mistakes.</p><p><strong>Your kind of place.</strong> Keep the ideas you like without committing to a time or booking. A shortlist can grow as the trip takes shape.</p></div></details><div className="x-inline-note" aria-live="polite"><span>{saved.length ? `${saved.length} ${saved.length === 1 ? "idea" : "ideas"} kept for this visit.` : "A shortlist is a beginning. You can decide the details later."}</span><a href="#route">Connect the possibilities</a></div>
  </section>;
}

const routePlaces = ["Manali", "Kasol", "Dharamshala", "Shimla"];
export function RouteStudio() {
  const [stops, setStops] = useState([{ place: routePlaces[0], nights: 2 }, { place: routePlaces[1], nights: 2 }, { place: routePlaces[2], nights: 3 }]);
  const [view, setView] = useState("Route");
  const nights = stops.reduce((sum, s) => sum + s.nights, 0);
  const move = (i: number) => setStops(s => { const a = [...s]; [a[i], a[i + 1]] = [a[i + 1], a[i]]; return a; });
  return <section className="x-section x-route" id="route">
    <Intro title={<>A few places.<br />One connected journey.</>} aside="Try shaping a trip">More than one destination. As many days as you need. Change the order or stay a little longer, and see the outline change with you.</Intro>
    <div className="x-route-workspace"><div className="x-route-controls"><div className="x-demo-head"><span>A sample mountain escape</span><span>{nights} nights</span></div>
      <ol>{stops.map((s, i) => <li key={s.place}><span className="x-stop-number">{i + 1}</span><div><h3>{s.place}</h3><div className="x-night-controls"><button aria-label={`Remove a night in ${s.place}`} disabled={s.nights === 1} onClick={() => setStops(list => list.map((a, n) => n === i ? { ...a, nights: a.nights - 1 } : a))}>−</button><span>{s.nights} nights</span><button aria-label={`Add a night in ${s.place}`} onClick={() => setStops(list => list.map((a, n) => n === i ? { ...a, nights: a.nights + 1 } : a))}>+</button></div></div>{i < stops.length - 1 ? <button className="x-swap" onClick={() => move(i)} aria-label={`Swap ${s.place} and ${stops[i + 1].place}`}>⇅</button> : <span className="x-route-end">Linger here</span>}</li>)}</ol>
      <button className="x-text-button" onClick={() => setStops(s => s.length === 3 ? [...s, { place: "Shimla", nights: 2 }] : s.filter(a => a.place !== "Shimla"))}>{stops.length === 3 ? "+ Add Shimla to this example" : "Remove Shimla from this example"}</button>
      <small>Changing the route can affect transfers and bookings. This demo updates the outline; real travel times still need checking.</small>
    </div><div className="x-route-visual"><div className="x-tabs" aria-label="Journey preview">{["Route", "Days"].map(x => <button key={x} aria-pressed={view === x} onClick={() => setView(x)}>{x}</button>)}</div>
      {view === "Route" ? <div className="x-map" key={stops.map(s => s.place).join()}><svg viewBox="0 0 520 360" aria-hidden="true"><path className="x-contour" d="M-20 120 Q100 -10 200 90T550 30 M-20 170 Q100 40 200 140T550 80 M-20 220 Q100 90 200 190T550 130 M-20 270 Q100 140 200 240T550 180 M-20 320 Q100 190 200 290T550 230"/><path className="x-map-path" d={stops.length === 3 ? "M90 260 C90 100 200 240 260 120 S380 40 420 170" : "M90 260 C90 100 200 240 260 120 S380 40 420 170 S340 320 260 290"}/>{[[90,260],[260,120],[420,170],[260,290]].slice(0,stops.length).map(([x,y],i)=><g key={i}><circle cx={x} cy={y} r="11"/><text x={x} y={y+4} textAnchor="middle">{i+1}</text></g>)}</svg><div className="x-map-legend">{stops.map((s,i)=><span key={s.place}>{i+1}. {s.place}</span>)}</div><small>Illustrated route · not a geographic map</small></div> : <div className="x-days-list" key="days">{stops.map(s=><div key={s.place}><strong>{s.place}</strong><span>{s.nights} nights</span><p>Room for places you love, transfers, and time to do nothing.</p></div>)}</div>}
      <div className="x-route-total" aria-live="polite"><span>Sample stay allowance<small>{nights} nights × ₹2,800 / room</small></span><strong>{money(nights*2800)}</strong></div><small className="x-demo-note">One room. Stays only; transport, food and activities are additional estimates.</small>
    </div></div>
  </section>;
}

export function StayTravel() {
  const [stay, setStay] = useState(2800);
  const [travel, setTravel] = useState(1200);
  return <section className="x-section x-stay"><div className="x-stay-photo"><img src={photo("cabin")} alt="A lakeside house surrounded by forest, shown as accommodation inspiration" loading="lazy"/><span>Somewhere you’ll want to stay a little longer.</span></div><div className="x-stay-copy"><span className="x-kicker">The details belong together</span><h2>A place to wake up.<br />A way to get there.</h2><p>Keep your accommodation and journeys beside the days they belong to. Bring bookings you’ve already made, too.</p><div className="x-stay-picker"><label htmlFor="sample-stay">Your kind of stay</label><select id="sample-stay" value={stay} onChange={e=>setStay(Number(e.target.value))}><option value={1800}>A simple homestay · ₹1,800 / night</option><option value={2800}>A quiet guesthouse · ₹2,800 / night</option><option value={4200}>A little boutique stay · ₹4,200 / night</option></select><label htmlFor="sample-transfer">Between the next two stops</label><select id="sample-transfer" value={travel} onChange={e=>setTravel(Number(e.target.value))}><option value={1200}>Bus for two · ₹1,200</option><option value={3800}>Private car · ₹3,800</option></select></div><div className="x-stay-estimate" aria-live="polite"><span>2 nights + one transfer<strong>{money(stay*2+travel)}</strong></span><small>Illustrative allowance, not a bookable offer.<br/>Taxes, meals and local travel not included.</small></div><p className="x-small">You choose and book with the provider. The planner keeps the pieces connected; it doesn’t make reservations.</p></div></section>;
}

const conditions = {
  Rain: { icon:"☂", before:"A riverside walk", after:"Museum, then a slow coffee", time:"14:30", reason:"A nearby indoor afternoon, with enough time to get to dinner.", delta:300 },
  "Low energy": { icon:"☁", before:"A long afternoon exploring", after:"A café and some time to yourself", time:"15:00", reason:"Less walking, a shorter afternoon, and room to recharge.", delta:-200 },
  Delay: { icon:"◷", before:"An early afternoon market visit", after:"A shorter walk after arrival", time:"16:00", reason:"Keep the later arrival visible and shorten the flexible part of the day.", delta:0 },
};
type Condition = keyof typeof conditions;
export function ChangeStudio() {
  const [condition,setCondition]=useState<Condition>("Rain");
  const [accepted,setAccepted]=useState<Condition|null>(null);
  const [preview,setPreview]=useState(false);
  const c=conditions[condition];
  const active=preview||accepted===condition;
  return <section className="x-section x-change" id="changes"><Intro title={<>Life changes the plan.<br />The trip is still yours.</>} aside="Try a change of plans">Rain, a delay, or just wanting to slow down. Explore an alternative, see what changes, and decide whether it belongs in your trip.</Intro><div className={`x-change-stage ${active?"x-weather-on":""} ${active&&condition==="Rain"?"x-raining":""}`}><div className="x-weather-scene" aria-hidden="true"><span className="x-weather-sun"/><span className="x-weather-cloud cloud-one"/><span className="x-weather-cloud cloud-two"/><div className="x-weather-hill"/><div className="x-rain-lines"/><span className="x-weather-caption">{active?c.icon:"☀"}</span></div><div className="x-change-ui"><div className="x-filter" aria-label="Choose a sample disruption">{(Object.keys(conditions) as Condition[]).map(x=><button key={x} aria-pressed={condition===x} onClick={()=>{setCondition(x);setPreview(false);}}>{x}</button>)}</div><div className="x-change-status" aria-live="polite">{accepted===condition?"Change accepted in this demo":preview?"Proposed afternoon · not applied":"Your afternoon, before the change"}</div><div className="x-change-day" key={`${condition}-${active}`}><div><time>{active?c.time:"14:00"}</time><strong>{active?c.after:c.before}</strong><p>{active?c.reason:"A flexible idea for an afternoon in the old city."}</p></div><div className="x-fixed-dinner"><time>20:00</time><strong>Dinner with a view</strong><span>Fixed time · stays at eight</span></div></div><div className="x-change-actions">{accepted===condition?<button className="x-button" onClick={()=>{setAccepted(null);setPreview(false);}}>Restore the original afternoon</button>:preview?<><button className="x-button" onClick={()=>setAccepted(condition)}>Accept this change</button><button className="x-text-button" onClick={()=>setPreview(false)}>Keep the original</button></>:<button className="x-button" onClick={()=>setPreview(true)}>Preview an alternative</button>}<span>{active?`Estimated activity difference: ${c.delta>0?"+":""}${money(c.delta)}`:"Your fixed commitments stay visible."}</span></div>{accepted&&accepted!==condition?<small className="x-small">A {accepted.toLowerCase()} change is accepted in this demo. Accepting a new alternative will replace it.</small>:null}</div></div><p className="x-small x-change-disclaimer">Illustrative scenario, not a live forecast or validated route. Accepting a preview changes this demo only. Existing reservations are never changed automatically.</p></section>;
}

export function BudgetStudio() {
  const [nights,setNights]=useState(7);
  const [style,setStyle]=useState(0);
  const [ceiling,setCeiling]=useState(42000);
  const rates=[1800,2800,4200];
  const stays=nights*rates[style],food=(nights+1)*900,travel=5400,activities=2400,total=stays+food+travel+activities;
  const parts=[{name:"Stays",value:stays},{name:"Food",value:food},{name:"Travel",value:travel},{name:"Activities",value:activities}];
  return <section className="x-section x-budget"><Intro title={<>Less mental maths.<br />More room to enjoy it.</>} aside="Keep the trade-offs in view">A longer stay or a different room changes the numbers. Try it here and see what your budget has room for, before making a commitment.</Intro><div className="x-budget-body"><div className="x-budget-inputs"><label htmlFor="budget-limit">Your budget <strong>{money(ceiling)}</strong></label><input id="budget-limit" type="range" min={20000} max={80000} step={1000} value={ceiling} onChange={e=>setCeiling(Number(e.target.value))}/><div className="x-budget-nights"><span>How long to linger</span><div><button aria-label="One fewer night in the budget" disabled={nights===1} onClick={()=>setNights(n=>n-1)}>−</button><strong>{nights} nights</strong><button aria-label="One more night in the budget" onClick={()=>setNights(n=>n+1)}>+</button></div></div><span className="x-control-label">The kind of stay</span><div className="x-filter" aria-label="Accommodation budget style">{["Simple","Comfortable","A little special"].map((x,i)=><button key={x} aria-pressed={style===i} onClick={()=>setStyle(i)}>{x}</button>)}</div><p className="x-small">Sample allowances for two people sharing one room. Food is ₹900 per day for both in this example. Taxes, fees and travel to the first destination remain unknown.</p></div><div className="x-budget-summary" aria-live="polite"><span>Estimated trip subtotal</span><strong className="x-budget-number">{money(total)}</strong><div className="x-cost-bar" aria-hidden="true">{parts.map((p,i)=><span key={p.name} className={`x-cost-${i}`} style={{width:`${p.value/total*100}%`}}/>)}</div><dl>{parts.map(p=><div key={p.name}><dt>{p.name}</dt><dd>{money(p.value)}</dd></div>)}</dl><p className={total>ceiling?"x-over-budget":"x-under-budget"}>{total>ceiling?`${money(total-ceiling)} over your budget. Try fewer nights or a simpler stay.`:`${money(ceiling-total)} remaining before unknown costs.`}</p><small>Unpriced items stay visible. An estimate is a guide, not a guaranteed total.</small></div></div></section>;
}

const chapters=[
  {title:"First, a feeling.",body:"That mountain you keep thinking about. A street you want to get lost in. Save a few possibilities before you know how they fit.",image:"mountains",tag:"Ideas before decisions",detail:"Places, photos and traveler perspectives"},
  {title:"Then, a little shape.",body:"A stay near the water. A journey between towns. Some days with direction, some with nothing booked. Bring the pieces into one place.",image:"cabin",tag:"The whole trip, connected",detail:"Destinations, stays, transfers and free time"},
  {title:"And room for real life.",body:"A rainy afternoon or a slower morning doesn’t have to undo the trip. Review a different plan while keeping the things you’ve committed to.",image:"lake",tag:"You decide what changes",detail:"Clear alternatives. Fixed plans protected."},
];
export function ScrollStory() {
  const [active,setActive]=useState(0);
  const stories=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const items=stories.current?.querySelectorAll<HTMLElement>("[data-story]");
    const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting)setActive(Number((entry.target as HTMLElement).dataset.story));}),{rootMargin:"-32% 0px -40% 0px",threshold:0});
    items?.forEach(item=>observer.observe(item));
    return ()=>observer.disconnect();
  },[]);
  return <section className="x-story" aria-label="From a travel idea to a flexible plan"><div className="x-story-visual"><div className="x-story-sticky"><img key={chapters[active].image} src={photo(chapters[active].image)} alt={chapters[active].tag} loading="lazy"/><div className="x-story-caption" aria-live="polite"><span>{chapters[active].tag}</span><p>{chapters[active].detail}</p></div><div className="x-story-dots" aria-label="Choose a planning chapter">{chapters.map((c,i)=><button key={c.title} aria-label={`Read chapter: ${c.title}`} aria-pressed={active===i} onClick={()=>{stories.current?.querySelectorAll<HTMLElement>("[data-story]")[i].scrollIntoView({block:"center",behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"instant":"smooth"});setActive(i);}}/>)}</div></div></div><div className="x-story-copy" ref={stories}>{chapters.map((c,i)=><div className={active===i?"x-story-current":""} data-story={i} key={c.title}><span className="x-kicker">{c.tag}</span><h2>{c.title}</h2><p>{c.body}</p>{i===2?<a href="#changes" className="x-text-link">Try changing an afternoon</a>:null}</div>)}</div></section>;
}

const questions=[
  {q:"Do I need exact dates to begin?",a:"No. Start with destinations, a tentative window, or a duration. Exact forecasts and date-specific availability only make sense once dates are known."},
  {q:"Can a trip have more than one destination?",a:"Yes. Add, reorder or revisit destinations, change the stay lengths and leave free days. A trip doesn’t have to fit into a preset number of days."},
  {q:"Will the planner change my bookings?",a:"No. It proposes itinerary changes for you to review. Booked stays and fixed commitments stay visible; any reservation change is something you handle with the provider."},
  {q:"How do I know what information to trust?",a:"The planned experience shows sources, retrieval times and estimate labels where available. Coverage gaps stay visible. These design samples use illustrative data rather than live supplier information."},
];
export function Questions(){return <section className="x-section x-questions" id="questions"><div><span className="x-kicker">Before you wander</span><h2>A few things<br/>worth knowing.</h2><p>Less uncertainty about the planner.<br/>More curiosity about the trip.</p></div><div>{questions.map(x=><details key={x.q}><summary>{x.q}<span aria-hidden="true">+</span></summary><p>{x.a}</p></details>)}</div></section>}
export function ClosingScene({title,image="mountains"}:{title:string;image?:string}){return <section className="x-close"><img src={photo(image)} alt="A landscape to inspire your next time away" loading="lazy"/><div><p>A little further from the everyday.</p><h2>{title}</h2><a href="/trips/new" className="x-button">Start shaping your trip</a><a className="x-close-secondary" href="/trips/demo">Or explore a sample itinerary</a></div></section>}
