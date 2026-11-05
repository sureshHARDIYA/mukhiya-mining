import {
  FREQUENCY_PALETTE,
  FREQUENCY_SHOWS,
  type Metric,
  PERFORMANCE_PALETTE,
  PERFORMANCE_SHOWS,
  type Show,
} from "../render/scales";
import { formatValue } from "../render/scene";

export interface Detail {
  activities: number;
  paths: number;
}

interface Props {
  detail: Detail;
  onDetail: (d: Detail) => void;
  metric: Metric;
  onMetric: (m: Metric) => void;
  show: Show;
  onShow: (s: Show) => void;
  secondary: Show | null;
  onSecondary: (s: Show | null) => void;
  maxNode: number;
}

export function MapRail({
  detail,
  onDetail,
  metric,
  onMetric,
  show,
  onShow,
  secondary,
  onSecondary,
  maxNode,
}: Props) {
  const palette = metric === "frequency" ? FREQUENCY_PALETTE : PERFORMANCE_PALETTE;
  const shows = metric === "frequency" ? FREQUENCY_SHOWS : PERFORMANCE_SHOWS;
  const secondaryOptions = metric === "frequency" ? PERFORMANCE_SHOWS : FREQUENCY_SHOWS;
  return (
    <aside className="pm-rail">
      <div>
        <h4>Detail</h4>
        <div className="pm-row">
          <span>Activities</span>
          <span>{Math.round(detail.activities * 100)}%</span>
        </div>
        <input
          id="pm-detail-activities"
          className="pm-slider"
          type="range"
          min="0"
          max="100"
          value={Math.round(detail.activities * 100)}
          onChange={(e) => onDetail({ ...detail, activities: Number(e.target.value) / 100 })}
          aria-label="Activities detail"
        />
        <div className="pm-row">
          <span>Paths</span>
          <span>{Math.round(detail.paths * 100)}%</span>
        </div>
        <input
          id="pm-detail-paths"
          className="pm-slider"
          type="range"
          min="0"
          max="100"
          value={Math.round(detail.paths * 100)}
          onChange={(e) => onDetail({ ...detail, paths: Number(e.target.value) / 100 })}
          aria-label="Paths detail"
        />
      </div>
      <div>
        <h4>Metric</h4>
        <fieldset
          className="pm-seg"
          style={{ border: 0, padding: 0, margin: 0 }}
          aria-label="Metric"
        >
          <button
            type="button"
            className="pm-btn"
            aria-pressed={metric === "frequency"}
            onClick={() => onMetric("frequency")}
          >
            Frequency
          </button>
          <button
            type="button"
            className="pm-btn"
            aria-pressed={metric === "performance"}
            onClick={() => onMetric("performance")}
          >
            Performance
          </button>
        </fieldset>
      </div>
      <div>
        <label className="pm-label" htmlFor="pm-show">
          Show
        </label>
        <select
          id="pm-show"
          className="pm-select"
          value={show}
          onChange={(e) => onShow(e.target.value as Show)}
        >
          {shows.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <h4>Legend</h4>
        <div
          className="pm-legend"
          style={{ background: `linear-gradient(90deg, ${palette.node.join(", ")})` }}
        />
        <div className="pm-legend-ticks">
          <span>{formatValue(0, show)}</span>
          <span>{formatValue(maxNode, show)}</span>
        </div>
      </div>
      <div>
        <label className="pm-label" htmlFor="pm-secondary">
          Secondary
        </label>
        <select
          id="pm-secondary"
          className="pm-select"
          value={secondary ?? ""}
          onChange={(e) => onSecondary(e.target.value ? (e.target.value as Show) : null)}
        >
          <option value="">None</option>
          {secondaryOptions.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
    </aside>
  );
}
