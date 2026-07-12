"use client";

import { Check } from "lucide-react";

interface ProgressTrackerProps {
  currentStep: number;
  furthestStep: number;
  onStepSelect: (step: number) => void;
  stepLabels: string[];
}

export function ProgressTracker({ currentStep, furthestStep, onStepSelect, stepLabels }: ProgressTrackerProps) {
  return (
    <div className="mx-auto w-full max-w-4xl">
      <ol className="grid grid-cols-4 gap-2" aria-label="Tiến trình tạo phòng phỏng vấn">
        {stepLabels.map((label, index) => {
          const isActive = index === currentStep;
          const isCompleted = index < furthestStep && !isActive;
          const isAvailable = index <= furthestStep;
          return (
            <li key={label} className="min-w-0">
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => onStepSelect(index)}
                  disabled={!isAvailable}
                  aria-label={`${isActive ? "Bước hiện tại" : "Mở bước"}: ${label}`}
                  className={`focus-ring flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black transition ${
                    isCompleted
                      ? "bg-[hsl(var(--success))] text-white"
                      : isActive
                        ? "bg-primary text-primary-foreground ring-4 ring-primary/15"
                        : isAvailable
                          ? "bg-muted text-foreground hover:bg-primary/15 hover:text-primary"
                          : "cursor-not-allowed bg-muted text-muted-foreground opacity-55"
                  }`}
                >
                  {isCompleted ? <Check size={16} strokeWidth={3} /> : index + 1}
                </button>
                {index < stepLabels.length - 1 ? (
                  <span className={`mx-2 hidden h-0.5 flex-1 rounded-full sm:block ${isCompleted ? "bg-[hsl(var(--success))]" : "bg-border"}`} />
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => onStepSelect(index)}
                disabled={!isAvailable}
                className={`focus-ring mt-2 max-w-full truncate rounded text-left text-xs font-black ${isActive ? "text-primary" : isAvailable ? "text-muted-foreground hover:text-primary" : "cursor-not-allowed text-muted-foreground opacity-55"}`}
              >
                {label}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
