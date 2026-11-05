# react API

Everything exported from `packages/react/src/index.ts` (`@mukhiya-mining/react`). Import the stylesheet once:

```ts
import "@mukhiya-mining/react/styles.css";
```

## Controlled and uncontrolled state

`useControllable(value, defaultValue, onChange)` (internal) implements the convention: when `value !== undefined` the prop controls the state; otherwise internal state starts at `defaultValue`. `onChange` is called in both cases. Passing `undefined` (not `null`) means uncontrolled. For `selection`, `null` is a controlled "nothing selected".

## ProcessMiningProvider

Holds the log, filters, selection and permissions. Renders `<div class="pm-root" data-theme={colorScheme} style={{...theme, ...style}}>`.

| Prop | Type | Notes |
| --- | --- | --- |
| `log` | `EventLog` | Required. |
| `filters` / `defaultFilters` / `onFiltersChange` | `Filter[]` / `Filter[]` / `(f: Filter[]) => void` | Controlled / initial (default `[]`) / change callback. |
| `selection` / `defaultSelection` / `onSelectionChange` | `Selection \| null` | Same convention; default `null`. |
| `permissions` | `{ canFilter?: boolean; canExport?: boolean }` | Both default `true`. `canFilter: false` hides the "+ filter" button and the popover's "Filter this ..." button. `canExport` is stored in the context but no component reads it in this code. |
| `theme` | `Record<string, string>` | CSS custom properties (`--pm-*`) set inline on the root. |
| `colorScheme` | `"light" \| "dark"` | Sets `data-theme`. Omit for light defaults. |
| `onCaseOpen` | `(caseId: string) => void` | Called with the case id string by the "Open" button in the case detail. The button is hidden if the prop is absent. |
| `className`, `style` | | Added to the root. |
| `children` | `ReactNode` | |

The provider computes `view = applyFilters(log, filters)` (memoised).

### Selection

```ts
type Selection =
  | { kind: "activity"; id: string }   // node id (String(activityId))
  | { kind: "path"; id: string }       // edge id "source>target"
  | { kind: "variant"; id: number }
  | { kind: "case"; caseId: number };
```

### Permissions

```ts
interface Permissions { canFilter?: boolean; canExport?: boolean }
```

## Hooks

All three throw `useProcessModel must be used inside <ProcessMiningProvider>` outside a provider.

| Hook | Returns |
| --- | --- |
| `useProcessModel()` | `{ log, view, filters, setFilters, selection, setSelection, permissions, onCaseOpen }` (`permissions` is `Required<Permissions>`). |
| `useFilters()` | `[filters, setFilters]` |
| `useSelection()` | `[selection, setSelection]` |

```tsx
function Count() {
  const { view } = useProcessModel();
  return <span>{view.caseCount} cases</span>;
}
```

## ProcessExplorer

All-in-one: provider, tab bar (Map, Statistics, Cases), `FilterBar` on the right of the tab bar, and the active view.

Props = `ProcessMiningProviderProps` without `children`, plus:

| Prop | Type | Notes |
| --- | --- | --- |
| `tab` / `defaultTab` / `onTabChange` | `ExplorerTab` = `"map" \| "statistics" \| "cases"` | Default tab `"map"`. Note: `tab` overrides internal state; `onTabChange` fires on click. |
| `map` | `ProcessMapProps` | Passed to `ProcessMap`. |
| `height` | `number \| string` | Default `640`. Applied as root height. The explorer has `min-height: 480px`. |

```tsx
<ProcessExplorer log={log} height={640} colorScheme="dark" onCaseOpen={(id) => router.push(`/s/${id}`)} />
```

## ProcessMap

Needs a provider. Renders the SVG viewport, a toolbar (zoom %, "Fit", counts) and the right rail.

| Prop | Type | Notes |
| --- | --- | --- |
| `metric` / `defaultMetric` / `onMetricChange` | `Metric` = `"frequency" \| "performance"` | Default `"frequency"`. |
| `show` | `Show` | Value displayed. If set, it overrides the internal choice (the rail select then has no effect). Default derived from metric. |
| `detail` / `defaultDetail` / `onDetailChange` | `Detail` = `{ activities: number; paths: number }` (0..1) | Default `{ activities: 1, paths: 0.5 }`. |
| `secondary` | `Show \| null` | **Initial** secondary metric only (read once into state). |
| `showRail` | `boolean` | `false` hides the rail. |
| `className`, `style` | | |

Defaults of `show`: `defaultShow("frequency") = "caseCoverage"`, `defaultShow("performance") = "total"`. Changing the metric in the rail resets `show` to that default and clears `secondary`.

