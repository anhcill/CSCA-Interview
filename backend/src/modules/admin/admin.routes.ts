import { admission_season_status, ai_task_type, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { Router, type Response } from "express";
import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import { requireAdmin } from "../../middleware/require-admin.js";
import { paginatedResponse, parsePagination } from "../../utils/pagination.js";
import { requireAuth, type AuthenticatedUser } from "../auth/auth.middleware.js";
import { passwordHashRounds } from "../auth/auth.utils.js";
import { importQuestionsFromCsv } from "../questions/questions.routes.js";
import { writeAdminAuditLog } from "./audit.service.js";
import {
  getAdminOverviewStats,
  getSessionsByDay,
  getScoreDistribution,
  getTopActiveUsers,
  getWeakestQuestions,
  getUserDistribution,
  getActivityHeatmap,
  getAICostTracking
} from "./admin-stats.service.js";

export const adminRouter = Router();

adminRouter.use(requireAuth, requireAdmin);

// Thống kê tổng quan cho Admin Dashboard
adminRouter.get("/stats/overview", async (_req, res) => {
  try {
    const stats = await getAdminOverviewStats();
    res.json(stats);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Không thể tải thống kê tổng quan" });
  }
});

// Thống kê sessions theo ngày (mặc định 30 ngày)
adminRouter.get("/stats/sessions-by-day", async (req, res) => {
  const days = req.query.days ? parseInt(String(req.query.days)) : 30;
  try {
    const stats = await getSessionsByDay(days);
    res.json(stats);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Không thể tải biểu đồ buổi phỏng vấn" });
  }
});

// Phân bố điểm số của các buổi phỏng vấn đã hoàn thành
adminRouter.get("/stats/score-distribution", async (_req, res) => {
  try {
    const stats = await getScoreDistribution();
    res.json(stats);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Không thể tải phân bố điểm số" });
  }
});

// Danh sách người dùng hoạt động tích cực nhất
adminRouter.get("/stats/top-users", async (req, res) => {
  const limit = req.query.limit ? parseInt(String(req.query.limit)) : 10;
  try {
    const stats = await getTopActiveUsers(limit);
    res.json(stats);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Không thể tải bảng xếp hạng người dùng" });
  }
});

// Danh sách các câu hỏi có điểm trung bình thấp nhất (cần cải thiện)
adminRouter.get("/stats/weak-questions", async (req, res) => {
  const limit = req.query.limit ? parseInt(String(req.query.limit)) : 10;
  try {
    const stats = await getWeakestQuestions(limit);
    res.json(stats);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Không thể tải danh sách câu hỏi yếu" });
  }
});

// Phân bố người dùng theo trường học và học bổng mục tiêu
adminRouter.get("/stats/user-distribution", async (_req, res) => {
  try {
    const stats = await getUserDistribution();
    res.json(stats);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Không thể tải phân bố người dùng" });
  }
});

// Heatmap giờ hoạt động cao điểm trong 90 ngày qua
adminRouter.get("/stats/activity-heatmap", async (_req, res) => {
  try {
    const stats = await getActivityHeatmap();
    res.json(stats);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Không thể tải bản đồ nhiệt hoạt động" });
  }
});

// Biểu đồ theo dõi chi phí sử dụng OpenAI API
adminRouter.get("/stats/ai-cost", async (req, res) => {
  const days = req.query.days ? parseInt(String(req.query.days)) : 30;
  try {
    const stats = await getAICostTracking(days);
    res.json(stats);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Không thể tải chi phí OpenAI" });
  }
});


const userStatusSchema = z.object({ isActive: z.boolean() });
const userRoleSchema = z.object({ role: z.nativeEnum(Role) });
const resetPasswordSchema = z.object({
  password: z.string().min(8, "Mat khau moi can toi thieu 8 ky tu")
});
const csvImportSchema = z.object({
  csv: z.string().min(1, "CSV không được để trống")
});

const jsonStringSchema = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return { notes: trimmed };
  }
}, z.any().optional().nullable());

