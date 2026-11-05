# Theming

Source: `packages/react/src/styles.css`. Import it once: `import "@mukhiya-mining/react/styles.css"`.

## Mechanism

- All tokens are CSS custom properties defined on `.pm-root` (the element rendered by `ProcessMiningProvider`).
- `colorScheme="dark"` sets `data-theme="dark"` on the root; the rule `.pm-root[data-theme="dark"]` overrides a subset of the tokens. With no `colorScheme` the attribute is absent and light values apply. There is no automatic `prefers-color-scheme` handling.
- Override tokens with the `theme` prop (inline style) or with your own CSS on `.pm-root` / a parent selector with equal or higher specificity.

```tsx
<ProcessExplorer log={log} theme={{ "--pm-accent": "#0a7d5a", "--pm-radius": "4px" }} />
```

```css
.my-host .pm-root { --pm-accent: #0a7d5a; }
.my-host .pm-root[data-theme="dark"] { --pm-accent: #4fd1a5; }
```

Note: `theme` is set inline, so it wins over both light and dark stylesheet values (dark mode will not change a token you set via `theme`).

## Variables

| Variable | Light | Dark |
| --- | --- | --- |
| `--pm-bg` | `#ffffff` | `#171b1e` |
| `--pm-fg` | `#1b2229` | `#e5e9ec` |
| `--pm-muted` | `#6b747c` | `#98a2aa` |
| `--pm-line` | `#d9dee2` | `#2c3338` |
| `--pm-panel` | `#f3f5f7` | `#1f2529` |
| `--pm-panel-strong` | `#e6eaee` | `#28303a` |
| `--pm-accent` | `#2f6fa8` | `#6fb0e6` |
| `--pm-accent-fg` | `#ffffff` | `#0d1216` |
| `--pm-marker` | `#7d8a93` | `#8d989f` |
| `--pm-marker-bg` | `#e3e8eb` | `#2b3338` |
| `--pm-selected` | `#7a3fa3` | `#9a62c9` |
| `--pm-selected-stroke` | `#5b2a7e` | `#c5a0e6` |
| `--pm-freq-head` | `#2f6b8f` | `#2a5f80` |
| `--pm-freq-body` | `#dcebf3` | `#1f3341` |
| `--pm-perf-head` | `#b8642c` | `#9a5324` |
| `--pm-perf-body` | `#f8e6d6` | `#3f2c1f` |
| `--pm-bar` | `#5b8fc4` | `#6fa0d8` |
| `--pm-font` | `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` | same |
| `--pm-radius` | `8px` | same |
| `--pm-shadow` | `0 10px 30px rgba(0, 0, 0, 0.16)` | same |

Usage:

- `--pm-marker`: Start/End marker outline and glyph, and dashed Start/End edges.
- `--pm-marker-bg`: fill of the Start/End marker circle. Start draws a play glyph (triangle), End a stop glyph (square).
- `--pm-selected`, `--pm-selected-stroke`: selected node/edge (purple).
- `--pm-freq-*`, `--pm-perf-*`: popover section headers and bodies.
- `--pm-bar`: chart bars and inline table bars.
- `--pm-accent`: active tab/segment, chips, sliders, primary buttons.

The node and edge colour scales for the metric are **not** CSS variables: they come from `FREQUENCY_PALETTE` and `PERFORMANCE_PALETTE` in `render/scales.ts`, or from `SceneOptions.palette` if you call `buildScene` yourself.

## Class names a host may target

