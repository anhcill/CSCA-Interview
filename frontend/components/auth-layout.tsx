import type { ReactNode } from "react";
import { ArrowRight, CheckCircle, ClipboardCheck, Globe, GraduationCap, School, Sparkles, Star } from "lucide-react";
import Link from "next/link";

type AuthLayoutProps = {
  title: string;
  subtitle: string;
  mode: "login" | "register";
  children: ReactNode;
};

const footerFeatures = [
  {
    icon: GraduationCap,
    title: "Luyện phỏng vấn",
    desc: "Theo chuẩn học bổng"
  },
  {
    icon: ClipboardCheck,
    title: "Kiểm tra tiến độ",
    desc: "Theo từng giai đoạn"
  },
  {
    icon: Globe,
    title: "Chuẩn bị hồ sơ",
    desc: "Đầy đủ & khoa học"
  },
  {
    icon: School,
    title: "Đồng hành cùng bạn",
    desc: "Trên hành trình du học"
  }
];

function BrandLogo() {
  return (
    <Link href="/" className="inline-flex items-center gap-3 text-[19px] font-black text-slate-800">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white shadow-md shadow-blue-500/20">
        <GraduationCap size={22} />
      </div>
      <div className="flex flex-col text-left">
        <span className="font-extrabold tracking-tight leading-none text-slate-900">InterviewAI</span>
        <span className="mt-1 text-[9px] font-black uppercase tracking-widest text-slate-400">
          Du học tự tin - Tương lai rộng mở
        </span>
      </div>
    </Link>
  );
}

function AuthSwitch({ mode }: { mode: AuthLayoutProps["mode"] }) {
  const items = [
    { href: "/login", label: "Đăng nhập", value: "login" },
    { href: "/register", label: "Đăng ký", value: "register" }
  ] as const;

  return (
    <div className="grid rounded-xl border border-slate-200 bg-slate-50 p-1 text-sm font-black" style={{ gridTemplateColumns: "1fr 1fr" }}>
      {items.map((item) => {
        const active = mode === item.value;
        return (
          <Link
            key={item.value}
            href={item.href}
            className={`focus-ring inline-flex min-h-11 items-center justify-center rounded-lg px-3 transition ${active ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-900"}`}
            aria-current={active ? "page" : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}

function AuthHeroPanel({ mode }: { mode: AuthLayoutProps["mode"] }) {
  const isRegister = mode === "register";
  const steps = isRegister
    ? ["Lưu hồ sơ ứng viên", "Chọn trường, ngành, học bổng", "Tạo phòng luyện theo mục tiêu"]
    : ["Mở lại tiến độ luyện tập", "Tiếp tục buổi phỏng vấn còn dở", "Xem báo cáo và điểm yếu"];

  return (
    <aside className="relative flex h-full min-h-[520px] overflow-hidden rounded-3xl bg-[#0f2447] p-6 text-white">
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(37,99,235,0.32),rgba(15,36,71,0)_46%),radial-gradient(circle_at_78%_18%,rgba(20,184,166,0.32),transparent_30%)]" />
      <div className="relative z-10 flex w-full flex-col justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-black text-blue-100">
            <Sparkles size={14} />
            Interview-ready scholarship profile
          </div>
          <h2 className="mt-6 max-w-sm text-[32px] font-black leading-tight tracking-tight">
            Luyện trả lời sắc gọn, tự tin bước vào phỏng vấn.
          </h2>
          <p className="mt-4 max-w-sm text-sm font-semibold leading-7 text-blue-100">
            AI Phỏng Vấn giúp bạn biến hồ sơ du học thành câu trả lời có cấu trúc, có dẫn chứng, có điểm cải thiện rõ ràng.
          </p>
        </div>

        <div className="mt-6 space-y-3">
          {steps.map((step) => (
            <div key={step} className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-blue-700">
                <CheckCircle size={18} />
              </span>
              <span className="text-sm font-black text-white">{step}</span>
            </div>
          ))}
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3">
          {[
            ["50+", "câu hỏi"],
            ["3", "ngôn ngữ"],
            ["AI", "feedback"]
          ].map(([value, label]) => (
            <div key={label} className="rounded-2xl border border-white/15 bg-white/10 p-4">
              <p className="text-2xl font-black">{value}</p>
              <p className="mt-1 text-xs font-bold text-blue-100">{label}</p>
            </div>
          ))}
        </div>

        <Link
          href={isRegister ? "/login" : "/register"}
          className="focus-ring mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-black text-blue-700 transition hover:bg-blue-50"
        >
          {isRegister ? "Đã có tài khoản" : "Tạo hồ sơ mới"}
          <ArrowRight size={16} />
        </Link>
      </div>
    </aside>
  );
}

export function AuthLayout({ title, subtitle, mode, children }: AuthLayoutProps) {
  return (
    <main
      id="main-content"
      className="relative flex min-h-screen w-full flex-col items-center justify-start bg-[#f3f7fb] px-4 py-5 md:py-6"
    >
      <div className="grid w-full max-w-[1080px] grid-cols-1 items-stretch gap-6 rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_24px_70px_rgba(15,23,42,0.08)] md:grid-cols-12 md:p-6">
        <div className="flex flex-col justify-between py-2 md:col-span-7">
          <div className="flex w-full items-center justify-between gap-3 border-b border-slate-50 pb-5">
            <BrandLogo />
            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50/50 px-3 py-1 text-xs font-bold text-blue-600">
              <Star size={13} className="fill-blue-600 text-blue-600" />
              CSC 2026
            </span>
          </div>

          <div className="mt-5">
            <AuthSwitch mode={mode} />
            <h2 className="mt-4 text-[28px] font-black tracking-tight text-slate-900">{title}</h2>
            <div className="mt-2.5 h-1 w-12 rounded-full bg-blue-600" />
            <p className="mt-4 text-[14px] font-semibold leading-relaxed text-slate-500">{subtitle}</p>
          </div>

          <div className="mt-5 flex-1">{children}</div>
        </div>

        <div className="relative hidden md:col-span-5 md:block">
          <AuthHeroPanel mode={mode} />
        </div>
      </div>

      <div className="mt-8 grid w-full max-w-[1024px] grid-cols-2 gap-4 md:grid-cols-4">
        {footerFeatures.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.title}
              className="flex items-center gap-3 rounded-2xl border border-slate-100/80 bg-white/70 p-4 backdrop-blur-sm transition hover:bg-white hover:shadow-sm"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 shadow-sm shadow-blue-500/5">
                <Icon size={19} />
              </div>
              <div className="flex min-w-0 flex-col text-left">
                <span className="truncate text-[13px] font-bold leading-tight text-slate-800">{item.title}</span>
                <span className="mt-0.5 truncate text-[11px] font-medium text-slate-400">{item.desc}</span>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
