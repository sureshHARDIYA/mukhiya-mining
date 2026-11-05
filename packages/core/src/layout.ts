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
}

export function nodeWidth(label: string, options: LayoutOptions = {}): number {
  const { charWidth = 7, minNodeWidth = 120, maxNodeWidth = 260 } = options;
  return Math.max(minNodeWidth, Math.min(maxNodeWidth, label.length * charWidth + 28));
}

/** Layered layout for a DFG. Pure function of the graph; safe to run in a worker. */
export function layoutDfg(dfg: Dfg, options: LayoutOptions = {}): Layout {
  const { direction = "TB", nodeHeight = 40, nodeSeparation = 40, rankSeparation = 56 } = options;
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
  // Start and End stay out of the layered layout so they cannot pull activities sideways.
  const isPseudo = (id: string) => id === START_NODE || id === END_NODE;
  for (const node of dfg.nodes) {
    if (node.activity < 0) continue;
    graph.setNode(node.id, { width: nodeWidth(node.name, options), height: nodeHeight });
  }
  for (const edge of dfg.edges) {
    if (edge.source !== edge.target && !isPseudo(edge.source) && !isPseudo(edge.target))
      graph.setEdge(edge.source, edge.target, { weight: Math.max(1, Math.round(edge.frequency)) });
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
    return { id: edge.id, source: edge.source, target: edge.target, points: e?.points ?? [] };
  });
  placeEndpoints(dfg, nodes, edges, rankSeparation);
  return normaliseBounds(nodes, edges, 20);
}

/**
 * Start sits one rank above the top of the drawing, over the activity most cases start with; End
 * sits one rank below, under the activity most cases end with. Their edges are straight runs.
 */
function placeEndpoints(
  dfg: Dfg,
  nodes: LayoutNode[],
  edges: LayoutEdge[],
  rankSeparation: number,
): void {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const activities = nodes.filter((n) => byId.get(n.id) && !isEndpoint(n.id));
  if (activities.length === 0) return;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const n of activities) {
    minY = Math.min(minY, n.y - n.height / 2);
    maxY = Math.max(maxY, n.y + n.height / 2);
  }
  const size = 24;
  const heaviest = (pick: (e: DfgEdge) => string, from: string | null, to: string | null) => {
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
    return best ?? (activities[0] as LayoutNode);
  };
  const entry = heaviest((e) => e.target, START_NODE, null);
  const exit = heaviest((e) => e.source, null, END_NODE);
  const start: LayoutNode = {
    id: START_NODE,
    x: entry.x,
    y: minY - rankSeparation - size / 2,
    width: size,
    height: size,
  };
  const end: LayoutNode = {
    id: END_NODE,
    x: exit.x,
    y: maxY + rankSeparation + size / 2,
    width: size,
    height: size,
  };
  if (dfg.nodes.some((n) => n.id === START_NODE)) nodes.push(start);
  if (dfg.nodes.some((n) => n.id === END_NODE)) nodes.push(end);
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  for (const n of activities) {
    minX = Math.min(minX, n.x - n.width / 2);
    maxX = Math.max(maxX, n.x + n.width / 2);
  }
  const sides = { left: minX - rankSeparation, right: maxX + rankSeparation };
  for (const e of edges) {
    const target = byId.get(e.target);
    const source = byId.get(e.source);
    if (e.source === START_NODE && target) e.points = detour(start, target, sides, minY, "down");
    if (e.target === END_NODE && source) e.points = detour(source, end, sides, maxY, "up");
  }
}

/**
 * Straight run when the activity is on the rank next to the marker; otherwise skirt the nearer
 * side of the drawing, the way the reference tool draws its dotted start/end paths.
 */
function detour(
  from: LayoutNode,
  to: LayoutNode,
  sides: { left: number; right: number },
  edgeY: number,
  dir: "down" | "up",
): { x: number; y: number }[] {
  const a = { x: from.x, y: from.y + from.height / 2 };
  const b = { x: to.x, y: to.y - to.height / 2 };
  const activity = dir === "down" ? to : from;
  const onEdgeRank =
    dir === "down"
      ? activity.y - activity.height / 2 <= edgeY + 1
      : activity.y + activity.height / 2 >= edgeY - 1;
  if (onEdgeRank) return [a, b];
  const side = activity.x - sides.left < sides.right - activity.x ? sides.left : sides.right;
  const sign = side === sides.left ? -1 : 1;
  const exitX = activity.x + (sign * activity.width) / 2;
  return dir === "down"
    ? [a, { x: side, y: from.y + from.height }, { x: side, y: to.y }, { x: exitX, y: to.y }]
    : [{ x: exitX, y: from.y }, { x: side, y: from.y }, { x: side, y: to.y - to.height }, b];
}

function isEndpoint(id: string): boolean {
  return id === START_NODE || id === END_NODE;
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
  for (const e of edges)
    for (const p of e.points) {
      p.x += dx;
      p.y += dy;
    }
  return { nodes, edges, width: maxX - minX + 2 * margin, height: maxY - minY + 2 * margin };
}
