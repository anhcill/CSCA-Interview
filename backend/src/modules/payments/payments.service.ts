import { payment_status, type payments } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { env } from "../../config/env.js";
import { prisma } from "../../db/prisma.js";
import { getPaymentPlan, paymentPlans, type PaymentPlan } from "./payment-plans.js";

type BankConfig = {
  accountName: string;
  accountNumber: string;
  bankCode: string;
};

type PaymentNote = {
  consumedAt?: string;
  consumedBySessionId?: string;
  paymentCode: string;
  plan: {
    id: string;
    name: string;
    label: string;
    durationMinutes: number;
    type: PaymentPlan["type"];
  };
};

type SepayWebhookPayload = Record<string, unknown>;

const defaultBankConfig: BankConfig = {
  accountName: "LE DUC ANH",
  accountNumber: "96886693010847",
  bankCode: "MSB"
};
const paymentOrderExpiresInMinutes = 10;
type PaymentAccessRole = "USER" | "ADMIN" | "SUPER_ADMIN";

export function isPaymentExemptRole(role: PaymentAccessRole) {
  return role === "SUPER_ADMIN";
}

export function listPaymentPlans() {
  return paymentPlans;
}

export function buildPaymentCode(paymentId: string) {
  return `CSCA${paymentId.replace(/-/g, "").slice(0, 10).toUpperCase()}`;
}

function getBankConfig(): BankConfig {
  return {
    accountName: env.bankAccountName?.trim() || defaultBankConfig.accountName,
    accountNumber: env.bankAccountNumber?.trim() || defaultBankConfig.accountNumber,
    bankCode: env.bankCode?.trim() || defaultBankConfig.bankCode
  };
}

export function buildSepayQrUrl(input: {
  accountNumber: string;
  amount: number;
  bankCode: string;
  content: string;
}) {
  const params = new URLSearchParams({
    acc: input.accountNumber,
    amount: String(input.amount),
    bank: input.bankCode,
    des: input.content
  });

  return `https://qr.sepay.vn/img?${params.toString()}`;
}

function parsePaymentNote(rawNote: string | null): PaymentNote | null {
  if (!rawNote) return null;

  try {
    const note = JSON.parse(rawNote) as PaymentNote;
    if (!note.paymentCode || !note.plan?.id) return null;
    return note;
  } catch {
    return null;
  }
}

function toNumberAmount(amount: payments["amount"]) {
  return Number(amount.toString());
}

function getPaymentExpiresAt(payment: payments) {
  return new Date(payment.created_at.getTime() + paymentOrderExpiresInMinutes * 60_000);
}

function serializePayment(payment: payments) {
  const note = parsePaymentNote(payment.note);
  const bank = getBankConfig();
  const amount = toNumberAmount(payment.amount);
  const paymentCode = note?.paymentCode ?? buildPaymentCode(payment.id);

  return {
    id: payment.id,
    amount,
    bank,
    createdAt: payment.created_at.toISOString(),
    currency: payment.currency,
    expiresAt: getPaymentExpiresAt(payment).toISOString(),
    expiresInMinutes: paymentOrderExpiresInMinutes,
    paidAt: payment.paid_at?.toISOString() ?? null,
    paymentCode,
    plan: note?.plan ?? null,
    consumedAt: note?.consumedAt ?? null,
    consumedBySessionId: note?.consumedBySessionId ?? null,
    provider: payment.provider,
    providerTransactionId: payment.provider_transaction_id,
    qrImageUrl: buildSepayQrUrl({
      accountNumber: bank.accountNumber,
      amount,
      bankCode: bank.bankCode,
      content: paymentCode
    }),
    status: payment.status,
    transferContent: paymentCode
  };
}

function isConsumableInterviewPayment(payment: payments, requiredMinutes: number) {
  const note = parsePaymentNote(payment.note);
  if (!note?.plan || note.consumedAt || note.consumedBySessionId) return false;
  if (payment.status !== payment_status.PAID) return false;
  return note.plan.durationMinutes >= requiredMinutes;
}

function buildPaymentRequiredResponse(requiredMinutes: number) {
  return {
    code: "PAYMENT_REQUIRED",
    message: `Bạn cần thanh toán gói phỏng vấn tối thiểu ${requiredMinutes} phút trước khi tạo phòng.`,
    paymentUrl: `/payment?next=${encodeURIComponent("/interview/setup")}&duration=${requiredMinutes}`,
    requiredMinutes
  };
}

export async function getInterviewPaymentEntitlement(userId: string, requiredMinutes = 30, role: PaymentAccessRole = "USER") {
  const safeRequiredMinutes = Math.max(10, Math.min(180, Math.round(requiredMinutes || 30)));
  if (isPaymentExemptRole(role)) {
    return {
      ...buildPaymentRequiredResponse(safeRequiredMinutes),
      code: "PAYMENT_NOT_REQUIRED" as const,
      message: "Tài khoản quản trị cấp cao được sử dụng phỏng vấn không giới hạn.",
      paymentUrl: "",
      availablePayments: [],
      hasAccess: true,
      isUnlimited: true
    };
  }

  const payments = await prisma.payments.findMany({
    orderBy: { created_at: "asc" },
    take: 20,
    where: {
      provider: "SEPAY",
      status: payment_status.PAID,
      user_id: userId
    }
  });
  const availablePayments = payments.filter((payment) => isConsumableInterviewPayment(payment, safeRequiredMinutes));

  return {
    ...buildPaymentRequiredResponse(safeRequiredMinutes),
    availablePayments: availablePayments.map(serializePayment),
    hasAccess: availablePayments.length > 0,
    isUnlimited: false
  };
}

