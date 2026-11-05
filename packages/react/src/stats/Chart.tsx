import {
  formatDateTime,
  formatDuration,
  formatNumber,
  type HistogramBin,
} from "@mukhiya-mining/core";

export type AxisKind = "time" | "duration" | "count";

interface Props {
  bins: HistogramBin[];
  axis: AxisKind;
  title: string;
}

function formatAxis(value: number, axis: AxisKind): string {
  if (axis === "time") return formatDateTime(value);
  if (axis === "duration") return formatDuration(value);
  return formatNumber(value);
}

/** Bar histogram drawn to scale. Hover a bar for its range and count (native tooltip). */
export function Chart({ bins, axis, title }: Props) {
  const W = 600;
  const H = 180;
  const padL = 36;
  const padB = 22;
  const max = Math.max(1, ...bins.map((b) => b.count));
  const innerW = W - padL - 8;
  const innerH = H - padB - 10;
  const bw = bins.length ? innerW / bins.length : 0;
  const first = bins[0];
  const last = bins[bins.length - 1];
  return (
    <svg
      className="pm-chart"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      <line x1={padL} y1={10} x2={padL} y2={10 + innerH} stroke="var(--pm-line)" />
      <line x1={padL} y1={10 + innerH} x2={W - 8} y2={10 + innerH} stroke="var(--pm-line)" />
      {bins.map((b, i) => {
        const h = (b.count / max) * innerH;
        return (
          <rect
            key={b.from}
            x={padL + i * bw + 0.5}
            y={10 + innerH - h}
            width={Math.max(0, bw - 1)}
            height={h}
            fill="var(--pm-bar)"
          >
            <title>{`${formatAxis(b.from, axis)} – ${formatAxis(b.to, axis)}: ${formatNumber(b.count)}`}</title>
          </rect>
        );
      })}
      <text x={padL - 4} y={14} textAnchor="end" fontSize="10" fill="var(--pm-muted)">
        {formatNumber(max)}
      </text>
      <text x={padL - 4} y={10 + innerH} textAnchor="end" fontSize="10" fill="var(--pm-muted)">
        0
      </text>
      {first ? (
        <text x={padL} y={H - 6} fontSize="10" fill="var(--pm-muted)">
          {formatAxis(first.from, axis)}
        </text>
      ) : null}
      {last ? (
        <text x={W - 8} y={H - 6} textAnchor="end" fontSize="10" fill="var(--pm-muted)">
          {formatAxis(last.to, axis)}
        </text>
      ) : null}
    </svg>
  );
}
