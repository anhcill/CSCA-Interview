import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import { requireAuth, type AuthenticatedUser } from "../auth/auth.middleware.js";
import { getTesterExperienceConfig } from "./site-experience.service.js";

export const siteExperienceRouter = Router();

const feedbackSchema = z.object({
  category: z.string().trim().max(80).optional().nullable(),
  message: z.string().trim().min(5, "Nội dung góp ý cần ít nhất 5 ký tự").max(5000),
  pageUrl: z.string().trim().max(1000).optional().nullable(),
  rating: z.number().int().min(1).max(5).optional().nullable()
});

siteExperienceRouter.get("/config", async (_req, res) => {
  try {
    res.json({ config: await getTesterExperienceConfig() });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Không thể tải cấu hình trải nghiệm" });
  }
});

siteExperienceRouter.post("/feedback", requireAuth, async (req, res) => {
  const parsed = feedbackSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({
      errors: parsed.error.flatten().fieldErrors,
      message: "Nội dung góp ý chưa hợp lệ"
    });
    return;
  }

  try {
    const config = await getTesterExperienceConfig();
    if (!config.feedbackEnabled) {
      res.status(403).json({ message: "Kênh góp ý hiện đang tạm đóng" });
      return;
    }

    const user = res.locals.user as AuthenticatedUser;
    const feedback = await prisma.site_feedback.create({
      data: {
        category: parsed.data.category || null,
        message: parsed.data.message,
        page_url: parsed.data.pageUrl || null,
        rating: parsed.data.rating ?? null,
        user_id: user.id
      },
      select: { created_at: true, id: true, status: true }
    });

    res.status(201).json({
      feedback,
      message: "Cảm ơn bạn! MOLY đã nhận được góp ý."
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Không thể gửi góp ý lúc này" });
  }
});
