import {
  type ActivityStat,
  type CaseStat,
  computeActivityStats,
  computeCaseStats,
  computeOverview,
  formatDateTime,
  formatDuration,
  formatNumber,
  formatPercent,
} from "@mukhiya-mining/core";
import { type CSSProperties, useMemo, useState } from "react";
import { useProcessModel } from "../context";
import { VirtualList } from "../shared/VirtualList";
import { type AxisKind, Chart } from "./Chart";

export type StatisticsPage = "overview" | "activities" | "cases";

export interface StatisticsViewProps {
  page?: StatisticsPage | undefined;
  defaultPage?: StatisticsPage | undefined;
  onPageChange?: ((page: StatisticsPage) => void) | undefined;
  className?: string | undefined;
  style?: CSSProperties | undefined;
}

const CHARTS: { id: string; label: string; axis: AxisKind }[] = [
  { id: "eventsOverTime", label: "Events over time", axis: "time" },
  { id: "activeCasesOverTime", label: "Active cases over time", axis: "time" },
  { id: "caseDurationHistogram", label: "Case duration", axis: "duration" },
  { id: "eventsPerCaseHistogram", label: "Events per case", axis: "count" },
];

export function StatisticsView(props: StatisticsViewProps) {
  const [page, setPage] = useState<StatisticsPage>(props.defaultPage ?? "overview");
  const current = props.page ?? page;
  const go = (p: StatisticsPage) => {
    setPage(p);
    props.onPageChange?.(p);
  };
  return (
    <div className={`pm-stats${props.className ? ` ${props.className}` : ""}`} style={props.style}>
      <nav className="pm-stats-nav" aria-label="Statistics views">
        <button type="button" aria-current={current === "overview"} onClick={() => go("overview")}>
          Overview<small>Global statistics</small>
        </button>
        <button
          type="button"
          aria-current={current === "activities"}
          onClick={() => go("activities")}
        >
          Activities<small>Activity classes</small>
        </button>
        <button type="button" aria-current={current === "cases"} onClick={() => go("cases")}>
          Cases<small>All cases</small>
        </button>
      </nav>
      <div className="pm-stats-main">
        {current === "overview" ? (
          <OverviewPage />
        ) : current === "activities" ? (
          <ActivitiesPage />
        ) : (
          <CasesPage />
        )}
      </div>
    </div>
  );
}

function Kpi({ value, label }: { value: string; label: string }) {
  return (
    <div className="pm-kpi">
      <b>{value}</b>
      <span>{label}</span>
    </div>
  );
}

function OverviewPage() {
  const { view } = useProcessModel();
  const overview = useMemo(() => computeOverview(view), [view]);
  const [chart, setChart] = useState(CHARTS[0] as (typeof CHARTS)[number]);
  const bins = overview[chart.id as "eventsOverTime"];
  return (
    <div className="pm-stats-head">
      <div className="pm-chart-tabs">
        {CHARTS.map((c) => (
          <button
            key={c.id}
            type="button"
            className="pm-chip is-add"
            aria-pressed={chart.id === c.id}
            style={
              chart.id === c.id
                ? { borderColor: "var(--pm-accent)", color: "var(--pm-accent)" }
                : undefined
            }
            onClick={() => setChart(c)}
          >
            {c.label}
          </button>
        ))}
      </div>
      <Chart bins={bins} axis={chart.axis} title={chart.label} />
      <div className="pm-kpis">
        <Kpi value={formatNumber(overview.cases)} label="cases" />
        <Kpi value={formatNumber(overview.events)} label="events" />
        <Kpi value={formatNumber(overview.activities)} label="activities" />
        <Kpi value={formatNumber(overview.variants)} label="variants" />
        <Kpi value={formatDuration(overview.caseDuration.median)} label="median case duration" />
        <Kpi value={formatDuration(overview.caseDuration.mean)} label="mean case duration" />
        <Kpi value={formatNumber(overview.eventsPerCase.mean)} label="events per case" />
        <Kpi value={formatDateTime(overview.start)} label="first event" />
        <Kpi value={formatDateTime(overview.end)} label="last event" />
      </div>
    </div>
  );
}

type SortDir = "asc" | "desc";

