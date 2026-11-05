# core API

Everything exported from `packages/core/src/index.ts` (`@mukhiya-mining/core`). Types from `types.ts` are re-exported (`export * from "./types"`, see data-model.md).

## Adapters

### ColumnMapping

```ts
interface ColumnMapping {
  caseId: string;        // column name
  activity: string;
  timestamp: string;
  endTimestamp?: string;
  resource?: string;
  attributes?: string[]; // extra columns kept as attributes (default none)
}
```

### fromJson

```ts
fromJson(rows: readonly Record<string, AttributeValue | undefined>[], mapping: ColumnMapping): ProcessEvent[]
```

Maps rows to events. `caseId` and `activity` are converted with `String`. Empty or null `endTimestamp` and `resource` are skipped. Throws `Row <i> is missing <columns>` if caseId, activity or timestamp is null/undefined. Mapped attributes missing in a row become `null`.

### fromCsv

```ts
fromCsv(text: string, mapping: ColumnMapping, options?: CsvOptions): ProcessEvent[]
interface CsvOptions { delimiter?: string }
```

First row is the header. Empty lines are skipped. Without `delimiter` the delimiter is detected on the first line among `,` `;` tab `|` (the one yielding most fields; ties go to the earlier one). Missing cells become `""`. Returns `[]` for empty text. A row with an empty required cell is not rejected by `fromJson` (only null/undefined is); an empty timestamp then fails later in `toMillis`.

```ts
const events = fromCsv(text, { caseId: "session", activity: "page", timestamp: "ts", endTimestamp: "end" });
```

### parseCsv

```ts
parseCsv(text: string, delimiter: string): string[][]
```

RFC 4180 style: quoted cells, `""` escapes, LF, CR and CRLF line breaks. Not streaming.

## Event log building

### EventLogBuilder

Columnar ingest for large logs.

| Member | Signature | Notes |
| --- | --- | --- |
| `size` | `get size(): number` | Rows added. |
| `cases`, `activities` | `readonly string[]` | Dictionaries, filled as rows are added. |
| `attribute` | `(name: string) => number` | Declare a column; returns its index. Idempotent per name. Rows added earlier get `-1`. |
| `add` | `(caseId: string, activity: string, start: number, end = NaN) => number` | `start`/`end` are epoch ms. Returns the row index. |
| `set` | `(column: number, value: AttributeValue, row = last) => void` | Sets an attribute of the last added row (or `row`). `null`/`undefined` is ignored. |
| `addEvent` | `(event: ProcessEvent, row = size) => void` | Parses timestamps with `toMillis` (throws `Invalid timestamp ... (event <row>)`). Adds `resource` and `attributes` as columns. |
| `build` | `() => EventLog` | Sorts and indexes. |

```ts
const b = new EventLogBuilder();
const device = b.attribute("device");
b.add("s1", "Landing", Date.UTC(2026, 0, 1), Date.UTC(2026, 0, 1, 0, 0, 5));
b.set(device, "mobile");
const log = b.build();
```

### sortedOrder

```ts
sortedOrder(caseIds: ArrayLike<number>, starts: ArrayLike<number>, caseCount: number): Uint32Array
```

Returns event positions ordered by (case, start, input order). Counting sort by case, then insertion sort per case (native typed-array sort for cases longer than 64 events).

### buildEventLog

```ts
buildEventLog(events: readonly ProcessEvent[]): EventLog
```

Wrapper over `EventLogBuilder.addEvent`. Input may be in any order.

### caseEvents

```ts
caseEvents(log: EventLog, caseId: number): [start: number, end: number]
```

Half-open event range of a case.

### fullView

```ts
fullView(log: EventLog): LogView
```

All cases kept.

### toMillis

```ts
toMillis(value: string | Date | number, context: string): number
```

Numbers pass through. `"YYYY-MM-DD HH:MM..."` (space separator) is rewritten to `T`. Throws `Invalid timestamp "<value>" (<context>)` when unparsable. Strings without a zone are parsed by `Date.parse` rules.

## Filters

```ts
applyFilters(log: EventLog, filters: readonly Filter[]): LogView
applyFilter(view: LogView, filter: Filter): LogView
```

Filters are ANDed. Each one only narrows the case mask. A filter keeps or drops whole cases; no filter removes individual events.

