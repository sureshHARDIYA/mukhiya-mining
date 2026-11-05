import { applyFilters, type EventLog, type Filter, type LogView } from "@mukhiya-mining/core";
import {
  type CSSProperties,
  createContext,
  type ReactNode,
  useContext,
  useMemo,
  useState,
} from "react";
import { useControllable } from "./shared/useControllable";

export type Selection =
  | { kind: "activity"; id: string }
  | { kind: "path"; id: string }
  | { kind: "variant"; id: number }
  | { kind: "case"; caseId: number };

export interface Permissions {
  canFilter?: boolean;
  canExport?: boolean;
}

export interface ProcessMiningProviderProps {
  log: EventLog;
  filters?: Filter[] | undefined;
  defaultFilters?: Filter[] | undefined;
  onFiltersChange?: ((filters: Filter[]) => void) | undefined;
  selection?: Selection | null | undefined;
  defaultSelection?: Selection | null | undefined;
  onSelectionChange?: ((selection: Selection | null) => void) | undefined;
  permissions?: Permissions | undefined;
  /** CSS custom properties (--pm-*) applied to the root element. */
  theme?: Record<string, string> | undefined;
  colorScheme?: "light" | "dark" | undefined;
  onCaseOpen?: ((caseId: string) => void) | undefined;
  className?: string | undefined;
  style?: CSSProperties | undefined;
  children: ReactNode;
}

/** What the map exposes to the host chrome (explorer header): a fit action and a one-line summary. */
export interface MapTools {
  fit: () => void;
  summary: string;
}

export interface ProcessMiningContextValue {
  log: EventLog;
  view: LogView;
  filters: Filter[];
  setFilters: (filters: Filter[]) => void;
  selection: Selection | null;
  setSelection: (selection: Selection | null) => void;
  permissions: Required<Permissions>;
  onCaseOpen: ((caseId: string) => void) | undefined;
  mapTools: MapTools | null;
  setMapTools: (tools: MapTools | null) => void;
}

const Context = createContext<ProcessMiningContextValue | null>(null);
const NO_FILTERS: Filter[] = [];

export function ProcessMiningProvider(props: ProcessMiningProviderProps) {
  const [filters, setFilters] = useControllable(
    props.filters,
    props.defaultFilters ?? NO_FILTERS,
    props.onFiltersChange,
  );
  const [selection, setSelection] = useControllable<Selection | null>(
    props.selection,
    props.defaultSelection ?? null,
    props.onSelectionChange,
  );
  const view = useMemo(() => applyFilters(props.log, filters), [props.log, filters]);
  const [mapTools, setMapTools] = useState<MapTools | null>(null);
  const permissions = useMemo(
    () => ({
      canFilter: props.permissions?.canFilter ?? true,
      canExport: props.permissions?.canExport ?? true,
    }),
    [props.permissions?.canFilter, props.permissions?.canExport],
  );
  const value = useMemo<ProcessMiningContextValue>(
    () => ({
      log: props.log,
      view,
      filters,
      setFilters,
      selection,
      setSelection,
      permissions,
      onCaseOpen: props.onCaseOpen,
      mapTools,
      setMapTools,
    }),
    [
      props.log,
      view,
      filters,
      setFilters,
      selection,
      setSelection,
      permissions,
      props.onCaseOpen,
      mapTools,
    ],
  );
  const style = { ...(props.theme as CSSProperties | undefined), ...props.style };
  return (
    <Context.Provider value={value}>
      <div
        className={`pm-root${props.className ? ` ${props.className}` : ""}`}
        data-theme={props.colorScheme}
        style={style}
      >
        {props.children}
      </div>
    </Context.Provider>
  );
}

export function useProcessModel(): ProcessMiningContextValue {
  const value = useContext(Context);
  if (!value) throw new Error("useProcessModel must be used inside <ProcessMiningProvider>");
  return value;
}

export function useFilters(): [Filter[], (filters: Filter[]) => void] {
  const { filters, setFilters } = useProcessModel();
  return [filters, setFilters];
}

export function useSelection(): [Selection | null, (selection: Selection | null) => void] {
  const { selection, setSelection } = useProcessModel();
  return [selection, setSelection];
}
