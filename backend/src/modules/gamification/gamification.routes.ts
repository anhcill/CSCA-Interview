import { LanguageCode } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { requireAuth, type AuthenticatedUser } from "../auth/auth.middleware.js";
import { getGamificationSummary, updateUserPreferences } from "./gamification.service.js";

export const gamificationRouter = Router();

const preferencesSchema = z.object({
  browserNotificationsEnabled: z.boolean().optional(),
  onboardingCompleted: z.boolean().optional(),
  preferredLanguage: z.nativeEnum(LanguageCode).optional(),
  theme: z.enum(["dark", "light", "system"]).optional(),
  weeklyGoalTarget: z.coerce.number().int().min(1).max(30).optional()
});

gamificationRouter.use(requireAuth);

gamificationRouter.get("/summary", async (_req, res) => {
  const user = res.locals.user as AuthenticatedUser;
  const summary = await getGamificationSummary(user.id);
  res.json(summary);
});

gamificationRouter.put("/preferences", async (req, res) => {
  const parsed = preferencesSchema.safeParse(req.body ?? {});

  if (!parsed.success) {
    res.status(400).json({
      message: "Dữ liệu tùy chọn không hợp lệ",
      errors: parsed.error.flatten().fieldErrors
    });
    return;
  }

  const user = res.locals.user as AuthenticatedUser;
  await updateUserPreferences(user.id, parsed.data);
  res.json(await getGamificationSummary(user.id));
});
