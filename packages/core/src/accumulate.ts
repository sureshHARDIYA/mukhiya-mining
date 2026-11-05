import { durationStats } from "./stats";
import type { DurationStats, FrequencyStats } from "./types";

/**
 * Flat per-slot accumulators (slot = activity id, or source*stride+target for paths).
 * Case frequency and repetitions use a "last seen case" trick so no Set/Map is touched per event.
 */
export class SlotAccumulator {
  readonly frequency: Uint32Array;
  readonly caseFrequency: Uint32Array;
  readonly maxRepetitions: Uint32Array;
  private readonly lastCase: Int32Array;
  private readonly countInCase: Uint32Array;
  private readonly durations: Float64Array[];
  private readonly durationCount: Uint32Array;

  constructor(readonly slots: number) {
    this.frequency = new Uint32Array(slots);
    this.caseFrequency = new Uint32Array(slots);
    this.maxRepetitions = new Uint32Array(slots);
    this.lastCase = new Int32Array(slots).fill(-1);
    this.countInCase = new Uint32Array(slots);
    this.durations = new Array(slots);
    this.durationCount = new Uint32Array(slots);
  }

  hit(slot: number, caseId: number, duration: number): void {
    this.frequency[slot] = (this.frequency[slot] as number) + 1;
    if ((this.lastCase[slot] as number) !== caseId) {
      this.lastCase[slot] = caseId;
      this.caseFrequency[slot] = (this.caseFrequency[slot] as number) + 1;
      this.countInCase[slot] = 1;
    } else {
      this.countInCase[slot] = (this.countInCase[slot] as number) + 1;
    }
    if ((this.countInCase[slot] as number) > (this.maxRepetitions[slot] as number)) {
      this.maxRepetitions[slot] = this.countInCase[slot] as number;
    }
    if (!Number.isNaN(duration)) this.pushDuration(slot, duration);
  }

  private pushDuration(slot: number, duration: number): void {
    let buffer = this.durations[slot];
    const count = this.durationCount[slot] as number;
    if (!buffer) {
      buffer = new Float64Array(16);
      this.durations[slot] = buffer;
    } else if (count === buffer.length) {
      const grown = new Float64Array(buffer.length * 2);
      grown.set(buffer);
      buffer = grown;
      this.durations[slot] = buffer;
    }
    buffer[count] = duration;
    this.durationCount[slot] = count + 1;
  }

  frequencyStats(slot: number, caseCount: number): FrequencyStats {
    const caseFrequency = this.caseFrequency[slot] as number;
    return {
      frequency: this.frequency[slot] as number,
      caseFrequency,
      caseCoverage: caseCount === 0 ? 0 : caseFrequency / caseCount,
      maxRepetitions: this.maxRepetitions[slot] as number,
    };
  }

  durationStats(slot: number): DurationStats {
    const buffer = this.durations[slot];
    const count = this.durationCount[slot] as number;
    if (!buffer || count === 0) return durationStats([]);
    return typedDurationStats(buffer.subarray(0, count));
  }
}

/** Same as durationStats but on a typed array; sorts in place with the native numeric sort. */
export function typedDurationStats(values: Float64Array): DurationStats {
  if (values.length === 0) return durationStats([]);
  values.sort();
  let total = 0;
  for (const v of values) total += v;
  const mid = values.length >> 1;
  const median =
    values.length % 2 === 1
      ? (values[mid] as number)
      : ((values[mid - 1] as number) + (values[mid] as number)) / 2;
  return {
    count: values.length,
    total,
    mean: total / values.length,
    median,
    min: values[0] as number,
    max: values.at(-1) as number,
  };
}
