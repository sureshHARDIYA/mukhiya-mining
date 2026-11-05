import type { Dfg, LogView } from "@mukhiya-mining/core";
import type { Scene } from "../render/scene";
import { AnimationBar } from "./AnimationBar";
import { TokenLayer } from "./TokenLayer";
import { useAnimation } from "./useAnimation";
import type { Transform } from "./usePanZoom";

interface Props {
  view: LogView;
  dfg: Dfg;
  scene: Scene;
  transform: Transform;
  limit: number;
  host: HTMLElement | null;
  onExit: () => void;
}

/** Token overlay (its own SVG above the map, no pointer events) plus the playback bar. */
export function MapAnimation({ view, dfg, scene, transform, limit, host, onExit }: Props) {
  const anim = useAnimation(view, dfg, true, limit);
  return (
    <>
      <svg className="pm-anim-overlay" aria-hidden="true">
        <g transform={`translate(${transform.x} ${transform.y}) scale(${transform.k})`}>
          <TokenLayer
            scene={scene}
            tracks={anim.tracks}
            timeRef={anim.timeRef}
            host={host}
            playing={anim.playing}
          />
        </g>
      </svg>
      <AnimationBar
        mode={anim.mode}
        onMode={anim.setMode}
        playing={anim.playing}
        onTogglePlay={anim.togglePlay}
        progress={anim.progress}
        onSeek={anim.seek}
        time={anim.time}
        duration={anim.duration}
        onDuration={anim.setDuration}
        factor={anim.factor}
        density={anim.density}
        sampled={anim.sampled}
        total={anim.total}
        onExit={onExit}
      />
    </>
  );
}
