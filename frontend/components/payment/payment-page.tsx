"use client";

import {
  Bot,
  CheckCircle2,
  Clock3,
  Copy,
  CreditCard,
  Headphones,
  Loader2,
  LockKeyhole,
  QrCode,
  ShieldCheck,
  Sparkles,
  Timer,
  TrendingUp,
  WalletCards
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { showToast } from "@/components/ui/toast";
import { ensureAuthSession } from "@/lib/auth-client";
import {
  createPaymentOrder,
  fetchPaymentOrder,
  fetchPaymentPlans,
  type PaymentOrder,
  type PaymentPlan
} from "@/lib/payments-client";

const currencyFormatter = new Intl.NumberFormat("vi-VN");

const paymentBadges = [
  { label: "momo", className: "bg-[#a50064] text-white" },
  { label: "ZaloPay", className: "bg-white text-[#0068ff]" },
  { label: "VNPAY", className: "bg-white text-[#005baa]" },
  { label: "VISA", className: "bg-white text-[#174ea6]" },
  { label: "●●", className: "bg-white text-[#ef4444]" }
];

function formatMoney(amount: number) {
  return `${currencyFormatter.format(amount)}đ`;
}

function usePlanGroups(plans: PaymentPlan[]) {
  return useMemo(() => ({
    addOnPlan: plans.find((plan) => plan.type === "add_on") ?? null,
    interviewPlans: plans.filter((plan) => plan.type === "interview")
  }), [plans]);
}

export function PaymentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [plans, setPlans] = useState<PaymentPlan[]>([]);
  const [activeOrder, setActiveOrder] = useState<PaymentOrder | null>(null);
  const [creatingPlanId, setCreatingPlanId] = useState<string | null>(null);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [loadError, setLoadError] = useState("");
  const { addOnPlan, interviewPlans } = usePlanGroups(plans);
  const nextPath = sanitizeNextPath(searchParams.get("next"));
  const requestedDurationText = searchParams.get("duration");
  const requestedDuration = requestedDurationText ? Number(requestedDurationText) : null;

  useEffect(() => {
    let cancelled = false;

    async function loadPlans() {
      setLoadingPlans(true);
      setLoadError("");

      try {
        const data = await fetchPaymentPlans();
        if (!cancelled) setPlans(data.plans);
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : "Không tải được bảng giá thanh toán.");
        }
      } finally {
        if (!cancelled) setLoadingPlans(false);
      }
    }

    void loadPlans();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!activeOrder || activeOrder.status !== "PENDING") return;

    let cancelled = false;
    const timer = window.setInterval(() => {
      void (async () => {
        const session = await ensureAuthSession();
        if (!session || cancelled) return;

        const data = await fetchPaymentOrder(activeOrder.id, session.token);
        if (cancelled) return;

        setActiveOrder(data.order);
        if (data.order.status === "PAID") {
          showToast({
            title: "Thanh toán đã được xác nhận",
            description: "Hệ thống đã ghi nhận giao dịch thành công.",
            tone: "success"
          });
          if (nextPath) {
            window.setTimeout(() => router.push(nextPath), 1200);
          }
        }
      })().catch(() => undefined);
    }, 4_000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeOrder, nextPath, router]);

  async function handleCreateOrder(plan: PaymentPlan) {
    setCreatingPlanId(plan.id);

    try {
      const session = await ensureAuthSession();
      if (!session) {
        const queryString = searchParams.toString();
        router.push(`/login?next=${encodeURIComponent(`/payment${queryString ? `?${queryString}` : ""}`)}`);
        return;
      }

      const data = await createPaymentOrder(plan.id, session.token);
      setActiveOrder(data.order);
      showToast({
        title: "Đã tạo mã thanh toán",
        description: "Quét QR hoặc chuyển khoản đúng nội dung để hệ thống tự xác nhận.",
        tone: "success"
      });
    } catch (error) {
      showToast({
        title: "Không tạo được đơn thanh toán",
        description: error instanceof Error ? error.message : "Vui lòng thử lại sau.",
        tone: "error"
      });
    } finally {
      setCreatingPlanId(null);
    }
  }

  async function copyText(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      showToast({ title: `Đã sao chép ${label}`, tone: "success" });
    } catch {
      showToast({ title: "Không thể sao chép", description: "Trình duyệt chưa cho phép truy cập clipboard.", tone: "error" });
    }
  }

  return (
    <section className="bg-[#fff7f7] px-3 py-3 sm:px-5 lg:py-4">
      <div className="mx-auto max-w-[1240px] overflow-hidden rounded-lg border border-[#ffd3d7] bg-white shadow-[0_24px_70px_rgba(185,28,28,0.08)]">
        <HeroPanel />

        <div className="grid gap-3 px-3 pb-3 sm:px-5 sm:pb-5 lg:grid-cols-[1fr_14.5rem] xl:grid-cols-[1fr_16rem]">
          <div>
            {loadError ? (
              <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                {loadError}
              </div>
            ) : null}

            <div className="grid gap-3 md:grid-cols-3">
              {loadingPlans
                ? Array.from({ length: 3 }).map((_, index) => <PlanSkeleton key={index} />)
                : interviewPlans.map((plan) => (
                  <PlanCard
                    key={plan.id}
                    recommended={typeof requestedDuration === "number" && Number.isFinite(requestedDuration) && plan.durationMinutes >= requestedDuration}
                    plan={plan}
                    creating={creatingPlanId === plan.id}
                    onChoose={() => void handleCreateOrder(plan)}
                  />
                ))}
            </div>

            <PaymentBadges />
          </div>

          <aside className="space-y-3">
            {activeOrder ? (
              <PaymentOrderPanel order={activeOrder} onContinue={nextPath ? () => router.push(nextPath) : undefined} onCopy={copyText} />
            ) : (
              <>
                {addOnPlan ? (
                  <AddOnCard
                    plan={addOnPlan}
                    creating={creatingPlanId === addOnPlan.id}
                    onChoose={() => void handleCreateOrder(addOnPlan)}
                  />
                ) : null}
                <WhyChooseCard />
              </>
            )}
          </aside>
        </div>
      </div>
    </section>
  );
}

function sanitizeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "";
  return value;
}

function HeroPanel() {
  return (
    <div className="relative min-h-[8.5rem] overflow-hidden px-5 py-5 sm:px-8 lg:min-h-[8rem]">
      <div
        className="absolute inset-y-0 right-0 w-full bg-cover bg-center opacity-25 blur-[1px] sm:w-[62%] sm:opacity-45"
        style={{ backgroundImage: "url('/auth/image/study_abroad_hero.png')" }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,#fff_0%,rgba(255,255,255,0.96)_42%,rgba(255,255,255,0.5)_100%)]" />
      <div className="absolute right-8 top-7 hidden h-12 w-12 rounded-full bg-[#fecdd3]/70 blur-2xl md:block" />

      <div className="relative max-w-2xl">
        <h1 className="text-3xl font-black leading-tight tracking-normal text-[#09090b] sm:text-4xl">
          Bảng giá <span className="text-[#ef233c]">Interview</span>
        </h1>
        <p className="mt-2 max-w-xl text-sm font-black text-[#1f2937] sm:text-base">
          Luyện phỏng vấn AI - tự tin chinh phục học bổng!
        </p>

        <div className="mt-3 flex max-w-xl items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#fff1f2] text-[#ef233c]">
            <ShieldCheck size={18} />
          </span>
          <div>
            <p className="text-sm font-black text-[#111827]">An toàn - Bảo mật - Hỗ trợ tận tâm</p>
            <p className="mt-0.5 text-xs font-semibold leading-4 text-[#6b7280]">
              Thanh toán qua SePay/VietQR, thông tin chuyển khoản được tạo riêng cho từng đơn.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlanCard({
  creating,
  onChoose,
  plan,
  recommended
}: {
  creating: boolean;
  onChoose: () => void;
  plan: PaymentPlan;
  recommended?: boolean;
}) {
  return (
    <article className={`relative rounded-lg border bg-white p-4 text-center shadow-[0_18px_45px_rgba(15,23,42,0.06)] transition ${plan.highlighted ? "border-[#ff4055] ring-1 ring-[#ff4055]/40" : "border-[#ffe0e3]"}`}>
      {plan.highlighted ? (
        <div className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-[#ef233c] px-3 py-1 text-[11px] font-black text-white shadow-lg shadow-red-900/20">
          <Sparkles size={13} />
          Phổ biến nhất
        </div>
      ) : null}
      {recommended && !plan.highlighted ? (
        <div className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-[#ef233c] px-3 py-1 text-[11px] font-black text-white shadow-lg shadow-red-900/20">
          <Sparkles size={13} />
          Phù hợp flow
        </div>
      ) : null}

      <p className="mx-auto inline-flex rounded-md bg-[#fff1f2] px-3 py-1 text-xs font-black uppercase text-[#ef233c]">Gói 1 lần</p>
      <h2 className="mt-2 text-xl font-black text-[#ef233c]">{plan.label}</h2>
      <p className="mt-0.5 text-xl font-black text-[#111827]">{formatMoney(plan.amount)}</p>

      <div className="mx-auto mt-3 flex h-16 w-16 items-center justify-center rounded-full bg-[#fff1f2] text-[#ef233c]">
        <div className="flex h-12 w-12 flex-col items-center justify-center rounded-full border-[3px] border-[#ff7b86] bg-white">
          <Clock3 size={17} />
          <span className="mt-0.5 text-base font-black leading-none text-[#374151]">{plan.durationMinutes}</span>
          <span className="text-[8px] font-black text-[#ef233c]">min</span>
        </div>
      </div>

      <ul className="mt-4 space-y-2 text-left text-xs font-semibold leading-4 text-[#374151]">
        {[
          `Phỏng vấn AI ${plan.durationMinutes} phút`,
          "Câu hỏi cá nhân hóa",
          "Phân tích & góp ý chi tiết",
          "Báo cáo kết quả sau buổi phỏng vấn"
        ].map((item) => (
          <li key={item} className="flex gap-2">
            <CheckCircle2 className="mt-0.5 shrink-0 text-[#ef233c]" size={14} />
            <span>{item}</span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={onChoose}
        disabled={creating}
        className={`mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg px-4 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-70 ${plan.highlighted ? "bg-[#ef233c] text-white shadow-lg shadow-red-900/15 hover:bg-[#d90429]" : "border border-[#ff5b68] bg-white text-[#ef233c] hover:bg-[#fff1f2]"}`}
      >
        {creating ? <Loader2 className="animate-spin" size={16} /> : <CreditCard size={16} />}
        Chọn gói này
      </button>
    </article>
  );
}

function PlanSkeleton() {
  return (
    <div className="h-[18rem] rounded-lg border border-[#ffe0e3] bg-white p-4">
      <div className="skeleton mx-auto h-7 w-24 rounded-lg" />
      <div className="skeleton mx-auto mt-4 h-8 w-28 rounded-lg" />
      <div className="skeleton mx-auto mt-3 h-8 w-32 rounded-lg" />
      <div className="skeleton mx-auto mt-4 h-16 w-16 rounded-full" />
      <div className="mt-5 space-y-2">
        <div className="skeleton h-4 rounded-lg" />
        <div className="skeleton h-4 rounded-lg" />
        <div className="skeleton h-4 rounded-lg" />
      </div>
      <div className="skeleton mt-5 h-10 rounded-lg" />
    </div>
  );
}

function AddOnCard({
  creating,
  onChoose,
  plan
}: {
  creating: boolean;
  onChoose: () => void;
  plan: PaymentPlan;
}) {
  return (
    <article className="rounded-lg border border-[#ffe0e3] bg-[#fff8f8] p-3 shadow-[0_18px_45px_rgba(185,28,28,0.06)]">
      <p className="inline-flex rounded-md bg-white px-3 py-1 text-xs font-black uppercase text-[#ef233c]">Mua thêm thời gian</p>
      <div className="mt-3 flex items-center gap-3">
        <Timer className="shrink-0 text-[#ef233c]" size={32} />
        <div>
          <p className="text-xl font-black text-[#ef233c]">30 phút = {formatMoney(plan.amount)}</p>
          <p className="mt-1 text-xs font-bold text-[#6b7280]">Mỗi 30 phút = {formatMoney(plan.amount)}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onChoose}
        disabled={creating}
        className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#ef233c] px-4 text-sm font-black text-white shadow-lg shadow-red-900/15 transition hover:bg-[#d90429] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {creating ? <Loader2 className="animate-spin" size={16} /> : <WalletCards size={16} />}
        Mua thêm thời gian
      </button>
    </article>
  );
}

function WhyChooseCard() {
  const items = [
    { icon: Bot, title: "AI thông minh", description: "Câu hỏi sát hồ sơ & mục tiêu du học" },
    { icon: TrendingUp, title: "Phân tích chuyên sâu", description: "Gợi ý chi tiết giúp bạn cải thiện" },
    { icon: ShieldCheck, title: "Bảo mật tuyệt đối", description: "Cam kết bảo vệ thông tin cá nhân" },
    { icon: Headphones, title: "Hỗ trợ 24/7", description: "Đội ngũ hỗ trợ luôn sẵn sàng" }
  ];

  return (
    <article className="rounded-lg border border-[#ffe0e3] bg-[#fff8f8] p-3 shadow-[0_18px_45px_rgba(185,28,28,0.06)]">
      <h2 className="text-sm font-black text-[#111827]">Tại sao chọn InterviewAI?</h2>
      <div className="mt-3 space-y-2">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.title} className="flex gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-[#ef233c]">
                <Icon size={16} />
              </span>
              <div>
                <p className="text-xs font-black text-[#111827]">{item.title}</p>
                <p className="mt-0.5 text-[11px] font-semibold leading-4 text-[#6b7280]">{item.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </article>
  );
}

function PaymentOrderPanel({
  onContinue,
  onCopy,
  order
}: {
  onContinue?: () => void;
  onCopy: (value: string, label: string) => Promise<void>;
  order: PaymentOrder;
}) {
  const isPaid = order.status === "PAID";

  return (
    <article className="rounded-lg border border-[#ffd3d7] bg-[#fff8f8] p-4 shadow-[0_18px_45px_rgba(185,28,28,0.08)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase text-[#ef233c]">Thanh toán SePay</p>
          <h2 className="mt-1 text-base font-black text-[#111827]">{isPaid ? "Đã thanh toán" : "Quét QR để thanh toán"}</h2>
        </div>
        <span className={`inline-flex h-10 w-10 items-center justify-center rounded-full ${isPaid ? "bg-emerald-100 text-emerald-700" : "bg-white text-[#ef233c]"}`}>
          {isPaid ? <CheckCircle2 size={20} /> : <QrCode size={20} />}
        </span>
      </div>

      <div className="mt-4 rounded-lg border border-[#ffe0e3] bg-white p-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={order.qrImageUrl}
          alt={`QR thanh toán ${order.paymentCode}`}
          className="aspect-square w-full rounded-lg object-contain"
        />
      </div>

      <div className="mt-4 space-y-2 text-xs">
        <PaymentInfoRow label="Ngân hàng" value={order.bank.bankCode} onCopy={() => onCopy(order.bank.bankCode, "ngân hàng")} />
        <PaymentInfoRow label="Chủ tài khoản" value={order.bank.accountName} onCopy={() => onCopy(order.bank.accountName, "chủ tài khoản")} />
        <PaymentInfoRow label="Số tài khoản" value={order.bank.accountNumber} onCopy={() => onCopy(order.bank.accountNumber, "số tài khoản")} />
        <PaymentInfoRow label="Số tiền" value={formatMoney(order.amount)} onCopy={() => onCopy(String(order.amount), "số tiền")} />
        <PaymentInfoRow label="Nội dung" value={order.transferContent} onCopy={() => onCopy(order.transferContent, "nội dung")} strong />
      </div>

      <div className={`mt-4 rounded-lg px-3 py-2 text-xs font-black ${isPaid ? "bg-emerald-50 text-emerald-700" : "bg-[#fff1f2] text-[#ef233c]"}`}>
        {isPaid ? "Giao dịch đã được xác nhận tự động." : "Đang chờ chuyển khoản đúng nội dung để tự xác nhận."}
      </div>

      {isPaid && onContinue ? (
        <button
          type="button"
          onClick={onContinue}
          className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-[#ef233c] px-4 text-sm font-black text-white shadow-lg shadow-red-900/15 transition hover:bg-[#d90429]"
        >
          Tiếp tục tạo phòng
        </button>
      ) : null}

      {order.webhookUrl ? (
        <p className="mt-3 break-all text-[11px] font-semibold leading-4 text-[#9ca3af]">Webhook: {order.webhookUrl}</p>
      ) : null}
    </article>
  );
}

function PaymentInfoRow({
  label,
  onCopy,
  strong,
  value
}: {
  label: string;
  onCopy: () => Promise<void>;
  strong?: boolean;
  value: string;
}) {
  return (
    <div className="grid grid-cols-[5.5rem_1fr_2rem] items-center gap-2 rounded-lg bg-white px-3 py-2">
      <span className="font-bold text-[#6b7280]">{label}</span>
      <span className={`min-w-0 break-words ${strong ? "font-black text-[#ef233c]" : "font-black text-[#111827]"}`}>{value}</span>
      <button
        type="button"
        onClick={() => void onCopy()}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-[#ef233c] hover:bg-[#fff1f2]"
        aria-label={`Sao chép ${label}`}
      >
        <Copy size={14} />
      </button>
    </div>
  );
}

function PaymentBadges() {
  return (
    <div className="mt-3 hidden rounded-lg border border-[#ffe0e3] bg-[#fff8f8] px-4 py-3 xl:block">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#ef233c]">
            <LockKeyhole size={18} />
          </span>
          <div>
            <p className="text-sm font-black text-[#111827]">Thanh toán an toàn & tiện lợi</p>
            <p className="mt-1 text-xs font-semibold text-[#6b7280]">SePay/VietQR tự động đối soát đơn hàng.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          {paymentBadges.map((badge) => (
            <span key={badge.label} className={`inline-flex h-10 min-w-20 items-center justify-center rounded-lg border border-[#ffe0e3] px-3 text-sm font-black shadow-sm ${badge.className}`}>
              {badge.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
