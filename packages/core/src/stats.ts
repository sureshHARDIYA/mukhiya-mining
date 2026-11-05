import type { DurationStats } from "./types";

export const EMPTY_DURATION: DurationStats = {
  count: 0,
  total: 0,
  mean: 0,
  median: 0,
  min: 0,
  max: 0,
};

/** Summarise a list of durations in ms. Sorts in place. */
export function durationStats(values: number[]): DurationStats {
  if (values.length === 0) return EMPTY_DURATION;
  values.sort((a, b) => a - b);
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

export interface HistogramBin {
  from: number;
  to: number;
  count: number;
}

/** Equal-width histogram over [min, max]. Returns an empty array for no values. */
export function histogram(values: ArrayLike<number>, bins = 40): HistogramBin[] {
  if (values.length === 0) return [];
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < values.length; i++) {
    const v = values[i] as number;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const width = max > min ? (max - min) / bins : 1;
  const counts = new Uint32Array(bins);
  for (let i = 0; i < values.length; i++) {
    const index = Math.min(bins - 1, Math.floor(((values[i] as number) - min) / width));
    counts[index] = (counts[index] as number) + 1;
  }
  return Array.from(counts, (count, i) => ({
    from: min + i * width,
    to: min + (i + 1) * width,
    count,
  }));
}