const settingSchema = z.object({
  description: z.string().trim().max(2000).optional().nullable(),
  settingValue: z.any()
});

const promptTemplateSchema = z.object({
  isActive: z.boolean().optional(),
  name: z.string().trim().min(1).max(150),
  outputSchema: jsonStringSchema,
  systemPrompt: z.string().trim().min(1),
  taskType: z.nativeEnum(ai_task_type),
  userPromptTemplate: z.string().trim().min(1),
  version: z.number().int().positive().optional()
});

const seasonSchema = z.object({
  admissionYear: z.number().int().min(2000).max(2100),
  endsAt: z.string().trim().optional().nullable(),
  name: z.string().trim().min(1).max(150),
  note: z.string().trim().max(5000).optional().nullable(),
  startsAt: z.string().trim().optional().nullable(),
  status: z.nativeEnum(admission_season_status).optional()
});

const schoolMajorSchema = z.object({
  admissionSeasonId: z.string().uuid().optional().nullable(),
  majorId: z.string().uuid(),
  note: z.string().trim().max(5000).optional().nullable(),
  schoolId: z.string().uuid()
});

const schoolScholarshipSchema = z.object({
  admissionSeasonId: z.string().uuid().optional().nullable(),
  note: z.string().trim().max(5000).optional().nullable(),
  scholarshipId: z.string().uuid(),
  schoolId: z.string().uuid()
});

const questionTagSchema = z.object({
  description: z.string().trim().max(2000).optional().nullable(),
  name: z.string().trim().min(1).max(100)
});

function getAdmin(res: Response) {
  return res.locals.user as AuthenticatedUser;
}

function requireSuperAdmin(res: Response) {
  const admin = getAdmin(res);
  if (admin.role !== "SUPER_ADMIN") {
    res.status(403).json({ message: "Chi SUPER_ADMIN moi duoc dung chuc nang nay" });
    return null;
  }
  return admin;
}

function parseRange(query: { from?: unknown; to?: unknown }) {
  const from = typeof query.from === "string" && query.from ? new Date(`${query.from}T00:00:00.000Z`) : null;
  const to = typeof query.to === "string" && query.to ? new Date(`${query.to}T23:59:59.999Z`) : null;
  return {
    from: from && Number.isFinite(from.getTime()) ? from : null,
    to: to && Number.isFinite(to.getTime()) ? to : null
  };
}

function dateWhere(field: string, from: Date | null, to: Date | null) {
  if (!from && !to) return {};
  return {
    [field]: {
      ...(from ? { gte: from } : {}),
      ...(to ? { lte: to } : {})
    }
  };
}

function toDateOnly(value?: string | null) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) ? date : null;
}

function publicUserSelect() {
  return { email: true, fullName: true, id: true, isActive: true, role: true };
}

