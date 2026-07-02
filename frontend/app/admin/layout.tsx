import type { ReactNode } from "react";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <div className="admin-theme min-h-screen bg-slate-950">{children}</div>;
}