### Pipeline inside ProcessMap

`computeDfg(view, { activityDetail })` (recomputed only when the view or activity detail changes) → `selectEdges(edges, detail.paths)` → `layoutDfg` → `buildScene`.

### Behaviours

| Action | Result |
| --- | --- |
| Mouse wheel | Zoom around the cursor. Factor `exp(-deltaY * 0.0015)`, clamped to 0.1..4. `preventDefault` is called. |
| Drag (primary button) | Pan. Pointer capture starts after a move of more than 3 px, so plain clicks reach nodes and edges. |
| Click on empty canvas (no drag) | Clears the selection. |
| Fit button | Fits the drawing in the viewport with 24 px padding; zoom capped at 1.5. |
| Auto fit | Runs when the rounded scene width or height changes (not on metric changes). |
| Click node | Selection `{ kind: "activity", id }`; selected node is purple; popover opens. |
| Click edge | Selection `{ kind: "path", id }`. |
| Popover | Frequency section always; Performance section if `duration.count > 0`. Node popovers add Start/End frequency when > 0. Buttons: "Filter this activity..." / "Filter this path..." (only if `canFilter`) and "Close". Escape inside the popover closes it. |
| "Filter this ..." | Appends `{ type: "activity", mode: "keep", activities }` to the filters and clears the selection. For an edge, `activities` are its two endpoints without Start/End. A Start -> End edge has no button. |
| No matching cases | Shows "No cases match the current filters." |

### Rail

