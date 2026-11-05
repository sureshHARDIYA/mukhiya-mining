import type { Dfg, LogView } from "@mukhiya-mining/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type AnimationMode, activityDensity, buildTracks, synced, type Track } from "./animation";

export interface AnimationState {
  mode: AnimationMode;
  setMode: (m: AnimationMode) => void;
  playing: boolean;
  togglePlay: () => void;
  progress: number;
  seek: (p: number) => void;
  time: number;
  /** Playback speed as a multiple of real time. */
  factor: number;
  setFactor: (f: number) => void;
  span: number;
  timeRef: React.MutableRefObject<number>;
  tracks: Track[];
  density: number[];
  sampled: number;
  total: number;
}

/** Playback clock for the token layer. Time lives in a ref; progress state re-renders only the bar. */
export function useAnimation(
  view: LogView,
  dfg: Dfg,
  enabled: boolean,
  limit = 1500,
): AnimationState {
  const [mode, setMode] = useState<AnimationMode>("realtime");
  const [playing, setPlaying] = useState(false);
  const [factor, setFactor] = useState(20);
  const [progress, setProgress] = useState(0);
  const timeRef = useRef(0);

  const built = useMemo(
    () =>
      enabled ? buildTracks(view, dfg, limit, mode === "realtime" ? "window" : "spread") : null,
    [view, dfg, enabled, limit, mode],
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
    factor,
    setFactor,
    span,
    timeRef,
    tracks,
    density,
    sampled: built?.sampled ?? 0,
    total: built?.total ?? 0,
  };
}
