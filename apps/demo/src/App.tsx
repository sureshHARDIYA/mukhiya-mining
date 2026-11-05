import { type EventLog, formatNumber } from "@mukhiya-mining/core";
import { ExplorerSkeleton, ProcessExplorer } from "@mukhiya-mining/react";
import "@mukhiya-mining/react/styles.css";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Job } from "./worker";

interface Dataset {
  label: string;
  job: Job;
}

/** Real logs are 90 days of Application Insights page views and custom events, ids hashed. */
const DATASETS: Dataset[] = [
  ...[10_000, 100_000, 1_000_000].map((cases) => ({
    label: `${formatNumber(cases)} sessions`,
    job: { kind: "sample", cases, seed: 3 } as Job,
  })),
  { label: "Dokumentbanken prod", job: { kind: "json", url: "/data/dbank-prod.json" } },
  { label: "Kompis prod", job: { kind: "json", url: "/data/kompis-prod.json" } },
];

export function App() {
  const [dataset, setDataset] = useState(DATASETS[0] as Dataset);
  const [log, setLog] = useState<EventLog | null>(null);
  const [status, setStatus] = useState("");
  const [dark, setDark] = useState(window.matchMedia("(prefers-color-scheme: dark)").matches);
  const worker = useMemo(
    () => new Worker(new URL("./worker.ts", import.meta.url), { type: "module" }),
    [],
  );
  const started = useRef(0);

  useEffect(() => {
    setLog(null);
    setStatus(`Loading ${dataset.label} in a worker…`);
    started.current = performance.now();
    worker.onmessage = (e: MessageEvent<{ log: EventLog; ms: number }>) => {
      const total = Math.round(performance.now() - started.current);
      setLog(e.data.log);
      setStatus(
        `${dataset.label} · ${formatNumber(e.data.log.cases.length)} sessions · ${formatNumber(e.data.log.eventCount)} events · loaded + indexed in ${e.data.ms} ms (${total} ms incl. transfer)`,
      );
    };
    worker.postMessage(dataset.job);
  }, [dataset, worker]);

  return (
    <div
      style={{
        fontFamily: "system-ui, sans-serif",
        padding: 16,
        display: "grid",
        gap: 12,
        background: dark ? "#101316" : "#f4f6f8",
        minHeight: "100vh",
        color: dark ? "#e5e9ec" : "#1b2229",
      }}
    >
      <header style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <b>mukhiya-mining demo</b>
        <span style={{ display: "inline-flex", gap: 4 }}>
          {DATASETS.map((d) => (
            <button
              key={d.label}
              type="button"
              onClick={() => setDataset(d)}
              disabled={d === dataset}
              style={{ padding: "4px 10px" }}
            >
              {d.label}
            </button>
          ))}
        </span>
        <label style={{ marginLeft: "auto" }}>
          <input type="checkbox" checked={dark} onChange={(e) => setDark(e.target.checked)} /> dark
        </label>
      </header>
      <div id="status" style={{ fontSize: 13, opacity: 0.8 }}>
        {status}
      </div>
      {log === null ? (
        <ExplorerSkeleton
          message={status}
          height="calc(100vh - 110px)"
          colorScheme={dark ? "dark" : "light"}
        />
      ) : (
        <ProcessExplorer
          log={log}
          height="calc(100vh - 110px)"
          colorScheme={dark ? "dark" : "light"}
          map={{ animation: true, animationLimit: 4000 }}
          onCaseOpen={(id) => alert(`Open case ${id} in the host app`)}
        />
      )}
    </div>
  );
}
