"use client";

import { Mail, Phone, User } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { AuthLayout } from "@/components/auth-layout";
import { PasswordField } from "@/components/password-field";
import { registerAccount, saveAuthSession } from "@/lib/auth-client";

const inputWrap =
  "flex h-11 items-center gap-3 rounded-xl px-4 transition-all duration-200 focus-within:ring-2 focus-within:ring-red-500/40";
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

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
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
    setError(messages[errorQuery] ?? `Lỗi đăng ký Google: ${errorQuery}`);
  }, [searchParams]);

  const handleGoogleRegister = () => {
    if (!acceptedTerms) return;
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4010";
    window.location.href = `${apiBaseUrl}/api/auth/google`;
  };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Mật khẩu xác nhận chưa khớp");
      return;
    }
    if (!acceptedTerms) {
      setError("Bạn cần đồng ý với điều khoản và chính sách bảo mật");
      return;
    }
    setIsLoading(true);
    try {
      const data = await registerAccount({ fullName, email, phone, password });
      saveAuthSession(data);
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tạo tài khoản");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AuthLayout
      mode="register"
      title="Bắt đầu hành trình"
      subtitle="Đăng ký để lưu hồ sơ và luyện phỏng vấn theo chuẩn học bổng Chính phủ Trung Quốc (CSC)."
    >
      <form className="space-y-2.5" onSubmit={handleSubmit}>
        {/* Full name */}
        <label className="block">
          <span className={inputWrap} style={inputStyle}>
            <User size={16} className="shrink-0 text-red-400" />
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className={inputBase}
              placeholder="Họ và tên"
              aria-label="Họ và tên"
              autoComplete="name"
              required
            />
          </span>
        </label>

        {/* Email */}
        <label className="block">
          <span className={inputWrap} style={inputStyle}>
            <Mail size={16} className="shrink-0 text-red-400" />
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputBase}
              type="email"
              placeholder="Email"
              aria-label="Email"
              autoComplete="email"
              required
            />
          </span>
        </label>

        {/* Phone */}
        <label className="block">
          <span className={inputWrap} style={inputStyle}>
            <Phone size={16} className="shrink-0 text-red-400" />
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={inputBase}
              placeholder="Số điện thoại (tuỳ chọn)"
              aria-label="Số điện thoại"
              autoComplete="tel"
            />
          </span>
        </label>

        {/* Password */}
        <PasswordField
          value={password}
          onChange={setPassword}
          placeholder="Mật khẩu"
          ariaLabel="Mật khẩu"
          autoComplete="new-password"
          compact
          darkMode
        />

        {/* Confirm password */}
        <PasswordField
          value={confirmPassword}
          onChange={setConfirmPassword}
          placeholder="Xác nhận mật khẩu"
          ariaLabel="Xác nhận mật khẩu"
          autoComplete="new-password"
          compact
          darkMode
        />

        {/* Terms */}
        <label className="flex cursor-pointer items-start gap-2.5 pt-0.5 text-[12px] font-semibold leading-5 text-white/40">
          <input
            checked={acceptedTerms}
            onChange={(e) => setAcceptedTerms(e.target.checked)}
            className="mt-0.5 h-3.5 w-3.5 accent-red-500 cursor-pointer"
            type="checkbox"
          />
          <span>
            Tôi đồng ý với{" "}
            <Link href="/terms" target="_blank" className="text-red-400 hover:text-red-300 transition underline">Điều khoản</Link>{" "}&amp;{" "}
            <Link href="/privacy" target="_blank" className="text-red-400 hover:text-red-300 transition underline">Chính sách bảo mật</Link>
          </span>
        </label>

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-xs font-semibold text-red-300">
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          id="btn-register-submit"
          disabled={isLoading || !acceptedTerms}
          className="h-12 w-full rounded-xl text-sm font-black text-white transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-40 hover:opacity-90 active:scale-[0.98]"
          style={{ background: "linear-gradient(135deg, #c0392b 0%, #e74c3c 50%, #c0392b 100%)", boxShadow: acceptedTerms ? "0 4px 24px rgba(192,57,43,0.4)" : "none" }}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Đang đăng ký...
            </span>
          ) : "🏮 Tạo tài khoản"}
        </button>

        {/* Divider */}
        <div className="relative flex items-center py-0.5">
          <div className="flex-grow border-t" style={{ borderColor: "rgba(255,255,255,0.08)" }} />
          <span className="mx-4 flex-shrink text-[11px] font-bold text-white/25">hoặc</span>
          <div className="flex-grow border-t" style={{ borderColor: "rgba(255,255,255,0.08)" }} />
        </div>

        {/* Google */}
        <button
          type="button"
          id="btn-register-google"
          disabled={isLoading || !acceptedTerms}
          onClick={handleGoogleRegister}
          className="flex h-11 w-full items-center justify-center gap-3 rounded-xl text-sm font-bold text-white/80 transition-all duration-200 hover:text-white hover:bg-white/10 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          style={{ border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)" }}
        >
          <GoogleIcon />
          Đăng ký với Google
        </button>

        {/* Switch */}
        <p className="pt-1 text-center text-[13px] font-semibold text-white/30">
          Đã có tài khoản?{" "}
          <Link href="/login" className="font-black text-red-400 hover:text-red-300 transition">
            Đăng nhập →
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