| Filter | Keeps a case when |
| --- | --- |
| `timeframe` | `mode: "intersecting"` (default): `caseEndTime >= from` and `caseStartTime <= to`. `mode: "contained"`: `caseStartTime >= from` and `caseEndTime <= to`. Missing `from` is -infinity, missing `to` is +infinity. Strings are parsed with `toMillis`. |
| `activity`, `mode: "keep"` | The case contains **any** of the listed activities. |
| `activity`, `mode: "remove"` | The case contains **none** of the listed activities. |
| `endpoints` | First event's activity is in `start` (if `start` is non-empty) and last event's activity is in `end` (if `end` is non-empty). Empty or missing lists do not constrain. |
| `variants` | The case's variant is among the first `top` variants (sorted by case count) of the **current view**, and that variant has at least `minCases` cases (`minCases` default 0, `top` default all). |

Notes:

- Activity names not present in the log are ignored. With `keep` and no known name, no case is kept. With `remove` and no known name, all cases are kept.
- `variants` ranks variants in the view produced by the filters before it. The `applyFilters` comment says order does not matter, but for `variants` the order changes the result.

```ts
const view = applyFilters(log, [
  { type: "activity", mode: "remove", activities: ["Help"] },
  { type: "endpoints", end: ["Order confirmed"] },
  { type: "variants", top: 5 },
]);
```

## Directly-follows graph

### DfgOptions

```ts
interface DfgOptions {
  activityDetail?: number; // share of activities kept, by frequency. Default 1.
  pathDetail?: number;     // share of paths kept beyond connectivity edges. Default 1.
}
```

### computeDfg

```ts
computeDfg(view: LogView, options?: DfgOptions): Dfg
```

- Walks every kept case once, in event order.
- **Hidden activities are projected out:** events of hidden activities are skipped, so A -> hidden -> B becomes A -> B. Waiting time is measured from the end of the last visible event.
- Each case adds a Start edge to its first visible activity and an End edge from its last. A case with no visible events adds a Start -> End edge.
- Edges are accumulated in a flat array indexed `source * (A + 2) + target` (activities `0..A-1`, START = A, END = A + 1).
- Node duration = event end - start (events without an end add no duration). Edge duration = waiting time (see data-model.md).
- Only nodes/edges with frequency > 0 are returned. `pathDetail` is then applied with `selectEdges`.

### selectActivities

```ts
selectActivities(view: LogView, detail: number): Uint8Array
```

Returns a per-activity `0/1` array. Keeps the most frequent `max(1, ceil(clamp(detail, 0, 1) * n))` activities, where `n` is the number of activities with at least one event in the view. Ties are broken by activity id.

### selectEdges

```ts
selectEdges(edges: DfgEdge[], detail: number): DfgEdge[]
```

`detail` is clamped to 0..1. At 1 all edges are returned. Otherwise, edges are sorted by frequency (descending) and the **connectivity rule** applies: an edge is required if its source has no kept outgoing edge yet or its target has no kept incoming edge yet. Then `round(detail * optional.length)` of the remaining, most frequent edges are added back. Original order is preserved in the result.

```ts
const full = computeDfg(view, { activityDetail: 0.8 });
const slim = { ...full, edges: selectEdges(full.edges, 0.3) };
```

## Variants

```ts
variantIndex(log: EventLog): { caseVariant: Int32Array; sequences: number[][] }
computeVariants(view: LogView): Variant[]
```

`variantIndex` assigns a stable variant id per distinct activity sequence over the full log. It is cached in a `WeakMap` per `EventLog` and independent of filters. `computeVariants` returns the variants present in the view, sorted by case count descending, then by id. `share = caseIds.length / view.caseCount`.

## Statistics

### computeActivityStats

```ts
computeActivityStats(view: LogView): ActivityStat[]
interface ActivityStat {
  activity: number; name: string;
  frequency: number; relativeFrequency: number; // frequency / view.eventCount
  caseFrequency: number;
  firstInCase: number; lastInCase: number;       // cases starting / ending with it
  duration: DurationStats;
}
```

Sorted by frequency, descending. Activities with no events in the view are omitted.

### computeCaseStats

```ts
computeCaseStats(view: LogView): CaseStat[]
interface CaseStat {
  caseId: number; name: string; events: number; variant: number;
  start: number; end: number; duration: number;
  activeShare: number; // time inside events with an end / case duration, capped at 1; 0 if duration is 0
}
```

Sorted by start time, ascending. `variant` is the variant id from `variantIndex`.

### computeOverview

