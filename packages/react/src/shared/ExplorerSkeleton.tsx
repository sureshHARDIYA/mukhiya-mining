import type { CSSProperties } from "react";

export interface ExplorerSkeletonProps {
  /** Short status line shown under the fake tabs, e.g. "Indexing 4.8M events…". */
  message?: string | undefined;
  height?: number | string | undefined;
  colorScheme?: "light" | "dark" | undefined;
  style?: CSSProperties | undefined;
}

const BOXES = [
  [38, 0, 24],
  [26, 1, 20],
  [50, 1, 20],
  [38, 2, 26],
  [38, 3, 22],
  [30, 4, 18],
  [46, 4, 18],
  [38, 5, 24],
];

/** Placeholder for the explorer while a log is being loaded or indexed. */
export function ExplorerSkeleton({
  message,
  height = 640,
  colorScheme,
  style,
}: ExplorerSkeletonProps) {
  return (
    <div
      className="pm-root"
      data-theme={colorScheme}
      style={{ height, ...style }}
      aria-busy="true"
      aria-live="polite"
    >
      <div className="pm-explorer pm-skeleton" style={{ height: "100%" }}>
        <div className="pm-tabs">
          <span className="pm-sk pm-sk-tab" />
          <span className="pm-sk pm-sk-tab" />
          <span className="pm-sk pm-sk-tab" />
          <span className="pm-sk pm-sk-chip" style={{ marginLeft: "auto" }} />
        </div>
        <div className="pm-body">
          <div className="pm-map-viewport pm-sk-map">
            {BOXES.map(([x, row, w]) => (
              <span
                key={`${x}-${row}`}
                className="pm-sk pm-sk-node"
                style={{ left: `${x}%`, top: 40 + (row as number) * 70, width: `${w}%` }}
              />
            ))}
            {message ? <div className="pm-sk-message">{message}</div> : null}
          </div>
          <aside className="pm-rail">
            <span className="pm-sk" style={{ height: 14, width: "40%" }} />
            <span className="pm-sk" style={{ height: 6 }} />
            <span className="pm-sk" style={{ height: 6 }} />
            <span className="pm-sk" style={{ height: 14, width: "40%" }} />
            <span className="pm-sk" style={{ height: 28, width: "70%" }} />
            <span className="pm-sk" style={{ height: 14, width: "40%" }} />
            <span className="pm-sk" style={{ height: 12 }} />
          </aside>
        </div>
      </div>
    </div>
  );
}
