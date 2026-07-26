"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiGet } from "@/lib/api";
import { saveAuthSession, type AuthUser } from "@/lib/auth-client";
import { InlineSystemLoading, SystemLoading } from "@/components/ui/system-loading";

function GoogleCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const processedRef = useRef(false);

  useEffect(() => {
    if (processedRef.current) return;
    processedRef.current = true;

    const token = searchParams.get("token");

    if (!token) {
      setError("Không tìm thấy mã xác thực (token) trong URL.");
      return;
    }

    async function handleLogin() {
      try {
        const data = await apiGet<{ user: AuthUser }>("/api/auth/me", { token: token as string });
        
        saveAuthSession({
          message: "Đăng nhập thành công",
          token: token as string,
          user: data.user
        });

        const isAdmin = data.user.role === "ADMIN" || data.user.role === "SUPER_ADMIN";
        if (isAdmin) {
          router.replace("/admin");
        } else {
          router.replace("/dashboard");
        }
      } catch (err) {
        console.error("Lỗi khi xác minh thông tin đăng nhập Google:", err);
        setError("Không thể xác minh thông tin đăng nhập của bạn với hệ thống. Vui lòng thử lại.");
      }
    }

    void handleLogin();
  }, [router, searchParams]);

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-slate-200/60 bg-white p-8 shadow-xl shadow-slate-100/50">
      {error ? (
        <div className="space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-800">Xác thực thất bại</h2>
          <p className="text-sm font-medium text-slate-500">{error}</p>
          <button
            onClick={() => router.replace("/login")}
            className="inline-flex min-h-10 items-center justify-center rounded-xl bg-blue-600 px-5 text-sm font-bold text-white shadow-md shadow-blue-500/10 transition hover:bg-blue-700"
          >
            Quay lại đăng nhập
          </button>
        </div>
      ) : (
        <InlineSystemLoading
          title="Đang đăng nhập hệ thống"
          description="MOLY đang xác minh thông tin tài khoản Google của bạn."
        />
      )}
    </div>
  );
}

export default function GoogleCallbackPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--background-soft)] p-4 text-center">
      <Suspense fallback={
        <SystemLoading
          fullScreen
          title="Đang xác thực tài khoản"
          description="MOLY đang hoàn tất kết nối đăng nhập."
        />
      }>
        <GoogleCallbackContent />
      </Suspense>
    </div>
  );
}