```ts
computeOverview(view: LogView, bins = 40): Overview
interface Overview {
  cases: number; events: number; activities: number; variants: number;
  start: number; end: number;               // NaN when there are no cases
  caseDuration: DurationStats;
  eventsPerCase: DurationStats;
  eventsOverTime: HistogramBin[];
  activeCasesOverTime: HistogramBin[];       // cases whose span touches each bin
  caseDurationHistogram: HistogramBin[];
  eventsPerCaseHistogram: HistogramBin[];    // min(bins, 30) bins
}
```

## Duration and histogram helpers

```ts
durationStats(values: number[]): DurationStats          // sorts the array in place
typedDurationStats(values: Float64Array): DurationStats // sorts in place, native numeric sort
histogram(values: ArrayLike<number>, bins = 40): HistogramBin[]
interface HistogramBin { from: number; to: number; count: number }
const EMPTY_DURATION: DurationStats                     // all zeros
```

`histogram` is equal-width over `[min, max]`; it returns `[]` for no values. When all values are equal the bin width is 1.

### SlotAccumulator

```ts
new SlotAccumulator(slots: number)
```

| Member | Notes |
| --- | --- |
| `slots` | Number of slots. |
| `frequency`, `caseFrequency`, `maxRepetitions` | `Uint32Array`, one entry per slot. |
| `hit(slot, caseId, duration)` | Count one occurrence. `NaN` duration is not stored. |
| `frequencyStats(slot, caseCount)` | Returns `FrequencyStats`. |
| `durationStats(slot)` | Returns `DurationStats` (sorts the slot's buffer). |

A slot is an activity id, or `source * stride + target` for paths. `caseId` must be visited in non-interleaved order (all hits of one case before the next) for `caseFrequency` to be correct.

## Layout

```ts
layoutDfg(dfg: Dfg, options?: LayoutOptions): Layout
nodeWidth(label: string, options?: LayoutOptions): number
```

```ts
interface LayoutOptions {
  direction?: "TB" | "LR";   // default "TB"
  nodeHeight?: number;       // default 40
  minNodeWidth?: number;     // default 120
  maxNodeWidth?: number;     // default 260
  charWidth?: number;        // default 7 (px per label character)
  nodeSeparation?: number;   // default 40
  rankSeparation?: number;   // default 56
}
interface LayoutNode { id: string; x: number; y: number; width: number; height: number }
interface LayoutEdge { id: string; source: string; target: string; points: { x: number; y: number }[] }
interface Layout { nodes: LayoutNode[]; edges: LayoutEdge[]; width: number; height: number }
```

- `nodeWidth = max(minNodeWidth, min(maxNodeWidth, label.length * charWidth + 28))`.
- Start and End pseudo nodes are 24 x 24.
- Uses dagre with the greedy acyclicer, margin 20; edge weight is `max(1, round(frequency))`. Only activities go into dagre, so Start/End cannot pull the spine sideways.
- Start is placed one rank above the drawing over the activity most cases start with; End one rank below under the activity most cases end with (as in the reference tool). Their edges are a straight run when the activity is on the adjacent rank, otherwise a detour around the nearer side of the drawing (`detour`), which the renderer splines.
- Self loops get `points: []`; the renderer draws them.
- Node `x`/`y` are centres. Bounds are re-fitted so everything starts at the 20 px margin, with 60 px extra on the right for loops and labels.
- Pure function; safe in a worker.

## Format helpers

| Function | Output |
| --- | --- |
| `formatDuration(ms)` | `"instant"` (< 1 s), `"42 s"`, `"3 m 48 s"`, `"2 h 10 m"`, `"3 d 4 h"`, `"2.3 wks"` (>= 2 weeks). Non-finite gives `"–"`. |
| `formatPercent(share, digits = 1)` | `0.1234` gives `"12.3%"`; values below 10 % use 2 decimals; trailing `.0` removed. |
| `formatNumber(value)` | `Intl.NumberFormat`, at most 1 decimal, locale default. |
| `formatDateTime(ms)` | `Intl.DateTimeFormat` medium date + short time; non-finite gives `"–"`. |

## Sample data

```ts
generateSampleLog(options?: SampleOptions): ProcessEvent[]
generateSampleEventLog(options?: SampleOptions): EventLog
seededRandom(seed: number): () => number   // mulberry32, returns [0, 1)
interface SampleOptions {
  cases?: number;            // default 2000
  seed?: number;             // default 7
  start?: number;            // epoch ms of the window start; default Date.UTC(2026, 9, 1)
  days?: number;             // window length; default 30
  maxEventsPerCase?: number; // default 25
}
```

Case ids look like `s-0001` (base 36). Attributes: `device`, `channel`. See demo.md for the journey model. `generateSampleEventLog` writes straight into `EventLogBuilder`.
