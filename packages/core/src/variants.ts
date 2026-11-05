import { caseEvents } from "./log";
import type { EventLog, LogView, Variant } from "./types";

interface VariantIndex {
  /** Variant id per case, over the full log. */
  caseVariant: Int32Array;
  /** Activity sequence per variant id. */
  sequences: number[][];
}

const cache = new WeakMap<EventLog, VariantIndex>();

/** Variant ids are stable per log: computed once, cached, independent of filters. */
export function variantIndex(log: EventLog): VariantIndex {
  const cached = cache.get(log);
  if (cached) return cached;
  const keys = new Map<string, number>();
  const sequences: number[][] = [];
  const caseVariant = new Int32Array(log.cases.length);
  for (let c = 0; c < log.cases.length; c++) {
    const [start, end] = caseEvents(log, c);
    const sequence = Array.from(log.eventActivity.subarray(start, end));
    const key = sequence.join(",");
    let id = keys.get(key);
    if (id === undefined) {
      id = sequences.length;
      keys.set(key, id);
      sequences.push(sequence);
    }
    caseVariant[c] = id;
  }
  const index = { caseVariant, sequences };
  cache.set(log, index);
  return index;
}

/** Variants present in the view, sorted by case count (desc), then first occurrence. */
export function computeVariants(view: LogView): Variant[] {
  const { caseVariant, sequences } = variantIndex(view.log);
  const casesByVariant = new Map<number, number[]>();
  for (let c = 0; c < caseVariant.length; c++) {
    if (view.caseMask[c] !== 1) continue;
    const id = caseVariant[c] as number;
    const list = casesByVariant.get(id);
    if (list) list.push(c);
    else casesByVariant.set(id, [c]);
  }
  const variants: Variant[] = [];
  for (const [id, caseIds] of casesByVariant) {
    variants.push({
      id,
      activities: sequences[id] as number[],
      caseIds,
      share: view.caseCount === 0 ? 0 : caseIds.length / view.caseCount,
    });
  }
  variants.sort((a, b) => b.caseIds.length - a.caseIds.length || a.id - b.id);
  return variants;
}
