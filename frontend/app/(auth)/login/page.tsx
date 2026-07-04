"use client";

import { Mail } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { AuthLayout } from "@/components/auth-layout";
import { PasswordField } from "@/components/password-field";
import { loginAccount, saveAuthSession } from "@/lib/auth-client";

const inputWrap =
  "flex h-12 items-center gap-3 rounded-xl px-4 transition-all duration-200 focus-within:ring-2 focus-within:ring-red-500/40";
const inputBase =
  "min-w-0 flex-1 appearance-none border-0 bg-transparent text-sm font-semibold text-white outline-none placeholder:text-white/30";
const inputStyle = {
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
};

function GoogleIcon() {
  return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
      <path fill="#EA4335" d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.136 4.114A5.89 5.89 0 0 1 8 12.628a5.89 5.89 0 0 1 5.99-5.89 5.75 5.75 0 0 1 3.96 1.543l3.14-3.14A10.15 10.15 0 0 0 13.99 3c-5.523 0-10 4.477-10 10s4.477 10 10 10c5.77 0 9.588-4.053 9.588-9.75 0-.663-.058-1.295-.168-1.965H12.24Z" />
    </svg>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const errorQuery = searchParams.get("error");
    if (!errorQuery) return;
    const messages: Record<string, string> = {
      token_exchange_failed: "Không thể trao đổi mã xác thực với Google.",
      user_info_failed: "Không thể lấy thông tin tài khoản từ Google.",
      email_not_provided: "Tài khoản Google của bạn không cung cấp Email.",
      account_disabled: "Tài khoản của bạn đã bị vô hiệu hóa.",
    };
    setError(messages[errorQuery] ?? `Lỗi xác thực Google: ${errorQuery}`);
  }, [searchParams]);

  const handleGoogleLogin = () => {
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4010";
    window.location.href = `${apiBaseUrl}/api/auth/google`;
  };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const data = await loginAccount({ email, password });
      saveAuthSession(data);
      const nextPath = new URLSearchParams(window.location.search).get("next");
      const safeNextPath = nextPath?.startsWith("/") && !nextPath.startsWith("//") ? nextPath : null;
      const isAdmin = data.user.role === "ADMIN" || data.user.role === "SUPER_ADMIN";
      const targetPath = isAdmin
        ? (safeNextPath?.startsWith("/admin") ? safeNextPath : "/admin")
        : (safeNextPath && !safeNextPath.startsWith("/admin") ? safeNextPath : "/dashboard");
      router.replace(targetPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể đăng nhập");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AuthLayout
      mode="login"
      title="Chào mừng trở lại"
      subtitle="Tiếp tục luyện phỏng vấn, theo dõi tiến độ và chuẩn bị tốt nhất cho kỳ apply học bổng."
    >
      <form className="space-y-3" onSubmit={handleSubmit}>
        {/* Email */}
        <label className="block">
          <span className={inputWrap} style={inputStyle}>
            <Mail size={17} className="shrink-0 text-red-400" />
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputBase}
              type="email"
              placeholder="Email đăng nhập"
              aria-label="Email đăng nhập"
              autoComplete="email"
              required
            />
          </span>
        </label>

        {/* Password */}
        <PasswordField
          value={password}
          onChange={setPassword}
          placeholder="Mật khẩu"
          ariaLabel="Mật khẩu"
          autoComplete="current-password"
          darkMode
        />

        {/* Remember + Forgot */}
        <div className="flex items-center justify-between text-xs font-semibold">
          <label className="flex cursor-pointer items-center gap-2 text-white/40 hover:text-white/60 transition">
            <input type="checkbox" defaultChecked className="h-3.5 w-3.5 accent-red-500" />
            Ghi nhớ đăng nhập
          </label>
          <button type="button" className="text-red-400 hover:text-red-300 transition">
            Quên mật khẩu?
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-xs font-semibold text-red-300">
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          id="btn-login-submit"
          disabled={isLoading}
          className="relative h-12 w-full overflow-hidden rounded-xl text-sm font-black text-white shadow-lg transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60 hover:opacity-90 active:scale-[0.98]"
          style={{ background: "linear-gradient(135deg, #c0392b 0%, #e74c3c 50%, #c0392b 100%)", boxShadow: "0 4px 24px rgba(192,57,43,0.4)" }}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Đang đăng nhập...
            </span>
          ) : (
            "🏮 Đăng nhập"
          )}
        </button>

        {/* Divider */}
        <div className="relative flex items-center py-1">
          <div className="flex-grow border-t" style={{ borderColor: "rgba(255,255,255,0.08)" }} />
          <span className="mx-4 flex-shrink text-[11px] font-bold text-white/25">hoặc</span>
          <div className="flex-grow border-t" style={{ borderColor: "rgba(255,255,255,0.08)" }} />
        </div>

        {/* Google */}
        <button
          type="button"
          id="btn-login-google"
          onClick={handleGoogleLogin}
          className="flex h-12 w-full items-center justify-center gap-3 rounded-xl text-sm font-bold text-white/80 transition-all duration-200 hover:text-white hover:bg-white/10 active:scale-[0.98]"
          style={{ border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)" }}
        >
          <GoogleIcon />
          Đăng nhập với Google
        </button>

        {/* Switch */}
        <p className="pt-1 text-center text-[13px] font-semibold text-white/30">
          Chưa có tài khoản?{" "}
          <Link href="/register" className="font-black text-red-400 hover:text-red-300 transition">
            Đăng ký ngay →
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
