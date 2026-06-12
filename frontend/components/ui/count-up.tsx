"use client";

import { useEffect, useRef, useState } from "react";

type CountUpProps = {
  decimals?: number;
  durationMs?: number;
  suffix?: string;
  value: number;
};

export function CountUp({ decimals = 0, durationMs = 700, suffix = "", value }: CountUpProps) {
  const [display, setDisplay] = useState(value);
  const displayRef = useRef(value);

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      setDisplay(value);
      displayRef.current = value;
      return;
    }

    const startValue = displayRef.current;
    const startedAt = performance.now();
    let frame = 0;

    function tick(now: number) {
      const progress = Math.min(1, (now - startedAt) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      const nextValue = startValue + (value - startValue) * eased;
      displayRef.current = nextValue;
      setDisplay(nextValue);
      if (progress < 1) frame = requestAnimationFrame(tick);
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [decimals, durationMs, value]);

  return <span>{display.toFixed(decimals)}{suffix}</span>;
}
