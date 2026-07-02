"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { resolvedTheme, setTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";
  const themeTitle = mounted ? theme ?? "system" : "system";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="focus-ring inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
      aria-label={`Chuyển giao diện ${isDark ? "sang sáng" : "sang tối"}`}
      title={`Theme: ${themeTitle}`}
    >
      {isDark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
