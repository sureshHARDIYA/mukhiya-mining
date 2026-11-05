import { type CSSProperties, useState } from "react";
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
  style,
  ...provider
}: ProcessExplorerProps) {
  const [internal, setInternal] = useState<ExplorerTab>(defaultTab ?? "map");
  const current = tab ?? internal;
  const go = (t: ExplorerTab) => {
    setInternal(t);
    onTabChange?.(t);
  };
  const rootStyle: CSSProperties = { height, ...style };
  return (
    <ProcessMiningProvider {...provider} style={rootStyle}>
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
