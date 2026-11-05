import dagre from "@dagrejs/dagre";
import { type Dfg, type DfgEdge, END_NODE, START_NODE } from "./types";

interface Point {
  x: number;
  y: number;
}

export interface LayoutNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutEdge {
  id: string;
  source: string;
  target: string;
  /** Polyline points from source to target; a self loop has none and is drawn by the renderer. */
  points: { x: number; y: number }[];
  /** Label anchor reserved by the layout (right of the edge), when the layout placed one. */
  label?: { x: number; y: number };
}

export interface Layout {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  width: number;
  height: number;
}

export interface LayoutOptions {
  direction?: "TB" | "LR";
  nodeHeight?: number;
  minNodeWidth?: number;
  maxNodeWidth?: number;
  /** Approximate width of one label character in px, used to size nodes. */
  charWidth?: number;
  nodeSeparation?: number;
  rankSeparation?: number;
  /** Space reserved beside each edge for its label, so labels do not sit on nodes or other edges. */
  edgeLabel?: { width: number; height: number };
}

export function nodeWidth(label: string, options: LayoutOptions = {}): number {
  const { charWidth = 7, minNodeWidth = 120, maxNodeWidth = 260 } = options;
  return Math.max(minNodeWidth, Math.min(maxNodeWidth, label.length * charWidth + 28));
}

/** Layered layout for a DFG. Pure function of the graph; safe to run in a worker. */
export function layoutDfg(dfg: Dfg, options: LayoutOptions = {}): Layout {
  const {
    direction = "TB",
    nodeHeight = 40,
    nodeSeparation = 40,
    rankSeparation = 56,
    edgeLabel = { width: 40, height: 14 },
  } = options;
  const graph = new dagre.graphlib.Graph({ multigraph: false });
  graph.setGraph({
    rankdir: direction,
    nodesep: nodeSeparation,
    ranksep: rankSeparation,
    marginx: 20,
    marginy: 20,
    acyclicer: "greedy",
  });
  graph.setDefaultEdgeLabel(() => ({}));
  // Start and End stay out of the ranking: as ranked nodes their dummy chains drag the ordering,
  // bend the main spine sideways and wrap dotted boxes around the drawing. They are placed after.
  const isPseudo = (id: string) => id === START_NODE || id === END_NODE;
  for (const node of dfg.nodes) {
    if (isPseudo(node.id)) continue;
    graph.setNode(node.id, { width: nodeWidth(node.name, options), height: nodeHeight });
  }
  for (const edge of dfg.edges) {
    if (edge.source === edge.target || isPseudo(edge.source) || isPseudo(edge.target)) continue;
    graph.setEdge(edge.source, edge.target, {
      weight: Math.max(1, Math.round(edge.frequency)),
      width: edgeLabel.width,
      height: edgeLabel.height,
      labelpos: "r",
      labeloffset: 4,
    });
  }
  dagre.layout(graph);
  const nodes: LayoutNode[] = graph.nodes().map((id) => {
    const n = graph.node(id);
    return { id, x: n.x, y: n.y, width: n.width, height: n.height };
  });
  const edges: LayoutEdge[] = dfg.edges.map((edge) => {
    if (edge.source === edge.target || isPseudo(edge.source) || isPseudo(edge.target))
      return { id: edge.id, source: edge.source, target: edge.target, points: [] };
    const e = graph.edge(edge.source, edge.target);
    const out: LayoutEdge = {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      points: e?.points ?? [],
    };
    if (e && typeof e.x === "number" && typeof e.y === "number") out.label = { x: e.x, y: e.y };
    return out;
  });
  const useLanes = deepConnections(dfg, nodes) <= MAX_LANES;
  placeMarker(dfg, nodes, edges, rankSeparation, "start", useLanes);
  placeMarker(dfg, nodes, edges, rankSeparation, "end", useLanes);
  return normaliseBounds(nodes, edges, 20);
}

function heaviestNeighbour(
  dfg: Dfg,
  byId: Map<string, LayoutNode>,
  from: string | null,
  to: string | null,
  pick: (e: DfgEdge) => string,
): LayoutNode | undefined {
  let best: LayoutNode | undefined;
  let bestWeight = -1;
  for (const e of dfg.edges) {
    if ((from && e.source !== from) || (to && e.target !== to)) continue;
    const n = byId.get(pick(e));
    if (n && e.frequency > bestWeight) {
      bestWeight = e.frequency;
      best = n;
    }
  }
  return best;
}

const MAX_LANES = 8;
const LANE = 14;
const MARKER = 24;

