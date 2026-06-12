"use client";

import { CheckCircle, Info, X, XCircle } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type ToastTone = "error" | "info" | "success";
type ToastInput = {
  description?: string;
  title: string;
  tone?: ToastTone;
};
type ToastItem = ToastInput & {
  id: string;
  tone: ToastTone;
};

const ToastContext = createContext<{ push: (toast: ToastInput) => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((toast: ToastInput) => {
    const id = crypto.randomUUID();
    const item: ToastItem = { ...toast, id, tone: toast.tone ?? "info" };
    setItems((current) => [item, ...current].slice(0, 4));
    window.setTimeout(() => {
      setItems((current) => current.filter((entry) => entry.id !== id));
    }, 4400);
  }, []);

  useEffect(() => {
    function handleToast(event: Event) {
      const custom = event as CustomEvent<ToastInput>;
      push(custom.detail);
    }

    window.addEventListener("app-toast", handleToast);
    return () => window.removeEventListener("app-toast", handleToast);
  }, [push]);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed right-4 top-4 z-[90] flex w-[min(420px,calc(100vw-2rem))] flex-col gap-3" aria-live="polite" aria-atomic="true">
        {items.map((item) => (
          <ToastCard key={item.id} item={item} onClose={() => setItems((current) => current.filter((entry) => entry.id !== item.id))} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}

export function showToast(toast: ToastInput) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("app-toast", { detail: toast }));
}

function ToastCard({ item, onClose }: { item: ToastItem; onClose: () => void }) {
  const tones = {
    error: "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-100",
    info: "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-100",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"
  };
  const Icon = item.tone === "success" ? CheckCircle : item.tone === "error" ? XCircle : Info;

  return (
    <section className={`animate-[toast-slide_180ms_ease-out] rounded-lg border p-4 shadow-xl ${tones[item.tone]}`}>
      <div className="flex gap-3">
        <Icon size={19} className="mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-black">{item.title}</h2>
          {item.description ? <p className="mt-1 text-sm font-semibold opacity-80">{item.description}</p> : null}
        </div>
        <button type="button" onClick={onClose} className="focus-ring flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" aria-label="Đóng thông báo">
          <X size={16} />
        </button>
      </div>
    </section>
  );
}
