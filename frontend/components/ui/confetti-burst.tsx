"use client";

import { useMemo } from "react";

export function ConfettiBurst({ active }: { active: boolean }) {
  const pieces = useMemo(() => Array.from({ length: 34 }, (_, index) => ({
    color: ["#2563EB", "#F59E0B", "#10B981", "#EF4444"][index % 4],
    delay: `${(index % 8) * 55}ms`,
    left: `${8 + ((index * 17) % 84)}%`,
    rotate: `${(index * 31) % 180}deg`
  })), []);

  if (!active) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[75] overflow-hidden" aria-hidden="true">
      {pieces.map((piece, index) => (
        <span
          key={index}
          className="absolute top-[-24px] h-3 w-2 animate-[confetti-fall_1400ms_ease-out_forwards] rounded-sm"
          style={{
            animationDelay: piece.delay,
            background: piece.color,
            left: piece.left,
            transform: `rotate(${piece.rotate})`
          }}
        />
      ))}
    </div>
  );
}
