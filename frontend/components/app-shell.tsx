"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { AdminShell } from "@/components/admin-shell";
import { MarketingFrame } from "@/components/home/marketing-frame";
import { getUserNavigationItems } from "@/components/navigation/user-navigation";
import { PageAccessDeniedState, PageErrorState, PageLoadingState } from "@/components/ui/page-state";
import { UserAppShell } from "@/components/user-app-shell";
import { ensureAuthSession, fetchCurrentUser, getAuthToken, getStoredUser, type AuthUser } from "@/lib/auth-client";
import { getStoredLocale, localeChangedEvent, type Locale } from "@/lib/i18n";

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
const optionalAuthPaths = new Set(["/guide", "/payment"]);
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
  const isOptionalAuthPath = optionalAuthPaths.has(activePathname);
  const isAdminPath = activePathname.startsWith("/admin");
  const canAccessAdmin = currentUser ? adminRoles.includes(currentUser.role) : false;
  const shouldUseShell = mounted && authStatus === "authenticated" && (!isPublicPath || isOptionalAuthPath) && !fullScreenPaths.has(activePathname);

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
      if (isPublicPath && !isOptionalAuthPath) {
        setAuthStatus("public");
        setCurrentUser(null);
        return;
      }

      const storedUser = getStoredUser();
      if (getAuthToken() && storedUser && !isAdminPath) {
        setCurrentUser(storedUser);
        setAuthStatus("authenticated");
        return;
      }

      setAuthStatus("checking");
      setAuthError("Không kiểm tra được phiên đăng nhập. Vui lòng thử lại.");
      let session: Awaited<ReturnType<typeof ensureAuthSession>>;

      try {
        if (getAuthToken() && storedUser && isAdminPath) {
          const user = await fetchCurrentUser();
          session = user ? { token: getAuthToken()!, user: user.user } : null;
        } else {
          session = await ensureAuthSession();
        }
      } catch (error) {
        if (cancelled) return;
        if (isOptionalAuthPath) {
          setCurrentUser(null);
          setAuthStatus("public");
          return;
        }
        setAuthError(error instanceof Error ? error.message : "Không kiểm tra được phiên đăng nhập. Vui lòng thử lại.");
        setAuthStatus("error");
        return;
      }

      if (cancelled) return;

      if (!session) {
        setCurrentUser(null);
        if (isOptionalAuthPath) {
          setAuthStatus("public");
          return;
        }
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
  }, [activePathname, isAdminPath, isOptionalAuthPath, isPublicPath, mounted, router]);

  useEffect(() => {
    if (!mounted || authStatus !== "authenticated") return;

    getUserNavigationItems(locale).forEach((item) => router.prefetch(item.href));
    if (canAccessAdmin) adminPrefetchPaths.forEach((path) => router.prefetch(path));
  }, [authStatus, canAccessAdmin, locale, mounted, router]);

  useEffect(() => {
    if (!mounted || authStatus !== "forbidden" || !isAdminPath) return;
    router.replace("/403-forbidden");
  }, [authStatus, isAdminPath, mounted, router]);

  if (!isPublicPath && (!mounted || authStatus === "checking" || authStatus === "unauthenticated")) {
    return <PageLoadingState description="Đang kiểm tra phiên đăng nhập và quyền truy cập." />;
  }

  if (isOptionalAuthPath && (!mounted || authStatus === "checking")) {
    return <PageLoadingState description="Đang kiểm tra phiên đăng nhập." />;
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
            Về tổng quan
          </Link>
        )}
      />
    );
  }

  if (!shouldUseShell) {
    return isOptionalAuthPath ? <MarketingFrame>{children}</MarketingFrame> : <>{children}</>;
  }

  if (isAdminPath) {
    return (
      <AdminShell currentUser={currentUser} locale={locale} activePathname={activePathname}>
        {children}
      </AdminShell>
    );
  }

  return (
    <UserAppShell currentUser={currentUser} locale={locale} activePathname={activePathname}>
      {children}
    </UserAppShell>
  );
}
