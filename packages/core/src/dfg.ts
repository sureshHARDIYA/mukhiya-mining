import { SlotAccumulator } from "./accumulate";
import { caseEvents } from "./log";
import { durationStats } from "./stats";
import {
  type Dfg,
  type DfgEdge,
  type DfgNode,
  END_NODE,
  type EventLog,
  type LogView,
  START_NODE,
} from "./types";

export interface DfgOptions {
  /** Share of activities to keep, by frequency. 1 = all. */
  activityDetail?: number;
  /** Share of paths to keep, by frequency, beyond the ones needed for connectivity. 1 = all. */
  pathDetail?: number;
}

/** Activities to keep: the most frequent `ceil(detail * n)`, at least one. */
export function selectActivities(view: LogView, detail: number): Uint8Array {
  const { log } = view;
  const frequency = new Float64Array(log.activities.length);
  for (let c = 0; c < log.cases.length; c++) {
    if (view.caseMask[c] !== 1) continue;
    const [start, end] = caseEvents(log, c);
    for (let e = start; e < end; e++) {
      const a = log.eventActivity[e] as number;
      frequency[a] = (frequency[a] as number) + 1;
    }
  }
  const ranked = Array.from(frequency.keys())
    .filter((a) => (frequency[a] as number) > 0)
    .sort((a, b) => (frequency[b] as number) - (frequency[a] as number) || a - b);
  const keepCount = Math.max(1, Math.ceil(Math.min(1, Math.max(0, detail)) * ranked.length));
  const kept = new Uint8Array(log.activities.length);
  for (const a of ranked.slice(0, keepCount)) kept[a] = 1;
  return kept;
}

/**
 * Directly-follows graph over the view, projected onto the kept activities
 * (hidden activities are skipped, so A→hidden→B becomes A→B).
 * Slot layout: activities 0..A-1, START = A, END = A+1; paths are source*stride+target.
 */
export function computeDfg(view: LogView, options: DfgOptions = {}): Dfg {
  const { log } = view;
  const kept = selectActivities(view, options.activityDetail ?? 1);
  const A = log.activities.length;
  const stride = A + 2;
  const nodes = new SlotAccumulator(A);
  const edges = new SlotAccumulator(stride * stride);
  const starts = new Uint32Array(A);
  const ends = new Uint32Array(A);
  for (let c = 0; c < log.cases.length; c++) {
    if (view.caseMask[c] === 1) walkCase(log, c, kept, { nodes, edges, starts, ends, stride });
  }
  const dfgNodes = buildNodes(log, nodes, starts, ends, view.caseCount);
  const allEdges = buildEdges(edges, stride, A, view.caseCount);
  const visibleEdges = selectEdges(allEdges, options.pathDetail ?? 1);
  const hiddenActivities: number[] = [];
  for (let a = 0; a < kept.length; a++) if (kept[a] !== 1) hiddenActivities.push(a);
  return { nodes: dfgNodes, edges: visibleEdges, hiddenActivities, caseCount: view.caseCount };
}

interface Walk {
  nodes: SlotAccumulator;
  edges: SlotAccumulator;
  starts: Uint32Array;
  ends: Uint32Array;
  stride: number;
}

function walkCase(log: EventLog, caseId: number, kept: Uint8Array, w: Walk): void {
  const [start, end] = caseEvents(log, caseId);
  const startSlot = w.stride - 2;
  const endSlot = w.stride - 1;
  let previous = -1;
  let previousEnd = Number.NaN;
  for (let e = start; e < end; e++) {
    const a = log.eventActivity[e] as number;
    if (kept[a] !== 1) continue;
    const eventStart = log.eventStart[e] as number;
    const eventEnd = log.eventEnd[e] as number;
    w.nodes.hit(a, caseId, Number.isNaN(eventEnd) ? Number.NaN : eventEnd - eventStart);
    if (previous < 0) {
      w.starts[a] = (w.starts[a] as number) + 1;
      w.edges.hit(startSlot * w.stride + a, caseId, Number.NaN);
    } else {
      w.edges.hit(previous * w.stride + a, caseId, eventStart - previousEnd);
    }
    previous = a;
    previousEnd = Number.isNaN(eventEnd) ? eventStart : eventEnd;
  }
  if (previous >= 0) {
    w.ends[previous] = (w.ends[previous] as number) + 1;
    w.edges.hit(previous * w.stride + endSlot, caseId, Number.NaN);
  } else {
    w.edges.hit(startSlot * w.stride + endSlot, caseId, Number.NaN);
  }
}

function buildNodes(
  log: EventLog,
  acc: SlotAccumulator,
  starts: Uint32Array,
  ends: Uint32Array,
  caseCount: number,
): DfgNode[] {
  const result: DfgNode[] = [
    pseudoNode(START_NODE, "Start", caseCount),
    pseudoNode(END_NODE, "End", caseCount),
  ];
  for (let a = 0; a < acc.slots; a++) {
    if ((acc.frequency[a] as number) === 0) continue;
    result.push({
      id: String(a),
      name: log.activities[a] as string,
      activity: a,
      ...acc.frequencyStats(a, caseCount),
      duration: acc.durationStats(a),
      startFrequency: starts[a] as number,
      endFrequency: ends[a] as number,
    });
  }
  return result;
}

function pseudoNode(id: string, name: string, caseCount: number): DfgNode {
  return {
    id,
    name,
    activity: -1,
    frequency: caseCount,
    caseFrequency: caseCount,
    caseCoverage: caseCount === 0 ? 0 : 1,
    maxRepetitions: 1,
    duration: durationStats([]),
    startFrequency: id === START_NODE ? caseCount : 0,
    endFrequency: id === END_NODE ? caseCount : 0,
  };
}

function slotId(slot: number, activityCount: number): string {
  if (slot === activityCount) return START_NODE;
  if (slot === activityCount + 1) return END_NODE;
  return String(slot);
}

function buildEdges(
  acc: SlotAccumulator,
  stride: number,
  activityCount: number,
  caseCount: number,
): DfgEdge[] {
  const result: DfgEdge[] = [];
  for (let slot = 0; slot < acc.slots; slot++) {
    if ((acc.frequency[slot] as number) === 0) continue;
    const source = slotId(Math.floor(slot / stride), activityCount);
    const target = slotId(slot % stride, activityCount);
    result.push({
      id: `${source}>${target}`,
      source,
      target,
      ...acc.frequencyStats(slot, caseCount),
      duration: acc.durationStats(slot),
    });
  }
  return result;
}

/**
 * Keep every node reachable: each node keeps its strongest incoming and outgoing edge,
 * then the most frequent `detail` share of the remaining edges is added back.
 */
export function selectEdges(edges: DfgEdge[], detail: number): DfgEdge[] {
  const share = Math.min(1, Math.max(0, detail));
  if (share >= 1) return edges;
  const sorted = [...edges].sort((a, b) => b.frequency - a.frequency);
  const required = new Set<string>();
  const seenOut = new Set<string>();
  const seenIn = new Set<string>();
  for (const edge of sorted) {
    if (!seenOut.has(edge.source) || !seenIn.has(edge.target)) {
      required.add(edge.id);
      seenOut.add(edge.source);
      seenIn.add(edge.target);
    }
  }
  const optional = sorted.filter((e) => !required.has(e.id));
  const extra = optional.slice(0, Math.round(share * optional.length));
  const keep = new Set([...required, ...extra.map((e) => e.id)]);
  return edges.filter((e) => keep.has(e.id));
}
