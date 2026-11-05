# Observed behavior and design notes (process-mining reference study)

Reference: a commercial desktop process-mining tool, Demo mode, studied 2026-11-05 through its
visible UI only (screenshots of the running app). No files, network traffic or binaries were inspected.
Scope decision for our library: web-application process mining (user journeys / clickstream), simple
filters, performance first. Items marked **Assumption** or **Unknown** were not directly observed.

## 1. Page structure and navigation (observed)

- One window, one dataset at a time. Top bar: dataset switcher (dropdown), three tabs **Map · Statistics · Cases**.
- Bottom bar: **Filter**, **TimeWarp**, **Animation** (map only), and **Copy · Delete · Export** on the right.
- Map tab = canvas (left, ~85 %) + right rail (~240 px): _Detail_ sliders, then collapsible _Frequency_ / _Performance_ sections.
- Filter is a **full-window mode** (not a modal): left column "Active filters" list, right side explains and
  recommends filters. Bottom: Cancel · Copy and filter · Apply filter. Escape does not leave it.
- Transitions between tabs are instant (no animation observed). Map re-layout after slider changes is instant
  and the map **auto-fits** to the viewport afterwards (zoom changed 181 % → 70 % → 66 % when sliders changed).

## 2. Process map (observed)

- Directed graph, top-to-bottom layered layout (start marker at top, end marker at bottom).
- **Nodes**: rounded rectangles, activity name on line 1, metric on line 2 (e.g. `67.9%`, `13 d`).
- **Edges**: curved splines with arrowheads; label is the metric (`61.5%`, `38.2 wks`, `instant`). Self-loops drawn as a small loop on the right.
- Start/end edges drawn dashed and light; start marker is a grey-green circle with a triangle.
- Controls: **Zoom slider** (top-left, shows %), mouse **wheel = zoom** (not scroll), **drag on empty canvas = pan**,
  vertical scrollbar on the right of the canvas, search box top-right (unknown behaviour, see §9).
- Right rail **Activities** and **Paths** sliders, 0–100 %, control how many activities/paths are shown
  (simplification). Labels under the sliders show the current %.
- Legend: a vertical gradient wedge (blue for nodes, grey-black for edges) with 20/40/60/80 % tick labels, in the
  Frequency section; a cream-orange-red wedge with duration ticks in the Performance section.
- "Add secondary metrics" adds a small second metric under the primary one on every node and edge.

## 3. Metric encoding (observed)

- **Frequency mode** (Show: Absolute frequency · Case frequency · Max. repetitions · Case coverage):
  node fill goes from pale grey-blue (low) to deep navy (high); edge stroke goes thin light grey → thick black.
- **Performance mode** (Show: Total · Median · Mean · Max · Min duration): node fill cream → orange → dark red;
  edges grey → red, thickness also scales. Zero durations are labelled `instant`.
- Thickness and colour both encode the same metric (redundant encoding, works in greyscale too).

## 4. Statistics and Cases (observed)

- **Statistics**: left list of views (Overview, Activity, Resource, other attributes). Each view has a chart
  (dark panel, bar/line) with selectable chart buttons on the left (Events over time, Active cases over time,
  Case variants, Events per case, Case duration, Case utilization, Mean activity duration, Mean waiting time)
  and a sortable table below with inline bar cells (Frequency, Relative frequency, Median/Mean duration, Duration range).
  Right side of chart: key figures (count, min/median/mean/max, std deviation). Tabs over the table: All · First in case · Last in case.
- **Cases**: three columns. Variants list ("Variant 1 · 88 cases (14.47 %)", with "Complete log" at the top),
  Cases list ("335 · 18 events"), and the case detail: header (id, event count), a timeline strip showing where
  the case sits in the log (red band on a blue area chart), key figures (events, start, duration, active time),
  and a vertical **Graph | Table** toggle. Graph = numbered event cards "Activity / started at … by … / completed after …"
  with waiting-time pills between cards.
- Selecting a variant filters the case list (608 → 88).

## 5. Filters (observed)

- Six filter types: Timeframe, Variation (variants), Performance (case duration), Endpoints (start/end activity),
  Attribute (keep/remove events by attribute value), Follower (sub-sequences).
- Filters stack in a list; the app proposes recommended filters. Apply creates a new dataset version
  ("Copy and filter" keeps the original).
- From a node/edge popover: **"Filter this activity…" / "Filter this path…"** shortcuts.
- **Unknown**: how combined filters are displayed on the map afterwards (not reached in Demo).

## 6. Selection behaviour (observed)

- **Hover node**: fill darkens. No tooltip. **Hover edge**: nothing visible.
- **Click node / edge**: node (or edge) turns purple and a **popover** opens next to it with two stacked sections,
  _Frequency_ (absolute, case frequency, max repetitions, case coverage) and _Performance_ (total, median, mean, max, min
  duration), plus a "Filter this …" button. Edge popover title is `A → B`. Click on empty canvas closes it.
- **Right-click**: no context menu observed.
- Click on a case opens its detail; click on a variant filters cases; table headers are sortable (sort arrow shown).

## 7. Loading, empty, error, large-data states

- **Unknown**: Demo mode gives no loading or error states to observe. Empty state only seen in the Filter screen
  ("click to add filter…" with a hand-drawn arrow hint).
- Large data: the demo log is small (see §9); no degradation visible. **Assumption**: real logs need
  virtualised tables and simplified maps.

## 8. Feel (observed)

- Dense, desktop-like, grey chrome; data areas are white; charts are on dark panels.
- No transition animations between states; everything snaps. Map re-fit is immediate.
- Popovers have a small caret pointing at the element and a drop shadow.
- The "Animation" feature replays cases as moving tokens over the map with a play/pause bar, a clock, a speed slider
  (slow–fast) and modes "Animate relative to real time" / "Synchronize case start times".

## 9. Demo log size and performance (observed)

- 608 cases, 98 variants, 24 activities, 27 resources, 5 roles; roughly 9 000 events (sum of activity frequencies).
- All interactions were instant at this size. Search box: text entry could not be verified from automation (**Unknown**).

## 10. What we keep, what we drop (decision for our library)

Keep: map with frequency/performance encoding, activities/paths sliders, node/edge popover with "filter this",
statistics tables with inline bars, variants → cases → case timeline drill-down, zoom/pan/fit.
Drop: dataset versioning, recipes, TimeWarp, animation replay, resource/role views, complex filter builder.
Add (web-app specific): session = case, page/action = activity, end frequency per page in the node popover (a drop-off highlight on the map is planned, not built).
