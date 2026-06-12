"use client";

import { AlertCircle, Lock, Loader2 } from "lucide-react";
import type { ReactNode } from "react";

type PageStateProps = {
  action?: ReactNode;
  description: string;
  title: string;
};

export function PageLoadingState({ description = "Đang tải dữ liệu." }: { description?: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <section className="w-full max-w-md rounded-lg border border-border bg-card p-6 text-center shadow-sm" aria-live="polite">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" aria-hidden="true" />
        <h1 className="type-section mt-4">Đang xử lý</h1>
        <p className="type-body mt-2 text-slate-500 dark:text-slate-300">{description}</p>
      </section>
    </main>
  );
}

export function PageErrorState({ action, description, title }: PageStateProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <section className="w-full max-w-lg rounded-lg border border-red-200 bg-red-50 p-6 text-center text-red-800 shadow-sm dark:border-red-900 dark:bg-red-950 dark:text-red-100">
        <AlertCircle className="mx-auto h-9 w-9" aria-hidden="true" />
        <h1 className="type-section mt-4">{title}</h1>
        <p className="type-body mt-2 opacity-80">{description}</p>
        {action ? <div className="mt-5">{action}</div> : null}
      </section>
    </main>
  );
}

export function PageAccessDeniedState({ action, description, title }: PageStateProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <section className="w-full max-w-lg rounded-lg border border-amber-200 bg-amber-50 p-6 text-center text-amber-900 shadow-sm dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
        <Lock className="mx-auto h-9 w-9" aria-hidden="true" />
        <h1 className="type-section mt-4">{title}</h1>
        <p className="type-body mt-2 opacity-80">{description}</p>
        {action ? <div className="mt-5">{action}</div> : null}
      </section>
    </main>
  );
}
