import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { getCachedJson, setCachedJson } from "../../cache/cache.service.js";
import { prisma } from "../../db/prisma.js";
import { writeAdminAuditLog } from "../admin/audit.service.js";
import { getOptionalAuthenticatedUser, requireAuth, requireRole, type AuthenticatedUser } from "../auth/auth.middleware.js";
import { paginatedResponse, parsePagination } from "../../utils/pagination.js";

export const scholarshipsRouter = Router();

const CACHE_TTL_MS = 10 * 60 * 1000;

const scholarshipListSelect = {
  code: true,
  commonInterviewQuestions: true,
  coverage: true,
  deadline: true,
  description: true,
  id: true,
  interviewFormat: true,
  isActive: true,
  name: true,
  requirements: true,
  studyPlanRequirements: true,
  tips: true
} as const;

type ScholarshipListItem = Prisma.ScholarshipGetPayload<{ select: typeof scholarshipListSelect }>;

async function getCachedScholarships() {
  const cacheKey = "metadata:scholarships:active";
  const cached = await getCachedJson<ScholarshipListItem[]>(cacheKey);
  if (cached) return cached;

  const scholarships = await prisma.scholarship.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: scholarshipListSelect
  });

  await setCachedJson(cacheKey, scholarships, CACHE_TTL_MS);
  return scholarships;
}

const jsonTextSchema = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  }
}, z.any().optional().nullable());

const scholarshipSchema = z.object({
  name: z.string().trim().min(1, "Tên học bổng là bắt buộc").max(500),
  code: z.string().trim().max(100).optional().nullable(),
  description: z.string().trim().max(5000).optional().nullable(),
  requirements: z.string().trim().max(10000).optional().nullable(),
  deadline: z.string().trim().max(255).optional().nullable(),
  coverage: z.string().trim().max(10000).optional().nullable(),
  studyPlanRequirements: z.string().trim().max(10000).optional().nullable(),
  interviewFormat: z.string().trim().max(10000).optional().nullable(),
  commonInterviewQuestions: jsonTextSchema,
  tips: z.string().trim().max(10000).optional().nullable(),
  isActive: z.boolean().optional()
});

type ScholarshipInput = z.infer<typeof scholarshipSchema>;
type ScholarshipTextKey = Exclude<keyof ScholarshipInput, "commonInterviewQuestions" | "isActive">;
type CleanScholarshipData = Partial<
  Pick<
    Prisma.ScholarshipUncheckedCreateInput,
    | "code"
    | "commonInterviewQuestions"
    | "coverage"
    | "deadline"
    | "description"
    | "interviewFormat"
    | "isActive"
    | "name"
    | "requirements"
    | "studyPlanRequirements"
    | "tips"
  >
>;

function cleanScholarshipData(input: Partial<ScholarshipInput>): CleanScholarshipData {
  return {
    code: cleanNullableText(input, "code"),
    commonInterviewQuestions: "commonInterviewQuestions" in input ? input.commonInterviewQuestions ?? null : undefined,
    coverage: cleanNullableText(input, "coverage"),
    deadline: cleanNullableText(input, "deadline"),
    description: cleanNullableText(input, "description"),
    interviewFormat: cleanNullableText(input, "interviewFormat"),
    isActive: input.isActive,
    name: "name" in input ? input.name : undefined,
    requirements: cleanNullableText(input, "requirements"),
    studyPlanRequirements: cleanNullableText(input, "studyPlanRequirements"),
    tips: cleanNullableText(input, "tips")
  };
}

function cleanNullableText(input: Partial<ScholarshipInput>, key: ScholarshipTextKey): string | null | undefined {
  if (!(key in input)) return undefined;
  const value = input[key];
  return typeof value === "string" ? value.trim() || null : null;
}