export async function consumeInterviewPayment(userId: string, sessionId: string, requiredMinutes = 30) {
  const entitlement = await getInterviewPaymentEntitlement(userId, requiredMinutes);
  const payment = entitlement.availablePayments[0];
  if (!payment) return null;

  const existingPayment = await prisma.payments.findFirst({
    where: {
      id: payment.id,
      user_id: userId
    }
  });
  const note = parsePaymentNote(existingPayment?.note ?? null);
  if (!existingPayment || !note || note.consumedAt || note.consumedBySessionId) return null;

  const updatedPayment = await prisma.payments.update({
    data: {
      note: JSON.stringify({
        ...note,
        consumedAt: new Date().toISOString(),
        consumedBySessionId: sessionId
      }),
      updated_at: new Date()
    },
    where: { id: existingPayment.id }
  });

  return serializePayment(updatedPayment);
}

export function paymentRequiredPayload(requiredMinutes = 30) {
  return buildPaymentRequiredResponse(requiredMinutes);
}

export async function createPaymentOrder(userId: string, planId: string) {
  const plan = getPaymentPlan(planId);
  if (!plan) {
    const error = new Error("Gói thanh toán không hợp lệ");
    error.name = "ValidationError";
    throw error;
  }

  const paymentId = randomUUID();
  const paymentCode = buildPaymentCode(paymentId);
  const note: PaymentNote = {
    paymentCode,
    plan: {
      id: plan.id,
      durationMinutes: plan.durationMinutes,
      label: plan.label,
      name: plan.name,
      type: plan.type
    }
  };

  const payment = await prisma.payments.create({
    data: {
      id: paymentId,
      amount: plan.amount,
      currency: "VND",
      note: JSON.stringify(note),
      provider: "SEPAY",
      status: payment_status.PENDING,
      user_id: userId
    }
  });

  return serializePayment(payment);
}

export async function getPaymentOrderForUser(userId: string, paymentId: string) {
  const payment = await prisma.payments.findFirst({
    where: {
      id: paymentId,
      user_id: userId
    }
  });

  return payment ? serializePayment(payment) : null;
}

function readStringField(payload: SepayWebhookPayload, keys: string[]) {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }

  return "";
}

function parseAmount(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;

  const normalized = value.replace(/[^\d.-]/g, "");
  if (!normalized) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function readAmount(payload: SepayWebhookPayload) {
  const keys = [
    "amount",
    "transferAmount",
    "transfer_amount",
    "transactionAmount",
    "transaction_amount",
    "value",
    "creditAmount",
    "credit_amount"
  ];

  for (const key of keys) {
    const amount = parseAmount(payload[key]);
    if (amount !== null) return amount;
  }

  return null;
}

function extractPaymentCode(content: string) {
  const normalized = content.toUpperCase().replace(/\s+/g, "");
  return normalized.match(/CSCA[A-Z0-9]{8,16}/)?.[0] ?? null;
}

function readTransferContent(payload: SepayWebhookPayload) {
  return readStringField(payload, [
    "content",
    "description",
    "transaction_content",
    "transfer_content",
    "transferContent",
    "remark",
    "memo"
  ]);
}

function readTransactionId(payload: SepayWebhookPayload) {
  return readStringField(payload, [
    "id",
    "referenceCode",
    "reference_code",
    "transactionId",
    "transaction_id",
    "code"
  ]);
}

export async function confirmSepayPayment(payload: SepayWebhookPayload) {
  const content = readTransferContent(payload);
  const paymentCode = extractPaymentCode(content);

  if (!paymentCode) {
    return {
      matched: false,
      message: "Không tìm thấy mã thanh toán trong nội dung chuyển khoản"
    };
  }

  const payment = await prisma.payments.findFirst({
    where: {
      note: {
        contains: paymentCode
      },
      provider: "SEPAY"
    }
  });

  if (!payment) {
    return {
      matched: false,
      message: "Không tìm thấy đơn thanh toán phù hợp",
      paymentCode
    };
  }

  const paidAmount = readAmount(payload);
  const expectedAmount = toNumberAmount(payment.amount);

  if (paidAmount !== null && paidAmount < expectedAmount) {
    return {
      matched: true,
      message: "Số tiền chuyển khoản nhỏ hơn số tiền cần thanh toán",
      payment: serializePayment(payment),
      paymentCode,
      validAmount: false
    };
  }

  if (payment.status === payment_status.PAID) {
    return {
      matched: true,
      message: "Đơn thanh toán đã được xác nhận trước đó",
      payment: serializePayment(payment),
      paymentCode,
      validAmount: true
    };
  }

  const transactionId = readTransactionId(payload);
  const updatedPayment = await prisma.payments.update({
    where: { id: payment.id },
    data: {
      paid_at: new Date(),
      provider_transaction_id: transactionId || payment.provider_transaction_id,
      status: payment_status.PAID,
      updated_at: new Date()
    }
  });

  return {
    matched: true,
    message: "Đã xác nhận thanh toán",
    payment: serializePayment(updatedPayment),
    paymentCode,
    validAmount: true
  };
}

export function isSepayWebhookAuthorized(headers: {
  authorization?: string | string[];
  "x-api-key"?: string | string[];
  "x-sepay-api-key"?: string | string[];
}) {
  const configuredApiKey = env.sepayWebhookApiKey?.trim();
  if (!configuredApiKey) return true;

  const headerValues = [
    headers.authorization,
    headers["x-api-key"],
    headers["x-sepay-api-key"]
  ].flatMap((value) => Array.isArray(value) ? value : value ? [value] : []);

  return headerValues.some((value) => {
    const normalized = value.replace(/^Bearer\s+/i, "").replace(/^Apikey\s+/i, "").trim();
    return normalized === configuredApiKey;
  });
}
