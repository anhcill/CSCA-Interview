import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { detailFeatures, featurePageGroups, interviewPreview } from "@/components/home/home-data";
import { homeIcons } from "@/components/home/home-icons";
import { MarketingFrame, MarketingIntro } from "@/components/home/marketing-frame";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "Tính năng | AI Phỏng Vấn Du Học",
  description: "Chi tiết tính năng luyện phỏng vấn học bổng Trung Quốc bằng AI.",
  path: "/features"
});

export default function FeaturesPage() {
  return (
    <MarketingFrame>
      <MarketingIntro
        eyebrow="Tính năng"
        title="Mọi phần trong buổi luyện đều bám theo hồ sơ apply thật"
        description="InterviewAI tập trung vào phỏng vấn học bổng Trung Quốc: tạo câu hỏi theo hồ sơ, luyện theo mạch vấn đáp và trả feedback đủ cụ thể để sửa câu trả lời."
      />

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {detailFeatures.map((feature) => {
            const Icon = homeIcons[feature.icon];
            return (
              <article key={feature.title} className="rounded-lg border border-[#dde5ef] bg-white p-5 shadow-sm">
                <span className="flex h-11 w-11 items-center justify-center rounded-md bg-[#fff7ed] text-[#b91c1c]">
                  <Icon size={22} />
                </span>
                <h2 className="mt-5 text-lg font-black text-[#111827]">{feature.title}</h2>
                <p className="mt-3 text-sm font-semibold leading-7 text-[#4b5563]">{feature.description}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="border-y border-[#dde5ef] bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="max-w-3xl">
            <p className="text-sm font-black uppercase text-[#b91c1c]">Chi tiết hệ thống · 功能</p>
            <h2 className="mt-3 text-3xl font-black leading-tight text-[#111827] sm:text-4xl">
              Ba lớp tính năng chính giúp buổi luyện sát với phỏng vấn thật
            </h2>
          </div>

          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            {featurePageGroups.map((group) => (
              <article key={group.title} className="rounded-lg border border-[#dde5ef] bg-[#f9fafb] p-6 shadow-sm">
                <h3 className="text-xl font-black text-[#111827]">{group.title}</h3>
                <p className="mt-3 text-sm font-semibold leading-7 text-[#4b5563]">{group.description}</p>
                <ul className="mt-5 space-y-3 text-sm font-bold text-[#374151]">
                  {group.items.map((item) => (
                    <li key={item} className="flex gap-3">
                      <Check className="mt-0.5 shrink-0 text-[#b91c1c]" size={17} />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-[0.78fr_1.22fr] lg:items-start">
          <div>
            <p className="text-sm font-black uppercase text-[#b91c1c]">Luồng feedback · 反馈</p>
            <h2 className="mt-3 text-3xl font-black leading-tight text-[#111827] sm:text-4xl">
              Không dừng ở điểm số
            </h2>
            <p className="mt-4 text-sm font-semibold leading-7 text-[#4b5563] sm:text-base">
              Sau mỗi buổi luyện, người học cần biết câu trả lời thiếu ví dụ, thiếu cấu trúc hay thiếu liên hệ với học bổng. Vì vậy feedback được tách thành phần có thể sửa ngay.
            </p>
            <Link
              href="/guide"
              className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-md border border-[#b91c1c] bg-white px-4 text-sm font-black text-[#b91c1c] transition hover:bg-[#fff7ed]"
            >
              Xem quy trình luyện
              <ArrowRight size={16} />
            </Link>
          </div>

          <div className="grid gap-4">
            {interviewPreview.map((item) => (
              <article key={item.label} className="rounded-lg border border-[#dde5ef] bg-white p-5 shadow-sm">
                <p className="text-xs font-black uppercase text-[#2563eb]">{item.label}</p>
                <h3 className="mt-2 text-lg font-black text-[#111827]">{item.title}</h3>
                <p className="mt-2 text-sm font-semibold leading-7 text-[#4b5563]">{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </MarketingFrame>
  );
}
