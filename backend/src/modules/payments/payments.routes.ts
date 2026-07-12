import { Router } from "express";
import { z } from "zod";
import { requireAuth, type AuthenticatedUser } from "../auth/auth.middleware.js";
import {
  confirmSepayPayment,
  createPaymentOrder,
  getInterviewPaymentEntitlement,
  getPaymentOrderForUser,
  isSepayWebhookAuthorized,
  listPaymentPlans
} from "./payments.service.js";

export const paymentsRouter = Router();

const createOrderSchema = z.object({
  planId: z.string().min(1)
});

paymentsRouter.get("/plans", (_req, res) => {
  res.json({ plans: listPaymentPlans() });
});

paymentsRouter.get("/entitlement", requireAuth, async (req, res) => {
  const user = res.locals.user as AuthenticatedUser;
  const requiredMinutes = Number(req.query.duration ?? 30);
  const entitlement = await getInterviewPaymentEntitlement(user.id, requiredMinutes, user.role);
  res.json({ entitlement });
});

paymentsRouter.post("/orders", requireAuth, async (req, res) => {
  const parsed = createOrderSchema.safeParse(req.body ?? {});

  if (!parsed.success) {
    res.status(400).json({
      errors: parsed.error.flatten().fieldErrors,
      message: "Dữ liệu thanh toán không hợp lệ"
    });
    return;
  }

  try {
    const user = res.locals.user as AuthenticatedUser;
    const order = await createPaymentOrder(user.id, parsed.data.planId);
    res.status(201).json({ order });
  } catch (error) {
    if (error instanceof Error && error.name === "ValidationError") {
      res.status(400).json({ message: error.message });
      return;
    }

    throw error;
  }
});

paymentsRouter.get("/orders/:id", requireAuth, async (req, res) => {
  const user = res.locals.user as AuthenticatedUser;
  const order = await getPaymentOrderForUser(user.id, req.params.id);

  if (!order) {
    res.status(404).json({ message: "Không tìm thấy đơn thanh toán" });
    return;
  }

  res.json({ order });
});

paymentsRouter.post("/sepay/webhook", async (req, res) => {
  if (!isSepayWebhookAuthorized(req.headers)) {
    res.status(401).json({ message: "Webhook SePay không được phép" });
    return;
  }

  const result = await confirmSepayPayment(req.body ?? {});

  if (result.matched && "validAmount" in result && result.validAmount === false) {
    res.status(409).json(result);
    return;
  }

  res.json(result);
});
