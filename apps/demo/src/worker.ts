import { type EventLog, generateSampleEventLog } from "@mukhiya-mining/core";

/** Builds the sample log off the main thread and transfers its buffers (zero copy). */
self.onmessage = (e: MessageEvent<{ cases: number; seed: number }>) => {
  const t0 = performance.now();
  const log = generateSampleEventLog({ cases: e.data.cases, seed: e.data.seed });
  const ms = Math.round(performance.now() - t0);
  const buffers = [
    log.caseStart,
    log.caseLength,
    log.caseStartTime,
    log.caseEndTime,
    log.eventActivity,
    log.eventStart,
    log.eventEnd,
    ...log.attributes.map((a) => a.codes),
  ].map((a) => a.buffer);
  (self as unknown as Worker).postMessage(
    { log, ms } satisfies { log: EventLog; ms: number },
    buffers as Transferable[],
  );
};
