import { EventLogBuilder } from "./builder";
import type { EventLog, LogView, ProcessEvent } from "./types";

/**
 * Index a list of events once. All metrics are derived from the result, never from the input.
 * Events may arrive in any order; they are sorted by (case, start, input order).
 * For millions of rows prefer `EventLogBuilder` and skip the per-event objects.
 */
export function buildEventLog(events: readonly ProcessEvent[]): EventLog {
  const builder = new EventLogBuilder();
  for (let i = 0; i < events.length; i++) builder.addEvent(events[i] as ProcessEvent, i);
  return builder.build();
}

/** Event position range of one case: `[start, end)`. */
export function caseEvents(log: EventLog, caseId: number): [start: number, end: number] {
  const start = log.caseStart[caseId] as number;
  return [start, start + (log.caseLength[caseId] as number)];
}

export function fullView(log: EventLog): LogView {
  return {
    log,
    caseMask: new Uint8Array(log.cases.length).fill(1),
    caseCount: log.cases.length,
    eventCount: log.eventCount,
  };
}
