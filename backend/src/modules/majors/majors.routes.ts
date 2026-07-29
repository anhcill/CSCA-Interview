import { DegreeLevel, type Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { getCachedJson, setCachedJson } from "../../cache/cache.service.js";
import { prisma } from "../../db/prisma.js";
import { writeAdminAuditLog } from "../admin/audit.service.js";
import { getOptionalAuthenticatedUser, requireAuth, requireRole, type AuthenticatedUser } from "../auth/auth.middleware.js";
import { paginatedResponse, parsePagination } from "../../utils/pagination.js";

export const majorsRouter = Router();

const CACHE_TTL_MS = 10 * 60 * 1000;

const majorListSelect = {
  degreeLevel: true,
  careerOutcomes: true,
  description: true,
  id: true,
  interviewFocus: true,
  isActive: true,
  name: true,
  nameEn: true,
  nameZh: true,
  requirements: true,
  researchAreas: true,
  researchLabs: true
} as const;

type MajorListItem = Prisma.MajorGetPayload<{ select: typeof majorListSelect }>;

async function getCachedMajors() {
  const cacheKey = "metadata:majors:active";
  const cached = await getCachedJson<MajorListItem[]>(cacheKey);
  if (cached) return cached;

  const majors = await prisma.major.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: majorListSelect
  });

  await setCachedJson(cacheKey, majors, CACHE_TTL_MS);
  return majors;
}

const majorSchema = z.object({
  name: z.string().trim().min(1, "Tên ngành là bắt buộc").max(500),
  nameZh: z.string().trim().max(500).optional().nullable(),
  nameEn: z.string().trim().max(500).optional().nullable(),
  degreeLevel: z.nativeEnum(DegreeLevel, { errorMap: () => ({ message: "Bậc học không hợp lệ" }) }),
  description: z.string().trim().max(5000).optional().nullable(),
  requirements: z.string().trim().max(10000).optional().nullable(),
  researchAreas: z.string().trim().max(10000).optional().nullable(),
  researchLabs: z.string().trim().max(10000).optional().nullable(),
  careerOutcomes: z.string().trim().max(10000).optional().nullable(),
  interviewFocus: z.string().trim().max(10000).optional().nullable(),
  isActive: z.boolean().optional()
});

type MajorInput = z.infer<typeof majorSchema>;
type MajorTextKey = Exclude<keyof MajorInput, "degreeLevel" | "isActive">;
type CleanMajorData = Partial<
  Pick<
    Prisma.MajorUncheckedCreateInput,
    | "careerOutcomes"
    | "degreeLevel"
    | "description"
    | "interviewFocus"
    | "isActive"
    | "name"
    | "nameEn"
    | "nameZh"
    | "requirements"
    | "researchAreas"
    | "researchLabs"
  >
>;

function cleanMajorData(input: Partial<MajorInput>): CleanMajorData {
  return {
    careerOutcomes: cleanNullableText(input, "careerOutcomes"),
    degreeLevel: input.degreeLevel,
    description: cleanNullableText(input, "description"),
    interviewFocus: cleanNullableText(input, "interviewFocus"),
    isActive: input.isActive,
    name: "name" in input ? input.name : undefined,
    nameEn: cleanNullableText(input, "nameEn"),
    nameZh: cleanNullableText(input, "nameZh"),
    requirements: cleanNullableText(input, "requirements"),
    researchAreas: cleanNullableText(input, "researchAreas"),
    researchLabs: cleanNullableText(input, "researchLabs")
  };
}

function cleanNullableText(input: Partial<MajorInput>, key: MajorTextKey): string | null | undefined {
  if (!(key in input)) return undefined;
  const value = input[key];
  return typeof value === "string" ? value.trim() || null : null;
}

