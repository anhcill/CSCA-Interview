import type { Metadata } from "next";
import type { ReactNode } from "react";
import { privateRouteMetadata } from "@/lib/seo";

export const metadata: Metadata = privateRouteMetadata("Đăng nhập | Moly Interview");

export default function AuthLayout({ children }: { children: ReactNode }) {
  return children;
}
