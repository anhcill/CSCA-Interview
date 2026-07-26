"use client";

import {
  formatBachelorGpa,
  normalizeLegacyMasterGpa,
  parseBachelorGpa
} from "./gpa-value";

type DegreeLevel = "BACHELOR" | "MASTER";

type GpaFieldsProps = {
  degreeLevel: DegreeLevel;
  onChange: (value: string) => void;
  value: string;
};

export function GpaFields({ degreeLevel, onChange, value }: GpaFieldsProps) {
  if (degreeLevel === "MASTER") {
    return (
      <GpaNumberField
        label="GPA đại học (thang 4)"
        max={4}
        onChange={onChange}
        placeholder="Ví dụ: 3.60"
        value={normalizeLegacyMasterGpa(value)}
      />
    );
  }

  const grades = parseBachelorGpa(value);

  function updateGrade(key: keyof typeof grades, nextValue: string) {
    const next = { ...grades, [key]: nextValue };
    onChange(formatBachelorGpa(next));
  }

  return (
    <div className="min-w-0 md:col-span-2">
      <p className="mb-2 text-sm font-black text-foreground">GPA THPT (thang 10)</p>
      <div className="grid min-w-0 gap-3 sm:grid-cols-3">
        <GpaNumberField label="Lớp 10" max={10} onChange={(next) => updateGrade("grade10", next)} value={grades.grade10} />
        <GpaNumberField label="Lớp 11" max={10} onChange={(next) => updateGrade("grade11", next)} value={grades.grade11} />
        <GpaNumberField label="Lớp 12" max={10} onChange={(next) => updateGrade("grade12", next)} value={grades.grade12} />
      </div>
    </div>
  );
}

function GpaNumberField({
  label,
  max,
  onChange,
  placeholder = "0.00",
  value
}: {
  label: string;
  max: number;
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  return (
    <label className="grid min-w-0 gap-2 text-sm font-black text-foreground">
      <span>{label}</span>
      <input
        className="focus-ring min-h-11 min-w-0 w-full rounded-lg border border-border bg-background px-3 text-sm font-bold text-foreground"
        inputMode="decimal"
        maxLength={5}
        onChange={(event) => {
          const nextValue = event.target.value.replace(",", ".");
          if (!/^\d{0,2}(?:\.\d{0,2})?$/.test(nextValue)) return;
          if (nextValue && Number(nextValue) > max) return;
          onChange(nextValue);
        }}
        placeholder={placeholder}
        type="text"
        value={value}
      />
    </label>
  );
}
