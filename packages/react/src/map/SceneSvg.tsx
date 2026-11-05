import { memo } from "react";
import type { Scene, SceneEdge, SceneNode } from "../render/scene";
import type { Transform } from "./usePanZoom";

interface Props {
  scene: Scene;
  transform: Transform;
  selectedId: string | null;
  onNodeClick: (id: string) => void;
  onEdgeClick: (id: string) => void;
}

/** React twin of `sceneToSvg`: same geometry, with event handlers and CSS transitions. */
export const SceneSvg = memo(function SceneSvg({
  scene,
  transform,
  selectedId,
  onNodeClick,
  onEdgeClick,
}: Props) {
  return (
    <g transform={`translate(${transform.x} ${transform.y}) scale(${transform.k})`}>
      <defs>
        <linearGradient id="pm-shine" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".22" />
          <stop offset=".55" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity=".12" />
        </linearGradient>
        {scene.edges.map((e) =>
          e.dashed ? null : (
            <linearGradient
              key={e.id}
              id={`pm-g-${slug(e.id)}`}
              gradientUnits="userSpaceOnUse"
              x1={e.from.x}
              y1={e.from.y}
              x2={e.to.x}
              y2={e.to.y}
            >
              <stop offset="0" stopColor={e.color} stopOpacity=".55" />
              <stop offset="1" stopColor={e.color} />
            </linearGradient>
          ),
        )}
      </defs>
      {scene.edges.map((e) => (
        <Edge key={e.id} edge={e} selected={selectedId === e.id} onClick={onEdgeClick} />
      ))}
      {scene.nodes.map((n) => (
        <Node key={n.id} node={n} selected={selectedId === n.id} onClick={onNodeClick} />
      ))}
    </g>
  );
});

const Edge = memo(function Edge({
  edge: e,
  selected,
  onClick,
}: {
  edge: SceneEdge;
  selected: boolean;
  onClick: (id: string) => void;
}) {
  const color = selected ? "var(--pm-selected)" : e.color;
  const stroke = selected || e.dashed ? color : `url(#pm-g-${slug(e.id)})`;
  return (
    <>
      {/* biome-ignore lint/a11y/useSemanticElements: an SVG group cannot be a <button>; it carries the button role and keyboard handling instead */}
      <g
        className={`pm-edge${selected ? " is-selected" : ""}`}
        data-id={e.id}
        role="button"
        tabIndex={0}
        aria-label={`Path ${e.id}`}
        onClick={() => onClick(e.id)}
        onKeyDown={(k) => k.key === "Enter" && onClick(e.id)}
      >
        <path d={e.path} fill="none" stroke="transparent" strokeWidth={Math.max(12, e.width + 8)} />
        <path
          className="pm-edge-stroke"
          d={e.path}
          fill="none"
          stroke={stroke}
          strokeWidth={e.width}
          strokeLinecap="butt"
          strokeLinejoin="round"
          strokeDasharray={e.dashed ? "4 4" : undefined}
        />
        <path
          className="pm-edge-arrow"
          d={e.arrow}
          fill={color}
          stroke={color}
          strokeWidth=".6"
          strokeLinejoin="round"
        />
        {e.label ? (
          <text
            className="pm-edge-label"
            x={e.labelAt.x}
            y={e.labelAt.y}
            fill={e.dashed ? "var(--pm-muted)" : "var(--pm-fg)"}
            paintOrder="stroke"
            stroke="var(--pm-bg)"
            strokeWidth="3"
            strokeLinejoin="round"
          >
            {e.label}
            {e.secondary ? (
              <tspan fill="var(--pm-muted)" fontSize="9">{` (${e.secondary})`}</tspan>
            ) : null}
          </text>
        ) : null}
      </g>
    </>
  );
});

const Node = memo(function Node({
  node: n,
  selected,
  onClick,
}: {
  node: SceneNode;
  selected: boolean;
  onClick: (id: string) => void;
}) {
  if (n.kind !== "activity") {
    return (
      <g
        className={`pm-node-g pm-node pm-node-${n.kind}`}
        data-id={n.id}
        style={{ transform: `translate(${n.x}px, ${n.y}px)` }}
      >
        <circle
          r={n.width / 2}
          fill="var(--pm-marker-bg)"
          stroke="var(--pm-marker)"
          strokeWidth="1.5"
        />
        {n.kind === "start" ? (
          <path d="M-5 -4 L5 -4 L0 5 Z" fill="var(--pm-marker)" />
        ) : (
          <rect x="-4" y="-4" width="8" height="8" rx="1" fill="var(--pm-marker)" />
        )}
      </g>
    );
  }
  const fill = selected ? "var(--pm-selected)" : n.fill;
  const stroke = selected ? "var(--pm-selected-stroke)" : n.stroke;
  const text = selected ? "#fff" : n.textColor;
  return (
    <>
      {/* biome-ignore lint/a11y/useSemanticElements: an SVG group cannot be a <button>; it carries the button role and keyboard handling instead */}
      <g
        className={`pm-node-g pm-node${selected ? " is-selected" : ""}`}
        data-id={n.id}
        style={{ transform: `translate(${n.x - n.width / 2}px, ${n.y - n.height / 2}px)` }}
        role="button"
        tabIndex={0}
        aria-label={n.name}
        onClick={() => onClick(n.id)}
        onKeyDown={(k) => k.key === "Enter" && onClick(n.id)}
      >
        <rect
          className="pm-node-shape"
          width={n.width}
          height={n.height}
          rx="6"
          fill={fill}
          stroke={stroke}
          strokeWidth="1"
        />
        <rect
          className="pm-node-shine"
          width={n.width}
          height={n.height}
          rx="6"
          fill="url(#pm-shine)"
          pointerEvents="none"
        />
        <text x={n.width / 2} y={n.height / 2 - 3} textAnchor="middle" fontSize="12" fill={text}>
          {n.name}
        </text>
        <text
          x={n.width / 2}
          y={n.height / 2 + 12}
          textAnchor="middle"
          fontSize="10.5"
          fill={text}
          opacity=".9"
        >
          {n.value}
          {n.secondary ? ` · ${n.secondary}` : ""}
        </text>
      </g>
    </>
  );
});

function slug(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, "_");
}
