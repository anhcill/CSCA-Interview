"use client";

import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  LogOut,
  Menu,
  ShieldCheck,
  Sparkles,
  User,
  X
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AccessibilityToolbar } from "@/components/accessibility-toolbar";
import { MobileBottomNavigation } from "@/components/navigation/mobile-bottom-navigation";
import {
  getPrimaryUserNavigationItems,
  getSecondaryUserNavigationItems,
  getUserNavigationUiCopy,
  getUserNavigationTitle,
  isUserNavigationItemActive
} from "@/components/navigation/user-navigation";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { RoleSwitcher } from "@/components/role-switcher";
import { UserTestExperience } from "@/components/site-experience/user-test-experience";
import { clearAuthSession, logoutAccount, type AuthUser } from "@/lib/auth-client";
import type { Locale } from "@/lib/i18n";

const sidebarCollapsedKey = "moly:user-sidebar-collapsed";
const adminRoles: AuthUser["role"][] = ["ADMIN", "SUPER_ADMIN"];

const shellCopyByLocale = {
  vi: {
    account: "Tài khoản",
    accountMenu: "Mở menu tài khoản",
    accountMoly: "Tài khoản MOLY",
    adminArea: "Khu vực quản trị",
    brandHome: "MOLY — về tổng quan",
    brandTagline: "Huấn luyện phỏng vấn AI",
    closeNavigation: "Đóng menu điều hướng",
    collapseSidebar: "Thu gọn thanh bên",
    currentLanguage: "Ngôn ngữ giao diện hiện tại: Tiếng Việt.",
    expandSidebar: "Mở rộng thanh bên",
    interviewReport: "Báo cáo phỏng vấn",
    logout: "Đăng xuất",
    loggingOut: "Đang đăng xuất...",
    myProfile: "Hồ sơ của tôi",
    navigationDrawer: "Menu điều hướng",
    navigationSidebar: "Thanh điều hướng",
    notifications: "Thông báo",
    openNavigation: "Mở menu điều hướng",
    practiceSpace: "Không gian luyện tập",
    startInterview: "Bắt đầu phỏng vấn"
  },
  en: {
    account: "Account",
    accountMenu: "Open account menu",
    accountMoly: "MOLY account",
    adminArea: "Admin area",
    brandHome: "MOLY — back to overview",
    brandTagline: "AI Interview Coach",
    closeNavigation: "Close navigation menu",
    collapseSidebar: "Collapse sidebar",
    currentLanguage: "Current interface language: English.",
    expandSidebar: "Expand sidebar",
    interviewReport: "Interview report",
    logout: "Log out",
    loggingOut: "Logging out...",
    myProfile: "My profile",
    navigationDrawer: "Navigation menu",
    navigationSidebar: "Navigation sidebar",
    notifications: "Notifications",
    openNavigation: "Open navigation menu",
    practiceSpace: "Interview practice space",
    startInterview: "Start interview"
  },
  zh: {
    account: "账户",
    accountMenu: "打开账户菜单",
    accountMoly: "MOLY 账户",
    adminArea: "管理后台",
    brandHome: "MOLY — 返回总览",
    brandTagline: "AI 面试教练",
    closeNavigation: "关闭导航菜单",
    collapseSidebar: "收起侧边栏",
    currentLanguage: "当前界面语言：中文。",
    expandSidebar: "展开侧边栏",
    interviewReport: "面试报告",
    logout: "退出登录",
    loggingOut: "正在退出...",
    myProfile: "我的资料",
    navigationDrawer: "导航菜单",
    navigationSidebar: "导航栏",
    notifications: "通知",
    openNavigation: "打开导航菜单",
    practiceSpace: "面试练习空间",
    startInterview: "开始面试"
  }
} as const satisfies Record<Locale, Record<string, string>>;

type ShellCopy = (typeof shellCopyByLocale)[Locale];

type UserAppShellProps = {
  activePathname: string;
  children: ReactNode;
  currentUser: AuthUser | null;
  locale: Locale;
};

type NavigationListProps = {
  activePathname: string;
  collapsed?: boolean;
  locale: Locale;
  onNavigate?: () => void;
};

