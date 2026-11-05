import { type CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import { CasesView } from "./cases/CasesView";
import { ProcessMiningProvider, type ProcessMiningProviderProps, useProcessModel } from "./context";
import { FilterBar } from "./filters/FilterBar";
import { ProcessMap, type ProcessMapProps } from "./map/ProcessMap";
import { StatisticsView } from "./stats/StatisticsView";

export type ExplorerTab = "map" | "statistics" | "cases";

export interface ProcessExplorerProps extends Omit<ProcessMiningProviderProps, "children"> {
  tab?: ExplorerTab | undefined;
  defaultTab?: ExplorerTab | undefined;
  onTabChange?: ((tab: ExplorerTab) => void) | undefined;
  map?: ProcessMapProps | undefined;
  height?: number | string | undefined;
  /** Show the "Full screen" button. Default on. */
  fullscreen?: boolean | undefined;
}

const TABS: { id: ExplorerTab; label: string }[] = [
  { id: "map", label: "Map" },
  { id: "statistics", label: "Statistics" },
  { id: "cases", label: "Cases" },
];

/** The whole experience in one component: tabs, filter bar, map, statistics and cases. */
export function ProcessExplorer({
  tab,
  defaultTab,
  onTabChange,
  map,
  height = 640,
  fullscreen = true,
  style,
  className,
  ...provider
}: ProcessExplorerProps) {
  const [internal, setInternal] = useState<ExplorerTab>(defaultTab ?? "map");
  const current = tab ?? internal;
  const go = (t: ExplorerTab) => {
    setInternal(t);
    onTabChange?.(t);
  };
  const full = useFullscreen();
  const rootStyle: CSSProperties = full.active
    ? { ...style, height: "100vh" }
    : { height, ...style };
  return (
    <ProcessMiningProvider
      {...provider}
      style={rootStyle}
      className={`${full.active ? "is-fullscreen" : ""}${className ? ` ${className}` : ""}`}
      rootRef={full.ref}
    >
      <div className="pm-explorer" style={{ height: "100%" }}>
        <div className="pm-tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              className="pm-tab"
              aria-selected={current === t.id}
              onClick={() => go(t.id)}
            >
              {t.label}
            </button>
          ))}
          {current === "map" ? <MapSummary /> : null}
          <FilterBar />
          {current === "map" ? <FitButton /> : null}
          {fullscreen ? (
            <button
              type="button"
              className="pm-btn"
              onClick={full.toggle}
              aria-pressed={full.active}
              title={full.active ? "Leave full screen (Esc)" : "Full screen"}
            >
              {full.active ? "Exit full screen" : "Full screen"}
            </button>
          ) : null}
        </div>
        <div className="pm-body">
          {current === "map" ? (
            <ProcessMap {...map} />
          ) : current === "statistics" ? (
            <StatisticsView />
          ) : (
            <CasesView />
          )}
        </div>
      </div>
    </ProcessMiningProvider>
  );
}

/** Case, activity and path counts, fed by the mounted map. */
function MapSummary() {
  const { mapTools } = useProcessModel();
  return mapTools ? <span className="pm-tabs-summary">{mapTools.summary}</span> : null;
}

function FitButton() {
  const { mapTools } = useProcessModel();
  if (!mapTools) return null;
  return (
    <button type="button" className="pm-btn" onClick={mapTools.fit}>
      Fit
    </button>
  );
}

/**
 * Full screen for the whole explorer: the browser's own full screen when it is
 * allowed (nothing else on the page is visible, the process map gets every
 * pixel), else a fixed overlay above the host's layout. Esc leaves either.
 */
function useFullscreen() {
  const ref = useRef<HTMLDivElement>(null);
  const [overlay, setOverlay] = useState(false);
  const [native, setNative] = useState(false);
  useEffect(() => {
    const sync = () =>
      setNative(Boolean(ref.current && document.fullscreenElement === ref.current));
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  useEffect(() => {
    if (!overlay && !native) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOverlay(false);
      if (document.fullscreenElement) void document.exitFullscreen?.();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [overlay, native]);
  const toggle = useCallback(() => {
    const el = ref.current;
    if (native) {
      void document.exitFullscreen?.();
      return;
    }
    if (overlay) {
      setOverlay(false);
      return;
    }
    if (el?.requestFullscreen) {
      el.requestFullscreen().catch(() => setOverlay(true));
    } else setOverlay(true);
  }, [native, overlay]);
  return { ref, active: native || overlay, toggle };
}