function useSorted<T>(rows: T[], key: keyof T, dir: SortDir): T[] {
  return useMemo(() => {
    const sorted = [...rows];
    sorted.sort((a, b) => {
      const x = a[key];
      const y = b[key];
      const cmp =
        typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
      return dir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [rows, key, dir]);
}

function Th<T>({
  label,
  col,
  sort,
  onSort,
}: {
  label: string;
  col: keyof T;
  sort: { key: keyof T; dir: SortDir };
  onSort: (k: keyof T) => void;
}) {
  const active = sort.key === col;
  return (
    <th
      onClick={() => onSort(col)}
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
    >
      {label}
      {active ? (sort.dir === "asc" ? " ▲" : " ▼") : ""}
    </th>
  );
}

function Bar({ share }: { share: number }) {
  return <span className="pm-cellbar" style={{ width: Math.max(2, Math.round(share * 90)) }} />;
}

type ActivityRow = ActivityStat & { median: number; mean: number };

function ActivitiesPage() {
  const { view, setSelection, selection } = useProcessModel();
  const rows = useMemo<ActivityRow[]>(
    () =>
      computeActivityStats(view).map((s) => ({
        ...s,
        median: s.duration.median,
        mean: s.duration.mean,
      })),
    [view],
  );
  const [sort, setSort] = useState<{ key: keyof ActivityRow; dir: SortDir }>({
    key: "frequency",
    dir: "desc",
  });
  const sorted = useSorted(rows, sort.key, sort.dir);
  const onSort = (key: keyof ActivityRow) =>
    setSort((s) => ({ key, dir: s.key === key && s.dir === "desc" ? "asc" : "desc" }));
  const maxFreq = Math.max(1, ...rows.map((r) => r.frequency));
  const maxMedian = Math.max(1, ...rows.map((r) => r.median));
  return (
    <div className="pm-table">
      <table>
        <thead>
          <tr>
            <Th<ActivityRow> label="Activity" col="name" sort={sort} onSort={onSort} />
            <Th<ActivityRow> label="Frequency" col="frequency" sort={sort} onSort={onSort} />
            <Th<ActivityRow> label="Relative" col="relativeFrequency" sort={sort} onSort={onSort} />
            <Th<ActivityRow> label="Cases" col="caseFrequency" sort={sort} onSort={onSort} />
            <Th<ActivityRow> label="First in case" col="firstInCase" sort={sort} onSort={onSort} />
            <Th<ActivityRow> label="Last in case" col="lastInCase" sort={sort} onSort={onSort} />
            <Th<ActivityRow> label="Median duration" col="median" sort={sort} onSort={onSort} />
            <Th<ActivityRow> label="Mean duration" col="mean" sort={sort} onSort={onSort} />
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr
              key={r.activity}
              className={
                selection?.kind === "activity" && selection.id === String(r.activity)
                  ? "is-selected"
                  : undefined
              }
              tabIndex={0}
              onClick={() => setSelection({ kind: "activity", id: String(r.activity) })}
              onKeyDown={(e) =>
                e.key === "Enter" && setSelection({ kind: "activity", id: String(r.activity) })
              }
            >
              <td>{r.name}</td>
              <td>
                {formatNumber(r.frequency)}
                <Bar share={r.frequency / maxFreq} />
              </td>
              <td>{formatPercent(r.relativeFrequency)}</td>
              <td>{formatNumber(r.caseFrequency)}</td>
              <td>{formatNumber(r.firstInCase)}</td>
              <td>{formatNumber(r.lastInCase)}</td>
              <td>
                {formatDuration(r.median)}
                <Bar share={r.median / maxMedian} />
              </td>
              <td>{formatDuration(r.mean)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CasesPage() {
  const { view, setSelection, selection } = useProcessModel();
  const rows = useMemo(() => computeCaseStats(view), [view]);
  const [sort, setSort] = useState<{ key: keyof CaseStat; dir: SortDir }>({
    key: "start",
    dir: "asc",
  });
  const sorted = useSorted(rows, sort.key, sort.dir);
  const onSort = (key: keyof CaseStat) =>
    setSort((s) => ({ key, dir: s.key === key && s.dir === "desc" ? "asc" : "desc" }));
  // No spread here: a million rows would blow the argument limit of Math.max.
  const maxEvents = useMemo(() => rows.reduce((m, r) => Math.max(m, r.events), 1), [rows]);
  const cols = "2fr 1.4fr 1fr 1.6fr 1.6fr 1.2fr 1fr";
  const header = (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: cols,
        background: "var(--pm-panel)",
        borderBottom: "1px solid var(--pm-line)",
        fontWeight: 600,
        fontSize: 12,
      }}
    >
      {(
        [
          ["Case", "name"],
          ["Events", "events"],
          ["Variant", "variant"],
          ["Started", "start"],
          ["Finished", "end"],
          ["Duration", "duration"],
          ["Active", "activeShare"],
        ] as [string, keyof CaseStat][]
      ).map(([label, key]) => (
        <button
          key={key}
          type="button"
          className="pm-btn"
          style={{
            border: 0,
            borderRadius: 0,
            textAlign: "left",
            background: "transparent",
            fontWeight: 600,
          }}
          onClick={() => onSort(key)}
        >
          {label}
          {sort.key === key ? (sort.dir === "asc" ? " ▲" : " ▼") : ""}
        </button>
      ))}
    </div>
  );
  return (
    <div className="pm-stats-main">
      {header}
      <VirtualList
        items={sorted}
        rowHeight={28}
        style={{ flex: 1 }}
        render={(r) => (
          <button
            type="button"
            className={`pm-list-row${selection?.kind === "case" && selection.caseId === r.caseId ? " is-selected" : ""}`}
            style={{ display: "grid", gridTemplateColumns: cols, padding: "0 10px" }}
            onClick={() => setSelection({ kind: "case", caseId: r.caseId })}
          >
            <span>{r.name}</span>
            <span>
              {formatNumber(r.events)}
              <Bar share={r.events / maxEvents} />
            </span>
            <span>Variant {r.variant + 1}</span>
            <span>{formatDateTime(r.start)}</span>
            <span>{formatDateTime(r.end)}</span>
            <span>{formatDuration(r.duration)}</span>
            <span>{formatPercent(r.activeShare)}</span>
          </button>
        )}
      />
    </div>
  );
}
