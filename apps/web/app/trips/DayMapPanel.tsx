"use client";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import type { Activity, Stop } from "../../lib/trips/adapter";
import type { Lodging } from "../../lib/trips/lodging";
import { dayMapModel, mapSummary, routeMapModel, type MapScope } from "../../lib/trips/day-map";

// MapLibre is large, so it loads only after someone opens the map.
const DayMap = dynamic(() => import("./DayMap"), { ssr: false, loading: () => <p role="status">Loading the map…</p> });

export default function DayMapPanel({ stop, stops, activities, lodging, open, onOpenChange, selectedId, onSelect }: {
  stop: Stop; stops: Stop[]; activities: Activity[]; lodging?: Lodging | null; open: boolean; onOpenChange: (open: boolean) => void;
  selectedId?: string; onSelect: (id: string) => void;
}) {
  const [scope, setScope] = useState<MapScope>("day");
  const model = useMemo(() => (scope === "day" ? dayMapModel(stop, activities, lodging) : routeMapModel(stops)), [scope, stop, stops, activities, lodging]);
  const selected = model.points.find((p) => p.id === selectedId);
  return <section className="day-map-panel" aria-label={`Map of ${stop.name}`}>
    <div className="day-map-head">
      <button type="button" aria-expanded={open} onClick={() => onOpenChange(!open)}>{open ? "Hide map" : "Show on map"}</button>
      {open && <div role="group" aria-label="Map view">
        <button type="button" aria-pressed={scope === "day"} onClick={() => setScope("day")}>This day</button>
        <button type="button" aria-pressed={scope === "route"} onClick={() => setScope("route")}>Whole route</button>
      </div>}
    </div>
    {open && <>
      <DayMap model={model} selectedId={selectedId} onSelect={onSelect} />
      <p role="status">{selected ? `Selected: ${selected.label} · ${selected.detail}. ` : ""}{mapSummary(model)}</p>
      {model.links.length > 0 && <small>Dashed lines join places in order. They are straight lines, not routes; use the journey check for travel time.</small>}
      {model.unmapped.length > 0 && <small>Without a map location: {model.unmapped.map((u) => u.label).join(", ")}. Use Edit or move to link one.</small>}
    </>}
  </section>;
}
