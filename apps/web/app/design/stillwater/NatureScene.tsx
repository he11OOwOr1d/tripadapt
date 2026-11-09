"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { LandscapePainter } from "./LandscapePainter";
import type { LandscapeKind } from "./LandscapePainter";
import "./nature-scene.css";
export type SceneKind = LandscapeKind;
const Motion = createContext({ paused: false, breezy: false });
export function SceneMotionProvider({
  paused,
  breezy,
  children,
}: {
  paused: boolean;
  breezy: boolean;
  children: ReactNode;
}) {
  const value = useMemo(() => ({ paused, breezy }), [paused, breezy]);
  return <Motion.Provider value={value}>{children}</Motion.Provider>;
}
export default function NatureScene({
  kind = "valley",
  hero = false,
  label,
}: {
  kind?: SceneKind;
  hero?: boolean;
  label?: string;
}) {
  const root = useRef<HTMLDivElement>(null),
    canvas = useRef<HTMLCanvasElement>(null),
    controller = useRef<(() => void) | null>(null);
  const motion = useContext(Motion),
    motionRef = useRef(motion);
  const [active, setActive] = useState(false);
  useEffect(() => {
    motionRef.current = motion;
    controller.current?.();
  }, [motion]);
  useEffect(() => {
    const element = root.current,
      surface = canvas.current;
    if (!element || !surface) return;
    const context = surface.getContext("2d", { alpha: false });
    if (!context) return;
    let painter: LandscapePainter | undefined,
      frame = 0,
      visible = false,
      disposed = false,
      last = 0,
      time = 0,
      wind = 1,
      w = 0,
      h = 0,
      dpr = 1,
      lastDiagnostic = 0;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    function dimensions() {
      if (!element || !surface) return;
      const r = element.getBoundingClientRect();
      w = Math.max(1, r.width);
      h = Math.max(1, r.height);
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      surface.width = Math.round(w * dpr);
      surface.height = Math.round(h * dpr);
    }
    function draw(now: number) {
      if (disposed || !visible || !context || !element) return;
      if (!painter) painter = new LandscapePainter(kind);
      const delta = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      const stopped = motionRef.current.paused || reduced.matches;
      if (!stopped) time += delta;
      const target = motionRef.current.breezy ? 1.9 : 1;
      wind += Math.min(1, delta * 2) * (target - wind);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      painter.draw(
        context,
        w,
        h,
        time,
        reduced.matches ? 0 : wind,
        hero && w < 750,
      );
      element.dataset.motion = stopped ? "paused" : "playing";
      if (now - lastDiagnostic > 400) {
        element.dataset.sceneTime = time.toFixed(2);
        element.dataset.wind = wind.toFixed(2);
        element.dataset.motion = stopped ? "paused" : "playing";
        lastDiagnostic = now;
      }
      if (!stopped) frame = requestAnimationFrame(draw);
    }
    function restart() {
      cancelAnimationFrame(frame);
      last = 0;
      if (visible && !disposed) frame = requestAnimationFrame(draw);
    }
    controller.current = restart;
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        setActive(visible);
        if (visible) {
          dimensions();
          restart();
        } else {
          cancelAnimationFrame(frame);
          element.dataset.motion = "offscreen";
          last = 0;
        }
      },
      { rootMargin: "120px" },
    );
    observer.observe(element);
    const resize = new ResizeObserver(() => {
      if (visible) {
        dimensions();
        restart();
      }
    });
    resize.observe(element);
    reduced.addEventListener("change", restart);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      resize.disconnect();
      reduced.removeEventListener("change", restart);
      controller.current = null;
    };
  }, [kind, hero]);
  return (
    <div
      ref={root}
      className={`nature-scene ns-painted ${hero ? "ns-hero" : "ns-panel"} ns-${kind}`}
      data-active={active}
      role="img"
      aria-label={
        label ||
        `Code-drawn ${kind} landscape with natural wind and water motion`
      }
    >
      <canvas ref={canvas} aria-hidden="true" />
    </div>
  );
}
