import { apiGet, apiPost } from "./api";

export type PaymentPlan = {
  id: string;
  name: string;
  label: string;
  description: string;
  amount: number;
  durationMinutes: number;
  type: "interview" | "add_on";
  highlighted?: boolean;
};

export type PaymentOrder = {
  id: string;
  amount: number;
  bank: {
    accountName: string;
    accountNumber: string;
    bankCode: string;
  };
  createdAt: string;
  currency: string;
  expiresAt: string;
  expiresInMinutes: number;
  paidAt: string | null;
  paymentCode: string;
  plan: {
    id: string;
    name: string;
    label: string;
    durationMinutes: number;
    type: "interview" | "add_on";
  } | null;
  provider: string | null;
  providerTransactionId: string | null;
  qrImageUrl: string;
  status: "PENDING" | "PAID" | "FAILED" | "REFUNDED" | "CANCELLED";
  transferContent: string;
};

export type PaymentEntitlement = {
  availablePayments: PaymentOrder[];
  code: "PAYMENT_NOT_REQUIRED" | "PAYMENT_REQUIRED";
  hasAccess: boolean;
  isUnlimited: boolean;
  message: string;
  paymentUrl: string;
  requiredMinutes: number;
};

export async function fetchPaymentPlans() {
  return apiGet<{ plans: PaymentPlan[] }>("/api/payments/plans", { cacheMs: 5 * 60_000 });
}

export async function createPaymentOrder(planId: string, token: string) {
  return apiPost<{ order: PaymentOrder }>("/api/payments/orders", { planId }, { token });
}

export async function fetchPaymentOrder(orderId: string, token: string) {
  return apiGet<{ order: PaymentOrder }>(`/api/payments/orders/${orderId}`, {
    cacheMs: 0,
    token
  });
}

export async function fetchPaymentEntitlement(durationMinutes: number, token: string) {
  return apiGet<{ entitlement: PaymentEntitlement }>(`/api/payments/entitlement?duration=${durationMinutes}`, {
    cacheMs: 0,
    token
  });
}
