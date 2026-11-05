# Design reference

Summary of `observations.md`: a study of a commercial desktop process-mining tool (Demo mode), done on 2026-11-05 through its visible UI only. No files, network traffic or binaries were inspected. Items marked Assumption or Unknown in the source were not directly observed.

## What was observed

- **Structure:** one dataset at a time; tabs Map, Statistics, Cases; bottom bar with Filter, TimeWarp, Animation (map only), Copy/Delete/Export. Filter is a full-window mode, not a modal.
- **Map:** top-to-bottom layered graph. Nodes are rounded rectangles with the name and a metric. Edges are curved with arrowheads and a metric label; self loops on the right. Start/end edges are dashed and light. Wheel zooms, dragging empty canvas pans, a zoom slider shows the percentage, and the map auto-fits after slider changes. The right rail has Activities and Paths sliders (0-100 %), legends, and "Add secondary metrics".
- **Metric encoding:** Frequency mode (absolute, case frequency, max repetitions, case coverage): node fill pale grey-blue to navy, edge thin grey to thick black. Performance mode (total, median, mean, max, min): node fill cream to orange to dark red, edge grey to red. Colour and thickness encode the same metric. Zero durations read "instant".
- **Statistics:** list of views (Overview, Activity, Resource, other attributes), a chart with chart buttons, key figures, and a sortable table with inline bars and tabs All / First in case / Last in case.
- **Cases:** three columns: variants (with "Complete log"), cases, case detail (header, timeline strip, key figures, Graph | Table toggle; graph = numbered event cards with waiting-time pills). Selecting a variant filters the case list.
- **Filters:** six types (Timeframe, Variation, Performance, Endpoints, Attribute, Follower). Filters stack, the app recommends some, and Apply creates a new dataset version.
- **Selection:** hover darkens a node, no tooltip. Click on a node or edge turns it purple and opens a popover with Frequency and Performance sections and a "Filter this ..." button. Click on empty canvas closes it. No right-click menu.
- **Feel:** dense, desktop-like, grey chrome, white data areas, charts on dark panels; no tab transition animations; popovers with a caret and a shadow.
- **Demo log:** 608 cases, 98 variants, 24 activities, about 9,000 events; all interactions instant.
- **Unknown:** loading and error states, how combined filters appear on the map, the search box behaviour.

## What the library keeps, drops, changes

| | Items |
| --- | --- |
| Kept | Map with frequency/performance encoding; Activities/Paths sliders; node/edge popover with "filter this"; statistics tables with inline bars; variants -> cases -> case drill-down; zoom, pan, fit. |
| Dropped | Dataset versioning, recipes, TimeWarp, animation replay, resource/role views, complex filter builder. |
| Changed / added | Web-app framing: session = case, page/action = activity. Four filters instead of six. Drop-off (end activity) highlighting was listed as an addition (in the code, end frequency appears in the node popover). |

## Colour conventions in the code

- Node fill and edge weight (colour and width) both encode the selected metric (`FREQUENCY_PALETTE`, `PERFORMANCE_PALETTE`).
- Purple (`--pm-selected`) marks the selected node or edge, and edge hover.
- Start/End paths are dashed and use the neutral `--pm-marker` colour.
- Popover headers use `--pm-freq-*` (blue) for Frequency and `--pm-perf-*` (orange) for Performance.

## Differences from the reference in the code

- Detail sliders default to Activities 100 %, Paths 50 %.
- The Filter UI is a small popover panel, not a full-window mode.
- Statistics has three pages (Overview, Activities, Cases), not per-attribute views.
- Case duration filter (Performance), attribute filter and follower filter are not implemented.
- The code has no animation and no TimeWarp.