adminRouter.get("/stats", async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 6);
    const { from, to } = parseRange(req.query);
    const sessionDateWhere = dateWhere("createdAt", from, to);
    const userDateWhere = dateWhere("createdAt", from, to);
    const answerDateWhere = dateWhere("answeredAt", from, to);
    const aiDateWhere = from || to ? dateWhere("created_at", from, to) : { created_at: { gte: today } };

    const [
      totalUsers,
      activeUsers,
      adminUsers,
      totalSessions,
      completedSessions,
      sessionScore,
      totalQuestions,
      activeQuestions,
      aiUsage,
      weakAnswers,
      activitySessions
    ] = await Promise.all([
      prisma.user.count({ where: { deletedAt: null, ...userDateWhere } }),
      prisma.user.count({ where: { deletedAt: null, isActive: true, ...userDateWhere } }),
      prisma.user.count({ where: { deletedAt: null, role: { in: ["ADMIN", "SUPER_ADMIN"] } } }),
      prisma.interviewSession.count({ where: sessionDateWhere }),
      prisma.interviewSession.count({ where: { status: "COMPLETED", ...sessionDateWhere } }),
      prisma.interviewSession.aggregate({
        _avg: { totalScore: true },
        where: { status: "COMPLETED", totalScore: { not: null }, ...sessionDateWhere }
      }),
      prisma.question.count({ where: { deletedAt: null } }),
      prisma.question.count({ where: { deletedAt: null, isActive: true } }),
      prisma.ai_usage_logs.aggregate({
        _count: { id: true },
        _sum: { cost_usd: true, total_tokens: true },
        where: { error_message: null, ...aiDateWhere }
      }),
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
        where: { scoreTotal: { not: null }, ...answerDateWhere }
      }),
      prisma.interviewSession.findMany({
        orderBy: { createdAt: "asc" },
        select: { createdAt: true, status: true },
        take: 5000,
        where: { createdAt: { gte: sevenDaysAgo } }
      })
    ]);

    const weakQuestionStats = new Map<
      string,
      { attempts: number; category: string | null; questionId: string | null; questionText: string; totalScore: number }
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
    const activity7d = buildDailyActivity(activitySessions, sevenDaysAgo);

    res.json({
      activeQuestions,
      activeUsers,
      activity7d,
      adminUsers,
      aiCallsToday: aiUsage._count.id,
      aiCostUsd: Number(aiUsage._sum.cost_usd ?? 0),
      aiTokens: Number(aiUsage._sum.total_tokens ?? 0),
      avgScore: Number(sessionScore._avg.totalScore ?? 0),
      completedSessions,
      dateFrom: from?.toISOString() ?? null,
      dateTo: to?.toISOString() ?? null,
      inactiveUsers: Math.max(0, totalUsers - activeUsers),
      totalQuestions,
      totalSessions,
      totalUsers,
      weakQuestions
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Khong the tai thong ke admin" });
  }
});

function buildDailyActivity(sessions: Array<{ createdAt: Date; status: string }>, startDate: Date) {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);
    const key = date.toISOString().slice(0, 10);
    return { completed: 0, date: key, sessions: 0 };
  });
  const byDate = new Map(days.map((day) => [day.date, day]));

  sessions.forEach((session) => {
    const key = session.createdAt.toISOString().slice(0, 10);
    const day = byDate.get(key);
    if (!day) return;
    day.sessions += 1;
    if (session.status === "COMPLETED") day.completed += 1;
  });

  return days;
}

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
    res.status(500).json({ message: "Khong the tai danh sach users" });
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
      res.status(404).json({ message: "Khong tim thay user" });
      return;
    }

    res.json({ user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Khong the tai chi tiet user" });
  }
});

adminRouter.put("/users/:id/status", async (req, res) => {
  const parsed = userStatusSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ message: "Du lieu trang thai khong hop le", errors: parsed.error.flatten().fieldErrors });
    return;
  }

  const admin = getAdmin(res);
  if (admin.id === req.params.id && !parsed.data.isActive) {
    res.status(400).json({ message: "Khong the khoa chinh tai khoan dang dang nhap" });
    return;
  }

  try {
    const before = await prisma.user.findUnique({ where: { id: req.params.id }, select: publicUserSelect() });
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { isActive: parsed.data.isActive },
      select: publicUserSelect()
    });

    if (!parsed.data.isActive) {
      await prisma.authSession.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() }
      });
    }

    await writeAdminAuditLog(req, {
      action: parsed.data.isActive ? "USER_UNLOCK" : "USER_LOCK",
      adminUserId: admin.id,
      afterData: user,
      beforeData: before,
      entityId: user.id,
      entityType: "user"
    });

    res.json({ user });
  } catch (error: any) {
    if (error.code === "P2025") {
      res.status(404).json({ message: "Khong tim thay user" });
      return;
    }
    res.status(500).json({ message: "Khong the cap nhat trang thai user" });
  }
});

