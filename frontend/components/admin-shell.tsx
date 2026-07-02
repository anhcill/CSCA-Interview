"use client";

import { Award, BarChart3, BookOpen, ChevronLeft, ChevronRight, ClipboardList, GraduationCap, Home, Link as LinkIcon, Menu, School, Settings, ShieldCheck, User, X } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { AccessibilityToolbar } from "@/components/accessibility-toolbar";
import { LogoutButton } from "@/components/logout-button";
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
  { href: "/admin/audit", icon: ClipboardList, label: "Audit logs" },
  { href: "/admin/settings", icon: Settings, label: "Cài đặt" }
] as const;

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

  return (
    <div className="dark min-h-screen bg-slate-950 text-slate-100">
      <aside className={`fixed left-0 top-0 z-40 hidden h-screen border-r border-slate-800 bg-slate-950 lg:block ${collapsed ? "w-20" : "w-72"}`}>
        <div className="flex h-16 items-center justify-between border-b border-slate-800 px-4">
          <Link href="/admin" className="flex items-center gap-3 text-sm font-black text-white" aria-label="Admin portal">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-600 text-white">
              <ShieldCheck size={20} />
            </span>
            {collapsed ? null : (
              <span>
                <span className="block">Admin Portal</span>
                <span className="block text-xs font-semibold text-slate-400">AI Phỏng Vấn</span>
              </span>
            )}
          </Link>
          <button type="button" onClick={() => setCollapsed((value) => !value)} className="focus-ring flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-900" aria-label={collapsed ? "Mở rộng sidebar" : "Thu gọn sidebar"}>
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
                className={`focus-ring flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-black transition ${active ? "bg-red-600 text-white shadow-lg shadow-red-950/30" : "text-slate-300 hover:bg-slate-900 hover:text-white"}`}
              >
                <Icon size={18} />
                {collapsed ? null : <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>
      </aside>

      <header className={`sticky top-0 z-30 border-b border-slate-800 bg-slate-950/92 backdrop-blur ${collapsed ? "lg:ml-20" : "lg:ml-72"}`}>
        <div className="flex min-h-16 items-center justify-between gap-4 px-4 lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" onClick={() => setMobileOpen(true)} className="focus-ring flex h-10 w-10 items-center justify-center rounded-lg border border-slate-700 text-slate-200 lg:hidden" aria-label="Mở menu quản trị">
              <Menu size={19} />
            </button>
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-wide text-red-300">Khu vực quản trị</p>
              <h1 className="truncate text-base font-black text-white sm:text-lg">{activeItem.label}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden text-right md:block">
              <p className="text-sm font-bold text-white">{currentUser?.fullName ?? "Admin"}</p>
              <p className="text-xs font-semibold text-slate-400">{currentUser?.role ?? "ADMIN"}</p>
            </div>
            <AccessibilityToolbar />
            <LogoutButton />
          </div>
        </div>
      </header>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm lg:hidden">
          <div className="min-h-screen w-full max-w-sm border-r border-slate-800 bg-slate-950 p-4">
            <div className="flex items-center justify-between">
              <Link href="/admin" onClick={() => setMobileOpen(false)} className="flex items-center gap-2 text-sm font-black text-white">
                <ShieldCheck size={20} />Admin Portal
              </Link>
              <button type="button" onClick={() => setMobileOpen(false)} className="focus-ring flex h-10 w-10 items-center justify-center rounded-lg border border-slate-700 text-slate-200" aria-label="Đóng menu">
                <X size={18} />
              </button>
            </div>
            <nav className="mt-5 space-y-1" aria-label="Điều hướng quản trị mobile">
              {adminNavItems.map((item) => {
                const active = activePathname === item.href || (item.href !== "/admin" && activePathname.startsWith(`${item.href}/`));
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} className={`focus-ring flex min-h-12 items-center gap-3 rounded-lg px-3 text-sm font-black ${active ? "bg-red-600 text-white" : "text-slate-300 hover:bg-slate-900"}`}>
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
