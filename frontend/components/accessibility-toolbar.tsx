"use client";

import { useEffect, useState } from "react";
import { getStoredLocale, localeChangedEvent, messages, setStoredLocale, type Locale } from "@/lib/i18n";
import { ThemeToggle } from "./theme-toggle";

const fontKey = "ai_phongvan_font_scale";

export function AccessibilityToolbar({ variant = "inline" }: { variant?: "floating" | "inline" }) {
  const [locale, setLocale] = useState<Locale>("vi");
  const [fontScale, setFontScale] = useState(100);

  useEffect(() => {
    const initialLocale = getStoredLocale();
    const initialScale = Number(localStorage.getItem(fontKey) ?? "100");
    setLocale(initialLocale);
    setFontScale(initialScale);
    document.documentElement.lang = initialLocale;
    document.documentElement.style.setProperty("--font-scale", `${initialScale}%`);

    function handleLocaleChanged(event: Event) {
      const nextLocale = (event as CustomEvent<{ locale: Locale }>).detail?.locale;
      if (nextLocale) setLocale(nextLocale);
    }

    window.addEventListener(localeChangedEvent, handleLocaleChanged);
    return () => window.removeEventListener(localeChangedEvent, handleLocaleChanged);
  }, []);

  function changeLocale(nextLocale: Locale) {
    setLocale(nextLocale);
    setStoredLocale(nextLocale, { persist: true });
  }

  function changeFont(nextScale: number) {
    const clamped = Math.min(120, Math.max(90, nextScale));
    setFontScale(clamped);
    localStorage.setItem(fontKey, String(clamped));
    document.documentElement.style.setProperty("--font-scale", `${clamped}%`);
  }

  const t = messages[locale];
  const containerClass = variant === "floating"
    ? "fixed bottom-20 right-4 z-50 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white/95 p-2 text-xs font-black shadow-xl dark:border-slate-700 dark:bg-slate-900/95 lg:bottom-4"
    : "flex items-center gap-1 rounded-xl border border-border bg-background/80 p-1 text-xs font-black shadow-sm";
  const controlClass = variant === "floating"
    ? "min-h-11 rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900"
    : "min-h-10 rounded-lg border border-border bg-background px-3";
  const buttonClass = variant === "floating"
    ? "min-h-11 min-w-11 rounded-xl border border-slate-200 dark:border-slate-700"
    : "min-h-10 min-w-10 rounded-lg border border-border px-2";

  return (
    <div className={containerClass} role="region" aria-label={t.accessibility}>
      <ThemeToggle />
      <label className="sr-only" htmlFor="accessibility-locale-switcher">{t.language}</label>
      <select id="accessibility-locale-switcher" value={locale} onChange={(event) => changeLocale(event.target.value as Locale)} className={controlClass} aria-label={t.language}>
        <option value="vi">{t.vietnamese}</option>
        <option value="zh">{t.zh}</option>
        <option value="en">{t.english}</option>
      </select>
      <button type="button" onClick={() => changeFont(fontScale - 10)} className={buttonClass} aria-label={`${t.fontSize} A-`}>A-</button>
      <button type="button" onClick={() => changeFont(fontScale + 10)} className={buttonClass} aria-label={`${t.fontSize} A+`}>A+</button>
    </div>
  );
}
