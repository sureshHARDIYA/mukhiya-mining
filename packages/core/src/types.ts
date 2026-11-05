export type AttributeValue = string | number | boolean | null;

/** Normalised input event. One row per activity instance. */
export interface ProcessEvent {
  caseId: string;
  activity: string;
  timestamp: string | Date | number;
  endTimestamp?: string | Date | number;
  resource?: string;
  attributes?: Record<string, AttributeValue>;
}

/** Dictionary-encoded attribute column. `codes[e] === -1` means the event has no value. */
export interface AttributeColumn {
  name: string;
  values: AttributeValue[];
  codes: Int32Array;
}

/**
 * Indexed event log. Events are stored sorted by (case, start time), so a case is the
 * contiguous range `[caseStart[c], caseStart[c] + caseLength[c])`.
 * Invariant: every typed array has one entry per event, except the per-case arrays.
 */
export interface EventLog {
  activities: string[];
  cases: string[];
  caseStart: Uint32Array;
  caseLength: Uint32Array;
  caseStartTime: Float64Array;
  caseEndTime: Float64Array;
  eventActivity: Uint32Array;
  eventStart: Float64Array;
  /** NaN when the event has no end timestamp. */
  eventEnd: Float64Array;
  attributes: AttributeColumn[];
  eventCount: number;
}

/** A subset of a log's cases. Events are never copied; `caseMask[c] === 1` keeps case c. */
export interface LogView {
  log: EventLog;
  caseMask: Uint8Array;
  caseCount: number;
  eventCount: number;
}

export interface DurationStats {
  count: number;
  total: number;
  mean: number;
  median: number;
  min: number;
  max: number;
}

export interface FrequencyStats {
  /** Number of event occurrences (or transitions). */
  frequency: number;
  /** Number of distinct cases in which it occurs. */
  caseFrequency: number;
  /** caseFrequency / cases in view, 0..1 */
  caseCoverage: number;
  /** Highest number of occurrences inside one case. */
  maxRepetitions: number;
}

export const START_NODE = "__start__";
export const END_NODE = "__end__";

export interface DfgNode extends FrequencyStats {
  id: string;
  name: string;
  /** -1 for the start and end pseudo nodes. */
  activity: number;
  duration: DurationStats;
  /** Cases that start with this activity. */
  startFrequency: number;
  /** Cases that end with this activity. */
  endFrequency: number;
}

export interface DfgEdge extends FrequencyStats {
  id: string;
  source: string;
  target: string;
  /** Waiting time between the source ending and the target starting. */
  duration: DurationStats;
}

export interface Dfg {
  nodes: DfgNode[];
  edges: DfgEdge[];
  /** Activities that were hidden by the detail setting. */
  hiddenActivities: number[];
  caseCount: number;
}

export interface Variant {
  id: number;
  /** Activity ids in order. */
  activities: number[];
  /** Case ids (indexes into log.cases). */
  caseIds: number[];
  share: number;
}

export type Filter =
  | { type: "timeframe"; from?: string; to?: string; mode?: "intersecting" | "contained" }
  | { type: "activity"; mode: "keep" | "remove"; activities: string[] }
  | { type: "endpoints"; start?: string[]; end?: string[] }
  | { type: "variants"; top?: number; minCases?: number };
