import { EventLogBuilder } from "./builder";
import type { EventLog, ProcessEvent } from "./types";

/** Deterministic PRNG (mulberry32) so demos and tests are reproducible. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Step = { next: [string, number][]; dwell: [number, number] };

/** A small e-commerce journey model: page -> weighted next pages, dwell range in seconds. */
const JOURNEY: Record<string, Step> = {
  Landing: {
    next: [
      ["Product list", 0.5],
      ["Search", 0.3],
      ["Account", 0.08],
      ["EXIT", 0.12],
    ],
    dwell: [5, 40],
  },
  Search: {
    next: [
      ["Product list", 0.55],
      ["Search", 0.15],
      ["Product detail", 0.2],
      ["EXIT", 0.1],
    ],
    dwell: [8, 60],
  },
  "Product list": {
    next: [
      ["Product detail", 0.65],
      ["Search", 0.1],
      ["EXIT", 0.25],
    ],
    dwell: [15, 120],
  },
  "Product detail": {
    next: [
      ["Add to cart", 0.45],
      ["Product list", 0.25],
      ["EXIT", 0.3],
    ],
    dwell: [20, 180],
  },
  "Add to cart": {
    next: [
      ["Cart", 0.7],
      ["Product list", 0.25],
      ["EXIT", 0.05],
    ],
    dwell: [2, 10],
  },
  Cart: {
    next: [
      ["Checkout", 0.6],
      ["Product list", 0.2],
      ["EXIT", 0.2],
    ],
    dwell: [10, 90],
  },
  Checkout: {
    next: [
      ["Payment", 0.75],
      ["Cart", 0.1],
      ["Help", 0.05],
      ["EXIT", 0.1],
    ],
    dwell: [30, 240],
  },
  Payment: {
    next: [
      ["Order confirmed", 0.85],
      ["Checkout", 0.1],
      ["EXIT", 0.05],
    ],
    dwell: [20, 120],
  },
  Help: {
    next: [
      ["Checkout", 0.6],
      ["EXIT", 0.4],
    ],
    dwell: [30, 200],
  },
  Account: {
    next: [
      ["Product list", 0.6],
      ["EXIT", 0.4],
    ],
    dwell: [10, 60],
  },
  "Order confirmed": { next: [["EXIT", 1]], dwell: [5, 30] },
};

export interface SampleOptions {
  cases?: number;
  seed?: number;
  /** Epoch ms of the first session. Default: 2026-10-01. */
  start?: number;
  /** Span of the log in days. */
  days?: number;
  maxEventsPerCase?: number;
}

/** Generate a web-journey event log: session = case, page = activity, device/channel as attributes. */
export function generateSampleLog(options: SampleOptions = {}): ProcessEvent[] {
  const events: ProcessEvent[] = [];
  walkSample(options, (caseId, page, start, end, device, channel) => {
    events.push({
      caseId,
      activity: page,
      timestamp: start,
      endTimestamp: end,
      attributes: { device, channel },
    });
  });
  return events;
}

/** Same journey model, written straight into the columnar builder (no per-event objects). */
export function generateSampleEventLog(options: SampleOptions = {}): EventLog {
  const builder = new EventLogBuilder();
  const device = builder.attribute("device");
  const channel = builder.attribute("channel");
  walkSample(options, (caseId, page, start, end, d, ch) => {
    builder.add(caseId, page, start, end);
    builder.set(device, d);
    builder.set(channel, ch);
  });
  return builder.build();
}

/** Session start with a weekly and daily rhythm: quieter weekends, peaks around 12:00 and 20:00. */
function sessionOffset(random: () => number, days: number): number {
  for (;;) {
    const day = Math.floor(random() * days);
    const hour = random() * 24;
    const weekday = (day + 3) % 7; // 2026-10-01 is a Thursday
    const weekend = weekday >= 5 ? 0.55 : 1;
    const daily =
      0.15 + 0.5 * Math.exp(-((hour - 12) ** 2) / 8) + 0.6 * Math.exp(-((hour - 20) ** 2) / 6);
    if (random() < weekend * daily) return (day * 24 + hour) * 3_600_000;
  }
}

type Emit = (
  caseId: string,
  page: string,
  start: number,
  end: number,
  device: string,
  channel: string,
) => void;

function walkSample(options: SampleOptions, emit: Emit): void {
  const {
    cases = 2000,
    seed = 7,
    start = Date.UTC(2026, 9, 1),
    days = 30,
    maxEventsPerCase = 25,
  } = options;
  const random = seededRandom(seed);
  for (let c = 0; c < cases; c++) {
    const caseId = `s-${(c + 1).toString(36).padStart(4, "0")}`;
    const device = random() < 0.58 ? "mobile" : "desktop";
    const channel = pick(random, [
      ["organic", 0.45],
      ["paid", 0.3],
      ["email", 0.15],
      ["direct", 0.1],
    ]);
    let time = start + sessionOffset(random, days);
    let page = "Landing";
    for (let i = 0; i < maxEventsPerCase && page !== "EXIT"; i++) {
      const step = JOURNEY[page] as Step;
      const dwell = (step.dwell[0] + random() * (step.dwell[1] - step.dwell[0])) * 1000;
      emit(caseId, page, time, time + dwell, device, channel);
      time += dwell + random() ** 3 * 90_000; // mostly instant, occasionally a long think
      page = pick(random, step.next);
    }
  }
}

function pick(random: () => number, weighted: [string, number][]): string {
  let r = random();
  for (const [value, weight] of weighted) {
    r -= weight;
    if (r <= 0) return value;
  }
  return (weighted.at(-1) as [string, number])[0];
}
