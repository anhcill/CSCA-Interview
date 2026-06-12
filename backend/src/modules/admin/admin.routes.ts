import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import { paginatedResponse, parsePagination } from "../../utils/pagination.js";
import { requireAuth, requireRole, type AuthenticatedUser } from "../auth/auth.middleware.js";

export const adminRouter = Router();

adminRouter.use(requireAuth, requireRole("ADMIN", "SUPER_ADMIN"));

const userStatusSchema = z.object({
  isActive: z.boolean()
});

adminRouter.get("/stats", async (_req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      activeUsers,
      adminUsers,
      totalSessions,
      completedSessions,
      sessionScore,
      totalQuestions,
      activeQuestions,
      aiCallsToday,
      weakAnswers
    ] = await Promise.all([
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.user.count({ where: { deletedAt: null, isActive: true } }),
      prisma.user.count({ where: { deletedAt: null, role: { in: ["ADMIN", "SUPER_ADMIN"] } } }),
      prisma.interviewSession.count(),
      prisma.interviewSession.count({ where: { status: "COMPLETED" } }),
      prisma.interviewSession.aggregate({
        _avg: { totalScore: true },
        where: { status: "COMPLETED", totalScore: { not: null } }
      }),
      prisma.question.count({ where: { deletedAt: null } }),
      prisma.question.count({ where: { deletedAt: null, isActive: true } }),
      prisma.ai_usage_logs.count({ where: { created_at: { gte: today }, error_message: null } }),
      prisma.interviewAnswer.findMany({
        orderBy: { scoreTotal: "asc" },
        select: {
          scoreTotal: true,
          sessionQuestion: {
            select: {
              category: true,
              questionId: true,
              questionText: true
            }
          }
        },
        take: 1000,
        where: { scoreTotal: { not: null } }
      })
    ]);

    const weakQuestionStats = new Map<
      string,
      {
        attempts: number;
        category: string | null;
        questionId: string | null;
        questionText: string;
        totalScore: number;
      }
    >();

    weakAnswers.forEach((answer) => {
      const question = answer.sessionQuestion;
      const key = question.questionId ?? question.questionText;
      const current = weakQuestionStats.get(key) ?? {
        attempts: 0,
        category: question.category ?? null,
        questionId: question.questionId ?? null,
        questionText: question.questionText,
        totalScore: 0
      };

      current.attempts += 1;
      current.totalScore += Number(answer.scoreTotal ?? 0);
      weakQuestionStats.set(key, current);
    });

    const weakQuestions = Array.from(weakQuestionStats.values())
      .map((question) => ({
        attempts: question.attempts,
        avgScore: question.attempts ? question.totalScore / question.attempts : 0,
        category: question.category,
        questionId: question.questionId,
        questionText: question.questionText
      }))
      .sort((a, b) => a.avgScore - b.avgScore)
      .slice(0, 8);

    res.json({
      activeQuestions,
      activeUsers,
      adminUsers,
      aiCallsToday,
      avgScore: Number(sessionScore._avg.totalScore ?? 0),
      completedSessions,
      inactiveUsers: Math.max(0, totalUsers - activeUsers),
      totalQuestions,
      totalSessions,
      totalUsers,
      weakQuestions
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Không thể tải thống kê admin" });
  }
});

adminRouter.get("/users", async (req, res) => {
  try {
    const { active, role, search } = req.query;
    const { limit, page, skip } = parsePagination(req.query);
    const where: any = { deletedAt: null };

    if (search) {
      const text = String(search);
      where.OR = [
        { email: { contains: text, mode: "insensitive" } },
        { fullName: { contains: text, mode: "insensitive" } },
        { phone: { contains: text, mode: "insensitive" } }
      ];
    }
    if (active === "true") where.isActive = true;
    if (active === "false") where.isActive = false;
    if (role) where.role = String(role);

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        select: {
          createdAt: true,
          email: true,
          fullName: true,
          id: true,
          isActive: true,
          lastLoginAt: true,
          phone: true,
          role: true,
          _count: { select: { interviewSessions: true } }
        },
        skip,
        take: limit
      }),
      prisma.user.count({ where })
    ]);

    res.json(paginatedResponse(users, total, page, limit));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Không thể tải danh sách users" });
  }
});

adminRouter.get("/users/:id", async (req, res) => {
  try {
    const user = await prisma.user.findFirst({
      where: { deletedAt: null, id: req.params.id },
      select: {
        createdAt: true,
        email: true,
        fullName: true,
        id: true,
        isActive: true,
        lastLoginAt: true,
        phone: true,
        role: true,
        _count: { select: { interviewSessions: true } },
        profile: true,
        interviewSessions: {
          orderBy: { createdAt: "desc" },
          select: {
            answeredQuestions: true,
            createdAt: true,
            id: true,
            language: true,
            mode: true,
            status: true,
            targetMajor: true,
            targetSchool: true,
            totalQuestions: true,
            totalScore: true
          },
          take: 20
        }
      }
    });

    if (!user) {
      res.status(404).json({ message: "Không tìm thấy user" });
      return;
    }

    res.json({ user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Không thể tải chi tiết user" });
  }
});

adminRouter.put("/users/:id/status", async (req, res) => {
  const parsed = userStatusSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ message: "Dữ liệu trạng thái không hợp lệ", errors: parsed.error.flatten().fieldErrors });
    return;
  }

  const admin = res.locals.user as AuthenticatedUser;
  if (admin.id === req.params.id && !parsed.data.isActive) {
    res.status(400).json({ message: "Không thể khóa chính tài khoản đang đăng nhập" });
    return;
  }

  try {
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { isActive: parsed.data.isActive },
      select: { email: true, fullName: true, id: true, isActive: true, role: true }
    });

    if (!parsed.data.isActive) {
      await prisma.authSession.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() }
      });
    }

    res.json({ user });
  } catch (error: any) {
    if (error.code === "P2025") {
      res.status(404).json({ message: "Không tìm thấy user" });
      return;
    }
    res.status(500).json({ message: "Không thể cập nhật trạng thái user" });
  }
});
