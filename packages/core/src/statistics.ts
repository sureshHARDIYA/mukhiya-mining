import { SlotAccumulator, typedDurationStats } from "./accumulate";
import { caseEvents } from "./log";
import { type HistogramBin, histogram } from "./stats";
import type { DurationStats, LogView } from "./types";
import { computeVariants, variantIndex } from "./variants";

export interface ActivityStat {
  activity: number;
  name: string;
  frequency: number;
  relativeFrequency: number;
  caseFrequency: number;
  firstInCase: number;
  lastInCase: number;
  duration: DurationStats;
}

export function computeActivityStats(view: LogView): ActivityStat[] {
  const { log } = view;
  const n = log.activities.length;
  const acc = new SlotAccumulator(n);
  const first = new Uint32Array(n);
  const last = new Uint32Array(n);
  for (let c = 0; c < log.cases.length; c++) {
    if (view.caseMask[c] !== 1) continue;
    const [start, end] = caseEvents(log, c);
    for (let e = start; e < end; e++) {
      const a = log.eventActivity[e] as number;
      acc.hit(a, c, (log.eventEnd[e] as number) - (log.eventStart[e] as number));
    }
    const firstActivity = log.eventActivity[start] as number;
    const lastActivity = log.eventActivity[end - 1] as number;
    first[firstActivity] = (first[firstActivity] as number) + 1;
    last[lastActivity] = (last[lastActivity] as number) + 1;
  }
  const stats: ActivityStat[] = [];
  for (let a = 0; a < n; a++) {
    const frequency = acc.frequency[a] as number;
    if (frequency === 0) continue;
    stats.push({
      activity: a,
      name: log.activities[a] as string,
      frequency,
      relativeFrequency: view.eventCount === 0 ? 0 : frequency / view.eventCount,
      caseFrequency: acc.caseFrequency[a] as number,
      firstInCase: first[a] as number,
      lastInCase: last[a] as number,
      duration: acc.durationStats(a),
    });
  }
  return stats.sort((x, y) => y.frequency - x.frequency);
}

export interface CaseStat {
  caseId: number;
  name: string;
  events: number;
  variant: number;
  start: number;
  end: number;
  duration: number;
  /** Share of the case duration spent inside events with an end timestamp, 0..1. */
  activeShare: number;
}

export function computeCaseStats(view: LogView): CaseStat[] {
  const { log } = view;
  const { caseVariant } = variantIndex(log);
  const stats: CaseStat[] = [];
  for (let c = 0; c < log.cases.length; c++) {
    if (view.caseMask[c] !== 1) continue;
    const [start, end] = caseEvents(log, c);
    let active = 0;
    for (let e = start; e < end; e++) {
      const d = (log.eventEnd[e] as number) - (log.eventStart[e] as number);
      if (!Number.isNaN(d)) active += d;
    }
    const caseStart = log.caseStartTime[c] as number;
    const caseEnd = log.caseEndTime[c] as number;
    const duration = caseEnd - caseStart;
    stats.push({
      caseId: c,
      name: log.cases[c] as string,
      events: end - start,
      variant: caseVariant[c] as number,
      start: caseStart,
      end: caseEnd,
      duration,
      activeShare: duration > 0 ? Math.min(1, active / duration) : 0,
    });
  }
  return stats.sort((a, b) => a.start - b.start);
}

export interface Overview {
  cases: number;
  events: number;
  activities: number;
  variants: number;
  start: number;
  end: number;
  caseDuration: DurationStats;
  eventsPerCase: DurationStats;
  eventsOverTime: HistogramBin[];
  activeCasesOverTime: HistogramBin[];
  caseDurationHistogram: HistogramBin[];
  eventsPerCaseHistogram: HistogramBin[];
}

export function computeOverview(view: LogView, bins = 40): Overview {
  const { log } = view;
  const cases = computeCaseStats(view);
  const activities = new Set<number>();
  const eventTimes: number[] = [];
  for (const c of cases) {
    const [start, end] = caseEvents(log, c.caseId);
    for (let e = start; e < end; e++) {
      activities.add(log.eventActivity[e] as number);
      eventTimes.push(log.eventStart[e] as number);
    }
  }
  let start = Number.POSITIVE_INFINITY;
  let end = Number.NEGATIVE_INFINITY;
  for (const c of cases) {
    if (c.start < start) start = c.start;
    if (c.end > end) end = c.end;
  }
  if (cases.length === 0) start = end = Number.NaN;
  return {
    cases: cases.length,
    events: view.eventCount,
    activities: activities.size,
    variants: computeVariants(view).length,
    start,
    end,
    caseDuration: typedDurationStats(Float64Array.from(cases, (c) => c.duration)),
    eventsPerCase: typedDurationStats(Float64Array.from(cases, (c) => c.events)),
    eventsOverTime: histogram(eventTimes, bins),
    activeCasesOverTime: activeCasesOverTime(cases, start, end, bins),
    caseDurationHistogram: histogram(
      Float64Array.from(cases, (c) => c.duration),
      bins,
    ),
    eventsPerCaseHistogram: histogram(
      Float64Array.from(cases, (c) => c.events),
      Math.min(bins, 30),
    ),
  };
}

function activeCasesOverTime(
  cases: CaseStat[],
  start: number,
  end: number,
  bins: number,
): HistogramBin[] {
  if (cases.length === 0 || !(end > start)) return [];
  const width = (end - start) / bins;
  const counts = new Uint32Array(bins);
  for (const c of cases) {
    const firstBin = Math.floor((c.start - start) / width);
    const lastBin = Math.min(bins - 1, Math.floor((c.end - start) / width));
    for (let b = firstBin; b <= lastBin; b++) counts[b] = (counts[b] as number) + 1;
  }
  return Array.from(counts, (count, i) => ({
    from: start + i * width,
    to: start + (i + 1) * width,
    count,
  }));
}
