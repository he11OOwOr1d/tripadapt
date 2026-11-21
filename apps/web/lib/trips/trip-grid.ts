import type { AgendaDay, AgendaItem } from "./trip-agenda";

/** Days shown side by side on one page of the grid. */
export const GRID_DAYS = 5;
/** The page sizes offered. Three days leaves a crowded day about 60% more width per lane. */
export const GRID_DAY_CHOICES = [3, 5] as const;

/**
 * The page to show after the page size changes, so the first day on screen stays on screen: page `index` of `oldSize`
 * days starts at day `index * oldSize`, which lives on page `floor(start / newSize)` of the new size.
 */
export function pageAfterResize(index: number, oldSize: number, newSize: number): number {
  if (!(oldSize >= 1) || !(newSize >= 1) || !(index >= 0)) return 0;
  return Math.floor((Math.floor(index) * Math.floor(oldSize)) / Math.floor(newSize));
}

/** A line shorter than this is drawn this tall, so it can be read and pressed. */
export const MIN_BLOCK_MINUTES = 30;

export type GridBlock = {
  item: AgendaItem;
  /** Minutes after local midnight where the block starts and where it is drawn to (never shorter than MIN_BLOCK_MINUTES). */
  start: number;
  end: number;
  /** Which side-by-side lane it sits in, and how many lanes share its stretch of the day. */
  lane: number;
  lanes: number;
};

export type GridColumn = {
  day: AgendaDay;
  /** Lines with no real times (a stay's check-in, staying, check-out), shown in a band above the hours. */
  allDay: AgendaItem[];
  blocks: GridBlock[];
};

export type GridPage = {
  /** The hour the axis starts at and the hour it ends at (0 to 24). */
  from: number;
  to: number;
  columns: GridColumn[];
};

/**
 * Side-by-side lanes for spans that overlap, so none hides another. Spans that overlap, directly or through a chain, share
 * a stretch of lanes; a span with nothing beside it gets the whole width. Input order is kept in the result.
 */
export function packLanes(spans: { start: number; end: number }[]): { lane: number; lanes: number }[] {
  const order = spans.map((_, i) => i).sort((a, b) => spans[a].start - spans[b].start || spans[a].end - spans[b].end || a - b);
  const out: { lane: number; lanes: number }[] = spans.map(() => ({ lane: 0, lanes: 1 }));
  let cluster: number[] = [], clusterEnd = -Infinity, laneEnds: number[] = [];
  const close = () => { for (const i of cluster) out[i].lanes = Math.max(1, laneEnds.length); cluster = []; laneEnds = []; clusterEnd = -Infinity; };
  for (const i of order) {
    const { start, end } = spans[i];
    if (cluster.length && start >= clusterEnd) close();
    let lane = laneEnds.findIndex((e) => e <= start);
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(end); } else laneEnds[lane] = end;
    out[i].lane = lane;
    cluster.push(i);
    clusterEnd = Math.max(clusterEnd, end);
  }
  close();
  return out;
}

/** The days split into pages of `perPage`, each with the hours it needs and its lines placed. */
export function gridPages(days: AgendaDay[], perPage: number = GRID_DAYS): GridPage[] {
  const size = Math.max(1, Math.floor(perPage));
  const pages: GridPage[] = [];
  for (let i = 0; i < days.length; i += size) {
    const columns: GridColumn[] = days.slice(i, i + size).map((day) => {
      const timed = day.items.filter((x): x is AgendaItem & { startMin: number; endMin: number } => x.startMin !== null && x.endMin !== null);
      const spans = timed.map((x) => ({ start: x.startMin, end: Math.max(x.endMin, x.startMin + MIN_BLOCK_MINUTES) }));
      const lanes = packLanes(spans);
      return {
        day,
        allDay: day.items.filter((x) => x.startMin === null || x.endMin === null),
        blocks: timed.map((item, k) => ({ item, start: spans[k].start, end: Math.min(spans[k].end, 1440), lane: lanes[k].lane, lanes: lanes[k].lanes })),
      };
    });
    const blocks = columns.flatMap((c) => c.blocks);
    // Always show a working day, and stretch to fit anything earlier or later.
    const from = blocks.length ? Math.min(8, Math.floor(Math.min(...blocks.map((b) => b.start)) / 60)) : 8;
    const to = blocks.length ? Math.max(20, Math.ceil(Math.max(...blocks.map((b) => b.end)) / 60)) : 20;
    pages.push({ from: Math.max(0, from), to: Math.min(24, to), columns });
  }
  return pages;
}
