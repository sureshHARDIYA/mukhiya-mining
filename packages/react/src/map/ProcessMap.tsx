import {
  computeDfg,
  type Dfg,
  type DfgEdge,
  type DfgNode,
  END_NODE,
  type Filter,
  formatNumber,
  layoutDfg,
  START_NODE,
  selectEdges,
} from "@pathminer/core";
import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useProcessModel } from "../context";
import { defaultShow, type Metric, metricValue, type Show } from "../render/scales";
import { buildScene, type Scene } from "../render/scene";
import { useControllable } from "../shared/useControllable";
import { downloadPng, downloadSvg, printPdf } from "./exportMap";
import { MapAnimation } from "./MapAnimation";
import { type Detail, MapRail } from "./MapRail";
import { Popover } from "./Popover";
import { SceneSvg } from "./SceneSvg";
import { usePanZoom } from "./usePanZoom";

export interface ProcessMapProps {
  metric?: Metric | undefined;
  defaultMetric?: Metric | undefined;
  onMetricChange?: ((metric: Metric) => void) | undefined;
  show?: Show | undefined;
  detail?: Detail | undefined;
  defaultDetail?: Detail | undefined;
  onDetailChange?: ((detail: Detail) => void) | undefined;
  secondary?: Show | null | undefined;
  showRail?: boolean | undefined;
  /** Show the "Animate" button; replay moves one token per case along the paths. */
  animation?: boolean | undefined;
  /** Max cases replayed at once. Real time takes the busiest stretch; synced mode samples evenly. */
  animationLimit?: number | undefined;
  className?: string | undefined;
  style?: CSSProperties | undefined;
}

const DEFAULT_DETAIL: Detail = { activities: 1, paths: 0.2 };

export function ProcessMap(props: ProcessMapProps) {
  const { view, selection, setSelection, filters, setFilters, permissions, setMapTools } =
    useProcessModel();
  const { metric, setMetric, setShow, detail, setDetail, secondary, setSecondary, effectiveShow } =
    useMapSettings(props);

  // Path detail only reselects edges; the expensive walk over events depends on activities alone.
  const fullDfg = useMemo(
    () => computeDfg(view, { activityDetail: detail.activities }),
    [view, detail.activities],
  );
  const dfg = useMemo(
    () => ({ ...fullDfg, edges: selectEdges(fullDfg.edges, detail.paths) }),
    [fullDfg, detail.paths],
  );
  const layout = useMemo(() => layoutDfg(dfg), [dfg]);
  const scene = useMemo(
    () =>
      buildScene(dfg, layout, { metric, show: effectiveShow, ...(secondary ? { secondary } : {}) }),
    [dfg, layout, metric, effectiveShow, secondary],
  );
  const maxNode = useMemo(
    () =>
      Math.max(
        0,
        ...dfg.nodes
          .filter((n) => n.activity >= 0)
          .map((n) => metricValue(n, effectiveShow))
          .filter((v) => !Number.isNaN(v)),
      ),
    [dfg, effectiveShow],
  );

  const viewportRef = useRef<HTMLDivElement>(null);
  const pz = usePanZoom();
  // Re-fit only when the drawing changes size, not on every metric change.
  const sceneWidth = Math.round(scene.width);
  const sceneHeight = Math.round(scene.height);
  const fitView = pz.fit;
  useEffect(() => {
    const el = viewportRef.current;
    if (el)
      fitView(
        { width: sceneWidth, height: sceneHeight },
        { width: el.clientWidth, height: el.clientHeight },
      );
  }, [sceneWidth, sceneHeight, fitView]);

  const onMetric = useCallback(
    (m: Metric) => {
      setMetric(m);
      setShow(defaultShow(m));
      setSecondary(null);
    },
    [setMetric, setShow, setSecondary],
  );
  const onNodeClick = useCallback(
    (id: string) => setSelection({ kind: "activity", id }),
    [setSelection],
  );
  const onEdgeClick = useCallback(
    (id: string) => setSelection({ kind: "path", id }),
    [setSelection],
  );
  const onPointerUp = useCallback(() => {
    if (!pz.onPointerUp()) setSelection(null);
  }, [pz, setSelection]);

  const [animating, setAnimating] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const onWheel = pz.onWheel;
  // React registers wheel listeners as passive, so preventDefault needs a native listener.
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [onWheel]);
  const summary = `${formatNumber(view.caseCount)} of ${formatNumber(view.log.cases.length)} cases · ${dfg.nodes.length - 2} activities · ${dfg.edges.length} paths`;
  const fitToViewport = useCallback(() => {
    const el = viewportRef.current;
    if (el) fitView(scene, { width: el.clientWidth, height: el.clientHeight });
  }, [fitView, scene]);
  useEffect(() => {
    setMapTools({ fit: fitToViewport, summary });
    return () => setMapTools(null);
  }, [setMapTools, fitToViewport, summary]);
  const onExport = permissions.canExport
    ? (kind: ExportKind) => {
        const host = viewportRef.current;
        if (kind === "png") void downloadPng(scene, host);
        else if (kind === "svg") downloadSvg(scene, host);
        else printPdf(scene, host);
      }
    : undefined;
  const onAnimate = props.animation && !animating ? () => setAnimating(true) : undefined;
  const tools = <MapTools onAnimate={onAnimate} onExport={onExport} />;
  const selectedId =
    selection?.kind === "activity" || selection?.kind === "path" ? selection.id : null;
  const popover = usePopover(
    dfg,
    scene,
    selectedId,
    pz.transform,
    filters,
    setFilters,
    setSelection,
  );

  return (
    <div
      className={`pm-map${animating ? " is-animating" : ""}${props.className ? ` ${props.className}` : ""}`}
      style={props.style}
    >
      <div ref={viewportRef} className={`pm-map-viewport${pz.panning ? " is-panning" : ""}`}>
        <svg
          ref={svgRef}
          role="img"
          aria-label="Process map"
          onPointerDown={pz.onPointerDown}
          onPointerMove={pz.onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <SceneSvg
            scene={scene}
            transform={pz.transform}
            selectedId={selectedId}
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
          />
        </svg>
        {props.showRail === false ? (
          <div className="pm-map-toolbar">
            <span>{Math.round(pz.transform.k * 100)}%</span>
            <button type="button" className="pm-btn" onClick={fitToViewport}>
              Fit
            </button>
            {tools}
          </div>
        ) : null}
        {view.caseCount === 0 ? (
          <div className="pm-map-empty">No cases match the current filters.</div>
        ) : null}
        {popover ? <Popover {...popover} canFilter={permissions.canFilter} /> : null}
        {animating ? (
          <MapAnimation
            view={view}
            dfg={dfg}
            scene={scene}
            transform={pz.transform}
            limit={props.animationLimit ?? 1500}
            host={viewportRef.current}
            onExit={() => setAnimating(false)}
          />
        ) : null}
      </div>
      {props.showRail === false ? null : (
        <MapRail
          detail={detail}
          onDetail={setDetail}
          metric={metric}
          onMetric={onMetric}
          show={effectiveShow}
          onShow={setShow}
          secondary={secondary}
          onSecondary={setSecondary}
          maxNode={maxNode}
          footer={tools}
        />
      )}
    </div>
  );
}

