"use client";

import { Eye, EyeOff, Lock } from "lucide-react";
import { useState, type ChangeEvent } from "react";

type PasswordFieldProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoComplete?: string;
  ariaLabel?: string;
  compact?: boolean;
  darkMode?: boolean;
};

export function PasswordField({
  value,
  onChange,
  placeholder,
  autoComplete,
  ariaLabel,
  compact = false,
  darkMode = false,
}: PasswordFieldProps) {
  const [isVisible, setIsVisible] = useState(false);
  const Icon = isVisible ? EyeOff : Eye;
  const fieldHeight = compact ? "h-11" : "h-12";

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onChange(event.target.value);
  }

  if (darkMode) {
    return (
      <label className="block">
        <span
          className={`flex ${fieldHeight} items-center gap-3 rounded-xl px-4 transition-all duration-200 focus-within:ring-2 focus-within:ring-red-500/40`}
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
        >
          <Lock size={16} className="shrink-0 text-red-400" />
          <input
            value={value}
            onChange={handleChange}
            className="min-w-0 flex-1 appearance-none border-0 bg-transparent text-sm font-semibold text-white outline-none placeholder:text-white/30"
            type={isVisible ? "text" : "password"}
            placeholder={placeholder}
            aria-label={ariaLabel ?? placeholder}
            autoComplete={autoComplete}
            required
          />
          <button
            type="button"
            onClick={() => setIsVisible((c) => !c)}
            className="-mr-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-white/30 transition hover:text-red-400"
            aria-label={isVisible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
            aria-pressed={isVisible}
          >
            <Icon size={16} />
          </button>
        </span>
      </label>
    );
  }

  return (
    <label className="block">
      <span className={`flex ${fieldHeight} items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 transition focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-100`}>
        <Lock size={18} className="shrink-0 text-blue-600" />
        <input
          value={value}
          onChange={handleChange}
          className="min-w-0 flex-1 appearance-none border-0 bg-transparent text-[15px] font-medium text-slate-800 outline-none placeholder:text-slate-400"
          type={isVisible ? "text" : "password"}
          placeholder={placeholder}
          aria-label={ariaLabel ?? placeholder}
          autoComplete={autoComplete}
          required
        />
        <button
          type="button"
          onClick={() => setIsVisible((c) => !c)}
          className="-mr-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-50 hover:text-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          aria-label={isVisible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
          aria-pressed={isVisible}
        >
          <Icon size={17} />
        </button>
      </span>
    </label>
  );
}
