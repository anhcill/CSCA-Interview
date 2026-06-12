"use client";

import { Mail, Phone, User, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import Link from "next/link";
import { AuthLayout } from "@/components/auth-layout";
import { PasswordField } from "@/components/password-field";
import { registerAccount, saveAuthSession } from "@/lib/auth-client";

const fieldShell =
  "flex h-11 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 transition focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-100";
const fieldInput =
  "min-w-0 flex-1 appearance-none border-0 bg-transparent text-[15px] font-medium text-slate-800 outline-none placeholder:text-slate-400";

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

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
      title="Tạo hồ sơ apply"
      subtitle="Đăng ký tài khoản để lưu thông tin ứng viên và bắt đầu luyện phỏng vấn theo mục tiêu du học."
    >
      <form className="space-y-3" onSubmit={handleSubmit}>
        <label className="block">
          <span className={fieldShell}>
            <User size={18} className="text-blue-600" />
            <input
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              className={fieldInput}
              placeholder="Họ và tên"
              aria-label="Họ và tên"
              autoComplete="name"
              required
            />
          </span>
        </label>

        <label className="block">
          <span className={fieldShell}>
            <Mail size={18} className="text-blue-600" />
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={fieldInput}
              type="email"
              placeholder="Email"
              aria-label="Email"
              autoComplete="email"
              required
            />
          </span>
        </label>

        <label className="block">
          <span className={fieldShell}>
            <Phone size={18} className="text-blue-600" />
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className={fieldInput}
              placeholder="Số điện thoại (không bắt buộc)"
              aria-label="Số điện thoại"
              autoComplete="tel"
            />
          </span>
        </label>

        <PasswordField
          value={password}
          onChange={setPassword}
          placeholder="Mật khẩu"
          ariaLabel="Mật khẩu"
          autoComplete="new-password"
          compact
        />

        <PasswordField
          value={confirmPassword}
          onChange={setConfirmPassword}
          placeholder="Xác nhận mật khẩu"
          ariaLabel="Xác nhận mật khẩu"
          autoComplete="new-password"
          compact
        />

        <label className="flex items-start gap-2 text-[12px] font-semibold leading-5 text-slate-500 cursor-pointer">
          <input
            checked={acceptedTerms}
            onChange={(event) => setAcceptedTerms(event.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            type="checkbox"
          />
          <span>
            Tôi đồng ý với{" "}
            <a href="/terms" className="text-blue-600 hover:text-blue-700 font-bold">
              Điều khoản
            </a>{" "}
            &{" "}
            <a href="/privacy" className="text-blue-600 hover:text-blue-700 font-bold">
              Chính sách bảo mật
            </a>
          </span>
        </label>

        {error ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isLoading}
          className="h-11 w-full rounded-xl bg-blue-600 text-[15px] font-bold text-white shadow-md shadow-blue-500/10 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70 flex items-center justify-center gap-2"
        >
          <Send size={17} className="rotate-45" />
          {isLoading ? "Đang đăng ký..." : "Đăng ký"}
        </button>

        <div className="relative flex py-1.5 items-center">
          <div className="flex-grow border-t border-slate-100"></div>
          <span className="flex-shrink mx-4 text-xs font-semibold text-slate-400">hoặc</span>
          <div className="flex-grow border-t border-slate-100"></div>
        </div>

        <button
          type="button"
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-[15px] font-bold text-slate-700 transition hover:bg-slate-50"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path
              fill="#EA4335"
              d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.136 4.114A5.89 5.89 0 0 1 8 12.628a5.89 5.89 0 0 1 5.99-5.89 5.75 5.75 0 0 1 3.96 1.543l3.14-3.14A10.15 10.15 0 0 0 13.99 3c-5.523 0-10 4.477-10 10s4.477 10 10 10c5.77 0 9.588-4.053 9.588-9.75 0-.663-.058-1.295-.168-1.965H12.24Z"
            />
          </svg>
          Đăng ký với Google
        </button>

        <div className="text-center pt-2">
          <span className="text-[14px] font-semibold text-slate-500">
            Đã có tài khoản?{" "}
            <Link href="/login" className="font-bold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1">
              Đăng nhập ngay <span className="text-lg leading-none">→</span>
            </Link>
          </span>
        </div>
      </form>
    </AuthLayout>
  );
}
