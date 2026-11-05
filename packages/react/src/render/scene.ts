import {
  type Dfg,
  type DfgEdge,
  type DfgNode,
  END_NODE,
  formatDuration,
  formatNumber,
  formatPercent,
  type Layout,
  type LayoutEdge,
  type LayoutNode,
  START_NODE,
} from "@mukhiya-mining/core";
import {
  arrowHead,
  arrowSize,
  midpoint,
  type Point,
  routePath,
  selfLoop,
  shortenEnd,
} from "./paths";
import {
  colorAt,
  edgeWidth,
  FREQUENCY_PALETTE,
  isPerformanceShow,
  labelColor,
  type Metric,
  metricValue,
  normalise,
  type Palette,
  PERFORMANCE_PALETTE,
  type Show,
} from "./scales";

export interface SceneNode {
  id: string;
  kind: "activity" | "start" | "end";
  x: number;
  y: number;
  width: number;
  height: number;
  name: string;
  value: string;
  secondary?: string;
  fill: string;
  stroke: string;
  textColor: string;
  t: number;
}

export interface SceneEdge {
  id: string;
  source: string;
  target: string;
  path: string;
  arrow: string;
  width: number;
  color: string;
  label: string;
  secondary?: string;
  labelAt: Point;
  /** Where the stroke starts and ends, for along-path gradients. */
  from: Point;
  to: Point;
  dashed: boolean;
  t: number;
}

export interface Scene {
  nodes: SceneNode[];
  edges: SceneEdge[];
  width: number;
  height: number;
}

export interface SceneOptions {
  metric: Metric;
  show: Show;
  secondary?: Show;
  palette?: Palette;
}

/** Format a metric for a label. Percentages for coverage, durations for performance, counts otherwise. */
export function formatValue(value: number, show: Show): string {
  if (Number.isNaN(value)) return "";
  if (show === "caseCoverage") return formatPercent(value);
  if (isPerformanceShow(show)) return formatDuration(value);
  return formatNumber(value);
}

interface Resolved {
  palette: Palette;
  show: Show;
  secondary: Show | undefined;
  maxNode: number;
  maxEdge: number;
  byId: Map<string, LayoutNode>;
}

/** Everything the SVG needs, with colours and geometry resolved. Pure; no DOM. */
export function buildScene(dfg: Dfg, layout: Layout, options: SceneOptions): Scene {
  const palette =
    options.palette ?? (options.metric === "frequency" ? FREQUENCY_PALETTE : PERFORMANCE_PALETTE);
  const { show, secondary } = options;
  const activityNodes = dfg.nodes.filter((n) => n.activity >= 0);
  const realEdges = dfg.edges.filter((e) => e.source !== START_NODE && e.target !== END_NODE);
  const finite = (values: number[]) => Math.max(0, ...values.filter((v) => !Number.isNaN(v)));
  const r: Resolved = {
    palette,
    show,
    secondary,
    maxNode: finite(activityNodes.map((n) => metricValue(n, show))),
    maxEdge: finite(realEdges.map((e) => metricValue(e, show))),
    byId: new Map(layout.nodes.map((n) => [n.id, n])),
  };
  const nodes = dfg.nodes.map((n) => sceneNode(n, r)).filter((n): n is SceneNode => n !== null);
  const layoutEdges = new Map(layout.edges.map((e) => [e.id, e]));
  const edges = dfg.edges
    .map((e) => sceneEdge(e, layoutEdges.get(e.id), r))
    .filter((e): e is SceneEdge => e !== null);
  return { nodes, edges, width: layout.width, height: layout.height };
}

