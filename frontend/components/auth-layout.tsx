"use client";

import type { ReactNode } from "react";
import Link from "next/link";

type AuthLayoutProps = {
  title: string;
  subtitle: string;
  mode: "login" | "register";
  children: ReactNode;
};

const STATS = [
  { value: "500+", label: "Câu hỏi phỏng vấn" },
  { value: "CSC", label: "Học bổng Chính phủ" },
  { value: "AI", label: "Chấm điểm thông minh" },
];

const STEPS_LOGIN = [
  "Tiếp tục buổi luyện tập còn dở",
  "Xem báo cáo điểm mạnh & điểm yếu",
  "Theo dõi tiến độ apply học bổng",
];
const STEPS_REGISTER = [
  "Lưu hồ sơ & mục tiêu du học của bạn",
  "Luyện phỏng vấn theo chuẩn CSC/HSK",
  "Nhận phản hồi AI chi tiết từng câu",
];

function HeroPanel({ mode }: { mode: "login" | "register" }) {
  const steps = mode === "login" ? STEPS_LOGIN : STEPS_REGISTER;
  return (
    <aside className="relative flex flex-col justify-between overflow-hidden rounded-2xl p-8 min-h-[540px]"
      style={{ background: "linear-gradient(145deg, #1a0a0a 0%, #3d0f0f 40%, #1a0a0a 100%)" }}>
      {/* Decorative pattern */}
      <div className="pointer-events-none absolute inset-0 opacity-10"
        style={{ backgroundImage: "radial-gradient(circle at 20% 80%, #c0392b 0%, transparent 50%), radial-gradient(circle at 80% 20%, #f0a500 0%, transparent 40%)" }} />

      {/* Chinese decorative characters */}
      <div className="pointer-events-none absolute right-6 top-6 text-[120px] font-black leading-none text-white opacity-[0.04] select-none">
        学
      </div>
      <div className="pointer-events-none absolute bottom-10 left-4 text-[80px] font-black leading-none text-red-500 opacity-[0.06] select-none">
        留
      </div>

      {/* Header */}
      <div className="relative z-10">
        <div className="inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-300 backdrop-blur">
          <span className="text-base">🏮</span>
          Phỏng vấn Du học Trung Quốc
        </div>

        <h2 className="mt-6 text-3xl font-black leading-tight tracking-tight text-white">
          Tự tin bước vào<br />
          <span style={{ background: "linear-gradient(90deg, #f0a500, #e74c3c)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            phỏng vấn học bổng
          </span>
        </h2>

        <p className="mt-3 text-sm font-medium leading-relaxed text-red-100/70">
          Luyện tập với AI theo đúng chuẩn hội đồng tuyển sinh Trung Quốc.
          Câu trả lời sắc gọn — điểm số ấn tượng.
        </p>
      </div>

      {/* Steps */}
      <div className="relative z-10 mt-6 space-y-2.5">
        {steps.map((step, i) => (
          <div key={step} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-black text-white"
              style={{ background: "linear-gradient(135deg, #c0392b, #e74c3c)" }}>
              {i + 1}
            </span>
            <span className="text-sm font-semibold text-white/90">{step}</span>
          </div>
        ))}
      </div>

      {/* Stats */}
      <div className="relative z-10 mt-6 grid grid-cols-3 gap-2">
        {STATS.map(({ value, label }) => (
          <div key={label} className="rounded-xl border border-white/10 bg-white/5 p-3 text-center backdrop-blur">
            <p className="text-xl font-black text-white">{value}</p>
            <p className="mt-0.5 text-[10px] font-semibold text-red-200/70">{label}</p>
          </div>
        ))}
      </div>

      {/* Bottom CTA */}
      <Link
        href={mode === "login" ? "/register" : "/login"}
        className="relative z-10 mt-6 inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 py-3 text-sm font-bold text-white backdrop-blur transition hover:bg-white/20"
      >
        {mode === "login" ? "Chưa có tài khoản? Đăng ký ngay" : "Đã có tài khoản? Đăng nhập"}
        <span>→</span>
      </Link>
    </aside>
  );
}

export function AuthLayout({ title, subtitle, mode, children }: AuthLayoutProps) {
  return (
    <main
      id="main-content"
      className="relative flex min-h-screen w-full flex-col items-center justify-center px-4 py-8"
      style={{ background: "linear-gradient(135deg, #0d1117 0%, #1a0a0a 50%, #0d1117 100%)" }}
    >
      {/* Background glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/4 h-80 w-80 rounded-full bg-red-800/20 blur-[100px]" />
        <div className="absolute -bottom-20 right-1/4 h-60 w-60 rounded-full bg-yellow-800/10 blur-[80px]" />
      </div>

      {/* Card */}
      <div className="relative z-10 grid w-full max-w-[1040px] grid-cols-1 gap-0 overflow-hidden rounded-2xl shadow-2xl md:grid-cols-2"
        style={{ border: "1px solid rgba(192,57,43,0.2)", background: "rgba(15,10,10,0.85)", backdropFilter: "blur(20px)" }}>

        {/* Left: Form panel */}
        <div className="flex flex-col justify-center px-8 py-10 md:px-10">
          {/* Logo */}
          <Link href="/" className="inline-flex items-center gap-3 self-start">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl text-white text-lg font-black shadow-lg"
              style={{ background: "linear-gradient(135deg, #c0392b, #e74c3c)" }}>
              面
            </div>
            <div>
              <p className="text-[16px] font-black tracking-tight text-white">MolyInterview</p>
              <p className="text-[9px] font-bold uppercase tracking-widest text-red-400/70">Du học Trung Quốc · AI</p>
            </div>
          </Link>

          {/* Tab switch */}
          <div className="mt-8 grid grid-cols-2 rounded-xl p-1 text-sm font-bold"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
            {(["login", "register"] as const).map((m) => (
              <Link
                key={m}
                href={m === "login" ? "/login" : "/register"}
                className={`flex items-center justify-center rounded-lg py-2.5 transition-all duration-200 ${
                  mode === m
                    ? "text-white shadow-md font-black"
                    : "text-white/40 hover:text-white/70"
                }`}
                style={mode === m ? { background: "linear-gradient(135deg, #c0392b, #e74c3c)" } : {}}
              >
                {m === "login" ? "Đăng nhập" : "Đăng ký"}
              </Link>
            ))}
          </div>

          {/* Heading */}
          <div className="mt-7">
            <h1 className="text-2xl font-black tracking-tight text-white">{title}</h1>
            <div className="mt-2 h-1 w-10 rounded-full" style={{ background: "linear-gradient(90deg, #c0392b, #f0a500)" }} />
            <p className="mt-3 text-sm font-medium leading-relaxed text-white/50">{subtitle}</p>
          </div>

          {/* Form */}
          <div className="mt-6">{children}</div>
        </div>

        {/* Right: Hero panel */}
        <div className="hidden md:block">
          <HeroPanel mode={mode} />
        </div>
      </div>

      {/* Footer note */}
      <p className="relative z-10 mt-6 text-center text-xs font-medium text-white/20">
        © 2025 MolyInterview · Nền tảng luyện phỏng vấn du học Trung Quốc
      </p>
    </main>
  );
}
