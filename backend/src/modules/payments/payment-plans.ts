export type PaymentPlanId = "interview_30" | "interview_60" | "interview_120" | "extra_30";

export type PaymentPlan = {
  id: PaymentPlanId;
  name: string;
  label: string;
  description: string;
  amount: number;
  durationMinutes: number;
  type: "interview" | "add_on";
  highlighted?: boolean;
};

export const paymentPlans: PaymentPlan[] = [
  {
    id: "interview_30",
    name: "Gói 30 phút",
    label: "30 phút",
    description: "Phỏng vấn AI 30 phút, câu hỏi cá nhân hóa và báo cáo sau buổi phỏng vấn.",
    amount: 150_000,
    durationMinutes: 30,
    type: "interview"
  },
  {
    id: "interview_60",
    name: "Gói 1 giờ",
    label: "1 giờ",
    description: "Phỏng vấn AI 60 phút, phân tích sâu hơn và phù hợp cho buổi luyện chính.",
    amount: 250_000,
    durationMinutes: 60,
    highlighted: true,
    type: "interview"
  },
  {
    id: "interview_120",
    name: "Gói 2 giờ",
    label: "2 giờ",
    description: "Phỏng vấn AI 120 phút cho phiên luyện dài, đào sâu hồ sơ và chiến lược trả lời.",
    amount: 400_000,
    durationMinutes: 120,
    type: "interview"
  },
  {
    id: "extra_30",
    name: "Mua thêm 30 phút",
    label: "30 phút mua thêm",
    description: "Mua thêm thời gian phỏng vấn, mỗi 30 phút tính 150.000đ.",
    amount: 150_000,
    durationMinutes: 30,
    type: "add_on"
  }
];

export function getPaymentPlan(planId: string) {
  return paymentPlans.find((plan) => plan.id === planId) ?? null;
}
