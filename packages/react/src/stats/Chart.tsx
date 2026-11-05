import {
  formatDateTime,
  formatDuration,
  formatNumber,
  type HistogramBin,
} from "@mukhiya-mining/core";
import { useRef } from "react";
import { useElementWidth } from "../shared/useElementWidth";

export type AxisKind = "time" | "duration" | "count";

interface Props {
  bins: HistogramBin[];
  axis: AxisKind;
  title: string;
  height?: number;
}

function formatAxis(value: number, axis: AxisKind): string {
  if (axis === "time") return formatDateTime(value);
  if (axis === "duration") return formatDuration(value);
  return formatNumber(value);
}

/** Time series draw as an area, distributions as bars. Drawn at pixel size so text never stretches. */
export function Chart({ bins, axis, title, height = 190 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const W = useElementWidth(ref);
  const H = height;
  const padL = 48;
  const padR = 12;
  const padT = 10;
  const padB = 22;
  const innerW = Math.max(10, W - padL - padR);
  const innerH = H - padT - padB;
  const max = Math.max(1, ...bins.map((b) => b.count));
  const first = bins[0];
  const last = bins[bins.length - 1];
  const x = (i: number) => padL + (innerW * i) / Math.max(1, bins.length);
  const y = (count: number) => padT + innerH - (count / max) * innerH;
  const gridLines = [0.25, 0.5, 0.75, 1];
  const area = axis === "time";
  const points = bins.map((b, i) => `${x(i + 0.5).toFixed(1)},${y(b.count).toFixed(1)}`).join(" ");
  return (
    <div ref={ref} className="pm-chart">
      <svg width={W} height={H} role="img" aria-label={title}>
        <title>{title}</title>
        <defs>
          <linearGradient id="pm-chart-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--pm-bar)" stopOpacity=".55" />
            <stop offset="1" stopColor="var(--pm-bar)" stopOpacity=".08" />
          </linearGradient>
        </defs>
        {gridLines.map((g) => (
          <line
            key={g}
            x1={padL}
            x2={W - padR}
            y1={y(max * g)}
            y2={y(max * g)}
            stroke="var(--pm-line)"
            strokeDasharray={g === 1 ? undefined : "2 3"}
          />
        ))}
        {area ? (
          <>
            <polygon
              points={`${x(0.5)},${y(0)} ${points} ${x(bins.length - 0.5)},${y(0)}`}
              fill="url(#pm-chart-fill)"
            />
            <polyline
              points={points}
              fill="none"
              stroke="var(--pm-bar)"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </>
        ) : (
          bins.map((b, i) => (
            <rect
              key={b.from}
              x={x(i) + 0.5}
              y={y(b.count)}
              width={Math.max(1, innerW / bins.length - 1)}
              height={innerH - (y(b.count) - padT)}
              fill="var(--pm-bar)"
            >
              <title>{`${formatAxis(b.from, axis)} – ${formatAxis(b.to, axis)}: ${formatNumber(b.count)}`}</title>
            </rect>
          ))
        )}
        <line
          x1={padL}
          x2={W - padR}
          y1={padT + innerH}
          y2={padT + innerH}
          stroke="var(--pm-muted)"
        />
        <text x={padL - 6} y={padT + 4} textAnchor="end" fontSize="10" fill="var(--pm-muted)">
          {formatNumber(max)}
        </text>
        <text x={padL - 6} y={padT + innerH} textAnchor="end" fontSize="10" fill="var(--pm-muted)">
          0
        </text>
        {first ? (
          <text x={padL} y={H - 6} fontSize="10" fill="var(--pm-muted)">
            {formatAxis(first.from, axis)}
          </text>
        ) : null}
        {last ? (
          <text x={W - padR} y={H - 6} textAnchor="end" fontSize="10" fill="var(--pm-muted)">
            {formatAxis(last.to, axis)}
          </text>
        ) : null}
      </svg>
    </div>
  );
}