function nodeName(dfg: Dfg, id: string): string {
  if (id === START_NODE) return "Start";
  if (id === END_NODE) return "End";
  return dfg.nodes.find((n) => n.id === id)?.name ?? id;
}

function anchorFor(scene: Scene, id: string): { x: number; y: number } {
  const node = scene.nodes.find((n) => n.id === id);
  if (node) return { x: node.x + node.width / 2, y: node.y - node.height / 2 };
  const edge = scene.edges.find((e) => e.id === id);
  return edge ? { x: edge.labelAt.x, y: edge.labelAt.y } : { x: 0, y: 0 };
}

function describeSelection(
  dfg: Dfg,
  id: string,
): { item: DfgNode | DfgEdge; title: string; activities: string[] } | null {
  const node = dfg.nodes.find((n) => n.id === id && n.activity >= 0);
  if (node) return { item: node, title: node.name, activities: [node.name] };
  const edge = dfg.edges.find((e) => e.id === id);
  if (!edge) return null;
  const ends = [nodeName(dfg, edge.source), nodeName(dfg, edge.target)];
  return {
    item: edge,
    title: ends.join(" → "),
    activities: ends.filter((n) => n !== "Start" && n !== "End"),
  };
}

function usePopover(
  dfg: Dfg,
  scene: Scene,
  selectedId: string | null,
  t: { x: number; y: number; k: number },
  filters: Filter[],
  setFilters: (f: Filter[]) => void,
  setSelection: (s: null) => void,
) {
  return useMemo(() => {
    if (!selectedId) return null;
    const described = describeSelection(dfg, selectedId);
    if (!described) return null;
    const anchor = anchorFor(scene, selectedId);
    const onFilter = described.activities.length
      ? () => {
          const next: Filter = { type: "activity", mode: "keep", activities: described.activities };
          const exists = filters.some((f) => JSON.stringify(f) === JSON.stringify(next));
          setFilters(exists ? filters : [...filters, next]);
          setSelection(null);
        }
      : undefined;
    return {
      item: described.item,
      title: described.title,
      x: anchor.x * t.k + t.x + 14,
      y: anchor.y * t.k + t.y,
      onFilter,
      onClose: () => setSelection(null),
    };
  }, [dfg, scene, selectedId, t, filters, setFilters, setSelection]);
}

export type ExportKind = "png" | "svg" | "pdf";

/** Animate and Export. Lives at the bottom of the rail, or over the map without one. */
function MapTools({
  onAnimate,
  onExport,
}: {
  onAnimate: (() => void) | undefined;
  onExport: ((kind: ExportKind) => void) | undefined;
}) {
  return (
    <div className="pm-map-tools">
      {onAnimate ? (
        <button type="button" className="pm-btn pm-btn-primary" onClick={onAnimate}>
          ▶ Animate
        </button>
      ) : null}
      {onExport ? (
        <select
          className="pm-select pm-map-export"
          value=""
          onChange={(e) => e.target.value && onExport(e.target.value as ExportKind)}
          aria-label="Export map"
        >
          <option value="">Export…</option>
          <option value="png">PNG image</option>
          <option value="svg">SVG vector</option>
          <option value="pdf">PDF (print)</option>
        </select>
      ) : null}
    </div>
  );
}

function useMapSettings(props: ProcessMapProps) {
  const [metric, setMetric] = useControllable(
    props.metric,
    props.defaultMetric ?? "frequency",
    props.onMetricChange,
  );
  const [show, setShow] = useState<Show>(props.show ?? defaultShow(metric));
  const [detail, setDetail] = useControllable(
    props.detail,
    props.defaultDetail ?? DEFAULT_DETAIL,
    props.onDetailChange,
  );
  const [secondary, setSecondary] = useState<Show | null>(props.secondary ?? null);
  return {
    metric,
    setMetric,
    show,
    setShow,
    detail,
    setDetail,
    secondary,
    setSecondary,
    effectiveShow: props.show ?? show,
  };
}
