import { formatDuration, formatNumber } from "@pathminer/core";
import type { AnimationMode } from "./animation";

interface Props {
  mode: AnimationMode;
  onMode: (m: AnimationMode) => void;
  playing: boolean;
  onTogglePlay: () => void;
  /** 0..1 position in the timeline. */
  progress: number;
  onSeek: (p: number) => void;
  /** Current log time (ms) in realtime mode, elapsed ms in synced mode. */
  time: number;
  /** Wall-clock seconds for the whole timeline. */
  duration: number;
  onDuration: (seconds: number) => void;
  /** Log ms per wall ms, shown for reference. */
  factor: number;
  density: number[];
  sampled: number;
  total: number;
  onExit: () => void;
}

/** Slow end plays the timeline over ten minutes, fast end over ten seconds. */
const SLOW_S = 600;
const FAST_S = 10;

export function AnimationBar(p: Readonly<Props>) {
  const sampledInfo = p.mode === "realtime" ? " (busiest period)" : "";
  const speedPosition = Math.log(SLOW_S / p.duration) / Math.log(SLOW_S / FAST_S);
  return (
    <div className="pm-anim-bar">
      <button
        type="button"
        className="pm-btn pm-anim-play"
        onClick={p.onTogglePlay}
        aria-label={p.playing ? "Pause" : "Play"}
      >
        {p.playing ? "❚❚" : "▶"}
      </button>
      <div className="pm-anim-timeline">
        <Density values={p.density} />
        <input
          id="pm-anim-seek"
          className="pm-slider pm-anim-seek"
          type="range"
          min="0"
          max="1000"
          value={Math.round(p.progress * 1000)}
          onChange={(e) => p.onSeek(Number(e.target.value) / 1000)}
          aria-label="Timeline"
        />
      </div>
      <div className="pm-anim-clock">
        {p.mode === "realtime" ? (
          <>
            <b>
              {new Date(p.time).toLocaleTimeString(undefined, {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </b>
            <small>
              {new Date(p.time).toLocaleDateString(undefined, {
                weekday: "short",
                day: "numeric",
                month: "short",
              })}
            </small>
          </>
        ) : (
          <b>{formatDuration(p.time)}</b>
        )}
      </div>
      <label className="pm-anim-speed">
        <span>slow</span>
        <input
          id="pm-anim-speed"
          className="pm-slider"
          type="range"
          min="0"
          max="100"
          value={Math.round(speedPosition * 100)}
          onChange={(e) => {
            const x = Number(e.target.value) / 100;
            p.onDuration(Math.round(SLOW_S * (FAST_S / SLOW_S) ** x));
          }}
          aria-label="Speed"
        />
        <span>fast</span>
        <span className="pm-anim-factor" title={`×${formatNumber(Math.round(p.factor))} real time`}>
          {formatDuration(p.duration * 1000)}
        </span>
      </label>
      <select
        id="pm-anim-mode"
        className="pm-select"
        value={p.mode}
        onChange={(e) => p.onMode(e.target.value as AnimationMode)}
        aria-label="Mode"
      >
        <option value="realtime">Real time</option>
        <option value="synced">Synchronise case starts</option>
      </select>
      <span className="pm-anim-info">
        {p.sampled < p.total
          ? `${formatNumber(p.sampled)} of ${formatNumber(p.total)} cases${sampledInfo}`
          : `${formatNumber(p.total)} cases`}
      </span>
      <button type="button" className="pm-btn" onClick={p.onExit}>
        Exit
      </button>
    </div>
  );
}

function Density({ values }: Readonly<{ values: number[] }>) {
  const max = Math.max(1, ...values);
  const W = 1000;
  const H = 28;
  const points = values
    .map((v, i) => `${((i + 0.5) / values.length) * W},${H - (v / max) * H}`)
    .join(" ");
  return (
    <svg
      className="pm-anim-density"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polygon points={`0,${H} ${points} ${W},${H}`} fill="var(--pm-accent)" opacity=".35" />
    </svg>
  );
}
