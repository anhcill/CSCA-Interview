import type { Metadata } from "next";
import type { ReactNode } from "react";
import { privateRouteMetadata } from "@/lib/seo";

export const metadata: Metadata = privateRouteMetadata("Admin | Moly Interview");

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <div className="admin-theme min-h-screen bg-[#f5f7fb] text-slate-950 dark:bg-slate-950 dark:text-slate-100">{children}</div>;
}
