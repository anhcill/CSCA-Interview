"use client";

import dynamic from "next/dynamic";

const DashboardClient = dynamic(() => import("./dashboard-client"), {
  loading: () => <DashboardLoading />,
  ssr: false
});

export function DashboardClientEntry() {
  return <DashboardClient />;
}

function DashboardLoading() {
  return (
    <main id="main-content" className="page-band min-h-screen text-foreground" tabIndex={-1} aria-label="Dashboard loading">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
        <div className="mb-6 h-16 max-w-xl rounded-lg bg-slate-200/70 dark:bg-slate-800" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-28 rounded-lg border border-border bg-background shadow-sm">
              <div className="m-4 h-4 w-20 rounded bg-slate-200 dark:bg-slate-800" />
              <div className="m-4 h-8 w-28 rounded bg-slate-200 dark:bg-slate-800" />
            </div>
          ))}
        </div>
        <div className="mt-5 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="h-80 rounded-lg border border-border bg-background shadow-sm" />
          <div className="h-80 rounded-lg border border-border bg-background shadow-sm" />
        </div>
      </div>
    </main>
  );
}
