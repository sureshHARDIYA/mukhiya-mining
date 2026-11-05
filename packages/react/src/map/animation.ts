import { caseEvents, type Dfg, END_NODE, type LogView, START_NODE } from "@mukhiya-mining/core";
import type { Scene } from "../render/scene";

export type AnimationMode = "realtime" | "synced";

export interface Step {
  node: string;
  start: number;
  end: number;
}

export interface Track {
  caseId: number;
  steps: Step[];
  start: number;
  end: number;
}

export interface Tracks {
  tracks: Track[];
  /** Earliest start and latest end over the sampled tracks. */
  timeStart: number;
  timeEnd: number;
  /** Longest case duration, the span used by synchronised mode. */
  maxDuration: number;
  sampled: number;
  total: number;
}

/** Log-time the token spends entering from Start and leaving to End. */
const APPROACH_MS = 15_000;
/** Web logs have near-zero gaps between pages; stretch hops so tokens travel instead of teleport. */
const MIN_TRAVEL_MS = 20_000;

export type Sampling = "window" | "spread";

/**
 * One track per sampled case, projected onto the activities shown in the DFG.
 * "window" takes the `limit` consecutive cases (by start time) that span the shortest time, i.e. the
 * busiest stretch of the log, so a real-time replay shows many cases at once;
 * "spread" takes every n-th case, which suits synchronised starts.
 */
export function buildTracks(
  view: LogView,
  dfg: Dfg,
  limit = 1500,
  sampling: Sampling = "spread",
): Tracks {
  const { log } = view;
  const hidden = new Set(dfg.hiddenActivities);
  const ids: number[] = [];
  for (let c = 0; c < log.cases.length; c++) if (view.caseMask[c] === 1) ids.push(c);
  let offset = 0;
  if (sampling === "window") {
    ids.sort((a, b) => (log.caseStartTime[a] as number) - (log.caseStartTime[b] as number));
    offset = densestWindow(ids, log.caseStartTime, limit);
  }
  const stride = sampling === "window" ? 1 : Math.max(1, Math.ceil(ids.length / limit));
  const tracks: Track[] = [];
  let timeStart = Number.POSITIVE_INFINITY;
  let timeEnd = Number.NEGATIVE_INFINITY;
  let maxDuration = 0;
  for (let i = offset; i < ids.length && tracks.length < limit; i += stride) {
    const track = buildTrack(view, ids[i] as number, hidden);
    if (!track) continue;
    tracks.push(track);
    if (track.start < timeStart) timeStart = track.start;
    if (track.end > timeEnd) timeEnd = track.end;
    if (track.end - track.start > maxDuration) maxDuration = track.end - track.start;
  }
  tracks.sort((a, b) => a.start - b.start);
  return { tracks, timeStart, timeEnd, maxDuration, sampled: tracks.length, total: ids.length };
}

/** Index into `sorted` where the `limit` consecutive cases with the smallest start-time span begin. */
function densestWindow(sorted: number[], startTime: Float64Array, limit: number): number {
  if (sorted.length <= limit) return 0;
  let best = 0;
  let bestSpan = Number.POSITIVE_INFINITY;
  for (let i = 0; i + limit <= sorted.length; i++) {
    const span =
      (startTime[sorted[i + limit - 1] as number] as number) -
      (startTime[sorted[i] as number] as number);
    if (span < bestSpan) {
      bestSpan = span;
      best = i;
    }
  }
  return best;
}

function buildTrack(view: LogView, caseId: number, hidden: Set<number>): Track | null {
  const { log } = view;
  const [from, to] = caseEvents(log, caseId);
  const steps: Step[] = [];
  let shift = 0;
  for (let e = from; e < to; e++) {
    const a = log.eventActivity[e] as number;
    if (hidden.has(a)) continue;
    const previous = steps[steps.length - 1];
    let start = (log.eventStart[e] as number) + shift;
    if (previous && start - previous.end < MIN_TRAVEL_MS) {
      shift += previous.end + MIN_TRAVEL_MS - start;
      start = previous.end + MIN_TRAVEL_MS;
    }
    const rawEnd = log.eventEnd[e] as number;
    const end = Number.isNaN(rawEnd) ? start : rawEnd + shift;
    steps.push({ node: String(a), start, end: Math.max(start, end) });
  }
  if (steps.length === 0) return null;
  const first = steps[0] as Step;
  const last = steps[steps.length - 1] as Step;
  return { caseId, steps, start: first.start - APPROACH_MS, end: last.end + APPROACH_MS };
}

