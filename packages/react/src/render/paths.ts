import type { LayoutNode } from "@mukhiya-mining/core";

export interface Point {
  x: number;
  y: number;
}

/**
 * Polyline with rounded corners: straight runs joined by quadratic arcs, like a dot spline. Never
 * overshoots a bend, which keeps detours and back edges calm.
 */
export function smoothPath(points: readonly Point[], radius = 28): string {
  if (points.length === 0) return "";
  const first = points[0] as Point;
  if (points.length === 1) return `M${first.x} ${first.y}`;
  let d = `M${first.x} ${first.y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i - 1] as Point;
    const b = points[i] as Point;
    const c = points[i + 1] as Point;
    const inLen = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const outLen = Math.hypot(c.x - b.x, c.y - b.y) || 1;
    const r = Math.min(radius, inLen / 2, outLen / 2);
    const p = { x: b.x - ((b.x - a.x) / inLen) * r, y: b.y - ((b.y - a.y) / inLen) * r };
    const q = { x: b.x + ((c.x - b.x) / outLen) * r, y: b.y + ((c.y - b.y) / outLen) * r };
    d += ` L${p.x} ${p.y} Q${b.x} ${b.y} ${q.x} ${q.y}`;
  }
  const last = points[points.length - 1] as Point;
  return `${d} L${last.x} ${last.y}`;
}

/** Pull the last point back along the final segment so the arrowhead tip lands on the node edge. */
export function shortenEnd(points: readonly Point[], by: number): Point[] {
  if (points.length < 2) return [...points];
  const result = [...points];
  const last = result[result.length - 1] as Point;
  const prev = result[result.length - 2] as Point;
  const dx = last.x - prev.x;
  const dy = last.y - prev.y;
  const length = Math.hypot(dx, dy) || 1;
  result[result.length - 1] = { x: last.x - (dx / length) * by, y: last.y - (dy / length) * by };
  return result;
}

/** Filled triangle whose tip is at `tip`, pointing in the direction from `from` to `tip`. */
export function arrowHead(from: Point, tip: Point, size: number): string {
  const dx = tip.x - from.x;
  const dy = tip.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  const bx = tip.x - ux * size;
  const by = tip.y - uy * size;
  const half = arrowHalfWidth(size);
  // Slightly concave base so the stroke appears to flow into the head without a step.
  const nx = tip.x - ux * size * 0.85;
  const ny = tip.y - uy * size * 0.85;
  return `M${tip.x} ${tip.y} L${bx - uy * half} ${by + ux * half} L${nx} ${ny} L${bx + uy * half} ${by - ux * half} Z`;
}

/** Head length grows with the stroke so thick paths get the big, calm arrows of the reference. */
export function arrowSize(strokeWidth: number): number {
  return 7 + strokeWidth * 1.6;
}

export function arrowHalfWidth(size: number): number {
  return size * 0.4;
}

/**
 * Route an edge along the layout's points: a straight line between neighbouring ranks, a gentle
 * spline where the router detours around nodes. Collinear bends are dropped so direct edges stay
 * straight even when dagre emits a midpoint.
 */
export function routePath(points: readonly Point[]): { d: string; points: Point[] } {
  const kept = dropCollinear(points);
  return { d: smoothPath(kept), points: kept };
}

function dropCollinear(points: readonly Point[]): Point[] {
  if (points.length < 3) return [...points];
  const out: Point[] = [points[0] as Point];
  for (let i = 1; i < points.length - 1; i++) {
    const a = out[out.length - 1] as Point;
    const b = points[i] as Point;
    const c = points[i + 1] as Point;
    const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    const len = Math.hypot(c.x - a.x, c.y - a.y) || 1;
    if (Math.abs(cross) / len > 2) out.push(b);
  }
  out.push(points[points.length - 1] as Point);
  return out;
}

/** Midpoint of a polyline by arc length, with the local direction. */
export function midpoint(points: readonly Point[]): { point: Point; angle: number } {
  if (points.length === 0) return { point: { x: 0, y: 0 }, angle: 0 };
  if (points.length === 1) return { point: points[0] as Point, angle: 0 };
  let total = 0;
  const lengths: number[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i] as Point;
    const b = points[i + 1] as Point;
    const l = Math.hypot(b.x - a.x, b.y - a.y);
    lengths.push(l);
    total += l;
  }
  let remaining = total / 2;
  for (let i = 0; i < lengths.length; i++) {
    const l = lengths[i] as number;
    if (remaining <= l || i === lengths.length - 1) {
      const a = points[i] as Point;
      const b = points[i + 1] as Point;
      const t = l === 0 ? 0 : remaining / l;
      return {
        point: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t },
        angle: Math.atan2(b.y - a.y, b.x - a.x),
      };
    }
    remaining -= l;
  }
  return { point: points[0] as Point, angle: 0 };
}

/** A loop leaving the right side of a node and re-entering below it. */
export function selfLoop(
  node: LayoutNode,
  radius = 22,
): { path: string; points: Point[]; label: Point } {
  const right = node.x + node.width / 2;
  const top = node.y - node.height / 4;
  const bottom = node.y + node.height / 4;
  const far = right + radius * 1.6;
  const path = `M${right} ${top} C${far} ${top - radius} ${far} ${bottom + radius} ${right} ${bottom}`;
  const points = [
    { x: right + radius * 0.9, y: bottom + radius * 0.2 },
    { x: right, y: bottom },
  ];
  return { path, points, label: { x: far + 4, y: node.y } };
}
