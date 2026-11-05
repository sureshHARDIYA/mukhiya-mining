import {
  type DfgEdge,
  type DfgNode,
  formatDuration,
  formatNumber,
  formatPercent,
} from "@pathminer/core";

interface Props {
  item: DfgNode | DfgEdge;
  title: string;
  x: number;
  y: number;
  canFilter: boolean;
  onFilter?: (() => void) | undefined;
  onClose: () => void;
}

function Row({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="pm-popover-row">
      <span>{label}</span>
      <i />
      <b>{value}</b>
    </div>
  );
}

export function Popover({ item, title, x, y, canFilter, onFilter, onClose }: Readonly<Props>) {
  const d = item.duration;
  const isNode = "activity" in item;
  return (
    <dialog
      open
      className="pm-popover"
      aria-label={title}
      style={{ left: x, top: y }}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div className="pm-popover-title">{title}</div>
      <div className="pm-popover-head is-freq">Frequency</div>
      <div className="pm-popover-body is-freq">
        <Row label="Absolute frequency" value={formatNumber(item.frequency)} />
        <Row label="Case frequency" value={formatNumber(item.caseFrequency)} />
        <Row label="Max. repetitions" value={formatNumber(item.maxRepetitions)} />
        <Row label="Case coverage" value={formatPercent(item.caseCoverage)} />
        {isNode && item.startFrequency > 0 ? (
          <Row label="Start frequency" value={formatNumber(item.startFrequency)} />
        ) : null}
        {isNode && item.endFrequency > 0 ? (
          <Row label="End frequency" value={formatNumber(item.endFrequency)} />
        ) : null}
      </div>
      {d.count > 0 ? (
        <>
          <div className="pm-popover-head is-perf">Performance</div>
          <div className="pm-popover-body is-perf">
            <Row label="Total duration" value={formatDuration(d.total)} />
            <Row label="Median duration" value={formatDuration(d.median)} />
            <Row label="Mean duration" value={formatDuration(d.mean)} />
            <Row label="Max. duration" value={formatDuration(d.max)} />
            <Row label="Min. duration" value={formatDuration(d.min)} />
          </div>
        </>
      ) : null}
      <div className="pm-popover-actions">
        {canFilter && onFilter ? (
          <button type="button" className="pm-btn" onClick={onFilter}>
            {isNode ? "Filter this activity…" : "Filter this path…"}
          </button>
        ) : null}
        <button type="button" className="pm-btn" onClick={onClose}>
          Close
        </button>
      </div>
    </dialog>
  );
}
