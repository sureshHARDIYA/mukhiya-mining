import { toMillis } from "./time";
import type { AttributeColumn, AttributeValue, EventLog, ProcessEvent } from "./types";

/**
 * Columnar, allocation-light ingest. Use it for large logs (millions of events) where creating
 * one ProcessEvent object per row would dominate memory. `buildEventLog(events)` is a thin wrapper.
 */
export class EventLogBuilder {
  private readonly caseIds: number[] = [];
  private readonly activityIds: number[] = [];
  private readonly starts: number[] = [];
  private readonly ends: number[] = [];
  private readonly caseDict = new Map<string, number>();
  private readonly activityDict = new Map<string, number>();
  readonly cases: string[] = [];
  readonly activities: string[] = [];
  private readonly attributeNames: string[] = [];
  private readonly attributeDicts: Map<AttributeValue, number>[] = [];
  private readonly attributeValues: AttributeValue[][] = [];
  private readonly attributeCodes: number[][] = [];

  get size(): number {
    return this.caseIds.length;
  }

  /** Declare attribute columns up front so every row gets a slot (missing values become -1). */
  attribute(name: string): number {
    const existing = this.attributeNames.indexOf(name);
    if (existing >= 0) return existing;
    this.attributeNames.push(name);
    this.attributeDicts.push(new Map());
    this.attributeValues.push([]);
    const codes = new Array<number>(this.caseIds.length).fill(-1);
    this.attributeCodes.push(codes);
    return this.attributeNames.length - 1;
  }

  /** Append one event. `start`/`end` are epoch ms. Returns the row index. */
  add(caseId: string, activity: string, start: number, end = Number.NaN): number {
    this.caseIds.push(intern(this.caseDict, this.cases, caseId));
    this.activityIds.push(intern(this.activityDict, this.activities, activity));
    this.starts.push(start);
    this.ends.push(end);
    for (const codes of this.attributeCodes) codes.push(-1);
    return this.caseIds.length - 1;
  }

  /** Set an attribute on the most recently added row (or `row`). */
  set(column: number, value: AttributeValue, row = this.caseIds.length - 1): void {
    if (value === null || value === undefined) return;
    const dict = this.attributeDicts[column] as Map<AttributeValue, number>;
    const values = this.attributeValues[column] as AttributeValue[];
    (this.attributeCodes[column] as number[])[row] = intern(dict, values, value);
  }

  addEvent(event: ProcessEvent, row = this.caseIds.length): void {
    const start = toMillis(event.timestamp, `event ${row}`);
    const end =
      event.endTimestamp === undefined
        ? Number.NaN
        : toMillis(event.endTimestamp, `event ${row} end`);
    this.add(event.caseId, event.activity, start, end);
    if (event.resource !== undefined) this.set(this.attribute("resource"), event.resource);
    if (event.attributes) {
      for (const [name, value] of Object.entries(event.attributes))
        this.set(this.attribute(name), value);
    }
  }

  build(): EventLog {
    const n = this.caseIds.length;
    const caseCount = this.cases.length;
    const order = sortedOrder(this.caseIds, this.starts, caseCount);
    const eventActivity = new Uint32Array(n);
    const eventStart = new Float64Array(n);
    const eventEnd = new Float64Array(n);
    const caseStart = new Uint32Array(caseCount);
    const caseLength = new Uint32Array(caseCount);
    const caseStartTime = new Float64Array(caseCount).fill(Number.POSITIVE_INFINITY);
    const caseEndTime = new Float64Array(caseCount).fill(Number.NEGATIVE_INFINITY);
    let previousCase = -1;
    for (let pos = 0; pos < n; pos++) {
      const i = order[pos] as number;
      const c = this.caseIds[i] as number;
      if (c !== previousCase) {
        caseStart[c] = pos;
        previousCase = c;
      }
      caseLength[c] = (caseLength[c] as number) + 1;
      const start = this.starts[i] as number;
      const end = this.ends[i] as number;
      eventActivity[pos] = this.activityIds[i] as number;
      eventStart[pos] = start;
      eventEnd[pos] = end;
      if (start < (caseStartTime[c] as number)) caseStartTime[c] = start;
      const last = Number.isNaN(end) ? start : end;
      if (last > (caseEndTime[c] as number)) caseEndTime[c] = last;
    }
    const attributes: AttributeColumn[] = this.attributeNames.map((name, k) => {
      const source = this.attributeCodes[k] as number[];
      const codes = new Int32Array(n);
      for (let pos = 0; pos < n; pos++) codes[pos] = source[order[pos] as number] as number;
      return { name, values: this.attributeValues[k] as AttributeValue[], codes };
    });
    return {
      activities: this.activities,
      cases: this.cases,
      caseStart,
      caseLength,
      caseStartTime,
      caseEndTime,
      eventActivity,
      eventStart,
      eventEnd,
      attributes,
      eventCount: n,
    };
  }
}

function intern<T>(dict: Map<T, number>, values: T[], value: T): number {
  const id = dict.get(value);
  if (id !== undefined) return id;
  const next = values.length;
  values.push(value);
  dict.set(value, next);
  return next;
}

/**
 * Order events by (case, start, input order) in O(n + cases): a counting sort by case, then an
 * insertion sort inside each case, which is already sorted for nearly all real logs.
 */
export function sortedOrder(
  caseIds: ArrayLike<number>,
  starts: ArrayLike<number>,
  caseCount: number,
): Uint32Array {
  const n = caseIds.length;
  const offsets = new Uint32Array(caseCount + 1);
  for (let i = 0; i < n; i++) {
    const slot = (caseIds[i] as number) + 1;
    offsets[slot] = (offsets[slot] as number) + 1;
  }
  for (let c = 0; c < caseCount; c++)
    offsets[c + 1] = (offsets[c + 1] as number) + (offsets[c] as number);
  const cursor = offsets.slice(0, caseCount);
  const order = new Uint32Array(n);
  for (let i = 0; i < n; i++) {
    const c = caseIds[i] as number;
    order[cursor[c] as number] = i;
    cursor[c] = (cursor[c] as number) + 1;
  }
  for (let c = 0; c < caseCount; c++)
    sortRange(order, starts, offsets[c] as number, offsets[c + 1] as number);
  return order;
}

function sortRange(order: Uint32Array, starts: ArrayLike<number>, from: number, to: number): void {
  if (to - from > 64) {
    const slice = order.subarray(from, to);
    slice.sort((a, b) => (starts[a] as number) - (starts[b] as number) || a - b);
    return;
  }
  for (let i = from + 1; i < to; i++) {
    const value = order[i] as number;
    const key = starts[value] as number;
    let j = i - 1;
    while (
      j >= from &&
      ((starts[order[j] as number] as number) > key ||
        ((starts[order[j] as number] as number) === key && (order[j] as number) > value))
    ) {
      order[j + 1] = order[j] as number;
      j--;
    }
    order[j + 1] = value;
  }
}