adminRouter.put("/users/:id/role", async (req, res) => {
  const admin = requireSuperAdmin(res);
  if (!admin) return;

  const parsed = userRoleSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ message: "Role khong hop le", errors: parsed.error.flatten().fieldErrors });
    return;
  }
  if (admin.id === req.params.id) {
    res.status(400).json({ message: "Khong the doi role cua chinh minh" });
    return;
  }

  try {
    const before = await prisma.user.findUnique({ where: { id: req.params.id }, select: publicUserSelect() });
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { role: parsed.data.role },
      select: publicUserSelect()
    });

    await writeAdminAuditLog(req, {
      action: "USER_ROLE_UPDATE",
      adminUserId: admin.id,
      afterData: user,
      beforeData: before,
      entityId: user.id,
      entityType: "user"
    });

    res.json({ user });
  } catch (error: any) {
    if (error.code === "P2025") {
      res.status(404).json({ message: "Khong tim thay user" });
      return;
    }
    res.status(500).json({ message: "Khong the cap nhat role user" });
  }
});

adminRouter.post("/users/:id/reset-password", async (req, res) => {
  const parsed = resetPasswordSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ message: "Mat khau moi khong hop le", errors: parsed.error.flatten().fieldErrors });
    return;
  }

  const admin = getAdmin(res);

  try {
    const target = await prisma.user.findFirst({
      where: { deletedAt: null, id: req.params.id },
      select: publicUserSelect()
    });
    if (!target) {
      res.status(404).json({ message: "Khong tim thay user" });
      return;
    }
    if (target.role === "SUPER_ADMIN" && admin.role !== "SUPER_ADMIN") {
      res.status(403).json({ message: "Chi SUPER_ADMIN moi reset duoc SUPER_ADMIN" });
      return;
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, passwordHashRounds);
    await prisma.user.update({ where: { id: target.id }, data: { passwordHash } });
    await prisma.authSession.updateMany({
      where: { userId: target.id, revokedAt: null },
      data: { revokedAt: new Date() }
    });

    await writeAdminAuditLog(req, {
      action: "USER_PASSWORD_RESET",
      adminUserId: admin.id,
      afterData: { id: target.id, email: target.email },
      entityId: target.id,
      entityType: "user"
    });

    res.json({ message: "Da reset mat khau va thu hoi phien dang nhap cu" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Khong the reset mat khau" });
  }
});

adminRouter.get("/audit-logs", async (req, res) => {
  try {
    const { action, adminUserId, entityType, from, to } = req.query;
    const { limit, page, skip } = parsePagination(req.query);
    const range = parseRange({ from, to });
    const where: any = { ...dateWhere("created_at", range.from, range.to) };

    if (action) where.action = { contains: String(action), mode: "insensitive" };
    if (entityType) where.entity_type = String(entityType);
    if (adminUserId) where.admin_user_id = String(adminUserId);

    const [logs, total] = await Promise.all([
      prisma.admin_audit_logs.findMany({
        where,
        include: { users: { select: { email: true, fullName: true, id: true } } },
        orderBy: { created_at: "desc" },
        skip,
        take: limit
      }),
      prisma.admin_audit_logs.count({ where })
    ]);

    res.json(paginatedResponse(logs, total, page, limit));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Khong the tai audit logs" });
  }
});

adminRouter.get("/settings", async (_req, res) => {
  try {
    const settings = await prisma.system_settings.findMany({
      include: { users: { select: { email: true, fullName: true, id: true } } },
      orderBy: { setting_key: "asc" }
    });
    res.json({ data: settings });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Khong the tai settings" });
  }
});

adminRouter.get("/question-tags", async (_req, res) => {
  try {
    const tags = await prisma.question_tags.findMany({
      orderBy: { name: "asc" },
      select: {
        created_at: true,
        description: true,
        id: true,
        name: true,
        _count: { select: { question_tag_links: true } }
      }
    });
    res.json({ data: tags });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Khong the tai question tags" });
  }
});

