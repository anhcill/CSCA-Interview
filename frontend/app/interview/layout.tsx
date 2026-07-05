import type { Metadata } from "next";
import type { ReactNode } from "react";
import { privateRouteMetadata } from "@/lib/seo";

export const metadata: Metadata = privateRouteMetadata("Phỏng vấn | Moly Interview");

export default function InterviewLayout({ children }: { children: ReactNode }) {
  return children;
}
