"use client";

import { BarChart3, ClipboardList, GraduationCap, Home, Menu, User, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AccessibilityToolbar } from "@/components/accessibility-toolbar";
import { PageAccessDeniedState, PageErrorState, PageLoadingState } from "@/components/ui/page-state";
import { ensureAuthSession, type AuthUser } from "@/lib/auth-client";
import { getStoredLocale, localeChangedEvent, messages, type Locale } from "@/lib/i18n";

const navItems = [
  { href: "/dashboard", icon: BarChart3, labelKey: "dashboard" },
  { href: "/interview/setup", icon: GraduationCap, labelKey: "interview" },
  { href: "/interview/history", icon: ClipboardList, labelKey: "history" },
  { href: "/profile", icon: User, labelKey: "profile" }
] as const;

const publicPaths = new Set(["/", "/features", "/guide", "/login", "/pricing", "/register"]);
const fullScreenPaths = new Set(["/interview"]);
const adminRoles: AuthUser["role"][] = ["ADMIN", "SUPER_ADMIN"];
type AuthStatus = "checking" | "authenticated" | "error" | "forbidden" | "public" | "unauthenticated";

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [authStatus, setAuthStatus] = useState<AuthStatus>("checking");
  const [authError, setAuthError] = useState("Không kiểm tra được phiên đăng nhập. Vui lòng thử lại.");
  const [locale, setLocale] = useState<Locale>("vi");
  const [mounted, setMounted] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const activePathname = pathname ?? "/";
  const isPublicPath = publicPaths.has(activePathname);
  const isAdminPath = activePathname.startsWith("/admin");
  const shouldUseShell = mounted && authStatus === "authenticated" && !isPublicPath && !fullScreenPaths.has(activePathname);
  const t = messages[locale];
  const breadcrumbs = useMemo(
    () => buildBreadcrumbs(activePathname, t.app.breadcrumbs, t.app.home),
    [activePathname, t.app.breadcrumbs, t.app.home]
  );

  useEffect(() => {
    setMounted(true);
    setLocale(getStoredLocale());

    function handleLocaleChanged(event: Event) {
      const nextLocale = (event as CustomEvent<{ locale: Locale }>).detail?.locale;
      if (nextLocale) setLocale(nextLocale);
    }

    window.addEventListener(localeChangedEvent, handleLocaleChanged);
    return () => window.removeEventListener(localeChangedEvent, handleLocaleChanged);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    let cancelled = false;

    async function checkRouteAccess() {
      if (isPublicPath) {
        setAuthStatus("public");
        return;
      }

      setAuthStatus("checking");
      setAuthError("Không kiểm tra được phiên đăng nhập. Vui lòng thử lại.");
      let session: Awaited<ReturnType<typeof ensureAuthSession>>;

      try {
        session = await ensureAuthSession();
      } catch (error) {
        if (cancelled) return;
        setAuthError(error instanceof Error ? error.message : "Không kiểm tra được phiên đăng nhập. Vui lòng thử lại.");
        setAuthStatus("error");
        return;
      }

      if (cancelled) return;

      if (!session) {
        setAuthStatus("unauthenticated");
        router.replace(`/login?next=${encodeURIComponent(activePathname)}`);
        return;
      }

      if (isAdminPath && !adminRoles.includes(session.user.role)) {
        setAuthStatus("forbidden");
        return;
      }

      setAuthStatus("authenticated");
    }

    void checkRouteAccess();

    return () => {
      cancelled = true;
    };
  }, [activePathname, isAdminPath, isPublicPath, mounted, router]);

  function handleMobileNavTouchEnd(event: React.TouchEvent<HTMLElement>) {
    if (touchStartX.current == null) return;
    const deltaX = event.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;

    if (Math.abs(deltaX) < 54) return;

    const activeIndex = navItems.findIndex((item) => activePathname === item.href || activePathname.startsWith(`${item.href}/`));
    if (activeIndex < 0) return;

    const nextIndex = deltaX < 0 ? activeIndex + 1 : activeIndex - 1;
    const nextItem = navItems[nextIndex];
    if (nextItem) router.push(nextItem.href);
  }

  if (!isPublicPath && (!mounted || authStatus === "checking" || authStatus === "unauthenticated")) {
    return <PageLoadingState description="Đang kiểm tra phiên đăng nhập và quyền truy cập." />;
  }

  if (!isPublicPath && authStatus === "error") {
    return (
      <PageErrorState
        title="Không thể kiểm tra đăng nhập"
        description={authError}
        action={(
          <button type="button" onClick={() => window.location.reload()} className="focus-ring inline-flex min-h-10 items-center rounded-lg bg-primary px-4 text-sm font-black text-white">
            Thử lại
          </button>
        )}
      />
    );
  }

  if (!isPublicPath && authStatus === "forbidden") {
    return (
      <PageAccessDeniedState
        title="Không có quyền truy cập"
        description="Tài khoản hiện tại không có quyền mở khu vực quản trị."
        action={(
          <Link href="/dashboard" className="focus-ring inline-flex min-h-10 items-center rounded-lg bg-primary px-4 text-sm font-black text-white">
            Về dashboard
          </Link>
        )}
      />
    );
  }

  if (!shouldUseShell) return <>{children}</>;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className={`fixed left-0 top-0 z-40 hidden h-screen border-r border-border bg-background/95 backdrop-blur lg:block ${collapsed ? "w-20" : "w-64"}`}>
        <div className="flex h-16 items-center justify-between border-b border-border px-4">
          <Link href="/dashboard" className="flex items-center gap-2 text-sm font-black text-primary" aria-label={`${t.app.name} ${t.dashboard}`}>
            <Home size={19} />
            {collapsed ? null : <span>{t.app.name}</span>}
          </Link>
          <button type="button" onClick={() => setCollapsed((current) => !current)} className="focus-ring flex h-9 w-9 items-center justify-center rounded-lg border border-border" aria-label={collapsed ? t.app.expandSidebar : t.app.collapseSidebar}>
            {collapsed ? <Menu size={17} /> : <X size={17} />}
          </button>
        </div>
        <nav className="space-y-2 p-3" aria-label={t.app.mainNav}>
          {navItems.map((item) => {
            const active = activePathname === item.href || activePathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            const label = t.app.nav[item.labelKey];
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`focus-ring flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-black transition ${active ? "bg-blue-50 text-primary dark:bg-blue-950 dark:text-blue-200" : "text-slate-600 hover:bg-muted dark:text-slate-300"}`}
                title={collapsed ? label : undefined}
                aria-current={active ? "page" : undefined}
              >
                <Icon size={18} />
                {collapsed ? null : <span>{label}</span>}
              </Link>
            );
          })}
        </nav>
      </aside>

      <header className={`sticky top-0 z-30 border-b border-border bg-background/88 backdrop-blur ${collapsed ? "lg:ml-20" : "lg:ml-64"}`}>
        <div className="flex min-h-16 items-center justify-between gap-4 px-4 lg:px-6">
          <div>
            <p className="type-caption text-slate-600 dark:text-slate-300">{t.app.breadcrumb}</p>
            <nav className="mt-1 flex flex-wrap items-center gap-2 text-sm font-black" aria-label={t.app.breadcrumb}>
              {breadcrumbs.map((crumb, index) => (
                <span key={crumb.href} className="flex items-center gap-2">
                  {index > 0 ? <span className="text-slate-400">/</span> : null}
                  <Link href={crumb.href} className={index === breadcrumbs.length - 1 ? "text-foreground" : "text-primary"} aria-current={index === breadcrumbs.length - 1 ? "page" : undefined}>
                    {crumb.label}
                  </Link>
                </span>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <AccessibilityToolbar />
            <Link href="/interview/setup" className="focus-ring hidden min-h-10 items-center rounded-lg bg-primary px-4 text-sm font-black text-white sm:inline-flex">
              {t.app.start}
            </Link>
          </div>
        </div>
      </header>

      <div
        key={activePathname}
        className={`animate-[fade-in_180ms_ease-out] pb-20 lg:pb-0 ${collapsed ? "lg:pl-20" : "lg:pl-64"}`}
      >
        {children}
      </div>

      <p id="mobile-nav-swipe-hint" className="sr-only">{t.app.swipeHint}</p>
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 grid grid-cols-4 border-t border-border bg-background/95 px-2 py-2 backdrop-blur lg:hidden"
        aria-describedby="mobile-nav-swipe-hint"
        aria-label={t.app.mobileNav}
        onTouchEnd={handleMobileNavTouchEnd}
        onTouchStart={(event) => {
          touchStartX.current = event.touches[0].clientX;
        }}
      >
        {navItems.map((item) => {
          const active = activePathname === item.href || activePathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          const label = t.app.nav[item.labelKey];
          return (
            <Link key={item.href} href={item.href} className={`focus-ring flex min-h-11 flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-black ${active ? "bg-blue-50 text-primary dark:bg-blue-950 dark:text-blue-200" : "text-slate-600 dark:text-slate-300"}`} aria-current={active ? "page" : undefined}>
              <Icon size={17} />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function buildBreadcrumbs(pathname: string, labels: Record<string, string>, homeLabel: string) {
  const parts = pathname.split("/").filter(Boolean);
  const crumbs = [{ href: "/dashboard", label: homeLabel }];
  let href = "";

  parts.forEach((part) => {
    href += `/${part}`;
    if (href === "/dashboard") return;
    crumbs.push({ href, label: labels[part] ?? part });
  });

  return crumbs;
}
