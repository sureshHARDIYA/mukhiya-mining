import { type Filter, formatDateTime, toMillis } from "@mukhiya-mining/core";
import { type CSSProperties, useState } from "react";
import { useProcessModel } from "../context";

export interface FilterBarProps {
  className?: string | undefined;
  style?: CSSProperties | undefined;
}

export function describeFilter(f: Filter): string {
  switch (f.type) {
    case "timeframe":
      return `Time: ${f.from ? formatDateTime(toMillis(f.from, "from")) : "…"} – ${f.to ? formatDateTime(toMillis(f.to, "to")) : "…"}`;
    case "activity":
      return `${f.mode === "keep" ? "With" : "Without"}: ${f.activities.join(", ")}`;
    case "endpoints":
      return [
        f.start?.length ? `Start: ${f.start.join(", ")}` : "",
        f.end?.length ? `End: ${f.end.join(", ")}` : "",
      ]
        .filter(Boolean)
        .join(" · ");
    case "variants":
      return f.top ? `Top ${f.top} variants` : `Variants ≥ ${f.minCases ?? 1} cases`;
  }
}

/** Active filters as removable chips plus a small "add filter" panel. */
export function FilterBar(props: FilterBarProps) {
  const { filters, setFilters, permissions, log } = useProcessModel();
  const [open, setOpen] = useState(false);
  const remove = (i: number) => setFilters(filters.filter((_, k) => k !== i));
  return (
    <div
      className={`pm-filterbar${props.className ? ` ${props.className}` : ""}`}
      style={props.style}
    >
      {filters.map((f, i) => (
        <button
          key={JSON.stringify(f)}
          type="button"
          className="pm-chip"
          onClick={() => remove(i)}
          title="Remove filter"
        >
          {describeFilter(f)}
          <span className="pm-x">×</span>
        </button>
      ))}
      {filters.length > 1 ? (
        <button type="button" className="pm-chip is-add" onClick={() => setFilters([])}>
          Clear all
        </button>
      ) : null}
      {permissions.canFilter ? (
        <button
          type="button"
          className="pm-chip is-add"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          + filter
        </button>
      ) : null}
      {open ? (
        <AddFilterPanel
          activities={log.activities}
          onAdd={(f) => {
            setFilters([...filters, f]);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
}

type Kind = Filter["type"];

interface Draft {
  from: string;
  to: string;
  mode: "keep" | "remove";
  picked: string[];
  start: string;
  end: string;
  top: number;
}

const EMPTY_DRAFT: Draft = {
  from: "",
  to: "",
  mode: "keep",
  picked: [],
  start: "",
  end: "",
  top: 10,
};

function timeframeFilter(d: Draft): Filter | null {
  if (!d.from && !d.to) return null;
  return {
    type: "timeframe",
    ...(d.from ? { from: d.from } : {}),
    ...(d.to ? { to: d.to } : {}),
    mode: "intersecting",
  };
}

function endpointsFilter(d: Draft): Filter | null {
  if (!d.start && !d.end) return null;
  return {
    type: "endpoints",
    ...(d.start ? { start: [d.start] } : {}),
    ...(d.end ? { end: [d.end] } : {}),
  };
}

const BUILDERS: Record<Kind, (d: Draft) => Filter | null> = {
  timeframe: timeframeFilter,
  activity: (d) =>
    d.picked.length ? { type: "activity", mode: d.mode, activities: d.picked } : null,
  endpoints: endpointsFilter,
  variants: (d) => ({ type: "variants", top: d.top }),
};

function buildFilter(kind: Kind, d: Draft): Filter | null {
  return BUILDERS[kind](d);
}

interface EditorProps {
  draft: Draft;
  patch: (p: Partial<Draft>) => void;
  activities: string[];
}

function TimeframeEditor({ draft, patch }: EditorProps) {
  return (
    <>
      <div>
        <label className="pm-label" htmlFor="pm-filter-from">
          From
        </label>
        <input
          id="pm-filter-from"
          className="pm-input"
          type="datetime-local"
          value={draft.from}
          onChange={(e) => patch({ from: e.target.value })}
        />
      </div>
      <div>
        <label className="pm-label" htmlFor="pm-filter-to">
          To
        </label>
        <input
          id="pm-filter-to"
          className="pm-input"
          type="datetime-local"
          value={draft.to}
          onChange={(e) => patch({ to: e.target.value })}
        />
      </div>
    </>
  );
}

function ActivityEditor({ draft, patch, activities }: EditorProps) {
  return (
    <>
      <div className="pm-seg">
        <button
          type="button"
          className="pm-btn"
          aria-pressed={draft.mode === "keep"}
          onClick={() => patch({ mode: "keep" })}
        >
          Keep cases with
        </button>
        <button
          type="button"
          className="pm-btn"
          aria-pressed={draft.mode === "remove"}
          onClick={() => patch({ mode: "remove" })}
        >
          Remove cases with
        </button>
      </div>
      <select
        id="pm-filter-activities"
        className="pm-select"
        multiple
        size={Math.min(8, activities.length)}
        value={draft.picked}
        onChange={(e) => patch({ picked: Array.from(e.target.selectedOptions, (o) => o.value) })}
        aria-label="Activities"
      >
        {activities.map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
      </select>
    </>
  );
}

function ActivitySelect({
  id,
  label,
  value,
  activities,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  activities: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="pm-label" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        className="pm-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Any</option>
        {activities.map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
      </select>
    </div>
  );
}

function EndpointsEditor({ draft, patch, activities }: EditorProps) {
  return (
    <>
      <ActivitySelect
        id="pm-filter-start"
        label="Starts with"
        value={draft.start}
        activities={activities}
        onChange={(start) => patch({ start })}
      />
      <ActivitySelect
        id="pm-filter-end"
        label="Ends with"
        value={draft.end}
        activities={activities}
        onChange={(end) => patch({ end })}
      />
    </>
  );
}

function VariantsEditor({ draft, patch }: EditorProps) {
  return (
    <div>
      <label className="pm-label" htmlFor="pm-filter-top">
        Keep the most common
      </label>
      <input
        id="pm-filter-top"
        className="pm-input"
        type="number"
        min={1}
        value={draft.top}
        onChange={(e) => patch({ top: Math.max(1, Number(e.target.value)) })}
      />
    </div>
  );
}

const EDITORS: Record<Kind, (p: EditorProps) => JSX.Element> = {
  timeframe: TimeframeEditor,
  activity: ActivityEditor,
  endpoints: EndpointsEditor,
  variants: VariantsEditor,
};

function AddFilterPanel({
  activities,
  onAdd,
  onClose,
}: {
  activities: string[];
  onAdd: (f: Filter) => void;
  onClose: () => void;
}) {
  const [kind, setKind] = useState<Kind>("activity");
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const patch = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));
  const sorted = [...activities].sort();
  const filter = buildFilter(kind, draft);
  const Editor = EDITORS[kind];
  return (
    <div className="pm-filter-panel" role="dialog" aria-label="Add filter">
      <div>
        <label className="pm-label" htmlFor="pm-filter-kind">
          Filter
        </label>
        <select
          id="pm-filter-kind"
          className="pm-select"
          value={kind}
          onChange={(e) => setKind(e.target.value as Kind)}
        >
          <option value="activity">Activity</option>
          <option value="timeframe">Timeframe</option>
          <option value="endpoints">Start / end activity</option>
          <option value="variants">Top variants</option>
        </select>
      </div>
      <Editor draft={draft} patch={patch} activities={sorted} />
      <footer>
        <button type="button" className="pm-btn" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="pm-btn is-primary"
          disabled={!filter}
          onClick={() => filter && onAdd(filter)}
        >
          Add
        </button>
      </footer>
    </div>
  );
}
