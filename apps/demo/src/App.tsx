import { type EventLog, formatNumber } from "@mukhiya-mining/core";
import { ProcessExplorer } from "@mukhiya-mining/react";
import "@mukhiya-mining/react/styles.css";
import { useEffect, useMemo, useRef, useState } from "react";

const SIZES = [10_000, 100_000, 1_000_000];

export function App() {
  const [cases, setCases] = useState(SIZES[0] as number);
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
    setStatus(`Generating ${formatNumber(cases)} sessions in a worker…`);
    started.current = performance.now();
    worker.onmessage = (e: MessageEvent<{ log: EventLog; ms: number }>) => {
      const total = Math.round(performance.now() - started.current);
      setLog(e.data.log);
      setStatus(
        `${formatNumber(e.data.log.cases.length)} sessions · ${formatNumber(e.data.log.eventCount)} events · generated + indexed in ${e.data.ms} ms (${total} ms incl. transfer)`,
      );
    };
    worker.postMessage({ cases, seed: 3 });
  }, [cases, worker]);

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
          {SIZES.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setCases(n)}
              disabled={n === cases}
              style={{ padding: "4px 10px" }}
            >
              {formatNumber(n)} sessions
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
      {log ? (
        <ProcessExplorer
          log={log}
          height="calc(100vh - 110px)"
          colorScheme={dark ? "dark" : "light"}
          onCaseOpen={(id) => alert(`Open case ${id} in the host app`)}
        />
      ) : null}
    </div>
  );
}
