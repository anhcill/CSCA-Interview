import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { guidePageStages, scholarshipFocus, steps } from "@/components/home/home-data";
import { MarketingFrame, MarketingIntro } from "@/components/home/marketing-frame";
import { createPageMetadata, getHowToStructuredData, getBreadcrumbStructuredData } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "Quy trình luyện | AI Phỏng Vấn Du Học",
  description: "Quy trình luyện phỏng vấn học bổng Trung Quốc từ hồ sơ apply đến báo cáo sau buổi luyện.",
  path: "/guide"
});

export default function GuidePage() {
  return (
    <MarketingFrame>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            getHowToStructuredData(
              "Luyện phỏng vấn học bổng Trung Quốc",
              "Quy trình luyện phỏng vấn học bổng Trung Quốc từ hồ sơ apply đến báo cáo sau buổi luyện.",
              steps
            )
          ).replace(/</g, "\\u003c")
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            getBreadcrumbStructuredData([
              { name: "Trang chủ", path: "/" },
              { name: "Quy trình luyện", path: "/guide" }
            ])
          ).replace(/</g, "\\u003c")
        }}
      />
      <MarketingIntro
        eyebrow="Quy trình luyện"
        title="Từ hồ sơ apply đến câu trả lời có thể dùng trong phỏng vấn"
        description="Luồng luyện được chia thành các bước rõ: chuẩn bị hồ sơ, tạo phòng phỏng vấn, trả lời theo mạch và đọc feedback để luyện lại phần yếu."
        primaryHref="/interview/setup"
        primaryLabel="Tạo phòng luyện"
      />

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="grid gap-4 lg:grid-cols-4">
          {steps.map((step) => (
            <article key={step.number} className="rounded-lg border border-[#dde5ef] bg-white p-5 shadow-sm">
              <span className="flex h-11 w-11 items-center justify-center rounded-md bg-[#f59e0b] text-sm font-black text-[#111827]">
                {step.number}
              </span>
              <h2 className="mt-5 text-lg font-black text-[#111827]">{step.title}</h2>
              <p className="mt-3 text-sm font-semibold leading-7 text-[#4b5563]">{step.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-[#dde5ef] bg-[#111827] py-16 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="max-w-3xl">
            <p className="text-sm font-black uppercase text-[#5eead4]">Từng bước chi tiết</p>
            <h2 className="mt-3 text-3xl font-black leading-tight sm:text-4xl">
              Mỗi bước đều có đầu ra rõ để biết đã chuẩn bị đủ chưa
            </h2>
          </div>

          <div className="mt-8 grid gap-4">
            {guidePageStages.map((stage) => (
              <article key={stage.number} className="grid gap-5 rounded-lg border border-white/12 bg-white/7 p-6 shadow-sm lg:grid-cols-[auto_0.8fr_1fr]">
                <span className="flex h-12 w-12 items-center justify-center rounded-md bg-[#f59e0b] text-sm font-black text-[#111827]">
                  {stage.number}
                </span>
                <div>
                  <h3 className="text-xl font-black text-white">{stage.title}</h3>
                  <p className="mt-3 text-sm font-semibold leading-7 text-[#cbd5e1]">{stage.description}</p>
                </div>
                <div className="rounded-lg border border-white/12 bg-black/14 p-4">
                  <p className="text-xs font-black uppercase text-[#fde68a]">Đầu ra · 输出</p>
                  <p className="mt-2 text-sm font-bold leading-7 text-white">{stage.output}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
          <div>
            <p className="text-sm font-black uppercase text-[#b91c1c]">Checklist nội dung · 准备</p>
            <h2 className="mt-3 text-3xl font-black leading-tight text-[#111827] sm:text-4xl">
              Những chủ đề nên luyện trước lịch phỏng vấn
            </h2>
            <p className="mt-4 text-sm font-semibold leading-7 text-[#4b5563] sm:text-base">
              Khi trả lời tốt các nhóm câu hỏi này, ứng viên thường nói rõ hơn về năng lực, lý do chọn trường và kế hoạch sau học bổng.
            </p>
            <Link
              href="/features"
              className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-md border border-[#b91c1c] bg-white px-4 text-sm font-black text-[#b91c1c] transition hover:bg-[#fff7ed]"
            >
              Xem tính năng hỗ trợ
              <ArrowRight size={16} />
            </Link>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {scholarshipFocus.map((item) => (
              <article key={item.title} className="rounded-lg border border-[#dde5ef] bg-white p-5 shadow-sm">
                <h3 className="text-lg font-black text-[#111827]">{item.title}</h3>
                <p className="mt-2 text-sm font-semibold leading-7 text-[#4b5563]">{item.description}</p>
                <p className="mt-4 flex gap-3 text-sm font-bold text-[#374151]">
                  <Check className="mt-0.5 shrink-0 text-[#b91c1c]" size={17} />
                  <span>Cần có ví dụ cụ thể và liên hệ với hồ sơ apply.</span>
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </MarketingFrame>
  );
}
