"use client";

import { BarChart3, ClipboardList, CreditCard, GraduationCap, ShieldCheck, User } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AdminShell } from "@/components/admin-shell";
import { PageAccessDeniedState, PageErrorState, PageLoadingState } from "@/components/ui/page-state";
import { UserNavbar } from "@/components/user-navbar";
import { ensureAuthSession, getAuthToken, getStoredUser, type AuthUser } from "@/lib/auth-client";
import { getStoredLocale, localeChangedEvent, type Locale } from "@/lib/i18n";

const navItems = [
  { href: "/dashboard", icon: BarChart3, labelKey: "dashboard" },
  { href: "/interview/setup", icon: GraduationCap, labelKey: "interview" },
  { href: "/interview/history", icon: ClipboardList, labelKey: "history" },
  { href: "/payment", icon: CreditCard, labelKey: "payment" },
  { href: "/profile", icon: User, labelKey: "profile" }
] as const;
const adminNavItem = { href: "/admin", icon: ShieldCheck, label: "Admin" } as const;
const adminPrefetchPaths = [
  "/admin",
  "/admin/analytics",
  "/admin/users",
  "/admin/questions",
  "/admin/schools",
  "/admin/majors",
  "/admin/scholarships"
];

const publicPaths = new Set(["/", "/403-forbidden", "/features", "/guide", "/login", "/payment", "/pricing", "/privacy", "/register", "/terms"]);
const fullScreenPaths = new Set(["/interview"]);
const adminRoles: AuthUser["role"][] = ["ADMIN", "SUPER_ADMIN"];
type AuthStatus = "checking" | "authenticated" | "error" | "forbidden" | "public" | "unauthenticated";

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [authStatus, setAuthStatus] = useState<AuthStatus>("checking");
  const [authError, setAuthError] = useState("Không kiểm tra được phiên đăng nhập. Vui lòng thử lại.");
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [locale, setLocale] = useState<Locale>("vi");
  const [mounted, setMounted] = useState(false);
  const activePathname = pathname ?? "/";
  const isPublicPath = publicPaths.has(activePathname);
  const isAdminPath = activePathname.startsWith("/admin");
  const canAccessAdmin = currentUser ? adminRoles.includes(currentUser.role) : false;
  const visibleNavItems = useMemo(() => canAccessAdmin ? [...navItems, adminNavItem] : [...navItems], [canAccessAdmin]);
  const shouldUseShell = mounted && authStatus === "authenticated" && !isPublicPath && !fullScreenPaths.has(activePathname);

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
        setCurrentUser(null);
        return;
      }

      const storedUser = getStoredUser();
      if (getAuthToken() && storedUser) {
        setCurrentUser(storedUser);
        setAuthStatus(isAdminPath && !adminRoles.includes(storedUser.role) ? "forbidden" : "authenticated");
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
        setCurrentUser(null);
        setAuthStatus("unauthenticated");
        router.replace(`/login?next=${encodeURIComponent(activePathname)}`);
        return;
      }

      setCurrentUser(session.user);

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

  useEffect(() => {
    if (!mounted || authStatus !== "authenticated") return;

    visibleNavItems.forEach((item) => router.prefetch(item.href));
    if (canAccessAdmin) adminPrefetchPaths.forEach((path) => router.prefetch(path));
  }, [authStatus, canAccessAdmin, mounted, router, visibleNavItems]);

  useEffect(() => {
    if (!mounted || authStatus !== "forbidden" || !isAdminPath) return;
    router.replace("/403-forbidden");
  }, [authStatus, isAdminPath, mounted, router]);

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

  if (isAdminPath) {
    return (
      <AdminShell currentUser={currentUser} locale={locale} activePathname={activePathname}>
        {children}
      </AdminShell>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <UserNavbar currentUser={currentUser} locale={locale} />
      <div key={activePathname} className="animate-[fade-in_180ms_ease-out]">
        {children}
      </div>
    </div>
  );
}
