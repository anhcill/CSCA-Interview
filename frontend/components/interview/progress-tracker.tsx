"use client";

import { Check } from "lucide-react";

interface ProgressTrackerProps {
  currentStep: number;
  stepLabels: string[];
}

export function ProgressTracker({ currentStep, stepLabels }: ProgressTrackerProps) {
  return (
    <div className="mx-auto w-full max-w-4xl">
      <ol className="grid grid-cols-4 gap-2" aria-label="Tiến trình tạo phòng phỏng vấn">
        {stepLabels.map((label, index) => {
          const isCompleted = index < currentStep;
          const isActive = index === currentStep;
          return (
            <li key={label} className="min-w-0">
              <div className="flex items-center">
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black transition ${
                    isCompleted
                      ? "bg-[hsl(var(--success))] text-white"
                      : isActive
                        ? "bg-primary text-primary-foreground ring-4 ring-primary/15"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {isCompleted ? <Check size={16} strokeWidth={3} /> : index + 1}
                </span>
                {index < stepLabels.length - 1 ? (
                  <span className={`mx-2 hidden h-0.5 flex-1 rounded-full sm:block ${isCompleted ? "bg-[hsl(var(--success))]" : "bg-border"}`} />
                ) : null}
              </div>
              <p className={`mt-2 truncate text-xs font-black ${isActive ? "text-primary" : "text-muted-foreground"}`}>{label}</p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
