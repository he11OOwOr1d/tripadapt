"use client";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import { Map as MapLibreMap, Marker, setWorkerUrl, type GeoJSONSource, type StyleSpecification } from "maplibre-gl";
import type { MapModel } from "../../lib/trips/day-map";

// Public by design: a browser map key is visible in requests. It is a separate
// Geoapify key, so leaking it cannot expose the backend key. Without one the
// map still draws markers and lines over a plain background.
const KEY = process.env.NEXT_PUBLIC_GEOAPIFY_MAP_KEY ?? "";
const BLANK: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: "background", type: "background", paint: { "background-color": "#e6e8da" } }],
};
const STYLE: StyleSpecification | string = KEY
  ? `https://maps.geoapify.com/v1/styles/osm-bright/style.json?apiKey=${encodeURIComponent(KEY)}`
  : BLANK;
export const BASEMAP_CREDIT = KEY
  ? "Map: Powered by Geoapify · © OpenMapTiles · © OpenStreetMap contributors"
  : "No basemap loaded: markers show positions only. Place data © OpenStreetMap contributors.";
const LINKS = "day-map-links";
// Served from /public by scripts/copy-maplibre-worker.mjs.
let workerReady = false;

export default function DayMap({ model, selectedId, onSelect }: { model: MapModel; selectedId?: string; onSelect: (id: string) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const pins = useRef(new Map<string, { marker: Marker; el: HTMLButtonElement }>());
  const onSelectRef = useRef(onSelect);
  const modelRef = useRef(model);
  const [state, setState] = useState<"loading" | "ready" | "plain" | "unsupported">("loading");
  const [notice, setNotice] = useState("");
  const loaded = useRef(false);
  onSelectRef.current = onSelect;
  modelRef.current = model;
  const signature = model.points.map((p) => `${p.id}:${p.lng},${p.lat}`).join("|");

  // Create the map once. It never reads trip data directly.
  useEffect(() => {
    if (!box.current) return;
    let instance: MapLibreMap;
    try {
      if (!workerReady) {
        setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
        workerReady = true;
      }
      instance = new MapLibreMap({
        container: box.current,
        style: STYLE,
        center: [0, 20],
        zoom: 1,
        // Two-finger pan on touch devices, so the page can still scroll past the map.
        cooperativeGestures: true,
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        attributionControl: { compact: true },
      });
    } catch {
      setState("unsupported");
      return;
    }
    map.current = instance;
    let tileFailures = 0;
    const ensureLayer = () => {
      if (instance.getSource(LINKS)) return;
      instance.addSource(LINKS, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      instance.addLayer({ id: LINKS, type: "line", source: LINKS, paint: { "line-color": "#476442", "line-width": 2.5, "line-dasharray": [2, 2] } });
    };
    instance.on("style.load", () => {
      ensureLayer();
      loaded.current = true;
      setState((s) => (s === "loading" ? "ready" : s));
      setLinks();
    });
    instance.on("error", (event) => {
      const status = (event.error as { status?: number } | undefined)?.status;
      if (!instance.isStyleLoaded() && STYLE !== BLANK) {
        // The basemap style itself failed (bad key, quota or network): keep the map useful.
        setNotice("The basemap could not load, so only positions are shown.");
        setState("plain");
        loaded.current = false;
        instance.setStyle(BLANK);
      } else if (status && [401, 402, 403, 429].includes(status) && ++tileFailures === 3) {
        setNotice("Map tiles are unavailable right now (key or usage limit). Markers still show positions.");
      }
    });
    // Exposed for automated browser checks: how much the map has actually drawn.
    instance.on("idle", () => {
      if (box.current) {
        box.current.dataset.idle = "true";
        box.current.dataset.rendered = String(instance.queryRenderedFeatures().length);
      }
    });
    const resize = new ResizeObserver(() => instance.resize());
    resize.observe(box.current);
    const current = pins.current;
    return () => {
      resize.disconnect();
      current.forEach(({ marker }) => marker.remove());
      current.clear();
      instance.remove();
      map.current = null;
      loaded.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setLinks() {
    const m = map.current;
    const source = m?.getSource(LINKS) as GeoJSONSource | undefined;
    if (!m || !source) return;
    const current = modelRef.current;
    const at = new Map(current.points.map((p) => [p.id, [p.lng, p.lat]]));
    const lines = current.links.flatMap((l) => (at.has(l.from) && at.has(l.to) ? [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [at.get(l.from), at.get(l.to)] } }] : []));
    source.setData({ type: "FeatureCollection", features: lines } as Parameters<GeoJSONSource["setData"]>[0]);
  }

  // Sync markers, lines and the camera whenever the points change.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const sync = () => {
      const wanted = new Set(model.points.map((p) => p.id));
      pins.current.forEach((pin, id) => {
        if (!wanted.has(id)) {
          pin.marker.remove();
          pins.current.delete(id);
        }
      });
      for (const p of model.points) {
        const label = p.kind === "stop" && p.order === 0 ? `${p.label}, destination centre` : `${p.kind === "stop" ? "Destination" : "Visit"} ${p.order}: ${p.label}, ${p.detail}`;
        let pin = pins.current.get(p.id);
        if (!pin) {
          const el = document.createElement("button");
          el.type = "button";
          el.className = `map-pin ${p.kind === "stop" ? "is-stop" : ""}`;
          el.addEventListener("click", (event) => {
            event.stopPropagation();
            onSelectRef.current(p.id);
          });
          pin = { marker: new Marker({ element: el }).setLngLat([p.lng, p.lat]).addTo(m), el };
          pins.current.set(p.id, pin);
        }
        pin.marker.setLngLat([p.lng, p.lat]);
        pin.el.textContent = p.order > 0 ? String(p.order) : "◆";
        pin.el.setAttribute("aria-label", label);
        pin.el.title = label;
      }
      setLinks();
      if (model.bounds) m.fitBounds(model.bounds, { padding: { top: 56, right: 56, left: 56, bottom: 84 }, maxZoom: 15, duration: 0 });
      else if (model.center) m.jumpTo({ center: model.center, zoom: 14 });
    };
    if (loaded.current || m.isStyleLoaded()) sync();
    else m.once("style.load", sync);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, state]);

  // Highlight the selected marker and keep it in view.
  useEffect(() => {
    pins.current.forEach(({ el }, id) => {
      const selected = id === selectedId;
      el.classList.toggle("is-selected", selected);
      el.setAttribute("aria-pressed", String(selected));
    });
    const m = map.current, p = model.points.find((x) => x.id === selectedId);
    if (m && p && !m.getBounds().contains([p.lng, p.lat])) {
      const calm = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
      m.easeTo({ center: [p.lng, p.lat], duration: calm ? 0 : 300 });
    }
  }, [selectedId, signature, state, model.points]);

  return (
    <div className="day-map">
      <div ref={box} className="day-map-canvas" role="group" aria-label="Map of the planned places" hidden={state === "unsupported"} />
      {state === "loading" && <p role="status">Loading the map…</p>}
      {state === "unsupported" && <p role="status">This browser can’t draw the map. Your timeline is unaffected.</p>}
      {notice && <p role="status">{notice}</p>}
      <small className="provider-attribution">{state === "plain" ? "No basemap loaded: markers show positions only. Place data © OpenStreetMap contributors." : BASEMAP_CREDIT}</small>
    </div>
  );
}
