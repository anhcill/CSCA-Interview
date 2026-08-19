import { Router } from "express";
import { payment_status } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import { paginatedResponse, parsePagination } from "../../utils/pagination.js";
import { requireIntegrationKey } from "../../middleware/integration-key.js";

export const integrationsRouter = Router();
integrationsRouter.use(requireIntegrationKey);

function mapPaymentStatus(status: payment_status) {
  switch (status) {
    case payment_status.PAID:
      return "Paid";
    case payment_status.REFUNDED:
      return "Refunded";
    case payment_status.FAILED:
    case payment_status.CANCELLED:
      return "Failed";
    default:
      return "Pending";
  }
}

function mapSubscriptionStatus(isActive: boolean, endsAt: Date | null) {
  return isActive && (!endsAt || endsAt > new Date()) ? "Active" : "Expired";
}

integrationsRouter.get("/customers", async (req, res) => {
  const { limit, page, skip } = parsePagination(req.query);
  const where = { deletedAt: null };
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { interviewSessions: true } },
        user_subscriptions: {
          where: { is_active: true },
          orderBy: { created_at: "desc" },
          take: 1,
          select: { plan: true }
        },
        payments: {
          where: { status: payment_status.PAID },
          select: { amount: true }
        }
      }
    }),
    prisma.user.count({ where })
  ]);

  const data = users.map((user) => {
    const paidAmount = user.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
    const subscription = user.user_subscriptions[0];
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phoneNumber: user.phone,
      packageName: subscription?.plan ?? "Interview",
      sessionCount: user._count.interviewSessions,
      paidAmount,
      status: paidAmount > 0 ? "Paid" : "Pending",
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
  });

  res.json(paginatedResponse(data, total, page, limit));
});

integrationsRouter.get("/subscriptions", async (req, res) => {
  const { limit, page, skip } = parsePagination(req.query);
  const where = { users: { deletedAt: null } };
  const [subscriptions, total] = await Promise.all([
    prisma.user_subscriptions.findMany({
      where,
      orderBy: { created_at: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        user_id: true,
        plan: true,
        starts_at: true,
        ends_at: true,
        is_active: true
      }
    }),
    prisma.user_subscriptions.count({ where })
  ]);

  const data = subscriptions.map((subscription) => ({
    id: subscription.id,
    customerId: subscription.user_id,
    packageName: subscription.plan,
    startsAt: subscription.starts_at,
    expiresAt: subscription.ends_at ?? new Date(new Date(subscription.starts_at).getTime() + 365 * 86400000),
    status: mapSubscriptionStatus(subscription.is_active, subscription.ends_at)
  }));

  res.json(paginatedResponse(data, total, page, limit));
});

integrationsRouter.get("/payments", async (req, res) => {
  const { limit, page, skip } = parsePagination(req.query);
  const where = { users: { deletedAt: null } };
  const [payments, total] = await Promise.all([
    prisma.payments.findMany({
      where,
      orderBy: { created_at: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        user_id: true,
        amount: true,
        currency: true,
        status: true,
        provider: true,
        provider_transaction_id: true,
        paid_at: true,
        created_at: true
      }
    }),
    prisma.payments.count({ where })
  ]);

  const data = payments.map((payment) => ({
    id: payment.id,
    customerId: payment.user_id,
    amount: Number(payment.amount),
    currency: payment.currency,
    status: mapPaymentStatus(payment.status),
    paidAt: payment.paid_at ?? payment.created_at,
    paymentMethod: payment.provider,
    transactionReference: payment.provider_transaction_id
  }));

  res.json(paginatedResponse(data, total, page, limit));
});

integrationsRouter.get("/questions", async (req, res) => {
  const { limit, page, skip } = parsePagination(req.query);
  const where = { deletedAt: null, isActive: true };
  const [questions, total] = await Promise.all([
    prisma.question.findMany({
      where,
      orderBy: { createdAt: "asc" },
      skip,
      take: limit,
      select: {
        id: true,
        questionText: true,
        category: true,
        difficulty: true,
        language: true,
        createdAt: true,
        updatedAt: true,
        school: { select: { name: true } },
        major: { select: { name: true } },
        scholarship: { select: { name: true } }
      }
    }),
    prisma.question.count({ where })
  ]);

  const data = questions.map((question) => ({
    id: question.id,
    category: question.category,
    difficulty: question.difficulty,
    language: question.language,
    questionText: question.questionText,
    createdAt: question.createdAt,
    updatedAt: question.updatedAt,
    school: question.school,
    major: question.major,
    scholarship: question.scholarship
  }));

  res.json(paginatedResponse(data, total, page, limit));
});
