import type { ReactNode } from "react";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <div className="admin-theme min-h-screen bg-[#f5f7fb] text-slate-950 dark:bg-slate-950 dark:text-slate-100">{children}</div>;
}
