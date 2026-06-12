import Link from "next/link";
import { ArrowRight, Check, MapPin, Plane, Sparkles } from "lucide-react";
import { featureStrip } from "./home-data";
import { homeIcons } from "./home-icons";

const proofPoints = [
  "Câu hỏi theo hồ sơ CSC, trường, ngành",
  "Luyện trả lời Trung / Việt / Anh",
  "Feedback sửa study plan và động lực apply"
] as const;

const cityBadges = ["北京", "上海", "杭州"] as const;
const interviewBadges = ["CSC 奖学金", "中文面试", "Study Plan"] as const;

export function HomeHero() {
  return (
    <section className="relative isolate w-full overflow-hidden border-b border-[#ead8c2] bg-[#f8fafc]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_88%_10%,rgba(185,28,28,0.16),transparent_28rem),radial-gradient(circle_at_70%_70%,rgba(245,158,11,0.18),transparent_24rem),linear-gradient(135deg,#ffffff_0%,#f8fafc_48%,#fff7ed_100%)]" />
      <div className="absolute left-0 top-0 h-full w-full opacity-[0.07] [background-image:linear-gradient(45deg,#b91c1c_25%,transparent_25%,transparent_75%,#b91c1c_75%),linear-gradient(45deg,#b91c1c_25%,transparent_25%,transparent_75%,#b91c1c_75%)] [background-position:0_0,18px_18px] [background-size:36px_36px]" />

      <div className="relative z-10 mx-auto grid min-h-[620px] max-w-7xl gap-10 px-5 py-12 sm:px-6 lg:grid-cols-[0.92fr_1.08fr] lg:items-center lg:py-16">
        <div>
          <p className="inline-flex items-center gap-2 rounded-md border border-[#f1c36d] bg-white/86 px-3 py-2 text-sm font-black text-[#b91c1c] shadow-sm backdrop-blur">
            <Sparkles size={16} />
            中国留学面试 · AI phỏng vấn học bổng Trung Quốc
          </p>

          <h1 className="mt-5 max-w-3xl text-4xl font-black leading-tight text-[#111827] sm:text-5xl lg:text-6xl">
            Luyện phỏng vấn du học Trung trước ngày nộp hồ sơ
          </h1>

          <p className="mt-5 max-w-2xl text-base font-semibold leading-8 text-[#4b5563] sm:text-lg">
            Chuẩn bị câu trả lời cho học bổng CSC, trường Trung Quốc, study plan và phỏng vấn tiếng Trung trong một luồng luyện rõ ràng.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/register"
              className="inline-flex min-h-12 items-center gap-2 rounded-md bg-[#b91c1c] px-5 text-sm font-black text-white shadow-lg shadow-red-900/15 transition hover:bg-[#991b1b]"
            >
              Tạo tài khoản miễn phí
              <ArrowRight size={17} />
            </Link>
            <Link
              href="/login"
              className="inline-flex min-h-12 items-center rounded-md border border-[#f1c36d] bg-white/86 px-5 text-sm font-black text-[#172033] shadow-sm backdrop-blur transition hover:border-[#b91c1c]"
            >
              Đăng nhập để luyện tiếp
            </Link>
          </div>

          <ul className="mt-7 grid gap-3 text-sm font-bold text-[#374151] sm:grid-cols-3">
            {proofPoints.map((point) => (
              <li key={point} className="flex gap-2">
                <Check className="mt-0.5 shrink-0 text-[#b91c1c]" size={17} />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>

        <ChinaStudyVisual />
      </div>

      <div className="relative z-10 border-t border-[#dde5ef] bg-white/88 px-5 py-4 backdrop-blur-md sm:px-10 lg:px-16">
        <div className="grid gap-3 md:grid-cols-4">
          {featureStrip.map((item) => {
            const Icon = homeIcons[item.icon];
            return (
              <div key={item.title} className="flex items-center gap-3 rounded-lg border border-[#dde5ef] bg-white px-4 py-3 shadow-sm">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#fff7ed] text-[#b91c1c]">
                  <Icon size={18} />
                </span>
                <div>
                  <p className="text-sm font-black text-[#111827]">{item.title}</p>
                  <p className="text-xs font-bold text-[#6b7280]">{item.description}</p>
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
    <div className="relative min-h-[430px] overflow-hidden rounded-lg border border-[#f1c36d] bg-white p-5 shadow-2xl shadow-red-950/10 lg:min-h-[500px]">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#fff7ed_0%,#ffffff_45%,#eff6ff_100%)]" />
      <div className="absolute right-5 top-5 flex flex-wrap justify-end gap-2">
        {cityBadges.map((city) => (
          <span key={city} className="rounded-md bg-[#b91c1c] px-3 py-1 text-sm font-black text-[#fde68a] shadow-sm">
            {city}
          </span>
        ))}
      </div>

      <div className="absolute left-5 top-6 rounded-lg border border-[#f1c36d] bg-white/88 p-4 shadow-sm backdrop-blur">
        <p className="text-xs font-black uppercase text-[#b91c1c]">Application route</p>
        <div className="mt-3 flex items-center gap-3 text-sm font-black text-[#111827]">
          <span>Việt Nam</span>
          <Plane size={17} className="text-[#b91c1c]" />
          <span>China</span>
        </div>
        <p className="mt-2 flex items-center gap-2 text-xs font-bold text-[#6b7280]">
          <MapPin size={14} className="text-[#d97706]" />
          campus interview · scholarship review
        </p>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-44 bg-[linear-gradient(180deg,transparent_0%,rgba(17,24,39,0.08)_100%)]" />
      <div className="absolute bottom-20 left-1/2 h-24 w-56 -translate-x-1/2 border-x-4 border-[#b91c1c] bg-[#fff7ed] shadow-md">
        <div className="absolute -top-9 left-1/2 h-0 w-0 -translate-x-1/2 border-x-[120px] border-b-[36px] border-x-transparent border-b-[#b91c1c]" />
        <div className="absolute -top-4 left-1/2 h-0 w-0 -translate-x-1/2 border-x-[90px] border-b-[26px] border-x-transparent border-b-[#f59e0b]" />
        <div className="absolute left-7 top-8 h-16 w-10 rounded-t-full bg-[#111827]" />
        <div className="absolute left-24 top-8 h-16 w-10 rounded-t-full bg-[#111827]" />
        <div className="absolute right-7 top-8 h-16 w-10 rounded-t-full bg-[#111827]" />
      </div>

      <div className="absolute bottom-10 left-8 rounded-lg border border-[#e5e7eb] bg-white p-4 shadow-lg">
        <p className="text-xs font-black uppercase text-[#b91c1c]">面试题</p>
        <p className="mt-2 max-w-[170px] text-sm font-black leading-5 text-[#111827]">Why this university and major?</p>
        <div className="mt-3 h-2 w-32 rounded-full bg-[#fee2e2]" />
        <div className="mt-2 h-2 w-24 rounded-full bg-[#fde68a]" />
      </div>

      <div className="absolute bottom-12 right-7 w-52 rounded-lg border border-[#f1c36d] bg-[#b91c1c] p-4 text-white shadow-xl shadow-red-950/20">
        <p className="text-xs font-black uppercase text-[#fde68a]">Scholarship dossier</p>
        <p className="mt-2 text-2xl font-black">CSC 2026</p>
        <div className="mt-4 grid gap-2">
          {interviewBadges.map((item) => (
            <span key={item} className="rounded-md bg-white/12 px-3 py-2 text-xs font-black">
              {item}
            </span>
          ))}
        </div>
      </div>

      <div className="absolute left-1/2 top-1/2 flex h-24 w-24 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 border-[#f1c36d] bg-white/86 text-center text-lg font-black leading-6 text-[#b91c1c] shadow-lg">
        留学
        <br />
        面试
      </div>
    </div>
  );
}
