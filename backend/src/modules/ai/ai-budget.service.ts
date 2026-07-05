import { prisma } from "../../db/prisma.js";

export const maxAiCallsPerUserPerDay = Number(process.env.AI_DAILY_CALL_LIMIT ?? 40);

export type AiCallBudgetResult =
  | { ok: true }
  | { ok: false; message: string };

export async function checkAiCallBudget(userId: string, requestedCalls = 1): Promise<AiCallBudgetResult> {
  if (requestedCalls <= 0) {
    return { ok: true };
  }

  if (!Number.isFinite(maxAiCallsPerUserPerDay) || maxAiCallsPerUserPerDay <= 0) {
    return { ok: true };
  }

  const since = new Date();
  since.setHours(0, 0, 0, 0);

  const used = await prisma.ai_usage_logs.count({
    where: {
      created_at: { gte: since },
      error_message: null,
      user_id: userId
    }
  });

  if (used + requestedCalls > maxAiCallsPerUserPerDay) {
    return {
      ok: false,
      message: `Bạn đã đạt giới hạn ${maxAiCallsPerUserPerDay} lượt AI hôm nay. Vui lòng thử lại ngày mai.`
    };
  }

  return { ok: true };
}
