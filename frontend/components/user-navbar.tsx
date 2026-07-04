"use client";

import { BarChart3, ChevronDown, ClipboardList, CreditCard, GraduationCap, LogOut, Menu, ShieldCheck, User, X } from "lucide-react";

const BellIcon = ({ size = 18, className = "" }: { size?: number; className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
);
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AccessibilityToolbar } from "@/components/accessibility-toolbar";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { RoleSwitcher } from "@/components/role-switcher";
import { clearAuthSession, logoutAccount, type AuthUser } from "@/lib/auth-client";
import { messages, type Locale } from "@/lib/i18n";

const navItems = [
  { href: "/dashboard", icon: BarChart3, labelKey: "dashboard" },
  { href: "/interview/setup", icon: GraduationCap, labelKey: "interview" },
  { href: "/interview/history", icon: ClipboardList, labelKey: "history" },
  { href: "/payment", icon: CreditCard, labelKey: "payment" },
  { href: "/profile", icon: User, labelKey: "profile" }
] as const;

const adminRoles: AuthUser["role"][] = ["ADMIN", "SUPER_ADMIN"];

interface UserNavbarProps {
  currentUser: AuthUser | null;
  locale: Locale;
}

export function UserNavbar({ currentUser, locale }: UserNavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hiddenOnScroll, setHiddenOnScroll] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const t = messages[locale];
  const activePathname = pathname ?? "/";
  const canSwitchRole = currentUser ? adminRoles.includes(currentUser.role) : false;
  const initials = useMemo(() => {
    const source = currentUser?.fullName || currentUser?.email || "PV";
    return source
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "PV";
  }, [currentUser]);

  useEffect(() => {
    setMobileOpen(false);
    setUserMenuOpen(false);
  }, [activePathname]);

  useEffect(() => {
    let lastY = window.scrollY;

    function handleScroll() {
      const nextY = window.scrollY;
      setHiddenOnScroll(nextY > 96 && nextY > lastY);
      lastY = nextY;
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await logoutAccount();
    } catch {
      clearAuthSession();
    } finally {
      router.replace("/login");
      setIsLoggingOut(false);
    }
  }

  return (
    <header className={`sticky top-0 z-50 border-b border-border bg-background/90 text-foreground backdrop-blur-md transition-transform duration-200 ${hiddenOnScroll && !mobileOpen ? "-translate-y-full" : "translate-y-0"}`}>
      <div className="mx-auto flex h-16 max-w-[90rem] items-center justify-between gap-3 px-4 sm:h-20 sm:px-6 xl:px-8">
        <Link href="/dashboard" className="focus-ring flex min-w-[12.5rem] max-w-[15rem] items-center gap-3 rounded-lg xl:min-w-[14rem]" aria-label={t.app.name}>
          <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-[0_12px_28px_rgba(184,29,36,0.22)]">
            <GraduationCap size={21} />
            <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-background bg-accent" />
          </span>
          <span className="hidden min-w-0 sm:block">
            <span className="block text-sm font-black leading-4 text-primary">{t.app.name}</span>
            <span className="block max-w-[8.5rem] text-xs font-bold leading-4 text-muted-foreground xl:max-w-none">China interview studio</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label={t.app.mainNav}>
          {navItems.map((item) => {
            const active = activePathname === item.href || activePathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`focus-ring group relative inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-black transition xl:px-4 ${active ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
                aria-current={active ? "page" : undefined}
              >
                <Icon size={17} />
                {t.app.nav[item.labelKey]}
                <span className={`absolute bottom-1 left-4 right-4 h-0.5 rounded-full bg-accent transition-transform ${active ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"}`} />
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          {canSwitchRole ? <RoleSwitcher active="user" /> : null}
          <AccessibilityToolbar />
          <NotificationBell />
          <Link href="/interview/setup" className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-black text-primary-foreground shadow-[0_12px_28px_rgba(184,29,36,0.18)]">
            <GraduationCap size={16} />
            {t.app.start}
          </Link>
          <div className="relative">
            <button
              type="button"
              onClick={() => setUserMenuOpen((current) => !current)}
              className="focus-ring flex min-h-10 items-center gap-2 rounded-lg border border-border bg-background px-2 text-sm font-black"
              aria-expanded={userMenuOpen}
              aria-haspopup="menu"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs text-primary">{initials}</span>
              <ChevronDown size={15} />
            </button>
            {userMenuOpen ? (
              <div className="absolute right-0 top-12 w-64 rounded-lg border border-border bg-background p-2 shadow-[var(--shadow-ui)]" role="menu">
                <div className="border-b border-border px-3 py-2">
                  <p className="truncate text-sm font-black">{currentUser?.fullName || currentUser?.email}</p>
                  <p className="truncate text-xs font-bold text-muted-foreground">{currentUser?.email}</p>
                </div>
                <Link href="/profile" className="focus-ring mt-2 flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-black hover:bg-muted" role="menuitem">
                  <User size={16} />
                  {t.app.nav.profile}
                </Link>
                {currentUser && adminRoles.includes(currentUser.role) ? (
                  <Link href="/admin" className="focus-ring flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-black hover:bg-muted" role="menuitem">
                    <ShieldCheck size={16} />
                    Admin
                  </Link>
                ) : null}
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="focus-ring flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-black text-primary hover:bg-muted disabled:opacity-60"
                  role="menuitem"
                >
                  <LogOut size={16} />
                  {isLoggingOut ? "Đang đăng xuất..." : "Đăng xuất"}
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen((current) => !current)}
          className="focus-ring flex h-11 w-11 items-center justify-center rounded-lg border border-border lg:hidden"
          aria-expanded={mobileOpen}
          aria-label={mobileOpen ? "Đóng menu" : "Mở menu"}
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {mobileOpen ? (
        <div className="border-t border-border bg-background/98 px-4 py-4 shadow-[var(--shadow-ui)] lg:hidden">
          <nav className="grid gap-2" aria-label={t.app.mobileNav}>
            {navItems.map((item) => {
              const active = activePathname === item.href || activePathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`focus-ring flex min-h-12 items-center gap-3 rounded-lg px-3 text-base font-black ${active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"}`}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon size={19} />
                  {t.app.nav[item.labelKey]}
                </Link>
              );
            })}
          </nav>
          <div className="mt-4 grid gap-3 border-t border-border pt-4">
            {canSwitchRole ? <RoleSwitcher active="user" className="flex w-full" /> : null}
            <Link href="/notifications" className="focus-ring flex min-h-12 items-center justify-center gap-2 rounded-lg border border-border px-4 text-sm font-black text-foreground">
              <BellIcon size={18} />
              Thông báo
            </Link>
            <Link href="/interview/setup" className="focus-ring flex min-h-12 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-black text-primary-foreground">
              <GraduationCap size={18} />
              {t.app.start}
            </Link>
            <AccessibilityToolbar />
            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="focus-ring flex min-h-12 items-center justify-center gap-2 rounded-lg border border-border px-4 text-sm font-black text-primary disabled:opacity-60"
            >
              <LogOut size={17} />
              {isLoggingOut ? "Đang đăng xuất..." : "Đăng xuất"}
            </button>
          </div>
        </div>
      ) : null}
    </header>
  );
}
