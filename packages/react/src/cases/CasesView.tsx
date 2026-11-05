import {
  caseEvents,
  computeVariants,
  formatDateTime,
  formatDuration,
  formatNumber,
  formatPercent,
  type Variant,
} from "@pathminer/core";
import { type CSSProperties, useMemo, useState } from "react";
import { useProcessModel } from "../context";
import { VirtualList } from "../shared/VirtualList";

export interface CasesViewProps {
  className?: string | undefined;
  style?: CSSProperties | undefined;
}

const ROW = 46;

export function CasesView(props: CasesViewProps) {
  const { view, log, selection, setSelection } = useProcessModel();
  const variants = useMemo(() => computeVariants(view), [view]);
  const [variantId, setVariantId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const activeVariant = useMemo(
    () => variants.find((v) => v.id === variantId) ?? null,
    [variants, variantId],
  );
  const caseIds = useMemo(
    () => listCases(view.caseMask, activeVariant, log.cases, query),
    [view.caseMask, activeVariant, log.cases, query],
  );
  const selectedCase = selection?.kind === "case" ? selection.caseId : (caseIds[0] ?? null);

  return (
    <div className={`pm-cases${props.className ? ` ${props.className}` : ""}`} style={props.style}>
      <div className="pm-list">
        <div className="pm-list-head">
          <span>Variants ({formatNumber(variants.length)})</span>
        </div>
        <button
          type="button"
          className={`pm-list-row${variantId === null ? " is-selected" : ""}`}
          style={{ height: ROW }}
          onClick={() => setVariantId(null)}
        >
          <span>All cases</span>
          <small>{formatNumber(view.caseCount)}</small>
        </button>
        <VirtualList
          items={variants}
          rowHeight={ROW}
          style={{ flex: 1 }}
          render={(v, i) => (
            <button
              type="button"
              className={`pm-list-row${variantId === v.id ? " is-selected" : ""}`}
              onClick={() => {
                setVariantId(v.id);
                setSelection({ kind: "variant", id: v.id });
              }}
            >
              <span>Variant {i + 1}</span>
              <small>
                {formatNumber(v.caseIds.length)} · {formatPercent(v.share)}
              </small>
            </button>
          )}
        />
      </div>
      <div className="pm-list">
        <div className="pm-list-head">
          <span>Cases ({formatNumber(caseIds.length)})</span>
          <input
            id="pm-case-search"
            className="pm-input"
            style={{ width: 90, padding: "2px 6px" }}
            placeholder="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search cases"
          />
        </div>
        <VirtualList
          items={caseIds}
          rowHeight={ROW}
          style={{ flex: 1 }}
          render={(c) => (
            <button
              type="button"
              className={`pm-list-row${selectedCase === c ? " is-selected" : ""}`}
              onClick={() => setSelection({ kind: "case", caseId: c })}
            >
              <span>{log.cases[c]}</span>
              <small>{formatNumber(log.caseLength[c] as number)} events</small>
            </button>
          )}
        />
      </div>
      {selectedCase === null ? (
        <div className="pm-case">
          <div className="pm-empty">No cases match.</div>
        </div>
      ) : (
        <CaseDetail caseId={selectedCase} />
      )}
    </div>
  );
}

function listCases(
  mask: Uint8Array,
  variant: Variant | null,
  names: string[],
  query: string,
): number[] {
  const q = query.trim().toLowerCase();
  const source = variant ? variant.caseIds : null;
  const out: number[] = [];
  const total = source ? source.length : mask.length;
  for (let i = 0; i < total; i++) {
    const c = source ? (source[i] as number) : i;
    if (mask[c] !== 1) continue;
    if (q && !(names[c] as string).toLowerCase().includes(q)) continue;
    out.push(c);
  }
  return out;
}

function CaseDetail({ caseId }: { caseId: number }) {
  const { log, onCaseOpen } = useProcessModel();
  const [mode, setMode] = useState<"graph" | "table">("graph");
  const [start, end] = caseEvents(log, caseId);
  const name = log.cases[caseId] as string;
  const duration = (log.caseEndTime[caseId] as number) - (log.caseStartTime[caseId] as number);
  const resource = log.attributes.find((a) => a.name === "resource");
  const events = useMemo(() => {
    const rows = [];
    for (let e = start; e < end; e++) {
      const s = log.eventStart[e] as number;
      const d = (log.eventEnd[e] as number) - s;
      const prevEnd =
        e > start
          ? Number.isNaN(log.eventEnd[e - 1] as number)
            ? (log.eventStart[e - 1] as number)
            : (log.eventEnd[e - 1] as number)
          : Number.NaN;
      const who =
        resource && (resource.codes[e] as number) >= 0
          ? String(resource.values[resource.codes[e] as number])
          : null;
      rows.push({
        e,
        activity: log.activities[log.eventActivity[e] as number] as string,
        start: s,
        duration: d,
        wait: s - prevEnd,
        who,
      });
    }
    return rows;
  }, [log, start, end, resource]);
  return (
    <div className="pm-case">
      <div className="pm-case-head">
        <div className="pm-case-title">
          <div>
            <b>{name}</b>{" "}
            <span style={{ color: "var(--pm-muted)" }}>
              case with {formatNumber(end - start)} events
            </span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <div className="pm-seg">
              <button
                type="button"
                className="pm-btn"
                aria-pressed={mode === "graph"}
                onClick={() => setMode("graph")}
              >
                Graph
              </button>
              <button
                type="button"
                className="pm-btn"
                aria-pressed={mode === "table"}
                onClick={() => setMode("table")}
              >
                Table
              </button>
            </div>
            {onCaseOpen ? (
              <button type="button" className="pm-btn is-primary" onClick={() => onCaseOpen(name)}>
                Open
              </button>
            ) : null}
          </div>
        </div>
        <div className="pm-kpis">
          <div className="pm-kpi">
            <b>{formatNumber(end - start)}</b>
            <span>events</span>
          </div>
          <div className="pm-kpi">
            <b>{formatDateTime(log.caseStartTime[caseId] as number)}</b>
            <span>start</span>
          </div>
          <div className="pm-kpi">
            <b>{formatDuration(duration)}</b>
            <span>duration</span>
          </div>
          {log.attributes
            .filter((a) => a.name !== "resource")
            .map((a) => {
              const code = a.codes[start] as number;
              return code >= 0 ? (
                <div key={a.name} className="pm-kpi">
                  <b>{String(a.values[code])}</b>
                  <span>{a.name}</span>
                </div>
              ) : null;
            })}
        </div>
      </div>
      <div className="pm-case-body">
        {mode === "table" ? (
          <div className="pm-table">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Activity</th>
                  <th>Started</th>
                  <th>Duration</th>
                  <th>Wait before</th>
                  {resource ? <th>Resource</th> : null}
                </tr>
              </thead>
              <tbody>
                {events.map((ev, i) => (
                  <tr key={ev.e}>
                    <td>{i + 1}</td>
                    <td>{ev.activity}</td>
                    <td>{formatDateTime(ev.start)}</td>
                    <td>{formatDuration(ev.duration)}</td>
                    <td>{i === 0 ? "–" : formatDuration(ev.wait)}</td>
                    {resource ? <td>{ev.who ?? "–"}</td> : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          events.map((ev, i) => (
            <div key={ev.e}>
              {i > 0 ? <div className="pm-event-gap">↓ {formatDuration(ev.wait)}</div> : null}
              <div className="pm-event">
                <div className="pm-event-n">{i + 1}</div>
                <div className="pm-event-card">
                  {ev.activity}
                  <small>
                    started {formatDateTime(ev.start)}
                    {ev.who ? ` by ${ev.who}` : ""}
                    {Number.isNaN(ev.duration)
                      ? ""
                      : ` · completed after ${formatDuration(ev.duration)}`}
                  </small>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
