import dagre from "@dagrejs/dagre";
import { type Dfg, type DfgEdge, END_NODE, START_NODE } from "./types";

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
  // Start edges weigh 1 so the marker follows the spine. End stays out of the ranking: ranking it
  // last drags long dummy chains through the ordering and bends the spine sideways.
  const isPseudo = (id: string) => id === START_NODE || id === END_NODE;
  for (const node of dfg.nodes) {
    if (node.id === END_NODE) continue;
    const pseudo = node.activity < 0;
    graph.setNode(node.id, {
      width: pseudo ? 24 : nodeWidth(node.name, options),
      height: pseudo ? 24 : nodeHeight,
    });
  }
  for (const edge of dfg.edges) {
    if (edge.source === edge.target || edge.target === END_NODE) continue;
    const pseudo = isPseudo(edge.source) || isPseudo(edge.target);
    graph.setEdge(edge.source, edge.target, {
      weight: pseudo ? 1 : Math.max(1, Math.round(edge.frequency)),
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
    if (edge.source === edge.target || edge.target === END_NODE)
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
  snapStart(dfg, nodes, edges);
  placeEnd(dfg, nodes, edges, rankSeparation);
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

/** Slide Start over the activity most cases start with; only the marker end of each route moves. */
function snapStart(dfg: Dfg, nodes: LayoutNode[], edges: LayoutEdge[]): void {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const start = byId.get(START_NODE);
  const entry = heaviestNeighbour(dfg, byId, START_NODE, null, (e) => e.target);
  if (!start || !entry) return;
  start.x = entry.x;
  for (const e of edges)
    if (e.source === START_NODE && e.points.length)
      e.points[0] = { x: start.x, y: start.y + start.height / 2 };
}

/**
 * End sits one rank below the drawing under the activity most cases end with. Exits on the bottom
 * rank run straight down; others leave sideways and follow a lane down the nearer margin, like
 * the reference tool's dotted end paths. Lanes are staggered so parallel routes stay apart.
 */
function placeEnd(
  dfg: Dfg,
  nodes: LayoutNode[],
  edges: LayoutEdge[],
  rankSeparation: number,
): void {
  if (!dfg.nodes.some((n) => n.id === END_NODE)) return;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const activities = nodes.filter((n) => n.id !== START_NODE);
  if (activities.length === 0) return;
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const n of activities) {
    minX = Math.min(minX, n.x - n.width / 2);
    maxX = Math.max(maxX, n.x + n.width / 2);
    maxY = Math.max(maxY, n.y + n.height / 2);
  }
  const size = 24;
  const exit = heaviestNeighbour(dfg, byId, null, END_NODE, (e) => e.source);
  const end: LayoutNode = {
    id: END_NODE,
    x: exit?.x ?? (minX + maxX) / 2,
    y: maxY + rankSeparation + size / 2,
    width: size,
    height: size,
  };
  nodes.push(end);
  const lanes = { left: 0, right: 0 };
  const LANE = 14;
  for (const e of edges) {
    if (e.target !== END_NODE) continue;
    const source = byId.get(e.source);
    if (!source) continue;
    const bottom = { x: source.x, y: source.y + source.height / 2 };
    const top = { x: end.x, y: end.y - size / 2 };
    if (bottom.y >= maxY - 1) {
      e.points = [bottom, top];
      continue;
    }
    const left = source.x - minX < maxX - source.x;
    const lane = left ? lanes.left++ : lanes.right++;
    const x = left
      ? minX - rankSeparation / 2 - lane * LANE
      : maxX + rankSeparation / 2 + lane * LANE;
    const side = { x: source.x + ((left ? -1 : 1) * source.width) / 2, y: source.y };
    e.points = [side, { x, y: source.y }, { x, y: top.y - rankSeparation / 4 }, top];
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
