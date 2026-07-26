import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import {
  audienceCards,
  chinaPathCards,
  detailFeatures,
  faqs,
  interviewPreview,
  pricing,
  scholarshipFocus,
  stats,
  steps
} from "./home-data";
import { homeIcons } from "./home-icons";
import { getFAQStructuredData } from "@/lib/seo";

export function StatsSection() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((item) => (
          <div key={item.label} className="rounded-lg border border-[#dde5ef] bg-white px-6 py-6 shadow-sm">
            <p className="text-4xl font-black text-[#b91c1c]">{item.value}</p>
            <p className="mt-2 text-sm font-bold leading-6 text-[#4b5563]">{item.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ChinaPathSection() {
  return (
    <section className="border-y border-[#ead8c2] bg-white py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-[0.78fr_1.22fr] lg:items-start">
          <div>
            <p className="text-sm font-black uppercase text-[#b91c1c]">Du học Trung Quốc</p>
            <h2 className="mt-3 text-3xl font-black leading-tight text-[#111827] sm:text-4xl">
              Không chỉ là luyện phỏng vấn, mà là luyện đúng bối cảnh nộp hồ sơ Trung Quốc
            </h2>
            <p className="mt-4 text-sm font-semibold leading-7 text-[#4b5563] sm:text-base">
              Giao diện mới đặt người học vào mạch chọn trường, xin học bổng và vấn đáp tiếng Trung, thay vì cảm giác một web luyện phỏng vấn chung chung.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {chinaPathCards.map((card) => (
              <article key={card.label} className="rounded-lg border border-[#ead8c2] bg-[#fffaf5] p-5 shadow-sm">
                <span className="inline-flex rounded-md bg-[#b91c1c] px-3 py-2 text-lg font-black text-[#fde68a]">
                  {card.label}
                </span>
                <h3 className="mt-5 text-lg font-black text-[#111827]">{card.title}</h3>
                <p className="mt-3 text-sm font-semibold leading-7 text-[#4b5563]">{card.description}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {card.tags.map((tag) => (
                    <span key={tag} className="rounded-md border border-[#f1c36d] bg-white px-3 py-1 text-xs font-black text-[#7f1d1d]">
                      {tag}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function AudienceSection() {
  return (
    <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6">
      <SectionHeading
        eyebrow="Dành cho ai"
        title="Mỗi nhóm ứng viên có một cách luyện khác nhau"
        description="Trang chủ không chỉ giới thiệu tính năng. Các khối dưới đây giúp người học nhìn ngay mình nên bắt đầu từ đâu."
      />

      <div className="mt-8 grid gap-5 lg:grid-cols-3">
        {audienceCards.map((card) => {
          const Icon = homeIcons[card.icon];
          return (
            <article key={card.title} className="rounded-lg border border-[#dde5ef] bg-white p-6 shadow-sm">
              <span className="flex h-12 w-12 items-center justify-center rounded-md bg-[#fff7ed] text-[#b91c1c]">
                <Icon size={22} />
              </span>
              <h3 className="mt-5 text-xl font-black text-[#111827]">{card.title}</h3>
              <p className="mt-3 text-sm font-semibold leading-7 text-[#4b5563]">{card.description}</p>
              <ul className="mt-5 space-y-3 text-sm font-bold text-[#374151]">
                {card.bullets.map((item) => (
                  <li key={item} className="flex gap-3">
                    <Check className="mt-0.5 shrink-0 text-[#b91c1c]" size={17} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function DetailFeaturesSection() {
  return (
    <section id="features" className="border-y border-[#dde5ef] bg-white py-14">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="Tính năng chính"
          title="Một phòng luyện phỏng vấn đúng ngữ cảnh nộp hồ sơ"
          description="Giao diện được thiết kế cho ứng viên cần luyện vấn đáp học bổng: rõ câu hỏi, rõ phản hồi, rõ bước tiếp theo."
        />

        <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {detailFeatures.map((feature) => {
            const Icon = homeIcons[feature.icon];
            return (
              <article key={feature.title} className="rounded-lg border border-[#dde5ef] bg-[#f9fafb] p-5 shadow-sm">
                <span className="flex h-11 w-11 items-center justify-center rounded-md bg-[#fff7ed] text-[#b91c1c]">
                  <Icon size={22} />
                </span>
                <h3 className="mt-5 text-lg font-black text-[#111827]">{feature.title}</h3>
                <p className="mt-3 text-sm font-semibold leading-7 text-[#4b5563]">{feature.description}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function InterviewPreviewSection() {
  return (
    <section className="bg-[#f6f8fb] py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-[0.86fr_1.14fr] lg:items-start">
          <SectionHeading
            eyebrow="Trong một buổi luyện"
            title="Từng bước đều có thông tin cụ thể để bạn biết mình đang sửa gì"
            description="Luồng luyện được tách rõ trước, trong và sau buổi phỏng vấn để tránh cảm giác chỉ nói chuyện với AI rồi không biết cải thiện ở đâu."
            compact
          />

          <div className="grid gap-4">
            {interviewPreview.map((item) => (
              <article key={item.label} className="rounded-lg border border-[#dde5ef] bg-white p-5 shadow-sm">
                <p className="text-xs font-black uppercase text-[#2563eb]">{item.label}</p>
                <h3 className="mt-2 text-lg font-black text-[#111827]">{item.title}</h3>
                <p className="mt-2 text-sm font-semibold leading-7 text-[#4b5563]">{item.description}</p>
                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  {item.items.map((point) => (
                    <span key={point} className="rounded-md border border-[#dde5ef] bg-[#f9fafb] px-3 py-2 text-xs font-black leading-5 text-[#374151]">
                      {point}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function GuideSection() {
  return (
    <section id="guide" className="bg-[#111827] py-16 text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.82fr_1.18fr]">
        <div>
          <p className="text-sm font-black uppercase text-[#fde68a]">Quy trình luyện</p>
          <h2 className="mt-3 text-3xl font-black leading-tight sm:text-4xl">
            Từ hồ sơ nộp đến câu trả lời sẵn sàng dùng
          </h2>
          <p className="mt-4 text-base font-semibold leading-8 text-[#cbd5e1]">
            Không cần tự đoán câu hỏi. Bạn đi theo một luồng rõ ràng: nhập mục tiêu, vào phòng luyện, nhận phản hồi và luyện lại phần yếu.
          </p>
        </div>

        <div className="grid gap-4">
          {steps.map((step) => (
            <article key={step.number} className="grid gap-4 rounded-lg border border-white/12 bg-white/7 p-5 shadow-sm sm:grid-cols-[auto_1fr]">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-[#f59e0b] text-sm font-black text-[#111827]">
                {step.number}
              </span>
              <div>
                <h3 className="text-lg font-black text-white">{step.title}</h3>
                <p className="mt-2 text-sm font-semibold leading-7 text-[#cbd5e1]">{step.description}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ScholarshipFocusSection() {
  return (
    <section className="border-y border-[#dde5ef] bg-white py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <SectionHeading
            eyebrow="Nội dung cần chuẩn bị"
            title="Tập trung vào những phần hội đồng thường hỏi"
            description="Các chủ đề này giúp câu trả lời bám sát học bổng Trung Quốc, thay vì chỉ luyện câu hỏi phỏng vấn chung chung."
            compact
          />
          <Link
            href="/guide"
            className="inline-flex min-h-11 w-fit items-center gap-2 rounded-md border border-[#b91c1c] bg-white px-4 text-sm font-black text-[#b91c1c] transition hover:bg-[#fff7ed]"
          >
            Xem quy trình chi tiết
            <ArrowRight size={16} />
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {scholarshipFocus.map((item) => (
            <article key={item.title} className="rounded-lg border border-[#dde5ef] bg-[#f9fafb] p-5 shadow-sm">
              <h3 className="text-lg font-black text-[#111827]">{item.title}</h3>
              <p className="mt-2 text-sm font-semibold leading-7 text-[#4b5563]">{item.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function PricingSection() {
  return (
    <section id="pricing" className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <SectionHeading
          eyebrow="Gói sử dụng"
          title="Bắt đầu nhanh, mở rộng khi cần luyện sâu hơn"
          description="Các gói được giữ rõ ràng để người học biết mình nhận được gì trước khi tạo phòng phỏng vấn."
          compact
        />
        <Link
          href="/register"
            className="inline-flex min-h-11 w-fit items-center gap-2 rounded-md border border-[#b91c1c] bg-white px-4 text-sm font-black text-[#b91c1c] transition hover:bg-[#fff7ed]"
        >
          Bắt đầu miễn phí
          <ArrowRight size={16} />
        </Link>
      </div>

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
            <h3 className="text-xl font-black">{plan.name}</h3>
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
          </article>
        ))}
      </div>
    </section>
  );
}

export function FaqSection() {
  return (
    <section className="border-y border-[#dde5ef] bg-white py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(getFAQStructuredData(faqs)).replace(/</g, "\\u003c")
        }}
      />
      <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.85fr_1.15fr]">
        <div>
          <p className="text-sm font-black uppercase text-[#b91c1c]">FAQ</p>
          <h2 className="mt-3 text-3xl font-black leading-tight text-[#111827]">Câu hỏi thường gặp</h2>
          <p className="mt-4 text-sm font-semibold leading-7 text-[#4b5563]">
            Một vài điểm quan trọng trước khi bạn tạo tài khoản và bắt đầu buổi luyện đầu tiên.
          </p>
        </div>

        <div className="grid gap-4">
          {faqs.map((faq) => (
            <article key={faq.question} className="rounded-lg border border-[#dde5ef] bg-[#f9fafb] p-5 shadow-sm">
              <h3 className="text-base font-black text-[#111827]">{faq.question}</h3>
              <p className="mt-2 text-sm font-semibold leading-7 text-[#4b5563]">{faq.answer}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function CtaSection() {
  return (
    <section className="bg-[#7f1d1d] px-4 py-14 text-white sm:px-6">
      <div className="mx-auto flex max-w-7xl flex-col justify-between gap-6 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-black uppercase text-[#fde68a]">Sẵn sàng luyện thử?</p>
          <h2 className="mt-3 max-w-2xl text-3xl font-black leading-tight sm:text-4xl">
            Tạo phòng phỏng vấn đầu tiên và biết ngay câu trả lời của bạn cần sửa gì
          </h2>
        </div>
        <Link
          href="/register"
          className="inline-flex min-h-12 w-fit items-center gap-2 rounded-md bg-white px-5 text-sm font-black text-[#7f1d1d] transition hover:bg-[#fff7ed]"
        >
          Đăng ký miễn phí
          <ArrowRight size={17} />
        </Link>
      </div>
    </section>
  );
}

function SectionHeading({
  compact = false,
  description,
  eyebrow,
  title
}: {
  compact?: boolean;
  description?: string;
  eyebrow: string;
  title: string;
}) {
  return (
    <div className={compact ? "max-w-2xl" : "max-w-3xl"}>
      <p className="text-sm font-black uppercase text-[#b91c1c]">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-black leading-tight text-[#111827] sm:text-4xl">{title}</h2>
      {description ? (
        <p className="mt-4 text-sm font-semibold leading-7 text-[#4b5563] sm:text-base">{description}</p>
      ) : null}
    </div>
  );
}
