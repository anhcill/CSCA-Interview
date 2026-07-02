"use client";

import { Mail, Send } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { AuthLayout } from "@/components/auth-layout";
import { PasswordField } from "@/components/password-field";
import { loginAccount, saveAuthSession } from "@/lib/auth-client";

const fieldShell =
  "flex h-12 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 transition focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-100";
const fieldInput =
  "min-w-0 flex-1 appearance-none border-0 bg-transparent text-[15px] font-medium text-slate-800 outline-none placeholder:text-slate-400";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const errorQuery = searchParams.get("error");
    if (errorQuery) {
      if (errorQuery === "token_exchange_failed") {
        setError("Không thể trao đổi mã xác thực với Google.");
      } else if (errorQuery === "user_info_failed") {
        setError("Không thể lấy thông tin tài khoản từ Google.");
      } else if (errorQuery === "email_not_provided") {
        setError("Tài khoản Google của bạn không cung cấp Email.");
      } else if (errorQuery === "account_disabled") {
        setError("Tài khoản của bạn đã bị vô hiệu hóa.");
      } else {
        setError(`Lỗi xác thực Google: ${errorQuery}`);
      }
    }
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
      title="Đăng nhập hồ sơ"
      subtitle="Tiếp tục luyện phỏng vấn, kiểm tra tiến độ và chuẩn bị câu trả lời cho kỳ apply du học."
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="block">
          <span className={fieldShell}>
            <Mail size={18} className="text-blue-600" />
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={fieldInput}
              type="email"
              placeholder="Email đăng nhập"
              aria-label="Email đăng nhập"
              autoComplete="email"
              required
            />
          </span>
        </label>

        <PasswordField
          value={password}
          onChange={setPassword}
          placeholder="Mật khẩu"
          ariaLabel="Mật khẩu"
          autoComplete="current-password"
        />

        <div className="flex items-center justify-between gap-4 text-[13px] font-semibold">
          <label className="flex items-center gap-2 text-slate-500 cursor-pointer">
            <input
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              type="checkbox"
            />
            Ghi nhớ đăng nhập
          </label>
          <button type="button" className="text-blue-600 hover:text-blue-700">
            Quên mật khẩu?
          </button>
        </div>

        {error ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isLoading}
          className="h-12 w-full rounded-xl bg-blue-600 text-[15px] font-bold text-white shadow-md shadow-blue-500/10 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70 flex items-center justify-center gap-2"
        >
          <Send size={17} className="rotate-45" />
          {isLoading ? "Đang đăng nhập..." : "Đăng nhập"}
        </button>

        <div className="relative flex py-2 items-center">
          <div className="flex-grow border-t border-slate-100"></div>
          <span className="flex-shrink mx-4 text-xs font-semibold text-slate-400">hoặc</span>
          <div className="flex-grow border-t border-slate-100"></div>
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-[15px] font-bold text-slate-700 transition hover:bg-slate-50"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path
              fill="#EA4335"
              d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.136 4.114A5.89 5.89 0 0 1 8 12.628a5.89 5.89 0 0 1 5.99-5.89 5.75 5.75 0 0 1 3.96 1.543l3.14-3.14A10.15 10.15 0 0 0 13.99 3c-5.523 0-10 4.477-10 10s4.477 10 10 10c5.77 0 9.588-4.053 9.588-9.75 0-.663-.058-1.295-.168-1.965H12.24Z"
            />
          </svg>
          Đăng nhập với Google
        </button>

        <div className="text-center pt-2">
          <span className="text-[14px] font-semibold text-slate-500">
            Chưa có tài khoản?{" "}
            <Link href="/register" className="font-bold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1">
              Đăng ký ngay <span className="text-lg leading-none">→</span>
            </Link>
          </span>
        </div>
      </form>
    </AuthLayout>
  );
}
