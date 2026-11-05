import { describe, expect, it } from "vitest";
import {
  applyFilters,
  buildEventLog,
  computeActivityStats,
  computeCaseStats,
  computeDfg,
  computeOverview,
  computeVariants,
  END_NODE,
  formatDuration,
  fromCsv,
  fromJson,
  fullView,
  layoutDfg,
  type ProcessEvent,
  START_NODE,
  selectEdges,
} from "../src";

const T0 = Date.UTC(2026, 0, 1, 10, 0, 0);
const min = (n: number) => T0 + n * 60_000;

const events: ProcessEvent[] = [
  { caseId: "s1", activity: "Landing", timestamp: min(0), endTimestamp: min(1) },
  { caseId: "s1", activity: "List", timestamp: min(2), endTimestamp: min(3) },
  { caseId: "s1", activity: "Detail", timestamp: min(4), endTimestamp: min(6) },
  { caseId: "s2", activity: "Landing", timestamp: min(10), endTimestamp: min(11) },
  { caseId: "s2", activity: "Detail", timestamp: min(12), endTimestamp: min(13) },
  { caseId: "s2", activity: "Detail", timestamp: min(14), endTimestamp: min(15) },
  { caseId: "s3", activity: "Landing", timestamp: min(20), resource: "bot" },
  // out of order on purpose
  { caseId: "s3", activity: "Search", timestamp: min(19) },
];

describe("buildEventLog", () => {
  it("sorts events by case and time and indexes cases", () => {
    const log = buildEventLog(events);
    expect(log.cases).toEqual(["s1", "s2", "s3"]);
    expect(Array.from(log.caseLength)).toEqual([3, 3, 2]);
    const s3 = log.caseStart[2] as number;
    expect(log.activities[log.eventActivity[s3] as number]).toBe("Search");
    expect(log.caseStartTime[2]).toBe(min(19));
    expect(log.caseEndTime[0]).toBe(min(6));
    expect(log.attributes[0]?.name).toBe("resource");
    expect(log.attributes[0]?.codes[s3]).toBe(-1);
  });

  it("rejects invalid timestamps with the event index", () => {
    expect(() => buildEventLog([{ caseId: "x", activity: "a", timestamp: "nope" }])).toThrow(
      /event 0/,
    );
  });
});

describe("adapters", () => {
  it("maps JSON rows and CSV text to the same events", () => {
    const mapping = {
      caseId: "session",
      activity: "page",
      timestamp: "ts",
      attributes: ["device"],
    };
    const rows = [{ session: "a", page: "Home", ts: "2026-01-01T10:00:00Z", device: "mobile" }];
    const csv = "session;page;ts;device\na;Home;2026-01-01T10:00:00Z;mobile\n";
    expect(fromCsv(csv, mapping)).toEqual(fromJson(rows, mapping));
    expect(fromJson(rows, mapping)[0]?.attributes).toEqual({ device: "mobile" });
  });

  it("handles quoted CSV cells", () => {
    const csv = 'c,a,t\n1,"Add, to cart","2026-01-01T10:00:00Z"\n';
    const parsed = fromCsv(csv, { caseId: "c", activity: "a", timestamp: "t" });
    expect(parsed[0]?.activity).toBe("Add, to cart");
  });
});

describe("dfg", () => {
  it("counts frequencies, case coverage and repetitions", () => {
    const dfg = computeDfg(fullView(buildEventLog(events)));
    const detail = dfg.nodes.find((n) => n.name === "Detail");
    expect(detail?.frequency).toBe(3);
    expect(detail?.caseFrequency).toBe(2);
    expect(detail?.maxRepetitions).toBe(2);
    expect(detail?.caseCoverage).toBeCloseTo(2 / 3);
    expect(detail?.duration.median).toBe(60_000);
    const startEdge = dfg.edges.find((e) => e.source === START_NODE && e.target === "0");
    expect(startEdge?.frequency).toBe(2);
    const loop = dfg.edges.find((e) => e.source === e.target);
    expect(loop?.duration.total).toBe(60_000);
    expect(dfg.edges.some((e) => e.target === END_NODE)).toBe(true);
  });

  it("projects hidden activities so the graph stays connected", () => {
    const dfg = computeDfg(fullView(buildEventLog(events)), { activityDetail: 0.4 });
    const names = dfg.nodes.filter((n) => n.activity >= 0).map((n) => n.name);
    expect(names).toEqual(["Landing", "Detail"]);
    expect(dfg.edges.find((e) => e.source === "0" && e.target === "2")?.frequency).toBe(2);
  });

  it("keeps connectivity edges when path detail is 0", () => {
    const dfg = computeDfg(fullView(buildEventLog(events)));
    const minimal = selectEdges(dfg.edges, 0);
    const targets = new Set(minimal.map((e) => e.target));
    for (const node of dfg.nodes)
      if (node.id !== START_NODE) expect(targets.has(node.id)).toBe(true);
  });
});

describe("filters", () => {
  const log = buildEventLog(events);
  it("timeframe, activity, endpoints and variants narrow the mask", () => {
    expect(
      applyFilters(log, [{ type: "timeframe", from: new Date(min(9)).toISOString() }]).caseCount,
    ).toBe(2);
    expect(
      applyFilters(log, [{ type: "activity", mode: "remove", activities: ["Search"] }]).caseCount,
    ).toBe(2);
    expect(applyFilters(log, [{ type: "endpoints", end: ["Detail"] }]).caseCount).toBe(2);
    expect(applyFilters(log, [{ type: "variants", top: 1 }]).caseCount).toBe(1);
    expect(
      applyFilters(log, [
        { type: "activity", mode: "keep", activities: ["Search"] },
        { type: "endpoints", end: ["Detail"] },
      ]).caseCount,
    ).toBe(0);
  });
});

describe("variants and statistics", () => {
  const view = fullView(buildEventLog(events));
  it("groups cases by activity sequence", () => {
    const variants = computeVariants(view);
    expect(variants).toHaveLength(3);
    expect(variants[0]?.share).toBeCloseTo(1 / 3);
  });
  it("computes activity, case and overview stats", () => {
    const activities = computeActivityStats(view);
    expect(activities[0]?.name).toBe("Landing");
    expect(activities[0]?.firstInCase).toBe(2);
    const cases = computeCaseStats(view);
    expect(cases.map((c) => c.name)).toEqual(["s1", "s2", "s3"]);
    expect(cases[0]?.duration).toBe(6 * 60_000);
    expect(cases[0]?.activeShare).toBeCloseTo(4 / 6);
    const overview = computeOverview(view, 10);
    expect(overview.cases).toBe(3);
    expect(overview.events).toBe(8);
    expect(overview.eventsOverTime).toHaveLength(10);
  });
});

describe("layout and format", () => {
  it("positions every node and routes every non-loop edge", () => {
    const dfg = computeDfg(fullView(buildEventLog(events)));
    const layout = layoutDfg(dfg);
    expect(layout.nodes).toHaveLength(dfg.nodes.length);
    expect(layout.edges.filter((e) => e.points.length > 0)).toHaveLength(
      dfg.edges.filter((e) => e.source !== e.target).length,
    );
    expect(layout.height).toBeGreaterThan(0);
  });
  it("formats durations", () => {
    expect(formatDuration(0)).toBe("instant");
    expect(formatDuration(42_000)).toBe("42 s");
    expect(formatDuration(228_000)).toBe("3 m 48 s");
    expect(formatDuration(3 * 86_400_000 + 4 * 3_600_000)).toBe("3 d 4 h");
    expect(formatDuration(16 * 86_400_000)).toBe("2.3 wks");
  });
});
