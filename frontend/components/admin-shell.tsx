"use client";

import { Award, BarChart3, BookOpen, Bot, ChevronLeft, ChevronRight, ClipboardList, GraduationCap, Home, Link as LinkIcon, Menu, School, Settings, ShieldCheck, User, X } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { AccessibilityToolbar } from "@/components/accessibility-toolbar";
import { HideOnScrollHeader } from "@/components/hide-on-scroll-header";
import { LogoutButton } from "@/components/logout-button";
import { RoleSwitcher } from "@/components/role-switcher";
import type { AuthUser } from "@/lib/auth-client";
import type { Locale } from "@/lib/i18n";

const adminNavItems = [
  { href: "/admin", icon: Home, label: "Tổng quan" },
  { href: "/admin/analytics", icon: BarChart3, label: "Analytics" },
  { href: "/admin/users", icon: User, label: "Học viên" },
  { href: "/admin/questions", icon: BookOpen, label: "Câu hỏi" },
  { href: "/admin/tags", icon: ClipboardList, label: "Tags" },
  { href: "/admin/schools", icon: School, label: "Trường" },
  { href: "/admin/majors", icon: GraduationCap, label: "Ngành" },
  { href: "/admin/scholarships", icon: Award, label: "Học bổng" },
  { href: "/admin/mappings", icon: LinkIcon, label: "Mappings" },
  { href: "/admin/ai-models", icon: Bot, label: "Model AI" },
  { href: "/admin/audit", icon: ClipboardList, label: "Audit logs" },
  { href: "/admin/settings", icon: Settings, label: "Cài đặt" }
] as const;
const adminRoles: AuthUser["role"][] = ["ADMIN", "SUPER_ADMIN"];

type AdminShellProps = {
  activePathname: string;
  children: ReactNode;
  currentUser: AuthUser | null;
  locale: Locale;
};

export function AdminShell({ activePathname, children, currentUser }: AdminShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const activeItem = adminNavItems.find((item) => activePathname === item.href || (item.href !== "/admin" && activePathname.startsWith(`${item.href}/`))) ?? adminNavItems[0];
  const canSwitchRole = currentUser ? adminRoles.includes(currentUser.role) : false;

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-950 dark:bg-slate-950 dark:text-slate-100">
      <aside className={`fixed left-0 top-0 z-40 hidden h-screen border-r border-slate-200 bg-white lg:block dark:border-slate-800 dark:bg-slate-950 ${collapsed ? "w-20" : "w-72"}`}>
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-4 dark:border-slate-800">
          <Link href="/admin" className="flex items-center gap-3 text-sm font-black text-slate-950 dark:text-white" aria-label="Admin portal">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-600 text-white">
              <ShieldCheck size={20} />
            </span>
            {collapsed ? null : (
              <span>
                <span className="block">Admin Portal</span>
                <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400">AI Phỏng Vấn</span>
              </span>
            )}
          </Link>
          <button type="button" onClick={() => setCollapsed((value) => !value)} className="focus-ring flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900" aria-label={collapsed ? "Mở rộng sidebar" : "Thu gọn sidebar"}>
            {collapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
          </button>
        </div>
        <nav className="space-y-1 p-3" aria-label="Điều hướng quản trị">
          {adminNavItems.map((item) => {
            const active = activePathname === item.href || (item.href !== "/admin" && activePathname.startsWith(`${item.href}/`));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                aria-current={active ? "page" : undefined}
                className={`focus-ring flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-black transition ${active ? "bg-red-600 text-white shadow-lg shadow-red-950/30" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white"}`}
              >
                <Icon size={18} />
                {collapsed ? null : <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>
      </aside>

      <HideOnScrollHeader className={`sticky top-0 z-30 border-b border-slate-200 bg-white/92 backdrop-blur dark:border-slate-800 dark:bg-slate-950/92 ${collapsed ? "lg:ml-20" : "lg:ml-72"}`}>
        <div className="flex min-h-16 items-center justify-between gap-4 px-4 lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" onClick={() => setMobileOpen(true)} className="focus-ring flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 lg:hidden dark:border-slate-700 dark:text-slate-200" aria-label="Mở menu quản trị">
              <Menu size={19} />
            </button>
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-wide text-red-600 dark:text-red-300">Khu vực quản trị</p>
              <h1 className="truncate text-base font-black text-slate-950 dark:text-white sm:text-lg">{activeItem.label}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canSwitchRole ? <RoleSwitcher active="admin" variant="dark" className="hidden sm:inline-flex" /> : null}
            <div className="hidden text-right md:block">
              <p className="text-sm font-bold text-slate-950 dark:text-white">{currentUser?.fullName ?? "Admin"}</p>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{currentUser?.role ?? "ADMIN"}</p>
            </div>
            <AccessibilityToolbar />
            <LogoutButton />
          </div>
        </div>
      </HideOnScrollHeader>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 bg-slate-950/30 backdrop-blur-sm lg:hidden dark:bg-slate-950/80">
          <div className="min-h-screen w-full max-w-sm border-r border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-center justify-between">
              <Link href="/admin" onClick={() => setMobileOpen(false)} className="flex items-center gap-2 text-sm font-black text-slate-950 dark:text-white">
                <ShieldCheck size={20} />Admin Portal
              </Link>
              <button type="button" onClick={() => setMobileOpen(false)} className="focus-ring flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-200" aria-label="Đóng menu">
                <X size={18} />
              </button>
            </div>
            {canSwitchRole ? <RoleSwitcher active="admin" variant="dark" className="mt-4 flex w-full" /> : null}
            <nav className="mt-5 space-y-1" aria-label="Điều hướng quản trị mobile">
              {adminNavItems.map((item) => {
                const active = activePathname === item.href || (item.href !== "/admin" && activePathname.startsWith(`${item.href}/`));
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} className={`focus-ring flex min-h-12 items-center gap-3 rounded-lg px-3 text-sm font-black ${active ? "bg-red-600 text-white" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900"}`}>
                    <Icon size={18} />{item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      ) : null}

      <div className={`min-h-[calc(100vh-4rem)] ${collapsed ? "lg:pl-20" : "lg:pl-72"}`}>
        <div className="animate-[fade-in_180ms_ease-out]">
          {children}
        </div>
      </div>
    </div>
  );
}