function sceneNode(node: DfgNode, r: Resolved): SceneNode | null {
  const pos = r.byId.get(node.id);
  if (!pos) return null;
  const kind = node.id === START_NODE ? "start" : node.id === END_NODE ? "end" : "activity";
  const value = metricValue(node, r.show);
  const raw = kind === "activity" ? normalise(value, r.maxNode, r.show) : 0;
  const t = Number.isNaN(raw) ? 0 : raw;
  const activity = kind === "activity";
  return {
    id: node.id,
    kind,
    x: pos.x,
    y: pos.y,
    width: pos.width,
    height: pos.height,
    name: node.name,
    value: activity ? formatValue(value, r.show) : "",
    ...(r.secondary && activity
      ? { secondary: formatValue(metricValue(node, r.secondary), r.secondary) }
      : {}),
    fill: activity ? colorAt(r.palette.node, t) : "var(--pm-marker)",
    stroke: activity ? colorAt(r.palette.node, Math.min(1, t + 0.25)) : "var(--pm-marker)",
    textColor: activity ? labelColor(t) : "var(--pm-fg)",
    t,
  };
}

interface Geometry {
  path: string;
  arrow: string;
  labelAt: Point;
  from: Point;
  to: Point;
}

function loopGeometry(source: LayoutNode, size: number): Geometry {
  const loop = selfLoop(source);
  return {
    path: loop.path,
    arrow: arrowHead(loop.points[0] as Point, loop.points[1] as Point, size),
    labelAt: loop.label,
    from: { x: source.x + source.width / 2, y: source.y },
    to: loop.points[1] as Point,
  };
}

function routeGeometry(
  points: Point[],
  size: number,
  width: number,
  label: Point | undefined,
): Geometry {
  const first = points[0] as Point;
  const tip = points[points.length - 1] as Point;
  // Stop the stroke a little inside the head so the two overlap and read as one shape.
  const trimmed = shortenEnd(points, size * 0.7);
  const route = routePath(trimmed);
  const tail = route.points.length > 1 ? (route.points[route.points.length - 2] as Point) : tip;
  const mid = midpoint(route.points);
  return {
    path: route.d,
    arrow: arrowHead(tail, tip, size),
    labelAt: label
      ? { x: label.x - 16, y: label.y + 4 }
      : { x: mid.point.x + width / 2 + 6, y: mid.point.y + 4 },
    from: first,
    to: tip,
  };
}

function sceneEdge(
  edge: DfgEdge,
  layoutEdge: LayoutEdge | undefined,
  r: Resolved,
): SceneEdge | null {
  if (!layoutEdge) return null;
  const pseudo = edge.source === START_NODE || edge.target === END_NODE;
  const value = metricValue(edge, r.show);
  const raw = pseudo ? 0 : normalise(value, r.maxEdge, r.show);
  const t = Number.isNaN(raw) ? 0 : raw;
  const width = pseudo ? 1.5 : edgeWidth(t);
  const size = arrowSize(width);
  let geometry: Geometry;
  if (edge.source === edge.target) {
    const source = r.byId.get(edge.source);
    if (!source) return null;
    geometry = loopGeometry(source, size);
  } else {
    geometry = routeGeometry(layoutEdge.points, size, width, layoutEdge.label);
  }
  const label =
    pseudo && edge.source === START_NODE
      ? formatValue(edge.caseCoverage, "caseCoverage")
      : formatValue(value, r.show);
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    ...geometry,
    width,
    color: pseudo ? "var(--pm-marker)" : colorAt(r.palette.edge, t),
    label,
    ...(r.secondary && !pseudo
      ? { secondary: formatValue(metricValue(edge, r.secondary), r.secondary) }
      : {}),
    dashed: pseudo,
    t,
  };
}

