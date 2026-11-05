# Data model

All types are in `packages/core/src/types.ts` and exported from `@mukhiya-mining/core`.

## AttributeValue

```ts
type AttributeValue = string | number | boolean | null;
```

## ProcessEvent

Normalised input event. One row per activity instance.

| Field | Type | Notes |
| --- | --- | --- |
| `caseId` | `string` | Case (for example a session). |
| `activity` | `string` | Activity (for example a page). |
| `timestamp` | `string \| Date \| number` | Start. Numbers are epoch ms. Strings go through `toMillis`. |
| `endTimestamp` | `string \| Date \| number` (optional) | End. If absent, the event has no duration. |
| `resource` | `string` (optional) | Stored as the attribute column named `resource`. |
| `attributes` | `Record<string, AttributeValue>` (optional) | One attribute column per key. |

## EventLog

Indexed event log. Events are stored sorted by (case, start time).

**Invariant:** a case is the contiguous range `[caseStart[c], caseStart[c] + caseLength[c])` in the event arrays. Every event-level typed array has one entry per event (`eventCount`). Per-case arrays have one entry per case.

| Field | Type | Level | Meaning |
| --- | --- | --- | --- |
| `activities` | `string[]` | dictionary | Activity names; index is the activity id. |
| `cases` | `string[]` | dictionary | Case ids; index is the case id used everywhere. |
| `caseStart` | `Uint32Array` | per case | Index of the first event of the case. |
| `caseLength` | `Uint32Array` | per case | Number of events. |
| `caseStartTime` | `Float64Array` | per case | Minimum event start (epoch ms). |
| `caseEndTime` | `Float64Array` | per case | Maximum of event end, or of start when an event has no end. |
| `eventActivity` | `Uint32Array` | per event | Activity id. |
| `eventStart` | `Float64Array` | per event | Start, epoch ms. |
| `eventEnd` | `Float64Array` | per event | End, epoch ms. `NaN` when absent. |
| `attributes` | `AttributeColumn[]` | per event (codes) | Dictionary-encoded columns. |
| `eventCount` | `number` | | Total events. |

Sort order is (case, start, input order). Events with the same start keep their input order.

## AttributeColumn

```ts
interface AttributeColumn {
  name: string;
  values: AttributeValue[]; // dictionary
  codes: Int32Array;        // one per event; -1 = no value
}
```

Value of event `e`: `codes[e] >= 0 ? values[codes[e]] : undefined`.

## LogView

A subset of the cases. Events are never copied.

| Field | Type | Meaning |
| --- | --- | --- |
| `log` | `EventLog` | The underlying log. |
| `caseMask` | `Uint8Array` | One byte per case; `1` keeps the case. |
| `caseCount` | `number` | Cases kept. |
| `eventCount` | `number` | Events in the kept cases. |

## DurationStats

`{ count, total, mean, median, min, max }`, all numbers in ms. `count` is the number of durations measured. An empty set gives all zeros (`EMPTY_DURATION`).

## FrequencyStats

| Field | Meaning |
| --- | --- |
| `frequency` | Occurrences of the activity or transition. |
| `caseFrequency` | Distinct cases containing it. |
| `caseCoverage` | `caseFrequency / cases in view`, 0..1. |
| `maxRepetitions` | Highest number of occurrences inside one case (not only consecutive ones). |

## Dfg, DfgNode, DfgEdge

```ts
const START_NODE = "__start__";
const END_NODE = "__end__";
```

`DfgNode extends FrequencyStats`:

| Field | Meaning |
| --- | --- |
| `id` | `String(activityId)`, or `START_NODE` / `END_NODE`. |
| `name` | Activity name; `"Start"` / `"End"` for the pseudo nodes. |
| `activity` | Activity id, `-1` for pseudo nodes. |
| `duration` | `DurationStats` of event durations (end - start, only events with an end). |
| `startFrequency` | Cases that start with this activity (after hiding). |
| `endFrequency` | Cases that end with this activity (after hiding). |

`DfgEdge extends FrequencyStats`:

| Field | Meaning |
| --- | --- |
| `id` | `"<source>><target>"`, for example `"0>3"` or `"__start__>0"`. |
| `source`, `target` | Node ids. |
| `duration` | Waiting time: next event start minus previous event end (previous start if it has no end). Start/end edges have no durations. |

`Dfg`: `{ nodes, edges, hiddenActivities, caseCount }`. `nodes` always begins with the Start and End pseudo nodes. `hiddenActivities` lists activity ids hidden by `activityDetail`. Pseudo nodes have `frequency = caseFrequency = caseCount`.

## Variant

```ts
interface Variant {
  id: number;           // stable per log, see variantIndex
  activities: number[]; // activity ids in order
  caseIds: number[];    // indexes into log.cases
  share: number;        // caseIds.length / view.caseCount
}
```

## Filter

```ts
type Filter =
  | { type: "timeframe"; from?: string; to?: string; mode?: "intersecting" | "contained" }
  | { type: "activity"; mode: "keep" | "remove"; activities: string[] }
  | { type: "endpoints"; start?: string[]; end?: string[] }
  | { type: "variants"; top?: number; minCases?: number };
```

Semantics are in core-api.md.
