"use client";

type DatePickerProps = {
  label: string;
  max?: string;
  min?: string;
  onChange: (value: string) => void;
  value: string;
};

export function DatePicker({ label, max, min, onChange, value }: DatePickerProps) {
  return (
    <label className="block">
      <span className="type-caption text-slate-500">{label}</span>
      <input
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(event) => onChange(event.target.value)}
        className="focus-ring mt-2 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm font-bold"
      />
    </label>
  );
}