export interface Point {
  x: number;
  y: number;
}

/** Sampled polylines per edge id and centre per node id, in scene coordinates. */
export interface Geometry {
  nodes: Map<string, Point>;
  edges: Map<string, Point[]>;
}

/** Walk the scene's path strings once with a throwaway SVG path element. */
export function sampleGeometry(scene: Scene, samples = 24): Geometry {
  const nodes = new Map(scene.nodes.map((n) => [n.id, { x: n.x, y: n.y }]));
  const edges = new Map<string, Point[]>();
  if (typeof document === "undefined") return { nodes, edges };
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  for (const e of scene.edges) {
    path.setAttribute("d", e.path);
    const length = path.getTotalLength();
    const points: Point[] = [];
    for (let i = 0; i <= samples; i++) {
      const p = path.getPointAtLength((length * i) / samples);
      points.push({ x: p.x, y: p.y });
    }
    edges.set(e.id, points);
  }
  return { nodes, edges };
}

export interface TokenPlace extends Point {
  /** Node id while dwelling, edge id while travelling. */
  on: string;
}

function along(
  points: Point[] | undefined,
  a: Point | undefined,
  b: Point | undefined,
  progress: number,
): Point | null {
  if (points && points.length > 1) {
    const f = Math.min(1, Math.max(0, progress)) * (points.length - 1);
    const i = Math.min(points.length - 2, Math.floor(f));
    const t = f - i;
    const p = points[i] as Point;
    const q = points[i + 1] as Point;
    return { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t };
  }
  if (a && b) return { x: a.x + (b.x - a.x) * progress, y: a.y + (b.y - a.y) * progress };
  return null;
}

function travelling(g: Geometry, from: string, to: string, progress: number): TokenPlace | null {
  const id = `${from}>${to}`;
  const p = along(g.edges.get(id), g.nodes.get(from), g.nodes.get(to), progress);
  return p ? { ...p, on: id } : null;
}

function dwelling(g: Geometry, node: string): TokenPlace | null {
  const p = g.nodes.get(node);
  return p ? { ...p, on: node } : null;
}

/** Where a case's token is at log time `t`, or null when the case is not active. */
export function tokenPosition(track: Track, t: number, g: Geometry): TokenPlace | null {
  if (t < track.start || t > track.end) return null;
  const steps = track.steps;
  const first = steps[0] as Step;
  if (t < first.start)
    return travelling(g, START_NODE, first.node, (t - track.start) / APPROACH_MS);
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i] as Step;
    if (t <= step.end) return dwelling(g, step.node);
    const next = steps[i + 1];
    if (next && t < next.start)
      return travelling(g, step.node, next.node, (t - step.end) / (next.start - step.end));
  }
  const last = steps[steps.length - 1] as Step;
  return travelling(g, last.node, END_NODE, (t - last.end) / APPROACH_MS);
}

/** Number of active tracks per time bin over [origin, origin + span]; drawn behind the timeline. */
export function activityDensity(
  tracks: readonly Track[],
  origin: number,
  span: number,
  bins = 160,
): number[] {
  const counts = new Array<number>(bins).fill(0);
  if (!(span > 0)) return counts;
  for (const track of tracks) {
    const from = Math.max(0, Math.floor(((track.start - origin) / span) * bins));
    const to = Math.min(bins - 1, Math.floor(((track.end - origin) / span) * bins));
    for (let b = from; b <= to; b++) (counts[b] as number)++;
  }
  return counts;
}

/** Shift a track so it starts at 0 (synchronised mode). */
export function synced(track: Track): Track {
  const offset = track.start;
  return {
    caseId: track.caseId,
    start: 0,
    end: track.end - offset,
    steps: track.steps.map((s) => ({ node: s.node, start: s.start - offset, end: s.end - offset })),
  };
}
