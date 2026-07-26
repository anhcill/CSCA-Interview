import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { faqs, pricing, pricingNotes } from "@/components/home/home-data";
import { MarketingFrame, MarketingIntro } from "@/components/home/marketing-frame";
import { createPageMetadata, getFAQStructuredData, getBreadcrumbStructuredData } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "Gói sử dụng | AI Phỏng Vấn Du Học",
  description: "Các gói sử dụng Moly Interview cho luyện phỏng vấn học bổng Trung Quốc.",
  path: "/pricing"
});

export default function PricingPage() {
  return (
    <MarketingFrame>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(getFAQStructuredData(faqs)).replace(/</g, "\\u003c")
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            getBreadcrumbStructuredData([
              { name: "Trang chủ", path: "/" },
              { name: "Gói sử dụng", path: "/pricing" }
            ])
          ).replace(/</g, "\\u003c")
        }}
      />
      <MarketingIntro
        eyebrow="Gói sử dụng"
        title="Chọn cách luyện phù hợp với giai đoạn apply hiện tại"
        description="Bắt đầu bằng gói miễn phí để thử phòng luyện. Khi cần luyện nhiều phiên, theo dõi lịch sử hoặc quản lý học viên, các gói nâng cao sẽ mở rộng theo nhu cầu."
      />

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="grid gap-5 lg:grid-cols-3">
          {pricing.map((plan) => (
            <article
              key={plan.name}
              className={`rounded-lg border p-6 shadow-sm ${
                plan.highlighted
                  ? "border-[#b91c1c] bg-[#b91c1c] text-white shadow-xl shadow-red-900/15"
                  : "border-[#dde5ef] bg-white text-[#172033]"
              }`}
            >
              <h2 className="text-xl font-black">{plan.name}</h2>
              <p className={`mt-2 text-sm font-semibold leading-6 ${plan.highlighted ? "text-white/82" : "text-[#4b5563]"}`}>
                {plan.description}
              </p>
              <p className="mt-6 text-3xl font-black">{plan.price}</p>
              <ul className="mt-6 space-y-3 text-sm font-bold">
                {plan.items.map((item) => (
                  <li key={item} className="flex gap-3">
                    <Check className={plan.highlighted ? "mt-0.5 shrink-0 text-white" : "mt-0.5 shrink-0 text-[#b91c1c]"} size={17} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <Link
                href={plan.name === "Trung tâm" ? "mailto:support@interviewai.vn" : "/register"}
                className={`mt-7 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md px-4 text-sm font-black transition ${
                  plan.highlighted
                    ? "bg-white text-[#7f1d1d] hover:bg-[#fff7ed]"
                    : "border border-[#b91c1c] bg-white text-[#b91c1c] hover:bg-[#fff7ed]"
                }`}
              >
                {plan.name === "Trung tâm" ? "Liên hệ tư vấn" : "Bắt đầu"}
                <ArrowRight size={16} />
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-[#dde5ef] bg-white py-16">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.82fr_1.18fr]">
          <div>
            <p className="text-sm font-black uppercase text-[#b91c1c]">Cách chọn gói · 套餐</p>
            <h2 className="mt-3 text-3xl font-black leading-tight text-[#111827] sm:text-4xl">
              Chọn theo tần suất luyện và mức cần theo dõi
            </h2>
            <p className="mt-4 text-sm font-semibold leading-7 text-[#4b5563] sm:text-base">
              Nếu mới thử sản phẩm, gói miễn phí là đủ. Nếu đang sát ngày phỏng vấn hoặc cần mentor theo dõi nhiều học viên, nên chọn gói có lịch sử và báo cáo sâu hơn.
            </p>
          </div>

          <div className="grid gap-4">
            {pricingNotes.map((note) => (
              <article key={note} className="rounded-lg border border-[#dde5ef] bg-[#f9fafb] p-5 shadow-sm">
                <p className="flex gap-3 text-sm font-bold leading-7 text-[#374151]">
                  <Check className="mt-1 shrink-0 text-[#b91c1c]" size={17} />
                  <span>{note}</span>
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="mb-8 max-w-3xl">
          <p className="text-sm font-black uppercase text-[#b91c1c]">Câu hỏi trước khi đăng ký · FAQ</p>
          <h2 className="mt-3 text-3xl font-black leading-tight text-[#111827] sm:text-4xl">Thông tin cần biết</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {faqs.map((faq) => (
            <article key={faq.question} className="rounded-lg border border-[#dde5ef] bg-white p-5 shadow-sm">
              <h3 className="text-base font-black text-[#111827]">{faq.question}</h3>
              <p className="mt-2 text-sm font-semibold leading-7 text-[#4b5563]">{faq.answer}</p>
            </article>
          ))}
        </div>
      </section>
    </MarketingFrame>
  );
}