function hash(text: string): string {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function edgeMarkup(e: SceneEdge, selected: boolean): string {
  const color = selected ? "var(--pm-selected)" : e.color;
  const gradientId = `pm-g-${hash(e.id)}`;
  const stroke = selected || e.dashed ? color : `url(#${gradientId})`;
  const parts: string[] = [
    `<g class="pm-edge${selected ? " is-selected" : ""}" data-id="${esc(e.id)}">`,
  ];
  if (!selected && !e.dashed) {
    // Lighter at the source, full colour at the arrow: the eye follows the flow direction.
    parts.push(
      `<linearGradient id="${gradientId}" gradientUnits="userSpaceOnUse" x1="${e.from.x}" y1="${e.from.y}" x2="${e.to.x}" y2="${e.to.y}"><stop offset="0" stop-color="${color}" stop-opacity=".55"/><stop offset="1" stop-color="${color}"/></linearGradient>`,
    );
  }
  parts.push(
    `<path d="${e.path}" fill="none" stroke="transparent" stroke-width="${Math.max(12, e.width + 8)}" class="pm-edge-hit"/>`,
  );
  parts.push(
    `<path d="${e.path}" fill="none" stroke="${stroke}" stroke-width="${e.width}" stroke-linecap="butt" stroke-linejoin="round"${e.dashed ? ' stroke-dasharray="4 4"' : ""}/>`,
  );
  parts.push(
    `<path d="${e.arrow}" fill="${color}" stroke="${color}" stroke-width=".6" stroke-linejoin="round"/>`,
  );
  if (e.label) {
    const secondary = e.secondary
      ? `<tspan fill="var(--pm-muted)" font-size="9"> (${esc(e.secondary)})</tspan>`
      : "";
    parts.push(
      `<text x="${e.labelAt.x}" y="${e.labelAt.y}" class="pm-edge-label" font-size="11" fill="${e.dashed ? "var(--pm-muted)" : "var(--pm-fg)"}" paint-order="stroke" stroke="var(--pm-bg)" stroke-width="3" stroke-linejoin="round">${esc(e.label)}${secondary}</text>`,
    );
  }
  parts.push("</g>");
  return parts.join("");
}

function markerMarkup(n: SceneNode): string {
  const glyph =
    n.kind === "start"
      ? `<path d="M${n.x - 5} ${n.y - 4} L${n.x + 5} ${n.y - 4} L${n.x} ${n.y + 5} Z" fill="var(--pm-marker)"/>`
      : `<rect x="${n.x - 4}" y="${n.y - 4}" width="8" height="8" rx="1" fill="var(--pm-marker)"/>`;
  return `<g class="pm-node pm-node-${n.kind}" data-id="${esc(n.id)}"><circle cx="${n.x}" cy="${n.y}" r="${n.width / 2}" fill="var(--pm-marker-bg)" stroke="var(--pm-marker)" stroke-width="1.5"/>${glyph}</g>`;
}

function nodeMarkup(n: SceneNode, selected: boolean): string {
  if (n.kind !== "activity") return markerMarkup(n);
  const x = n.x - n.width / 2;
  const y = n.y - n.height / 2;
  const fill = selected ? "var(--pm-selected)" : n.fill;
  const stroke = selected ? "var(--pm-selected-stroke)" : n.stroke;
  const text = selected ? "#fff" : n.textColor;
  const secondary = n.secondary ? ` · ${esc(n.secondary)}` : "";
  return [
    `<g class="pm-node${selected ? " is-selected" : ""}" data-id="${esc(n.id)}" transform="translate(${x} ${y})">`,
    `<rect width="${n.width}" height="${n.height}" rx="6" fill="${fill}" stroke="${stroke}" stroke-width="1"/>`,
    `<rect width="${n.width}" height="${n.height}" rx="6" fill="url(#pm-shine)" pointer-events="none"/>`,
    `<text x="${n.width / 2}" y="${n.height / 2 - 3}" text-anchor="middle" font-size="12" fill="${text}">${esc(n.name)}</text>`,
    `<text x="${n.width / 2}" y="${n.height / 2 + 12}" text-anchor="middle" font-size="10.5" fill="${text}" opacity=".9">${esc(n.value)}${secondary}</text>`,
    "</g>",
  ].join("");
}

/** Serialise a scene to standalone SVG markup (used for export and server-side previews). */
export function sceneToSvg(
  scene: Scene,
  options: { selected?: string | undefined; className?: string } = {},
): string {
  const head = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${scene.width} ${scene.height}" width="${scene.width}" height="${scene.height}" class="${options.className ?? "pm-map"}" font-family="system-ui, sans-serif">`;
  const defs = `<defs><linearGradient id="pm-shine" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".12"/></linearGradient></defs>`;
  const edges = scene.edges.map((e) => edgeMarkup(e, options.selected === e.id));
  const nodes = scene.nodes.map((n) => nodeMarkup(n, options.selected === n.id));
  return [head, defs, ...edges, ...nodes, "</svg>"].join("");
}
