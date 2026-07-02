"use client";

import { ShieldCheck, User } from "lucide-react";
import Link from "next/link";

type RoleSwitcherProps = {
  active: "admin" | "user";
  className?: string;
  variant?: "dark" | "light";
};

const items = [
  { href: "/dashboard", icon: User, key: "user", label: "User" },
  { href: "/admin", icon: ShieldCheck, key: "admin", label: "Admin" }
] as const;

export function RoleSwitcher({ active, className = "", variant = "light" }: RoleSwitcherProps) {
  const dark = variant === "dark";

  return (
    <nav
      aria-label="Chuyen doi User Admin"
      className={`inline-flex items-center rounded-lg border p-1 ${
        dark ? "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900" : "border-border bg-muted/50"
      } ${className}`}
    >
      {items.map((item) => {
        const Icon = item.icon;
        const selected = active === item.key;

        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={selected ? "page" : undefined}
            className={`focus-ring inline-flex min-h-9 flex-1 items-center justify-center gap-2 rounded-md px-3 text-sm font-black transition ${
              selected
                ? dark
                  ? "bg-red-600 text-white shadow-lg shadow-red-950/30"
                  : "bg-background text-primary shadow-sm"
                : dark
                  ? "text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                  : "text-muted-foreground hover:bg-background hover:text-foreground"
            }`}
          >
            <Icon size={16} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