adminRouter.post("/questions/import", async (req, res) => {
  const parsed = csvImportSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ message: "Dữ liệu CSV không hợp lệ", errors: parsed.error.flatten().fieldErrors });
    return;
  }

  try {
    const result = await importQuestionsFromCsv(req, getAdmin(res), parsed.data.csv);
    res.status(201).json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "CSV_EMPTY") {
      res.status(400).json({ message: "CSV không có dòng dữ liệu" });
      return;
    }
    console.error(error);
    res.status(500).json({ message: "Không thể import CSV câu hỏi" });
  }
});

adminRouter.post("/question-tags", async (req, res) => {
  const parsed = questionTagSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ message: "Tag khong hop le", errors: parsed.error.flatten().fieldErrors });
    return;
  }
  const admin = getAdmin(res);
  try {
    const tag = await prisma.question_tags.create({
      data: {
        description: parsed.data.description ?? null,
        name: parsed.data.name
      }
    });
    await writeAdminAuditLog(req, {
      action: "QUESTION_TAG_CREATE",
      adminUserId: admin.id,
      afterData: tag,
      entityId: tag.id,
      entityType: "question_tag"
    });
    res.status(201).json({ tag });
  } catch (error: any) {
    if (error.code === "P2002") {
      res.status(409).json({ message: "Tag da ton tai" });
      return;
    }
    res.status(500).json({ message: "Khong the tao tag" });
  }
});

adminRouter.put("/question-tags/:id", async (req, res) => {
  const parsed = questionTagSchema.partial().safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ message: "Tag khong hop le", errors: parsed.error.flatten().fieldErrors });
    return;
  }
  const admin = getAdmin(res);
  try {
    const before = await prisma.question_tags.findUnique({ where: { id: req.params.id } });
    const tag = await prisma.question_tags.update({
      where: { id: req.params.id },
      data: parsed.data
    });
    await writeAdminAuditLog(req, {
      action: "QUESTION_TAG_UPDATE",
      adminUserId: admin.id,
      afterData: tag,
      beforeData: before,
      entityId: tag.id,
      entityType: "question_tag"
    });
    res.json({ tag });
  } catch (error: any) {
    if (error.code === "P2025") {
      res.status(404).json({ message: "Khong tim thay tag" });
      return;
    }
    if (error.code === "P2002") {
      res.status(409).json({ message: "Tag da ton tai" });
      return;
    }
    res.status(500).json({ message: "Khong the cap nhat tag" });
  }
});

adminRouter.delete("/question-tags/:id", async (req, res) => {
  const admin = getAdmin(res);
  try {
    const before = await prisma.question_tags.delete({ where: { id: req.params.id } });
    await writeAdminAuditLog(req, {
      action: "QUESTION_TAG_DELETE",
      adminUserId: admin.id,
      beforeData: before,
      entityId: before.id,
      entityType: "question_tag"
    });
    res.json({ message: "Da xoa tag" });
  } catch (error: any) {
    if (error.code === "P2025") {
      res.status(404).json({ message: "Khong tim thay tag" });
      return;
    }
    res.status(500).json({ message: "Khong the xoa tag" });
  }
});

adminRouter.put("/settings/:key", async (req, res) => {
  const parsed = settingSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ message: "Setting khong hop le", errors: parsed.error.flatten().fieldErrors });
    return;
  }

  const admin = getAdmin(res);
  try {
    const key = req.params.key.trim();
    const before = await prisma.system_settings.findUnique({ where: { setting_key: key } });
    const setting = await prisma.system_settings.upsert({
      where: { setting_key: key },
      update: {
        description: parsed.data.description ?? null,
        setting_value: parsed.data.settingValue,
        updated_at: new Date(),
        updated_by: admin.id
      },
      create: {
        description: parsed.data.description ?? null,
        setting_key: key,
        setting_value: parsed.data.settingValue,
        updated_by: admin.id
      }
    });

    await writeAdminAuditLog(req, {
      action: before ? "SETTING_UPDATE" : "SETTING_CREATE",
      adminUserId: admin.id,
      afterData: setting,
      beforeData: before,
      entityId: setting.id,
      entityType: "system_setting"
    });

    res.json({ setting });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Khong the luu setting" });
  }
});

