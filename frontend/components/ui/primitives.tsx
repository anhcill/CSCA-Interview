import { Loader2 } from "lucide-react";
import Image from "next/image";
import { twMerge } from "tailwind-merge";

export function Button({
  children,
  className,
  isLoading,
  variant = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  isLoading?: boolean;
  variant?: "danger" | "ghost" | "primary" | "secondary";
}) {
  const variants = {
    primary: "bg-primary text-white hover:bg-blue-700",
    secondary: "bg-amber-500 text-slate-950 hover:bg-amber-400",
    ghost: "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800",
    danger: "bg-red-500 text-white hover:bg-red-600"
  };

  return (
    <button
      {...props}
      className={twMerge(
        "focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-black shadow-sm transition disabled:cursor-not-allowed disabled:opacity-55",
        variants[variant],
        className
      )}
    >
      {isLoading ? <Loader2 size={16} className="animate-spin" /> : null}
      {children}
    </button>
  );
}

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={twMerge("rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950", className)}>
      {children}
    </section>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={twMerge("focus-ring min-h-11 w-full rounded-lg border border-border bg-background px-3 text-sm font-bold", props.className)}
    />
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={twMerge("focus-ring min-h-28 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-bold", props.className)}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={twMerge("focus-ring min-h-11 w-full rounded-lg border border-border bg-background px-3 text-sm font-bold", props.className)}
    />
  );
}

export function Avatar({ alt, fallback, src }: { alt: string; fallback: string; src?: string | null }) {
  return (
    <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-blue-50 text-sm font-black text-primary dark:bg-blue-950">
      {src ? <Image src={src} alt={alt} width={40} height={40} className="h-full w-full object-cover" /> : fallback.slice(0, 2).toUpperCase()}
    </span>
  );
}

export function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "danger" | "neutral" | "primary" | "success" | "warning" }) {
  const tones = {
    primary: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200",
    warning: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200",
    success: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
    danger: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200",
    neutral: "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
  };

  return <span className={twMerge("inline-flex rounded-full border px-2.5 py-1 text-xs font-black", tones[tone])}>{children}</span>;
}

export function Progress({ value, className }: { value: number; className?: string }) {
  return (
    <div className={twMerge("h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800", className)}>
      <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={twMerge("skeleton rounded-lg", className)} />;
}
