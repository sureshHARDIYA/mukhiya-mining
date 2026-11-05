import { useLayoutEffect, useState } from "react";

/** Current width of a DOM element, kept in sync with a ResizeObserver. */
export function useElementWidth(ref: React.RefObject<HTMLElement | null>, fallback = 600): number {
  const [width, setWidth] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth || fallback);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, fallback]);
  return width;
}