adminRouter.get("/prompt-templates", async (req, res) => {
  try {
    const { active, taskType } = req.query;
    const where: any = {};
    if (active === "true") where.is_active = true;
    if (active === "false") where.is_active = false;
    if (taskType) where.task_type = String(taskType);

    const templates = await prisma.ai_prompt_templates.findMany({
      where,
      include: { users: { select: { email: true, fullName: true, id: true } } },
      orderBy: [{ task_type: "asc" }, { name: "asc" }, { version: "desc" }]
    });
    res.json({ data: templates, taskTypes: Object.values(ai_task_type) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Khong the tai prompt templates" });
  }
});

adminRouter.post("/prompt-templates", async (req, res) => {
  const parsed = promptTemplateSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ message: "Prompt template khong hop le", errors: parsed.error.flatten().fieldErrors });
    return;
  }

  const admin = getAdmin(res);
  try {
    const template = await prisma.ai_prompt_templates.create({
      data: {
        created_by: admin.id,
        is_active: parsed.data.isActive ?? true,
        name: parsed.data.name,
        output_schema: parsed.data.outputSchema ?? null,
        system_prompt: parsed.data.systemPrompt,
        task_type: parsed.data.taskType,
        user_prompt_template: parsed.data.userPromptTemplate,
        version: parsed.data.version ?? 1
      }
    });

    await writeAdminAuditLog(req, {
      action: "PROMPT_TEMPLATE_CREATE",
      adminUserId: admin.id,
      afterData: template,
      entityId: template.id,
      entityType: "ai_prompt_template"
    });

    res.status(201).json({ template });
  } catch (error: any) {
    if (error.code === "P2002") {
      res.status(409).json({ message: "Template trung task/name/version" });
      return;
    }
    res.status(500).json({ message: "Khong the tao prompt template" });
  }
});

adminRouter.put("/prompt-templates/:id", async (req, res) => {
  const parsed = promptTemplateSchema.partial().safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ message: "Prompt template khong hop le", errors: parsed.error.flatten().fieldErrors });
    return;
  }

  const admin = getAdmin(res);
  try {
    const before = await prisma.ai_prompt_templates.findUnique({ where: { id: req.params.id } });
    const template = await prisma.ai_prompt_templates.update({
      where: { id: req.params.id },
      data: {
        is_active: parsed.data.isActive,
        name: parsed.data.name,
        output_schema: parsed.data.outputSchema === undefined ? undefined : parsed.data.outputSchema,
        system_prompt: parsed.data.systemPrompt,
        task_type: parsed.data.taskType,
        updated_at: new Date(),
        user_prompt_template: parsed.data.userPromptTemplate,
        version: parsed.data.version
      }
    });

    await writeAdminAuditLog(req, {
      action: "PROMPT_TEMPLATE_UPDATE",
      adminUserId: admin.id,
      afterData: template,
      beforeData: before,
      entityId: template.id,
      entityType: "ai_prompt_template"
    });

    res.json({ template });
  } catch (error: any) {
    if (error.code === "P2025") {
      res.status(404).json({ message: "Khong tim thay prompt template" });
      return;
    }
    if (error.code === "P2002") {
      res.status(409).json({ message: "Template trung task/name/version" });
      return;
    }
    res.status(500).json({ message: "Khong the cap nhat prompt template" });
  }
});