// GET /api/scholarships
scholarshipsRouter.get("/", async (req, res) => {
  try {
    const { search, active } = req.query;
    const requester = await getOptionalAuthenticatedUser(req);
    const canReadInactive = requester?.role === "ADMIN" || requester?.role === "SUPER_ADMIN";
    const where: any = {};
    const { limit, page, skip } = parsePagination(req.query);

    if (active !== "all" || !canReadInactive) where.isActive = true;
    if (search) where.name = { contains: String(search), mode: "insensitive" };

    if (!search && active !== "all") {
      const cachedScholarships = await getCachedScholarships();
      const scholarships = cachedScholarships.slice(skip, skip + limit);
      res.json(paginatedResponse(scholarships, cachedScholarships.length, page, limit));
      return;
    }

    const [scholarships, total] = await Promise.all([
      prisma.scholarship.findMany({
        where,
        orderBy: { name: "asc" },
        select: scholarshipListSelect,
        skip,
        take: limit
      }),
      prisma.scholarship.count({ where })
    ]);
    res.json(paginatedResponse(scholarships, total, page, limit));
  } catch {
    res.status(500).json({ message: "Lỗi server" });
  }
});

// GET /api/scholarships/:id
scholarshipsRouter.get("/:id", async (req, res) => {
  try {
    const requester = await getOptionalAuthenticatedUser(req);
    const canReadInactive = requester?.role === "ADMIN" || requester?.role === "SUPER_ADMIN";
    const s = await prisma.scholarship.findFirst({
      where: {
        id: req.params.id,
        ...(canReadInactive ? {} : { isActive: true })
      }
    });
    if (!s) { res.status(404).json({ message: "Không tìm thấy học bổng" }); return; }
    res.json(s);
  } catch {
    res.status(500).json({ message: "Lỗi server" });
  }
});

// POST /api/scholarships (admin)
scholarshipsRouter.post("/", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), async (req, res) => {
  const parsed = scholarshipSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Dữ liệu không hợp lệ", errors: parsed.error.flatten().fieldErrors });
    return;
  }

  try {
    const user = res.locals.user as AuthenticatedUser;
    const s = await prisma.scholarship.create({
      data: {
        ...cleanScholarshipData(parsed.data),
        name: parsed.data.name,
        isActive: parsed.data.isActive ?? true
      }
    });
    await writeAdminAuditLog(req, { action: "SCHOLARSHIP_CREATE", adminUserId: user.id, afterData: s, entityId: s.id, entityType: "scholarship" });
    res.status(201).json(s);
  } catch (err: any) {
    if (err.code === "P2002") { res.status(409).json({ message: "Học bổng đã tồn tại" }); return; }
    res.status(500).json({ message: "Lỗi server" });
  }
});

// PUT /api/scholarships/:id (admin)
scholarshipsRouter.put("/:id", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), async (req, res) => {
  const parsed = scholarshipSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Dữ liệu không hợp lệ", errors: parsed.error.flatten().fieldErrors });
    return;
  }

  try {
    const user = res.locals.user as AuthenticatedUser;
    const before = await prisma.scholarship.findUnique({ where: { id: req.params.id } });
    const s = await prisma.scholarship.update({
      where: { id: req.params.id },
      data: cleanScholarshipData(parsed.data),
    });
    await writeAdminAuditLog(req, { action: "SCHOLARSHIP_UPDATE", adminUserId: user.id, afterData: s, beforeData: before, entityId: s.id, entityType: "scholarship" });
    res.json(s);
  } catch (err: any) {
    if (err.code === "P2025") { res.status(404).json({ message: "Không tìm thấy học bổng" }); return; }
    if (err.code === "P2002") { res.status(409).json({ message: "Tên học bổng đã tồn tại" }); return; }
    res.status(500).json({ message: "Lỗi server" });
  }
});

// DELETE /api/scholarships/:id (admin)
scholarshipsRouter.delete("/:id", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), async (req, res) => {
  try {
    const user = res.locals.user as AuthenticatedUser;
    const before = await prisma.scholarship.findUnique({ where: { id: req.params.id } });
    const s = await prisma.scholarship.update({ where: { id: req.params.id }, data: { isActive: false } });
    await writeAdminAuditLog(req, { action: "SCHOLARSHIP_DEACTIVATE", adminUserId: user.id, afterData: s, beforeData: before, entityId: s.id, entityType: "scholarship" });
    res.json({ message: "Đã xoá học bổng" });
  } catch (err: any) {
    if (err.code === "P2025") { res.status(404).json({ message: "Không tìm thấy học bổng" }); return; }
    res.status(500).json({ message: "Lỗi server" });
  }
});
