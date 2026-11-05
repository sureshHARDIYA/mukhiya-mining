import { type CSSProperties, type ReactNode, useCallback, useRef, useState } from "react";

export interface VirtualListProps<T> {
  items: readonly T[];
  rowHeight: number;
  render: (item: T, index: number) => ReactNode;
  className?: string | undefined;
  style?: CSSProperties | undefined;
  overscan?: number;
}

/** Fixed-height windowed list. Handles a million rows without a million DOM nodes. */
export function VirtualList<T>({
  items,
  rowHeight,
  render,
  className,
  style,
  overscan = 6,
}: VirtualListProps<T>) {
  const ref = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [height, setHeight] = useState(600);
  const onScroll = useCallback(() => {
    const el = ref.current;
    if (el) {
      setScrollTop(el.scrollTop);
      if (el.clientHeight !== height) setHeight(el.clientHeight);
    }
  }, [height]);
  const measure = useCallback((el: HTMLDivElement | null) => {
    (ref as { current: HTMLDivElement | null }).current = el;
    if (el) setHeight(el.clientHeight || 600);
  }, []);
  const first = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const last = Math.min(items.length, Math.ceil((scrollTop + height) / rowHeight) + overscan);
  const rows = [];
  for (let i = first; i < last; i++) {
    rows.push(
      <div key={i} className="pm-vlist-row" style={{ top: i * rowHeight, height: rowHeight }}>
        {render(items[i] as T, i)}
      </div>,
    );
  }
  return (
    <div
      ref={measure}
      className={`pm-vlist${className ? ` ${className}` : ""}`}
      style={style}
      onScroll={onScroll}
    >
      <div className="pm-vlist-inner" style={{ height: items.length * rowHeight }}>
        {rows}
      </div>
    </div>
  );
}
