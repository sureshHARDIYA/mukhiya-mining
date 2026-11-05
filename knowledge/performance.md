# Performance

## Design choices

| Choice | Where | Effect |
| --- | --- | --- |
| Typed arrays for the log | `EventLog` (`Uint32Array`, `Float64Array`, `Int32Array`) | No per-event objects after ingest; compact memory; buffers can be transferred between threads. |
| Dictionary encoding | `activities`, `cases`, `AttributeColumn` | Strings stored once; events hold integer ids/codes. |
| Columnar ingest | `EventLogBuilder` | Avoids one `ProcessEvent` object per row. `buildEventLog` is a thin wrapper. |
| Counting sort | `sortedOrder` | Orders events by (case, start) in O(n + cases); insertion sort inside each case (cases are nearly sorted), typed-array sort above 64 events per case. |
| Contiguous cases | `caseStart`/`caseLength` | A case is a range; walking a case is a linear scan. |
| Case bitmask filters | `applyFilters`, `LogView` | A filter allocates one `Uint8Array` per case count, never copies events. |
| `SlotAccumulator` with last-seen-case | `accumulate.ts` | Flat typed arrays per slot (activity or `source*stride+target`). `lastCase[slot]` records the last case that hit the slot, so case frequency and per-case repetition counts need no `Set` or `Map` per event. |
| Duration buffers | `SlotAccumulator` | Per-slot `Float64Array` that doubles when full; stats use the native numeric sort. |
| Variant index cache | `variantIndex` | Computed once per `EventLog` (`WeakMap`), independent of filters. |
| Split recomputation | `ProcessMap` | The DFG walk over events is memoised on `[view, activities detail]`. The paths slider only runs `selectEdges`, then layout and scene. |
| Virtualised lists | `VirtualList` | Fixed row height; only visible rows plus overscan are in the DOM. Used for the case table, variants list and cases list. |
| No spread over big arrays | `StatisticsView` cases page | Uses `reduce` instead of `Math.max(...rows)`, which would overflow the argument limit at a million rows. |
| Imperative token layer | `TokenLayer` | Tokens are a fixed pool of `<circle>` elements whose `cx`, `cy` and `opacity` are set directly each frame from a `timeRef`; no React render per token. |
| CSS-only map dimming | `.pm-map.is-animating` | The map is faded by CSS. The only per-frame DOM change on nodes and edges is toggling `is-active` for ids whose state changed. |
| Pixel-size chart | `Chart` + `useElementWidth` | Redraws on container resize (`ResizeObserver`) at real pixel width; no stretching. |
| Pure core | `layoutDfg`, `buildScene` | Run anywhere, including a worker. |

## Measurements

Stress run on 2026-11-05, Apple Silicon laptop, generated sample log (see demo.md).

### Node: 1,000,000 sessions / 4,818,014 events

| Step | Time |
| --- | --- |
| Generate + index | 1163 ms |
| `applyFilters` (3 filters) | 34 ms |
| `computeDfg` | 706 ms |
| `layoutDfg` | 114 ms |
| `computeVariants` | 335 ms |
| `computeActivityStats` | 367 ms |
| `computeCaseStats` | 621 ms |
| `computeOverview` | 1590 ms |

### Token replay

Measured in the browser demo: replay runs at 61 fps with 1,500 to 4,000 tokens. The limit is `animationLimit` (default 1,500; the demo uses 4,000). `buildTracks` with `"window"` sampling scans all kept cases once (sort by start time plus a sliding window), so it grows with the number of kept cases, not with the limit.

### Browser demo (Vite dev, Chromium)

| Step | Time |
| --- | --- |
| Worker generate + index | ~1000 ms |
| First map paint | ~2.5 s |
| Paths slider | 162 ms |
| Activities slider | 1.4 s |
| Statistics overview | ~3 s |
| Cases statistics table | ~1 s |
| Cases tab | 73 ms |
| Add filter | 149 ms |
| JS heap | ~370 MB |

The paths slider is much faster than the activities slider because the paths slider does not redo the DFG walk (see "Split recomputation").

## Known limits

- `computeOverview` is the slowest stage. It calls `computeCaseStats`, collects every event time into a JS array for the histogram, and calls `computeVariants`.
- The `timeframe` filter works at case level: it keeps or drops whole cases based on case start/end time and does not trim events.
- The library has no Web Worker API. The host builds the log in a worker and transfers the buffers, as `apps/demo/src/worker.ts` does.
- `LogView` operations still visit every case (mask check), so cost grows with the number of cases even when few are kept.
- `computeCaseStats` and the Cases page materialise one `CaseStat` object per kept case.
- `activityIds` in filters uses `indexOf` on the activity list per name (fine for tens of activities).