| Class | Element |
| --- | --- |
| `.pm-root` | Provider root (tokens, font, base colours). |
| `.pm-explorer`, `.pm-tabs`, `.pm-tab`, `.pm-body` | `ProcessExplorer` frame, tab bar, tab button (`aria-selected`), body. |
| `.pm-btn` (`.is-primary`), `.pm-seg`, `.pm-select`, `.pm-input`, `.pm-label` | Shared controls. |
| `.pm-map`, `.pm-map-viewport` (`.is-panning`), `.pm-map-empty`, `.pm-map-toolbar` (only without the rail) | Process map. |
| `.pm-tabs-summary`, `.pm-rail-footer`, `.pm-map-tools`, `.pm-btn-primary`, `.pm-map-export` | Map summary in the explorer header; Animate and Export at the bottom of the rail. |
| `.pm-rail`, `.pm-slider`, `.pm-legend`, `.pm-legend-ticks` | Right rail. |
| `.pm-node` (`.is-selected`), `.pm-edge` (`.is-selected`), `.pm-edge-label` | SVG nodes and edges. |
| `.pm-popover`, `.pm-popover-title`, `.pm-popover-head`, `.pm-popover-body` (`.is-freq`, `.is-perf`), `.pm-popover-row`, `.pm-popover-actions` | Popover. |
| `.pm-filterbar`, `.pm-chip` (`.is-add`), `.pm-x`, `.pm-filter-panel` | Filter bar and add panel. |
| `.pm-stats`, `.pm-stats-nav`, `.pm-stats-main`, `.pm-stats-head`, `.pm-chart-tabs`, `.pm-chart`, `.pm-kpis`, `.pm-kpi` | Statistics view. |
| `.pm-table`, `.pm-cellbar` | Tables and inline bars. |
| `.pm-map.is-animating` | Set on `.pm-map` while the replay is on. Fades the map (see below). |
| `.pm-node.is-active`, `.pm-edge.is-active` | Added by `TokenLayer` to the node or edge that currently carries at least one token. Styled under `.is-animating` (blue node, red path). |
| `.pm-anim-overlay`, `.pm-token` | Token overlay `<svg>` and each token circle (fill `#f6b21b`, stroke `#5a3b00`; fixed colours, not tokens). |
| `.pm-anim-bar`, `.pm-anim-play`, `.pm-anim-timeline`, `.pm-anim-density`, `.pm-anim-seek`, `.pm-anim-clock`, `.pm-anim-speed`, `.pm-anim-factor`, `.pm-anim-info` | Playback bar parts. |
| `.pm-skeleton`, `.pm-sk`, `.pm-sk-tab`, `.pm-sk-chip`, `.pm-sk-map`, `.pm-sk-node`, `.pm-sk-message` | `ExplorerSkeleton` (shimmer animation, disabled under `prefers-reduced-motion`). |
| `.pm-vlist`, `.pm-vlist-inner`, `.pm-vlist-row` | `VirtualList`. |
| `.pm-cases`, `.pm-list`, `.pm-list-head`, `.pm-list-row` (`.is-selected`), `.pm-case`, `.pm-case-head`, `.pm-case-title`, `.pm-case-body`, `.pm-event`, `.pm-event-n`, `.pm-event-card`, `.pm-event-gap`, `.pm-empty` | Cases view. |

`className` props on `ProcessMiningProvider`, `ProcessMap`, `StatisticsView`, `CasesView`, `FilterBar` add a class to the respective root element.

Other CSS behaviour: node hover darkens the node (`brightness(0.86)`); edge hover turns the stroke purple; `prefers-reduced-motion: reduce` disables node transitions; at max-width 720 px the rail is hidden and the stats nav and case lists narrow.

## Animation styling

- The replay highlight colours are fixed values in the stylesheet, not `--pm-*` tokens: token fill `#f6b21b`, stroke `#5a3b00`; active edge stroke and arrow `#c0392b`. They do not change in dark mode.
- Under `.pm-map.is-animating` the map uses the classic replay look with flat colours, never opacity: `.pm-node-shape` fills `--pm-panel-strong` with a `--pm-line` border, the shine overlay is hidden, node text is `--pm-muted`, edges become `--pm-line` at 1.4 px with grey arrows, edge labels are hidden. `.pm-node.is-active` fills `--pm-accent` with `--pm-accent-fg` text; `.pm-edge.is-active` strokes `--pm-active-path` at 1.8 px.
- Highlighting is only CSS plus one class toggle per frame; no inline styles are written to map nodes.
