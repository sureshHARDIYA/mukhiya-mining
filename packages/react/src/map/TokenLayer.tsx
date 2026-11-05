import { useEffect, useMemo, useRef } from "react";
import type { Scene } from "../render/scene";
import { type Geometry, sampleGeometry, type Track, tokenPosition } from "./animation";

interface Props {
  scene: Scene;
  tracks: Track[];
  /** Current log time; read through a ref so the frame loop never re-renders React. */
  timeRef: React.MutableRefObject<number>;
  playing: boolean;
  /** Element containing the map SVG; its [data-id] nodes and edges get the is-active class. */
  host: HTMLElement | null;
  radius?: number;
}

/** A pool of circles moved imperatively every frame. */
export function TokenLayer({ scene, tracks, timeRef, playing, host, radius = 4 }: Readonly<Props>) {
  const group = useRef<SVGGElement>(null);
  const geometry = useMemo<Geometry>(() => sampleGeometry(scene), [scene]);
  const pool = useMemo(() => tracks.map((t) => t.caseId), [tracks]);
  const targets = useMemo(() => {
    const map = new Map<string, Element>();
    for (const el of host?.querySelectorAll("[data-id]") ?? [])
      map.set((el as HTMLElement | SVGElement).dataset.id as string, el);
    return map;
  }, [host]);

  useEffect(() => {
    const g = group.current;
    if (!g) return;
    let frame = 0;
    const active = new Set<string>();
    const draw = () => {
      paint(g, tracks, timeRef.current, geometry, targets, active);
      if (playing) frame = requestAnimationFrame(draw);
    };
    draw();
    const interval = playing ? 0 : window.setInterval(draw, 120);
    return () => {
      cancelAnimationFrame(frame);
      if (interval) window.clearInterval(interval);
      for (const id of active) targets.get(id)?.classList.remove("is-active");
    };
  }, [tracks, geometry, playing, timeRef, targets]);

  return (
    <g ref={group} className="pm-tokens" pointerEvents="none">
      {pool.map((id) => (
        <circle key={id} r={radius} className="pm-token" opacity="0" />
      ))}
    </g>
  );
}

function paint(
  g: SVGGElement,
  tracks: Track[],
  t: number,
  geometry: Geometry,
  targets: Map<string, Element>,
  active: Set<string>,
): void {
  const circles = g.children;
  const now = new Set<string>();
  for (let i = 0; i < tracks.length; i++) {
    const el = circles[i] as SVGCircleElement | undefined;
    if (!el) break;
    const p = tokenPosition(tracks[i] as Track, t, geometry);
    if (!p) {
      el.setAttribute("opacity", "0");
      continue;
    }
    now.add(p.on);
    el.setAttribute("opacity", "1");
    el.setAttribute("cx", String(p.x));
    el.setAttribute("cy", String(p.y));
  }
  for (const id of active) if (!now.has(id)) targets.get(id)?.classList.remove("is-active");
  for (const id of now) if (!active.has(id)) targets.get(id)?.classList.add("is-active");
  active.clear();
  for (const id of now) active.add(id);
}
