import {
  buildEventLog,
  type EventLog,
  fromJson,
  generateSampleEventLog,
} from "@mukhiya-mining/core";

export type Job = { kind: "sample"; cases: number; seed: number } | { kind: "json"; url: string };

/** Builds the log off the main thread and transfers its buffers (zero copy). */
self.onmessage = async (e: MessageEvent<Job>) => {
  const t0 = performance.now();
  const log = await build(e.data);
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

async function build(job: Job): Promise<EventLog> {
  if (job.kind === "sample") return generateSampleEventLog({ cases: job.cases, seed: job.seed });
  const rows = await (await fetch(job.url)).json();
  return buildEventLog(
    fromJson(rows, {
      caseId: "caseId",
      activity: "activity",
      timestamp: "timestamp",
      endTimestamp: "endTimestamp",
      resource: "resource",
      attributes: ["kind", "browser", "os"],
    }),
  );
}