Detail sliders (Activities, Paths, 0..100), Metric buttons (Frequency, Performance), Show select, Legend (node palette gradient with `0` and the max node value), Secondary select (lists the other metric's options, plus None). The rail is hidden under 720 px width (CSS).

`Detail` is exported as a type.

## StatisticsView

Needs a provider.

| Prop | Type | Notes |
| --- | --- | --- |
| `page` / `defaultPage` / `onPageChange` | `StatisticsPage` = `"overview" \| "activities" \| "cases"` | Default `"overview"`. `page` overrides internal state. |
| `className`, `style` | | |

Pages:

- **Overview:** four chart buttons (Events over time, Active cases over time, Case duration, Events per case) drawn by an internal SVG bar histogram (native `<title>` tooltips), and KPIs: cases, events, activities, variants, median and mean case duration, events per case (mean), first and last event. Data from `computeOverview(view)`.
- **Activities:** sortable table (Activity, Frequency, Relative, Cases, First in case, Last in case, Median duration, Mean duration) with inline bars on Frequency and Median. Click or Enter on a row sets selection `{ kind: "activity", id: String(activityId) }`. Header click sorts; clicking the active column toggles direction (default sort: Frequency descending).
- **Cases:** sortable header (Case, Events, Variant, Started, Finished, Duration, Active) and a `VirtualList` (row height 28). Row click sets `{ kind: "case", caseId }`. Default sort: start ascending.

## CasesView

Needs a provider. Three columns.

1. **Variants** list: "All cases" row, then variants in `computeVariants` order, labelled "Variant N" (rank in the current list), with case count and share. Click sets the variant filter for the list and selection `{ kind: "variant", id }`.
2. **Cases** list: cases of the chosen variant (or all) in the view, with a search box (case-insensitive substring of the case id) and event counts. Click sets selection `{ kind: "case", caseId }`. Both lists are virtualised (row height 46).
3. **Case detail:** title, event count, KPIs (events, start, duration, plus the first event's value of every non-`resource` attribute), a **Graph | Table** toggle and an "Open" button (if `onCaseOpen`). Graph = numbered event cards with started time, resource ("by ...") and "completed after ..." plus waiting-time gaps. Table = #, Activity, Started, Duration, Wait before, Resource (if a `resource` attribute exists). If no case is selected, the first listed case is shown; with none, "No cases match."

Props: `className`, `style`.

## FilterBar

Needs a provider. Props: `className`, `style`.

- One chip per active filter; click removes it (title "Remove filter").
- "Clear all" when more than one filter.
- "+ filter" (only if `canFilter`) opens the add panel with a filter kind select:
  - Activity: Keep cases with / Remove cases with, plus a multi-select of activities (sorted).
  - Timeframe: From / To (`datetime-local`); builds `mode: "intersecting"`. Needs at least one date.
  - Start / end activity: single selects ("Any" or an activity); builds `start: [x]` / `end: [y]`. Needs at least one.
  - Top variants: number (min 1, default 10); builds `{ type: "variants", top }`.
- Add is disabled until the draft is valid.

```ts
describeFilter(f: Filter): string
```

Chip text. Examples: `With: A, B`, `Without: A`, `Start: X · End: Y`, `Top 5 variants`, `Variants ≥ 3 cases` (`minCases`, default 1, used when `top` is falsy), `Time: <from> – <to>` (`…` for missing).

## VirtualList

```ts
interface VirtualListProps<T> {
  items: readonly T[];
  rowHeight: number;                       // fixed, px
  render: (item: T, index: number) => ReactNode;
  className?: string;
  style?: CSSProperties;
  overscan?: number;                       // default 6
}
```

Windowed list. Rows are absolutely positioned inside a container of height `items.length * rowHeight`. The viewport height is measured from the element (fallback 600).

## Render helpers (`export * from "./render"`)

### Types and scales (`scales.ts`)

```ts
type Metric = "frequency" | "performance";
type FrequencyShow = "frequency" | "caseFrequency" | "caseCoverage" | "maxRepetitions";
type PerformanceShow = "total" | "median" | "mean" | "max" | "min";
type Show = FrequencyShow | PerformanceShow;
FREQUENCY_SHOWS: { value: FrequencyShow; label: string }[]
PERFORMANCE_SHOWS: { value: PerformanceShow; label: string }[]
defaultShow(metric: Metric): Show
metricValue(item: DfgNode | DfgEdge, show: Show): number   // NaN for performance when duration.count === 0
isPerformanceShow(show: Show): show is PerformanceShow
interface Palette { node: [string, string, string]; edge: [string, string, string] }
hexToRgb(hex), mix(a, b, t), colorAt(scale, t), labelColor(t), edgeWidth(t), normalise(value, max, show)
```

| Palette | Node stops | Edge stops |
| --- | --- | --- |
| `FREQUENCY_PALETTE` | `#d6dfe9`, `#3b7fc0`, `#0a2d5c` | `#c3c9cf`, `#5f6872`, `#14181c` |
| `PERFORMANCE_PALETTE` | `#f5ecd8`, `#e39a3c`, `#8f1f2c` | `#c2bdb4`, `#c66a3c`, `#7e1a24` |

- `colorAt` samples a three-stop scale in sRGB; `NaN` is treated as 0.
- `labelColor(t)`: white text when `t > 0.38`, else `#1b2229`.
- `edgeWidth(t) = 1.2 + 8 * clamp(t)`.
- `normalise(value, max, show)`: `value / max` capped at 1; square root for performance shows; `NaN` if `max <= 0` or value is `NaN`.

### Scene (`scene.ts`)

```ts
interface SceneOptions { metric: Metric; show: Show; secondary?: Show; palette?: Palette }
buildScene(dfg: Dfg, layout: Layout, options: SceneOptions): Scene
sceneToSvg(scene: Scene, options?: { selected?: string; className?: string }): string
formatValue(value: number, show: Show): string
```

- `Scene = { nodes: SceneNode[]; edges: SceneEdge[]; width; height }`. `SceneNode` has `id, kind ("activity" | "start" | "end"), x, y, width, height, name, value, secondary?, fill, stroke, textColor, t`. `SceneEdge` has `id, source, target, path, arrow, width, color, label, secondary?, labelAt, from, to, dashed, t`.
- `buildScene` is pure (no DOM). Node and edge scales are normalised to the maximum among activity nodes and among non-Start/End edges.
- Start and End nodes use `var(--pm-marker)`. Start/End edges are dashed, width 1.5, colour `var(--pm-marker)`. The Start edge label shows case coverage.
- `formatValue`: `caseCoverage` as percent, performance shows as duration, others as number; `NaN` gives `""`.
- `sceneToSvg` returns standalone SVG markup. The selected node/edge uses `var(--pm-selected)`, so those CSS variables must resolve where the SVG is shown.
- The "Scene" types are exported (`SceneNode`, `SceneEdge`, `Scene`, `SceneOptions`).

### Paths (`paths.ts`)

Geometry helpers used by the scene: `Point`, `smoothPath(points)` (Catmull-Rom to cubic Bezier), `shortenEnd(points, by)`, `arrowHead(from, tip, size)`, `arrowSize(strokeWidth) = 9 + strokeWidth * 1.9`, `arrowHalfWidth(size)`, `routePath(points)`, `midpoint(points)` (arc-length midpoint and angle), `selfLoop(node)`.

## Not exported

`MapRail`, `Popover`, `SceneSvg`, `usePanZoom`, `Chart`, `useControllable` are internal.
