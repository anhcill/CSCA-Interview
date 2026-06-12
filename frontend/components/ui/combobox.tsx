"use client";

import { Check, ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";
import { twMerge } from "tailwind-merge";

export type ComboboxOption = {
  label: string;
  value: string;
};

type ComboboxProps = {
  label: string;
  onChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  value: string;
};

export function Combobox({ label, onChange, options, placeholder = "Chọn", value }: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = options.find((option) => option.value === value);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return options;
    return options.filter((option) => option.label.toLowerCase().includes(normalized));
  }, [options, query]);

  return (
    <div className="relative">
      <label className="type-caption text-slate-500">{label}</label>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="focus-ring mt-2 flex min-h-11 w-full items-center justify-between rounded-lg border border-border bg-background px-3 text-sm font-bold"
      >
        <span className={selected ? "" : "text-slate-400"}>{selected?.label ?? placeholder}</span>
        <ChevronDown size={16} />
      </button>
      {open ? (
        <div className="absolute z-50 mt-2 w-full rounded-lg border border-border bg-background p-2 shadow-xl">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-10 w-full rounded-lg border border-border px-3 text-sm"
            placeholder="Tìm..."
            aria-label={`Tìm ${label}`}
          />
          <div role="listbox" className="mt-2 max-h-56 overflow-y-auto">
            {filtered.length ? filtered.map((option) => (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={option.value === value}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                  setQuery("");
                }}
                className={twMerge(
                  "flex min-h-10 w-full items-center justify-between rounded-lg px-3 text-left text-sm font-bold hover:bg-muted",
                  option.value === value && "bg-blue-50 text-primary dark:bg-blue-950"
                )}
              >
                {option.label}
                {option.value === value ? <Check size={16} /> : null}
              </button>
            )) : <p className="px-3 py-2 text-sm font-semibold text-slate-500">Không có kết quả.</p>}
          </div>
        </div>
      ) : null}
    </div>
  );
}
