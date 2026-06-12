"use client";

import { BookOpen } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({
  action,
  description,
  title
}: {
  action?: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <section className="flex min-h-56 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/45 p-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-primary dark:bg-blue-950">
        <BookOpen size={22} />
      </div>
      <h2 className="type-section mt-4">{title}</h2>
      <p className="type-body mt-2 max-w-md text-slate-500">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </section>
  );
}
