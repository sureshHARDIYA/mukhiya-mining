import type { Dfg, LogView } from "@mukhiya-mining/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type AnimationMode,
  activityDensity,
  selectCases,
  synced,
  type Track,
  tracksFor,
} from "./animation";

export interface AnimationState {
  mode: AnimationMode;
  setMode: (m: AnimationMode) => void;
  playing: boolean;
  togglePlay: () => void;
  progress: number;
  seek: (p: number) => void;
  time: number;
  /** Wall-clock seconds the whole timeline takes to play; the speed control sets this. */
  duration: number;
  setDuration: (seconds: number) => void;
  /** Log ms advanced per wall ms, derived from `duration` and the raw span. */
  factor: number;
  span: number;
  timeRef: React.MutableRefObject<number>;
  tracks: Track[];
  density: number[];
  sampled: number;
  total: number;
}

/** Playback clock for the token layer. Time lives in a ref; progress state re-renders only the bar. */
/** Wall-clock time a hop must take on screen, so tokens travel instead of teleport. */
const TRAVEL_WALL_MS = 500;
const APPROACH_WALL_MS = 400;
const DWELL_WALL_MS = 350;
export const DEFAULT_DURATION_S = 60;

export function useAnimation(
  view: LogView,
  dfg: Dfg,
  enabled: boolean,
  limit = 1500,
): AnimationState {
  const [mode, setMode] = useState<AnimationMode>("realtime");
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(DEFAULT_DURATION_S);
  const [progress, setProgress] = useState(0);
  const timeRef = useRef(0);

  const selection = useMemo(
    () => (enabled ? selectCases(view, limit, mode === "realtime" ? "window" : "spread") : null),
    [view, enabled, limit, mode],
  );
  const rawSpan = !selection ? 1 : mode === "synced" ? selection.syncedSpan : selection.span;
  const factor = Math.max(1, rawSpan / (duration * 1000));
  const built = useMemo(
    () =>
      selection
        ? tracksFor(view, dfg, selection, {
            travel: TRAVEL_WALL_MS * factor,
            approach: APPROACH_WALL_MS * factor,
            dwell: DWELL_WALL_MS * factor,
          })
        : null,
    [view, dfg, selection, factor],
  );
  const tracks = useMemo(() => {
    if (!built) return [];
    return mode === "synced"
      ? built.tracks.map(synced).sort((a, b) => a.end - b.end)
      : built.tracks;
  }, [built, mode]);
  const origin = mode === "synced" || !built ? 0 : built.timeStart;
  const span = !built ? 1 : mode === "synced" ? built.maxDuration : built.timeEnd - built.timeStart;

  // Mode or data changes restart the clock from the beginning.
  const resetKey = `${origin}:${span}`;
  useEffect(() => {
    timeRef.current = Number(resetKey.split(":")[0]);
    setProgress(0);
    setPlaying(false);
  }, [resetKey]);

  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      timeRef.current = Math.min(origin + span, timeRef.current + dt * factor);
      const p = (timeRef.current - origin) / span;
      setProgress(p);
      if (p >= 1) setPlaying(false);
      else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, origin, span, factor]);

  const density = useMemo(() => activityDensity(tracks, origin, span), [tracks, origin, span]);

  const seek = useCallback(
    (p: number) => {
      timeRef.current = origin + p * span;
      setProgress(p);
    },
    [origin, span],
  );
  const togglePlay = useCallback(() => {
    if (!playing && progress >= 1) seek(0);
    setPlaying((v) => !v);
  }, [playing, progress, seek]);

  return {
    mode,
    setMode,
    playing,
    togglePlay,
    progress,
    seek,
    time: origin + progress * span,
    duration,
    setDuration,
    factor,
    span,
    timeRef,
    tracks,
    density,
    sampled: built?.sampled ?? 0,
    total: built?.total ?? 0,
  };
}
