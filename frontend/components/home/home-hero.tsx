import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, FileText, MapPin, MessageSquareText, Mic, Sparkles } from "lucide-react";
import { featureStrip } from "./home-data";
import { homeIcons } from "./home-icons";

const proofPoints = [
  "Câu hỏi theo hồ sơ CSC, trường, ngành",
  "Luyện trả lời Trung / Việt / Anh",
  "Feedback sửa study plan và động lực apply"
] as const;

const cityBadges = ["北京", "上海", "杭州"] as const;

const sessionRows = [
  { icon: MessageSquareText, label: "中文面试", value: "Why this university?", tone: "primary" },
  { icon: FileText, label: "Study Plan", value: "Logic + examples", tone: "gold" },
  { icon: Mic, label: "Speaking", value: "Clarity feedback", tone: "jade" }
] as const;

export function HomeHero() {
  return (
    <section className="relative isolate min-h-[calc(100vh-4.5rem)] overflow-hidden border-b border-[#ead8c2] bg-[#17120f] text-white">
      <Image
        src="/home/hero-interview.png"
        alt="AI interview practice dashboard"
        fill
        priority
        sizes="100vw"
        className="object-cover object-[62%_center]"
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(23,18,15,0.92)_0%,rgba(23,18,15,0.76)_36%,rgba(23,18,15,0.26)_68%,rgba(23,18,15,0.08)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-32 bg-[linear-gradient(180deg,transparent,rgba(23,18,15,0.72))]" />

      <div className="relative z-10 mx-auto grid min-h-[calc(100vh-4.5rem)] max-w-7xl gap-10 px-5 py-12 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:py-16">
        <div className="max-w-3xl">
          <p className="inline-flex items-center gap-2 text-sm font-black uppercase tracking-wide text-[#e5a93b]">
            <Sparkles size={16} />
            中国留学面试 · AI phỏng vấn học bổng Trung Quốc
          </p>

          <h1 className="mt-5 max-w-3xl text-4xl font-black leading-tight sm:text-5xl lg:text-6xl">
            Luyện phỏng vấn du học Trung trước ngày nộp hồ sơ
          </h1>

          <p className="mt-5 max-w-2xl text-base font-semibold leading-8 text-white/78 sm:text-lg">
            Chuẩn bị câu trả lời cho học bổng CSC, trường Trung Quốc, study plan và phỏng vấn tiếng Trung trong một luồng luyện rõ ràng.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/register"
              className="inline-flex min-h-12 items-center gap-2 rounded-md bg-[#b81d24] px-5 text-sm font-black text-white shadow-lg shadow-red-950/25 transition hover:bg-[#961319]"
            >
              Tạo tài khoản miễn phí
              <ArrowRight size={17} />
            </Link>
            <Link
              href="/login"
              className="inline-flex min-h-12 items-center rounded-md border border-white/24 bg-white/10 px-5 text-sm font-black text-white backdrop-blur transition hover:border-[#e5a93b] hover:bg-white/15"
            >
              Đăng nhập để luyện tiếp
            </Link>
          </div>

          <ul className="mt-7 grid gap-3 text-sm font-bold text-white/82 sm:grid-cols-3">
            {proofPoints.map((point) => (
              <li key={point} className="flex gap-2">
                <Check className="mt-0.5 shrink-0 text-[#e5a93b]" size={17} />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>

        <ChinaStudyVisual />
      </div>

      <div className="relative z-10 border-t border-white/12 bg-[#17120f]/78 px-5 py-4 backdrop-blur-md sm:px-10 lg:px-16">
        <div className="grid gap-3 md:grid-cols-4">
          {featureStrip.map((item) => {
            const Icon = homeIcons[item.icon];
            return (
              <div key={item.title} className="flex items-center gap-3 rounded-lg border border-white/12 bg-white/9 px-4 py-3 shadow-sm">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#e5a93b] text-[#17120f]">
                  <Icon size={18} />
                </span>
                <div>
                  <p className="text-sm font-black text-white">{item.title}</p>
                  <p className="text-xs font-bold text-white/62">{item.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ChinaStudyVisual() {
  return (
    <div className="relative hidden min-h-[520px] lg:block">
      <div className="absolute right-0 top-4 flex gap-2">
        {cityBadges.map((city) => (
          <span key={city} className="rounded-md border border-[#e5a93b]/50 bg-[#b81d24] px-3 py-1 text-sm font-black text-[#fef3c7] shadow-lg shadow-red-950/20">
            {city}
          </span>
        ))}
      </div>

      <div className="absolute bottom-10 right-0 w-[430px] rounded-lg border border-white/18 bg-[#17120f]/76 p-5 shadow-2xl shadow-black/28 backdrop-blur-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-[#e5a93b]">Scholarship dossier</p>
            <h2 className="mt-2 text-3xl font-black">CSC 2026</h2>
            <p className="mt-2 text-sm font-bold leading-6 text-white/64">Campus interview · scholarship review</p>
          </div>
          <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-[#e5a93b]/45 bg-[#e5a93b] text-2xl font-black text-[#17120f]">
            留
          </div>
        </div>

        <div className="mt-5 grid gap-3">
          {sessionRows.map((row) => {
            const Icon = row.icon;
            const toneClass = row.tone === "gold" ? "bg-[#e5a93b] text-[#17120f]" : row.tone === "jade" ? "bg-[#2e7d32] text-white" : "bg-[#b81d24] text-white";
            return (
              <div key={row.label} className="flex min-h-16 items-center gap-3 rounded-lg border border-white/12 bg-white/10 px-4">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${toneClass}`}>
                  <Icon size={18} />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase text-white/52">{row.label}</p>
                  <p className="truncate text-sm font-black text-white">{row.value}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-5 rounded-lg border border-[#e5a93b]/30 bg-[#e5a93b]/12 p-4">
          <div className="flex items-center gap-2 text-xs font-black uppercase text-[#fef3c7]">
            <MapPin size={14} />
            Application route
          </div>
          <div className="mt-3 flex items-center justify-between text-sm font-black">
            <span>Việt Nam</span>
            <span className="h-px flex-1 bg-[#e5a93b]/42 mx-3" />
            <span>China</span>
          </div>
        </div>
      </div>
    </div>
  );
}
