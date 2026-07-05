import type { Metadata } from "next";
import type { ReactNode } from "react";
import { privateRouteMetadata } from "@/lib/seo";

export const metadata: Metadata = privateRouteMetadata("403 | Moly Interview");

export default function ForbiddenLayout({ children }: { children: ReactNode }) {
  return children;
}