interface Extent {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

function extentOf(nodes: readonly LayoutNode[]): Extent {
  const e = {
    minX: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
  };
  for (const n of nodes) {
    e.minX = Math.min(e.minX, n.x - n.width / 2);
    e.maxX = Math.max(e.maxX, n.x + n.width / 2);
    e.minY = Math.min(e.minY, n.y - n.height / 2);
    e.maxY = Math.max(e.maxY, n.y + n.height / 2);
  }
  return e;
}

interface MarkerSide {
  kind: "start" | "end";
  id: string;
  /** +1 for Start (ports face down), -1 for End (ports face up). */
  dir: 1 | -1;
  marker: LayoutNode;
  ext: Extent;
  rankSeparation: number;
}

/** Node port facing the marker, and the marker's own port. */
function ports(m: MarkerSide, n: LayoutNode): { node: Point; marker: Point } {
  return {
    node: { x: n.x, y: n.y - (m.dir * n.height) / 2 },
    marker: { x: m.marker.x, y: m.marker.y + (m.dir * MARKER) / 2 },
  };
}

/** True when the activity sits on the rank next to the marker. */
function adjacentToMarker(m: MarkerSide, n: LayoutNode): boolean {
  return m.kind === "start"
    ? n.y - n.height / 2 <= m.ext.minY + 1
    : n.y + n.height / 2 >= m.ext.maxY - 1;
}

function laneRoute(m: MarkerSide, n: LayoutNode, lanes: { left: number; right: number }): Point[] {
  const p = ports(m, n);
  const left = n.x - m.ext.minX < m.ext.maxX - n.x;
  const lane = left ? lanes.left++ : lanes.right++;
  const x = left
    ? m.ext.minX - m.rankSeparation / 2 - lane * LANE
    : m.ext.maxX + m.rankSeparation / 2 + lane * LANE;
  const side = { x: n.x + ((left ? -1 : 1) * n.width) / 2, y: n.y };
  const turn = { x, y: p.marker.y + (m.dir * m.rankSeparation) / 4 };
  return m.kind === "start"
    ? [p.marker, turn, { x, y: n.y }, side]
    : [side, { x, y: n.y }, turn, p.marker];
}

/**
 * Start sits one rank above the drawing over the activity most cases start with; End one rank
 * below under the activity most cases end with, the way desktop process-mining tools draw them. Activities on the adjacent
 * rank connect straight; deeper ones leave sideways into a staggered lane down the nearer margin,
 * like the dotted paths in those tools. With many deep connections the lanes would wrap nested boxes around
 * the drawing, so straight runs are used instead, the way dense dot layouts look.
 */
/** Start/End connections to activities that are not on the top or bottom rank. */
function deepConnections(dfg: Dfg, nodes: readonly LayoutNode[]): number {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const ext = extentOf(nodes);
  let deep = 0;
  for (const e of dfg.edges) {
    const n = byId.get(e.source === START_NODE ? e.target : e.target === END_NODE ? e.source : "");
    if (!n) continue;
    const top = n.y - n.height / 2 <= ext.minY + 1;
    const bottom = n.y + n.height / 2 >= ext.maxY - 1;
    if (!(e.source === START_NODE ? top : bottom)) deep++;
  }
  return deep;
}

function placeMarker(
  dfg: Dfg,
  nodes: LayoutNode[],
  edges: LayoutEdge[],
  rankSeparation: number,
  kind: "start" | "end",
  useLanes: boolean,
): void {
  const id = kind === "start" ? START_NODE : END_NODE;
  if (!dfg.nodes.some((n) => n.id === id)) return;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const activities = nodes.filter((n) => n.id !== START_NODE && n.id !== END_NODE);
  if (activities.length === 0) return;
  const ext = extentOf(activities);
  const dir = kind === "start" ? 1 : -1;
  const anchor =
    kind === "start"
      ? heaviestNeighbour(dfg, byId, START_NODE, null, (e) => e.target)
      : heaviestNeighbour(dfg, byId, null, END_NODE, (e) => e.source);
  const marker: LayoutNode = {
    id,
    x: anchor?.x ?? (ext.minX + ext.maxX) / 2,
    y:
      kind === "start"
        ? ext.minY - rankSeparation - MARKER / 2
        : ext.maxY + rankSeparation + MARKER / 2,
    width: MARKER,
    height: MARKER,
  };
  nodes.push(marker);
  const m: MarkerSide = { kind, id, dir, marker, ext, rankSeparation };
  const own = edges
    .filter((e) => (kind === "start" ? e.source : e.target) === id)
    .map((e) => ({ e, n: byId.get(kind === "start" ? e.target : e.source) }))
    .filter((x): x is { e: LayoutEdge; n: LayoutNode } => x.n !== undefined);
  const lanes = { left: 0, right: 0 };
  for (const { e, n } of own) {
    if (adjacentToMarker(m, n) || !useLanes) {
      const p = ports(m, n);
      e.points = kind === "start" ? [p.marker, p.node] : [p.node, p.marker];
    } else e.points = laneRoute(m, n, lanes);
  }
}

/** dagre reports node extents only; edge control points can lie outside. Re-fit the bounds. */
function normaliseBounds(nodes: LayoutNode[], edges: LayoutEdge[], margin: number): Layout {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  const grow = (x: number, y: number) => {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  };
  for (const n of nodes) {
    grow(n.x - n.width / 2, n.y - n.height / 2);
    grow(n.x + n.width / 2 + 60, n.y + n.height / 2); // room for self loops and labels
  }
  for (const e of edges) for (const p of e.points) grow(p.x, p.y);
  if (!Number.isFinite(minX)) return { nodes, edges, width: 0, height: 0 };
  const dx = margin - minX;
  const dy = margin - minY;
  for (const n of nodes) {
    n.x += dx;
    n.y += dy;
  }
  for (const e of edges) {
    for (const p of e.points) {
      p.x += dx;
      p.y += dy;
    }
    if (e.label) {
      e.label.x += dx;
      e.label.y += dy;
    }
  }
  return { nodes, edges, width: maxX - minX + 2 * margin, height: maxY - minY + 2 * margin };
}
