import dagre from "@dagrejs/dagre";
import type { Dfg } from "./types";

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
  for (const node of dfg.nodes) {
    const pseudo = node.activity < 0;
    graph.setNode(node.id, {
      width: pseudo ? 24 : nodeWidth(node.name, options),
      height: pseudo ? 24 : nodeHeight,
    });
  }
  for (const edge of dfg.edges) {
    if (edge.source !== edge.target)
      graph.setEdge(edge.source, edge.target, { weight: Math.max(1, Math.round(edge.frequency)) });
  }
  dagre.layout(graph);
  const nodes: LayoutNode[] = graph.nodes().map((id) => {
    const n = graph.node(id);
    return { id, x: n.x, y: n.y, width: n.width, height: n.height };
  });
  const edges: LayoutEdge[] = dfg.edges.map((edge) => {
    if (edge.source === edge.target)
      return { id: edge.id, source: edge.source, target: edge.target, points: [] };
    const e = graph.edge(edge.source, edge.target);
    return { id: edge.id, source: edge.source, target: edge.target, points: e?.points ?? [] };
  });
  return normaliseBounds(nodes, edges, 20);
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
