import { type PointerEvent as ReactPointerEvent, useCallback, useRef, useState } from "react";

export interface Transform {
  x: number;
  y: number;
  k: number;
}

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 4;

const IDENTITY: Transform = { x: 0, y: 0, k: 1 };

/** Pointer-drag pan, wheel zoom around the cursor, and fit-to-content. */
export function usePanZoom(initial?: Transform) {
  const [transform, setTransform] = useState<Transform>(initial ?? IDENTITY);
  const [panning, setPanning] = useState(false);
  const drag = useRef<{ x: number; y: number; tx: number; ty: number; moved: boolean } | null>(
    null,
  );

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      if (e.button !== 0) return;
      drag.current = { x: e.clientX, y: e.clientY, tx: transform.x, ty: transform.y, moved: false };
      setPanning(true);
    },
    [transform.x, transform.y],
  );
  const onPointerMove = useCallback((e: ReactPointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.abs(dx) + Math.abs(dy) > 3) {
      d.moved = true;
      // Capture only once a real drag starts, so plain clicks still reach nodes and edges.
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    setTransform((t) => ({ ...t, x: d.tx + dx, y: d.ty + dy }));
  }, []);
  const onPointerUp = useCallback((): boolean => {
    const moved = drag.current?.moved ?? false;
    drag.current = null;
    setPanning(false);
    return moved;
  }, []);
  const onWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const rect = (e.currentTarget as Element).getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    setTransform((t) => {
      const k = clamp(t.k * Math.exp(-e.deltaY * 0.0015), MIN_ZOOM, MAX_ZOOM);
      const ratio = k / t.k;
      return { k, x: px - (px - t.x) * ratio, y: py - (py - t.y) * ratio };
    });
  }, []);
  const fit = useCallback(
    (
      content: { width: number; height: number },
      viewport: { width: number; height: number },
      padding = 24,
    ) => {
      if (content.width <= 0 || content.height <= 0 || viewport.width <= 0) return;
      const k = clamp(
        Math.min(
          (viewport.width - padding * 2) / content.width,
          (viewport.height - padding * 2) / content.height,
        ),
        MIN_ZOOM,
        1.5,
      );
      setTransform({
        k,
        x: (viewport.width - content.width * k) / 2,
        y: (viewport.height - content.height * k) / 2,
      });
    },
    [],
  );
  const zoomTo = useCallback((k: number, viewport: { width: number; height: number }) => {
    setTransform((t) => {
      const next = clamp(k, MIN_ZOOM, MAX_ZOOM);
      const cx = viewport.width / 2;
      const cy = viewport.height / 2;
      const ratio = next / t.k;
      return { k: next, x: cx - (cx - t.x) * ratio, y: cy - (cy - t.y) * ratio };
    });
  }, []);
  return { transform, panning, onPointerDown, onPointerMove, onPointerUp, onWheel, fit, zoomTo };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
