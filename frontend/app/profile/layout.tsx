import type { Metadata } from "next";
import type { ReactNode } from "react";
import { privateRouteMetadata } from "@/lib/seo";

export const metadata: Metadata = privateRouteMetadata("Hồ sơ | Moly Interview");

export default function ProfileLayout({ children }: { children: ReactNode }) {
  return children;
}