adminRouter.get("/admission-seasons", async (_req, res) => {
  try {
    const seasons = await prisma.admission_seasons.findMany({
      orderBy: [{ admission_year: "desc" }, { name: "asc" }]
    });
    res.json({ data: seasons, statuses: Object.values(admission_season_status) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Khong the tai admission seasons" });
  }
});

adminRouter.post("/admission-seasons", async (req, res) => {
  const parsed = seasonSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ message: "Mua tuyen sinh khong hop le", errors: parsed.error.flatten().fieldErrors });
    return;
  }

  const admin = getAdmin(res);
  try {
    const season = await prisma.admission_seasons.create({
      data: {
        admission_year: parsed.data.admissionYear,
        ends_at: toDateOnly(parsed.data.endsAt),
        name: parsed.data.name,
        note: parsed.data.note ?? null,
        starts_at: toDateOnly(parsed.data.startsAt),
        status: parsed.data.status ?? "DRAFT"
      }
    });
    await writeAdminAuditLog(req, {
      action: "ADMISSION_SEASON_CREATE",
      adminUserId: admin.id,
      afterData: season,
      entityId: season.id,
      entityType: "admission_season"
    });
    res.status(201).json({ season });
  } catch (error: any) {
    if (error.code === "P2002") {
      res.status(409).json({ message: "Mua tuyen sinh da ton tai" });
      return;
    }
    res.status(500).json({ message: "Khong the tao mua tuyen sinh" });
  }
});

adminRouter.put("/admission-seasons/:id", async (req, res) => {
  const parsed = seasonSchema.partial().safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ message: "Mua tuyen sinh khong hop le", errors: parsed.error.flatten().fieldErrors });
    return;
  }

  const admin = getAdmin(res);
  try {
    const before = await prisma.admission_seasons.findUnique({ where: { id: req.params.id } });
    const season = await prisma.admission_seasons.update({
      where: { id: req.params.id },
      data: {
        admission_year: parsed.data.admissionYear,
        ends_at: parsed.data.endsAt === undefined ? undefined : toDateOnly(parsed.data.endsAt),
        name: parsed.data.name,
        note: parsed.data.note,
        starts_at: parsed.data.startsAt === undefined ? undefined : toDateOnly(parsed.data.startsAt),
        status: parsed.data.status,
        updated_at: new Date()
      }
    });
    await writeAdminAuditLog(req, {
      action: "ADMISSION_SEASON_UPDATE",
      adminUserId: admin.id,
      afterData: season,
      beforeData: before,
      entityId: season.id,
      entityType: "admission_season"
    });
    res.json({ season });
  } catch (error: any) {
    if (error.code === "P2025") {
      res.status(404).json({ message: "Khong tim thay mua tuyen sinh" });
      return;
    }
    if (error.code === "P2002") {
      res.status(409).json({ message: "Mua tuyen sinh da ton tai" });
      return;
    }
    res.status(500).json({ message: "Khong the cap nhat mua tuyen sinh" });
  }
});

adminRouter.get("/school-majors", async (req, res) => {
  try {
    const { schoolId, admissionSeasonId } = req.query;
    const where: any = {};
    if (schoolId) where.school_id = String(schoolId);
    if (admissionSeasonId) where.admission_season_id = String(admissionSeasonId);
    const rows = await prisma.school_majors.findMany({
      where,
      include: {
        admission_seasons: true,
        majors: { select: { degreeLevel: true, id: true, name: true } },
        schools: { select: { id: true, name: true } }
      },
      orderBy: { created_at: "desc" },
      take: 300
    });
    res.json({ data: rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Khong the tai mapping truong-nganh" });
  }
});

adminRouter.post("/school-majors", async (req, res) => {
  const parsed = schoolMajorSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ message: "Mapping truong-nganh khong hop le", errors: parsed.error.flatten().fieldErrors });
    return;
  }
  const admin = getAdmin(res);
  try {
    const row = await prisma.school_majors.create({
      data: {
        admission_season_id: parsed.data.admissionSeasonId ?? null,
        major_id: parsed.data.majorId,
        note: parsed.data.note ?? null,
        school_id: parsed.data.schoolId
      }
    });
    await writeAdminAuditLog(req, {
      action: "SCHOOL_MAJOR_CREATE",
      adminUserId: admin.id,
      afterData: row,
      entityId: row.id,
      entityType: "school_major"
    });
    res.status(201).json({ item: row });
  } catch (error: any) {
    if (error.code === "P2002") {
      res.status(409).json({ message: "Mapping truong-nganh da ton tai" });
      return;
    }
    res.status(500).json({ message: "Khong the tao mapping truong-nganh" });
  }
});

