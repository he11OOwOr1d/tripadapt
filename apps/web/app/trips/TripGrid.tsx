"use client";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { AgendaDay, AgendaItem } from "../../lib/trips/trip-agenda";
import { GRID_DAYS, GRID_DAY_CHOICES, gridPages, pageAfterResize } from "../../lib/trips/trip-grid";
import { GRID_DAYS_KEY, readPref, writePref } from "../../lib/trips/view-prefs";

const HOUR_PX = 56;
const CHIP_PX = 44;
const hourLabel = (h: number) => `${String(h).padStart(2, "0")}:00`;
/** The full text of a line, for the tooltip. */
const full = (i: AgendaItem) => [i.when || (i.kind === "stay" ? "All day" : ""), i.title, i.skipped ? "skipped" : "", i.note].filter(Boolean).join(" · ");

/** The days as columns against a local clock, five to a page. Read-only: a block opens that day in the day view. */
export default function TripGrid({ days, onOpen }: { days: AgendaDay[]; onOpen: (stopId: string, day: number) => void }) {
  const [per, setPer] = useState<number>(GRID_DAYS);
  // The remembered page size is read after mount so the first render matches the server's.
  useEffect(() => { setPer(Number(readPref(GRID_DAYS_KEY, ["3", "5"] as const, String(GRID_DAYS)))); }, []);
  const pages = useMemo(() => gridPages(days, per), [days, per]);
  const [index, setIndex] = useState(0);
  if (pages.length === 0) return null;
  const at = Math.min(index, pages.length - 1), page = pages[at];
  const first = page.columns[0].day, last = page.columns[page.columns.length - 1].day;
  const band = Math.max(...page.columns.map((c) => c.allDay.length)) * CHIP_PX;
  const height = (page.to - page.from) * HOUR_PX;
  const px = (minutes: number) => ((minutes - page.from * 60) * HOUR_PX) / 60;
  const choose = (size: number) => { if (size === per) return; setIndex(pageAfterResize(at, per, size)); setPer(size); writePref(GRID_DAYS_KEY, String(size)); };
  const press = (item: AgendaItem) => item.open && onOpen(item.open.stopId, item.open.day);
  const hours = Array.from({ length: page.to - page.from }, (_, k) => page.from + k);
  return <div className="trip-grid">
    <div className="grid-per"><span id="grid-per-label">Days per page</span>
      <div role="group" aria-labelledby="grid-per-label">{GRID_DAY_CHOICES.map((n) => <button key={n} type="button" aria-pressed={per === n} onClick={() => choose(n)}>{n} days</button>)}</div>
    </div>
    <div className="grid-nav">
      <button type="button" disabled={at === 0} onClick={() => setIndex(at - 1)}>Earlier days</button>
      <p role="status">{first.label}{first.date !== last.date ? ` to ${last.label}` : ""} · page {at + 1} of {pages.length}</p>
      <button type="button" disabled={at === pages.length - 1} onClick={() => setIndex(at + 1)}>Later days</button>
    </div>
    <div className="grid-body" style={{ gridTemplateColumns: `3rem repeat(${page.columns.length}, minmax(0, 1fr))` }}>
      <div className="grid-axis" aria-hidden="true">
        <div className="grid-head" />
        <div style={{ height: band }} />
        <div className="grid-hours" style={{ height }}>{hours.map((h) => <span key={h} style={{ top: (h - page.from) * HOUR_PX }}>{hourLabel(h)}</span>)}</div>
      </div>
      {page.columns.map(({ day, allDay, blocks }) => <section key={day.date} className="grid-col" aria-label={`${day.label}, ${day.place}`}>
        <header className="grid-head"><time dateTime={day.date}>{day.label}</time><span>{day.tripDay ? `Day ${day.tripDay} · ` : ""}{day.place}</span></header>
        <ul className="grid-allday" style={{ height: band }}>
          {allDay.map((item) => <li key={item.key} className={`grid-chip kind-${item.kind}`}>
            {item.open ? <button type="button" title={full(item)} onClick={() => press(item)}><span>{item.title}</span><span className="sr-only">{item.when ? `, ${item.when}` : ""}. Opens day {item.open.day} in {item.open.stopName}</span></button> : <div title={full(item)}><span>{item.title}</span><span className="sr-only">{item.when ? `, ${item.when}` : ""}</span></div>}
          </li>)}
        </ul>
        <ul className="grid-hours" style={{ height }}>
          {blocks.map(({ item, start, end, lane, lanes }) => {
            const tall = Math.max(30, px(end) - px(start) - 2);
            return <li key={item.key} data-full={full(item)} className={`grid-block kind-${item.kind}${item.skipped ? " is-skipped" : ""}`}
              style={{ top: px(start), height: tall, "--grid-h": `${tall}px`, left: `calc(${lane} * 100% / ${lanes})`, width: `calc(100% / ${lanes} - 2px)` } as CSSProperties}>
            {item.open ? <button type="button" onClick={() => press(item)}>
              <span className="grid-block-time">{item.when}</span><span className="grid-block-title">{item.title}</span>
              <span className="sr-only">{item.skipped ? ", skipped" : ""}. Opens day {item.open.day} in {item.open.stopName}</span>
            </button> : <div><span className="grid-block-time">{item.when}</span><span className="grid-block-title">{item.title}</span>{item.skipped && <span className="sr-only">, skipped</span>}</div>}
            </li>;
          })}
        </ul>
      </section>)}
    </div>
    <p className="grid-note">Each column is that day's clock at the place you are. A journey is drawn from its departure for as long as it really takes, so a flight across time zones can look longer than its two clock times suggest; one that crosses midnight carries on in the next day's column. Hover over or focus a crowded block to read it in full.</p>
  </div>;
}
