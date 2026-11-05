import { caseEvents, fullView } from "./log";
import { toMillis } from "./time";
import type { EventLog, Filter, LogView } from "./types";
import { computeVariants } from "./variants";

/** Filters are ANDed. Each one only narrows the case mask. Order matters only for `variants`, which ranks variants within the cases left by the filters before it. */
export function applyFilters(log: EventLog, filters: readonly Filter[]): LogView {
  let view = fullView(log);
  for (const filter of filters) view = applyFilter(view, filter);
  return view;
}

export function applyFilter(view: LogView, filter: Filter): LogView {
  switch (filter.type) {
    case "timeframe":
      return keepCases(view, timeframePredicate(view.log, filter));
    case "activity":
      return keepCases(view, activityPredicate(view.log, filter));
    case "endpoints":
      return keepCases(view, endpointsPredicate(view.log, filter));
    case "variants":
      return keepVariants(view, filter);
  }
}

function keepCases(view: LogView, keep: (caseId: number) => boolean): LogView {
  const { log } = view;
  const caseMask = new Uint8Array(log.cases.length);
  let caseCount = 0;
  let eventCount = 0;
  for (let c = 0; c < caseMask.length; c++) {
    if (view.caseMask[c] !== 1 || !keep(c)) continue;
    caseMask[c] = 1;
    caseCount++;
    eventCount += log.caseLength[c] as number;
  }
  return { log, caseMask, caseCount, eventCount };
}

function timeframePredicate(
  log: EventLog,
  filter: Extract<Filter, { type: "timeframe" }>,
): (caseId: number) => boolean {
  const from = filter.from ? toMillis(filter.from, "timeframe.from") : Number.NEGATIVE_INFINITY;
  const to = filter.to ? toMillis(filter.to, "timeframe.to") : Number.POSITIVE_INFINITY;
  if (filter.mode === "contained") {
    return (c) => (log.caseStartTime[c] as number) >= from && (log.caseEndTime[c] as number) <= to;
  }
  return (c) => (log.caseEndTime[c] as number) >= from && (log.caseStartTime[c] as number) <= to;
}

function activityIds(log: EventLog, names: readonly string[]): Set<number> {
  const ids = new Set<number>();
  for (const name of names) {
    const id = log.activities.indexOf(name);
    if (id >= 0) ids.add(id);
  }
  return ids;
}

function caseContainsAny(log: EventLog, caseId: number, ids: Set<number>): boolean {
  const [start, end] = caseEvents(log, caseId);
  for (let e = start; e < end; e++) if (ids.has(log.eventActivity[e] as number)) return true;
  return false;
}

function activityPredicate(
  log: EventLog,
  filter: Extract<Filter, { type: "activity" }>,
): (caseId: number) => boolean {
  const ids = activityIds(log, filter.activities);
  const keep = filter.mode === "keep";
  return (c) => caseContainsAny(log, c, ids) === keep;
}

function endpointsPredicate(
  log: EventLog,
  filter: Extract<Filter, { type: "endpoints" }>,
): (caseId: number) => boolean {
  const starts = filter.start?.length ? activityIds(log, filter.start) : null;
  const ends = filter.end?.length ? activityIds(log, filter.end) : null;
  return (c) => {
    const [first, last] = caseEvents(log, c);
    if (starts && !starts.has(log.eventActivity[first] as number)) return false;
    if (ends && !ends.has(log.eventActivity[last - 1] as number)) return false;
    return true;
  };
}

function keepVariants(view: LogView, filter: Extract<Filter, { type: "variants" }>): LogView {
  const variants = computeVariants(view);
  const minCases = filter.minCases ?? 0;
  const top = filter.top ?? variants.length;
  const kept = new Uint8Array(view.log.cases.length);
  variants.slice(0, top).forEach((variant) => {
    if (variant.caseIds.length < minCases) return;
    for (const c of variant.caseIds) kept[c] = 1;
  });
  return keepCases(view, (c) => kept[c] === 1);
}
