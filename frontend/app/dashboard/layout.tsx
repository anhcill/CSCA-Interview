import type { Metadata } from "next";
import type { ReactNode } from "react";
import { privateRouteMetadata } from "@/lib/seo";

export const metadata: Metadata = privateRouteMetadata("Dashboard | Moly Interview");

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return children;
}