adminRouter.delete("/school-majors/:id", async (req, res) => {
  const admin = getAdmin(res);
  try {
    const before = await prisma.school_majors.delete({ where: { id: req.params.id } });
    await writeAdminAuditLog(req, {
      action: "SCHOOL_MAJOR_DELETE",
      adminUserId: admin.id,
      beforeData: before,
      entityId: before.id,
      entityType: "school_major"
    });
    res.json({ message: "Da xoa mapping truong-nganh" });
  } catch (error: any) {
    if (error.code === "P2025") {
      res.status(404).json({ message: "Khong tim thay mapping" });
      return;
    }
    res.status(500).json({ message: "Khong the xoa mapping truong-nganh" });
  }
});

adminRouter.get("/school-scholarships", async (req, res) => {
  try {
    const { schoolId, admissionSeasonId } = req.query;
    const where: any = {};
    if (schoolId) where.school_id = String(schoolId);
    if (admissionSeasonId) where.admission_season_id = String(admissionSeasonId);
    const rows = await prisma.school_scholarships.findMany({
      where,
      include: {
        admission_seasons: true,
        scholarships: { select: { code: true, id: true, name: true } },
        schools: { select: { id: true, name: true } }
      },
      orderBy: { created_at: "desc" },
      take: 300
    });
    res.json({ data: rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Khong the tai mapping truong-hoc bong" });
  }
});

adminRouter.post("/school-scholarships", async (req, res) => {
  const parsed = schoolScholarshipSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ message: "Mapping truong-hoc bong khong hop le", errors: parsed.error.flatten().fieldErrors });
    return;
  }
  const admin = getAdmin(res);
  try {
    const row = await prisma.school_scholarships.create({
      data: {
        admission_season_id: parsed.data.admissionSeasonId ?? null,
        note: parsed.data.note ?? null,
        scholarship_id: parsed.data.scholarshipId,
        school_id: parsed.data.schoolId
      }
    });
    await writeAdminAuditLog(req, {
      action: "SCHOOL_SCHOLARSHIP_CREATE",
      adminUserId: admin.id,
      afterData: row,
      entityId: row.id,
      entityType: "school_scholarship"
    });
    res.status(201).json({ item: row });
  } catch (error: any) {
    if (error.code === "P2002") {
      res.status(409).json({ message: "Mapping truong-hoc bong da ton tai" });
      return;
    }
    res.status(500).json({ message: "Khong the tao mapping truong-hoc bong" });
  }
});

adminRouter.delete("/school-scholarships/:id", async (req, res) => {
  const admin = getAdmin(res);
  try {
    const before = await prisma.school_scholarships.delete({ where: { id: req.params.id } });
    await writeAdminAuditLog(req, {
      action: "SCHOOL_SCHOLARSHIP_DELETE",
      adminUserId: admin.id,
      beforeData: before,
      entityId: before.id,
      entityType: "school_scholarship"
    });
    res.json({ message: "Da xoa mapping truong-hoc bong" });
  } catch (error: any) {
    if (error.code === "P2025") {
      res.status(404).json({ message: "Khong tim thay mapping" });
      return;
    }
    res.status(500).json({ message: "Khong the xoa mapping truong-hoc bong" });
  }
});