function Brand({ collapsed = false, copy, onNavigate }: { collapsed?: boolean; copy: ShellCopy; onNavigate?: () => void }) {
  return (
    <Link
      href="/dashboard"
      onClick={onNavigate}
      className="focus-ring flex min-w-0 items-center gap-3 rounded-xl"
      aria-label={copy.brandHome}
    >
      <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-[0_10px_24px_rgba(184,29,36,0.22)]">
        <GraduationCap size={21} aria-hidden="true" />
        <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-background bg-amber-400" />
      </span>
      {collapsed ? null : (
        <span className="min-w-0">
          <span className="block truncate text-base font-black tracking-tight text-primary">MOLY</span>
          <span className="block truncate text-[11px] font-bold text-muted-foreground">{copy.brandTagline}</span>
        </span>
      )}
    </Link>
  );
}

function NavigationList({ activePathname, collapsed = false, locale, onNavigate }: NavigationListProps) {
  const navigationCopy = getUserNavigationUiCopy(locale);
  const primaryItems = getPrimaryUserNavigationItems(locale);
  const secondaryItems = getSecondaryUserNavigationItems(locale);

  return (
    <>
      <nav className="space-y-1" aria-label={navigationCopy.primaryNavigationLabel}>
        {primaryItems.map((item) => {
          const active = isUserNavigationItemActive(activePathname, item);
          const Icon = item.icon;

          return (
            <Link
              key={item.id}
              href={item.href}
              onClick={onNavigate}
              title={collapsed ? item.label : undefined}
              aria-current={active ? "page" : undefined}
              className={`focus-ring group flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-black transition-colors ${
                active
                  ? "bg-primary text-primary-foreground shadow-[0_10px_22px_rgba(184,29,36,0.18)]"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Icon className="shrink-0" size={19} aria-hidden="true" />
              {collapsed ? <span className="sr-only">{item.label}</span> : <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="my-4 border-t border-border" />

      <nav className="space-y-1" aria-label={navigationCopy.secondaryNavigationLabel}>
        {secondaryItems.map((item) => {
          const active = isUserNavigationItemActive(activePathname, item);
          const Icon = item.icon;

          return (
            <Link
              key={item.id}
              href={item.href}
              onClick={onNavigate}
              title={collapsed ? item.label : undefined}
              aria-current={active ? "page" : undefined}
              className={`focus-ring group flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-black transition-colors ${
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Icon className="shrink-0" size={18} aria-hidden="true" />
              {collapsed ? <span className="sr-only">{item.label}</span> : <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>
    </>
  );
}

function getShellPageTitle(currentLocation: string, copy: ShellCopy, locale: Locale) {
  const pathname = currentLocation.split(/[?#]/, 1)[0];

  if (pathname === "/interview/result" || pathname.startsWith("/interview/result/")) return copy.interviewReport;
  if (pathname === "/notifications" || pathname.startsWith("/notifications/")) return copy.notifications;
  return getUserNavigationTitle(currentLocation, locale);
}

export function UserAppShell({ activePathname, children, currentUser, locale }: UserAppShellProps) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(activePathname);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const closeDrawerButtonRef = useRef<HTMLButtonElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const copy = shellCopyByLocale[locale];
  const canSwitchRole = currentUser ? adminRoles.includes(currentUser.role) : false;
  const pageTitle = getShellPageTitle(currentLocation, copy, locale);
  const initials = useMemo(() => {
    const source = currentUser?.fullName || currentUser?.email || "MOLY";
    return source
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "MO";
  }, [currentUser]);

  useEffect(() => {
    setCollapsed(localStorage.getItem(sidebarCollapsedKey) === "true");
  }, []);

  useEffect(() => {
    function updateCurrentLocation() {
      setCurrentLocation(`${activePathname}${window.location.hash}`);
    }

    updateCurrentLocation();
    window.addEventListener("hashchange", updateCurrentLocation);
    return () => window.removeEventListener("hashchange", updateCurrentLocation);
  }, [activePathname]);

  useEffect(() => {
    setMobileOpen(false);
    setUserMenuOpen(false);
  }, [currentLocation]);

  useEffect(() => {
    if (!mobileOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeDrawerButtonRef.current?.focus();

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileOpen(false);
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [mobileOpen]);

  useEffect(() => {
    if (!userMenuOpen) return;

    function handleOutsideClick(event: MouseEvent) {
      if (!userMenuRef.current?.contains(event.target as Node)) setUserMenuOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setUserMenuOpen(false);
    }

    document.addEventListener("mousedown", handleOutsideClick);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [userMenuOpen]);

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      localStorage.setItem(sidebarCollapsedKey, String(next));
      return next;
    });
  }

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
    <div className="min-h-screen bg-background text-foreground">
      <aside
        className={`fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-border bg-background transition-[width] duration-200 lg:flex ${
          collapsed ? "w-20" : "w-64 xl:w-72"
        }`}
        aria-label={copy.navigationSidebar}
      >
        <div className={`flex h-16 shrink-0 items-center border-b border-border ${collapsed ? "justify-center px-3" : "justify-between px-4"}`}>
          <Brand collapsed={collapsed} copy={copy} />
          {collapsed ? null : (
            <button
              type="button"
              onClick={toggleCollapsed}
              className="focus-ring flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground"
              aria-label={copy.collapseSidebar}
              aria-controls="user-sidebar-navigation"
              aria-expanded="true"
            >
              <ChevronLeft size={17} aria-hidden="true" />
            </button>
          )}
        </div>

        <div id="user-sidebar-navigation" className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
          {collapsed ? (
            <button
              type="button"
              onClick={toggleCollapsed}
              className="focus-ring mb-3 flex h-11 w-full items-center justify-center rounded-xl border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground"
              aria-label={copy.expandSidebar}
              aria-controls="user-sidebar-navigation"
              aria-expanded="false"
            >
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          ) : null}
          <NavigationList activePathname={currentLocation} collapsed={collapsed} locale={locale} />
        </div>

        <div className="shrink-0 border-t border-border p-3">
          <Link
            href="/interview/setup"
            title={collapsed ? copy.startInterview : undefined}
            className={`focus-ring flex min-h-11 items-center rounded-xl bg-primary text-sm font-black text-primary-foreground shadow-[0_10px_22px_rgba(184,29,36,0.18)] transition hover:bg-primary/90 ${
              collapsed ? "justify-center px-2" : "gap-3 px-3"
            }`}
          >
            <Sparkles size={18} className="shrink-0" aria-hidden="true" />
            {collapsed ? <span className="sr-only">{copy.startInterview}</span> : <span>{copy.startInterview}</span>}
          </Link>
        </div>
      </aside>

      <div className={`min-h-screen transition-[padding] duration-200 ${collapsed ? "lg:pl-20" : "lg:pl-64 xl:pl-72"}`}>
        <header className="sticky top-0 z-30 border-b border-border bg-background/92 backdrop-blur-xl">
          <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-5 lg:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="focus-ring flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border text-muted-foreground lg:hidden"
                aria-label={copy.openNavigation}
                aria-controls="user-mobile-drawer"
                aria-expanded={mobileOpen}
              >
                <Menu size={20} aria-hidden="true" />
              </button>
              <div className="lg:hidden">
                <Brand collapsed copy={copy} />
              </div>
              <div className="hidden min-w-0 sm:block">
                <p className="truncate text-xs font-black uppercase tracking-[0.12em] text-primary">{copy.practiceSpace}</p>
                <h1 className="truncate text-base font-black sm:text-lg">{pageTitle}</h1>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {canSwitchRole ? <RoleSwitcher active="user" className="hidden xl:inline-flex" /> : null}
              <div className="hidden lg:block">
                <AccessibilityToolbar compact />
              </div>
              <NotificationBell />

              <div className="relative" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => setUserMenuOpen((current) => !current)}
                  className="focus-ring flex min-h-10 items-center gap-2 rounded-xl border border-border bg-background p-1.5 pr-2 text-sm font-black transition hover:bg-muted"
                  aria-label={copy.accountMenu}
                  aria-expanded={userMenuOpen}
                  aria-haspopup="menu"
                  aria-controls="user-account-menu"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-xs text-primary">
                    {initials}
                  </span>
                  <span className="hidden max-w-32 truncate sm:block">{currentUser?.fullName || copy.account}</span>
                  <ChevronDown size={15} className="text-muted-foreground" aria-hidden="true" />
                </button>

                {userMenuOpen ? (
                  <div
                    id="user-account-menu"
                    role="menu"
                    className="absolute right-0 top-12 z-50 w-72 rounded-xl border border-border bg-background p-2 shadow-[var(--shadow-ui)]"
                  >
                    <div className="border-b border-border px-3 py-2">
                      <p className="truncate text-sm font-black">{currentUser?.fullName || copy.accountMoly}</p>
                      <p className="mt-0.5 truncate text-xs font-bold text-muted-foreground">{currentUser?.email}</p>
                    </div>
                    <Link
                      href="/profile"
                      role="menuitem"
                      className="focus-ring mt-2 flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-black hover:bg-muted"
                    >
                      <User size={16} aria-hidden="true" />
                      {copy.myProfile}
                    </Link>
                    {canSwitchRole ? (
                      <Link
                        href="/admin"
                        role="menuitem"
                        className="focus-ring flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-black hover:bg-muted"
                      >
                        <ShieldCheck size={16} aria-hidden="true" />
                        {copy.adminArea}
                      </Link>
                    ) : null}
                    <button
                      type="button"
                      onClick={handleLogout}
                      disabled={isLoggingOut}
                      role="menuitem"
                      className="focus-ring flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-black text-primary hover:bg-muted disabled:opacity-60"
                    >
                      <LogOut size={16} aria-hidden="true" />
                      {isLoggingOut ? copy.loggingOut : copy.logout}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </header>

        <div id="main-content" className="min-h-[calc(100vh-4rem)] pb-20 lg:pb-0" tabIndex={-1}>
          <div key={activePathname} className="animate-[fade-in_180ms_ease-out]">
            {children}
          </div>
        </div>
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="absolute inset-0 h-full w-full cursor-default bg-slate-950/40 backdrop-blur-sm"
            aria-label={copy.closeNavigation}
            tabIndex={-1}
          />
          <aside
            id="user-mobile-drawer"
            role="dialog"
            aria-modal="true"
            aria-label={copy.navigationDrawer}
            className="relative flex h-dvh w-[min(88vw,22rem)] flex-col overflow-hidden border-r border-border bg-background shadow-2xl"
          >
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-4">
              <Brand copy={copy} onNavigate={() => setMobileOpen(false)} />
              <button
                ref={closeDrawerButtonRef}
                type="button"
                onClick={() => setMobileOpen(false)}
                className="focus-ring flex h-10 w-10 items-center justify-center rounded-xl border border-border text-muted-foreground"
                aria-label={copy.closeNavigation}
              >
                <X size={19} aria-hidden="true" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
              <NavigationList activePathname={currentLocation} locale={locale} onNavigate={() => setMobileOpen(false)} />

              <div className="mt-5 space-y-3 border-t border-border pt-5">
                {canSwitchRole ? <RoleSwitcher active="user" className="flex w-full" /> : null}
                <AccessibilityToolbar />
              </div>
            </div>

            <div className="shrink-0 border-t border-border p-4">
              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="focus-ring flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-border text-sm font-black text-primary disabled:opacity-60"
              >
                <LogOut size={17} aria-hidden="true" />
                {isLoggingOut ? copy.loggingOut : copy.logout}
              </button>
            </div>
          </aside>
        </div>
      ) : null}

      <MobileBottomNavigation
        currentLocation={currentLocation}
        locale={locale}
        menuOpen={mobileOpen}
        menuControlsId="user-mobile-drawer"
        onMenuOpen={() => setMobileOpen(true)}
      />
      <UserTestExperience />

      <span className="sr-only" aria-live="polite">
        {copy.currentLanguage}
      </span>
    </div>
  );
}
