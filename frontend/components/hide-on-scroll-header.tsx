"use client";

import type { ReactNode } from "react";
import { useHideOnScroll } from "@/lib/hooks/use-hide-on-scroll";

type HideOnScrollHeaderProps = {
  children: ReactNode;
  className: string;
  hiddenClassName?: string;
  visibleClassName?: string;
};

export function HideOnScrollHeader({
  children,
  className,
  hiddenClassName = "-translate-y-full",
  visibleClassName = "translate-y-0"
}: HideOnScrollHeaderProps) {
  const hiddenOnScroll = useHideOnScroll();

  return (
    <div className={`${className} transition-transform duration-200 ${hiddenOnScroll ? hiddenClassName : visibleClassName}`}>
      {children}
    </div>
  );
}
