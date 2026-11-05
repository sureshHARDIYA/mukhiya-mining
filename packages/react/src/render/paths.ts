import type { LayoutNode } from "@mukhiya-mining/core";

export interface Point {
  x: number;
  y: number;
}

/** Catmull-Rom spline through the layout points, emitted as cubic Béziers. */
export function smoothPath(points: readonly Point[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M${points[0]?.x} ${points[0]?.y}`;
  if (points.length === 2) {
    const [a, b] = points as [Point, Point];
    return `M${a.x} ${a.y} L${b.x} ${b.y}`;
  }
  let d = `M${(points[0] as Point).x} ${(points[0] as Point).y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)] as Point;
    const p1 = points[i] as Point;
    const p2 = points[i + 1] as Point;
    const p3 = points[Math.min(points.length - 1, i + 2)] as Point;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${c1x} ${c1y} ${c2x} ${c2y} ${p2.x} ${p2.y}`;
  }
  return d;
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
  return 9 + strokeWidth * 1.9;
}

export function arrowHalfWidth(size: number): number {
  return size * 0.4;
}

/**
 * Route an edge the way a layered diagram reads best: leave the source downward, enter the target
 * downward, with one smooth S-curve. Falls back to the spline through the layout points for
 * backward edges (target above source), where the router's detour is needed. Forward edges ignore
 * the router's bends on purpose: one gentle curve reads better than a faithful wobble.
 */
export function routePath(points: readonly Point[]): { d: string; points: Point[] } {
  if (points.length < 2) return { d: smoothPath(points), points: [...points] };
  const start = points[0] as Point;
  const end = points[points.length - 1] as Point;
  const dy = end.y - start.y;
  if (dy < 24) return { d: smoothPath(points), points: [...points] };
  const pull = Math.max(16, Math.min(dy * 0.42, 110));
  const c1 = { x: start.x, y: start.y + pull };
  const c2 = { x: end.x, y: end.y - pull };
  return {
    d: `M${start.x} ${start.y} C${c1.x} ${c1.y} ${c2.x} ${c2.y} ${end.x} ${end.y}`,
    points: [start, end],
  };
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
