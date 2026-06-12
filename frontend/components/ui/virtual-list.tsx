"use client";

import { UIEvent, useMemo, useState, type ReactNode } from "react";

type VirtualListProps<T> = {
  className?: string;
  estimateSize: number;
  items: T[];
  overscan?: number;
  renderItem: (item: T, index: number) => ReactNode;
  viewportHeight: number;
};

export function VirtualList<T>({
  className = "",
  estimateSize,
  items,
  overscan = 4,
  renderItem,
  viewportHeight
}: VirtualListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const totalHeight = items.length * estimateSize;
  const range = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / estimateSize) - overscan);
    const visibleCount = Math.ceil(viewportHeight / estimateSize) + overscan * 2;
    const end = Math.min(items.length, start + visibleCount);
    return { end, start };
  }, [estimateSize, items.length, overscan, scrollTop, viewportHeight]);

  function handleScroll(event: UIEvent<HTMLDivElement>) {
    setScrollTop(event.currentTarget.scrollTop);
  }

  return (
    <div className={`overflow-y-auto ${className}`} onScroll={handleScroll} style={{ height: viewportHeight }}>
      <div className="relative" style={{ height: totalHeight }}>
        {items.slice(range.start, range.end).map((item, offset) => {
          const index = range.start + offset;
          return (
            <div key={index} className="absolute left-0 right-0 px-1" style={{ top: index * estimateSize }}>
              {renderItem(item, index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