// GET /api/majors
majorsRouter.get("/", async (req, res) => {
  try {
    const { search, degreeLevel, schoolId, active } = req.query;
    const requester = await getOptionalAuthenticatedUser(req);
    const canReadInactive = requester?.role === "ADMIN" || requester?.role === "SUPER_ADMIN";
    const where: any = {};
    const { limit, page, skip } = parsePagination(req.query);

    if (active !== "all" || !canReadInactive) where.isActive = true;
    if (search) where.name = { contains: String(search), mode: "insensitive" };
    if (degreeLevel) where.degreeLevel = String(degreeLevel);
    if (schoolId) {
      where.school_majors = {
        some: {
          school_id: String(schoolId)
        }
      };
    }

    if (!search && !degreeLevel && !schoolId && active !== "all") {
      const cachedMajors = await getCachedMajors();
      const majors = cachedMajors.slice(skip, skip + limit);
      res.json(paginatedResponse(majors, cachedMajors.length, page, limit));
      return;
    }

    const [majors, total] = await Promise.all([
      prisma.major.findMany({
        where,
        orderBy: { name: "asc" },
        select: majorListSelect,
        skip,
        take: limit
      }),
      prisma.major.count({ where })
    ]);
    res.json(paginatedResponse(majors, total, page, limit));
  } catch {
    res.status(500).json({ message: "Lỗi server" });
  }
});

// GET /api/majors/:id
majorsRouter.get("/:id", async (req, res) => {
  try {
    const requester = await getOptionalAuthenticatedUser(req);
    const canReadInactive = requester?.role === "ADMIN" || requester?.role === "SUPER_ADMIN";
    const major = await prisma.major.findFirst({
      where: {
        id: req.params.id,
        ...(canReadInactive ? {} : { isActive: true })
      }
    });
    if (!major) { res.status(404).json({ message: "Không tìm thấy ngành" }); return; }
    res.json(major);
  } catch {
    res.status(500).json({ message: "Lỗi server" });
  }
});

// POST /api/majors (admin)
majorsRouter.post("/", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), async (req, res) => {
  const parsed = majorSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Dữ liệu không hợp lệ", errors: parsed.error.flatten().fieldErrors });
    return;
  }

  try {
    const user = res.locals.user as AuthenticatedUser;
    const major = await prisma.major.create({
      data: {
        ...cleanMajorData(parsed.data),
        degreeLevel: parsed.data.degreeLevel,
        name: parsed.data.name,
        isActive: parsed.data.isActive ?? true
      },
    });
    await writeAdminAuditLog(req, { action: "MAJOR_CREATE", adminUserId: user.id, afterData: major, entityId: major.id, entityType: "major" });
    res.status(201).json(major);
  } catch (err: any) {
    if (err.code === "P2002") { res.status(409).json({ message: "Ngành này đã tồn tại ở bậc học này" }); return; }
    res.status(500).json({ message: "Lỗi server" });
  }
});

// PUT /api/majors/:id (admin)
majorsRouter.put("/:id", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), async (req, res) => {
  const parsed = majorSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Dữ liệu không hợp lệ", errors: parsed.error.flatten().fieldErrors });
    return;
  }

  try {
    const user = res.locals.user as AuthenticatedUser;
    const before = await prisma.major.findUnique({ where: { id: req.params.id } });
    const major = await prisma.major.update({
      where: { id: req.params.id },
      data: cleanMajorData(parsed.data),
    });
    await writeAdminAuditLog(req, { action: "MAJOR_UPDATE", adminUserId: user.id, afterData: major, beforeData: before, entityId: major.id, entityType: "major" });
    res.json(major);
  } catch (err: any) {
    if (err.code === "P2025") { res.status(404).json({ message: "Không tìm thấy ngành" }); return; }
    if (err.code === "P2002") { res.status(409).json({ message: "Ngành đã tồn tại" }); return; }
    res.status(500).json({ message: "Lỗi server" });
  }
});

// DELETE /api/majors/:id (admin)
majorsRouter.delete("/:id", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), async (req, res) => {
  try {
    const user = res.locals.user as AuthenticatedUser;
    const before = await prisma.major.findUnique({ where: { id: req.params.id } });
    const major = await prisma.major.update({ where: { id: req.params.id }, data: { isActive: false } });
    await writeAdminAuditLog(req, { action: "MAJOR_DEACTIVATE", adminUserId: user.id, afterData: major, beforeData: before, entityId: major.id, entityType: "major" });
    res.json({ message: "Đã xoá ngành" });
  } catch (err: any) {
    if (err.code === "P2025") { res.status(404).json({ message: "Không tìm thấy ngành" }); return; }
    res.status(500).json({ message: "Lỗi server" });
  }
});
