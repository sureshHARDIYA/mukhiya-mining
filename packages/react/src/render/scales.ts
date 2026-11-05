import type { DfgEdge, DfgNode } from "@pathminer/core";

export type Metric = "frequency" | "performance";
export type FrequencyShow = "frequency" | "caseFrequency" | "caseCoverage" | "maxRepetitions";
export type PerformanceShow = "total" | "median" | "mean" | "max" | "min";
export type Show = FrequencyShow | PerformanceShow;

export const FREQUENCY_SHOWS: { value: FrequencyShow; label: string }[] = [
  { value: "frequency", label: "Absolute frequency" },
  { value: "caseFrequency", label: "Case frequency" },
  { value: "maxRepetitions", label: "Max. repetitions" },
  { value: "caseCoverage", label: "Case coverage" },
];
export const PERFORMANCE_SHOWS: { value: PerformanceShow; label: string }[] = [
  { value: "total", label: "Total duration" },
  { value: "median", label: "Median duration" },
  { value: "mean", label: "Mean duration" },
  { value: "max", label: "Max. duration" },
  { value: "min", label: "Min. duration" },
];

export function defaultShow(metric: Metric): Show {
  return metric === "frequency" ? "caseCoverage" : "total";
}

/** Read the displayed value of a node or edge. Pseudo nodes return NaN for performance. */
export function metricValue(item: DfgNode | DfgEdge, show: Show): number {
  switch (show) {
    case "frequency":
    case "caseFrequency":
    case "caseCoverage":
    case "maxRepetitions":
      return item[show];
    default:
      return item.duration.count === 0 ? Number.NaN : item.duration[show];
  }
}

export function isPerformanceShow(show: Show): show is PerformanceShow {
  return (
    show === "total" || show === "median" || show === "mean" || show === "max" || show === "min"
  );
}

/** Palette: node fill scale, edge stroke scale. Colors are mixed in sRGB; good enough for 3 stops. */
export interface Palette {
  node: [string, string, string];
  edge: [string, string, string];
}

export const FREQUENCY_PALETTE: Palette = {
  node: ["#d6dfe9", "#3b7fc0", "#0a2d5c"],
  edge: ["#c3c9cf", "#5f6872", "#14181c"],
};
export const PERFORMANCE_PALETTE: Palette = {
  node: ["#f5ecd8", "#e39a3c", "#8f1f2c"],
  edge: ["#c2bdb4", "#c66a3c", "#7e1a24"],
};

export function hexToRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const c = (x: number, y: number) => Math.round(x + (y - x) * t);
  return `rgb(${c(r1, r2)}, ${c(g1, g2)}, ${c(b1, b2)})`;
}

/** Sample a three-stop scale at t in 0..1. */
export function colorAt(scale: [string, string, string], t: number): string {
  const x = Number.isNaN(t) ? 0 : Math.min(1, Math.max(0, t));
  return x < 0.5 ? mix(scale[0], scale[1], x * 2) : mix(scale[1], scale[2], (x - 0.5) * 2);
}

/** Light text on dark fills; the threshold matches the palettes above. */
export function labelColor(t: number): string {
  return t > 0.38 ? "#ffffff" : "#1b2229";
}

export function edgeWidth(t: number): number {
  return 1.2 + 5 * (Number.isNaN(t) ? 0 : Math.min(1, Math.max(0, t)));
}

/** Normalised 0..1 position of a value within [0, max]. Square root for durations keeps outliers readable. */
export function normalise(value: number, max: number, show: Show): number {
  if (!(max > 0) || Number.isNaN(value)) return Number.NaN;
  const t = Math.min(1, value / max);
  return isPerformanceShow(show) ? Math.sqrt(t) : t;
}
