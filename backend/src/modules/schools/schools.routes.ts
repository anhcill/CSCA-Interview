import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { getCachedJson, setCachedJson } from "../../cache/cache.service.js";
import { prisma } from "../../db/prisma.js";
import { writeAdminAuditLog } from "../admin/audit.service.js";
import { getOptionalAuthenticatedUser, requireAuth, requireRole, type AuthenticatedUser } from "../auth/auth.middleware.js";
import { paginatedResponse, parsePagination } from "../../utils/pagination.js";
import { rankSearchCandidate } from "../../utils/search-normalize.js";

export const schoolsRouter = Router();

const CACHE_TTL_MS = 10 * 60 * 1000;

const schoolListSelect = {
  achievements: true,
  admissionRequirements: true,
  campusInfo: true,
  city: true,
  description: true,
  id: true,
  interviewTips: true,
  isActive: true,
  name: true,
  nameEn: true,
  nameZh: true,
  notableAlumni: true,
  province: true,
  programLanguage: true,
  ranking: true,
  rankingType: true,
  researchAreas: true,
  strongMajors: true,
  websiteUrl: true
} as const;

type SchoolListItem = {
  achievements: string | null;
  admissionRequirements: string | null;
  campusInfo: string | null;
  city: string | null;
  description: string | null;
  id: string;
  interviewTips: string | null;
  isActive: boolean;
  name: string;
  nameEn: string | null;
  nameZh: string | null;
  notableAlumni: string | null;
  province: string | null;
  programLanguage: string | null;
  ranking: number | null;
  rankingType: string | null;
  researchAreas: string | null;
  strongMajors: string | null;
  websiteUrl: string | null;
};

async function getCachedSchools() {
  const cacheKey = "metadata:schools:active";
  const cached = await getCachedJson<SchoolListItem[]>(cacheKey);
  if (cached) return cached;

  const schools = await prisma.school.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: schoolListSelect
  });

  await setCachedJson(cacheKey, schools, CACHE_TTL_MS);
  return schools;
}

const schoolSchema = z.object({
  name: z.string().trim().min(1, "Tên trường là bắt buộc").max(500),
  nameZh: z.string().trim().max(500).optional().nullable(),
  nameEn: z.string().trim().max(500).optional().nullable(),
  city: z.string().trim().max(200).optional().nullable(),
  province: z.string().trim().max(200).optional().nullable(),
  websiteUrl: z.string().trim().url("URL không hợp lệ").max(1000).optional().nullable().or(z.literal("")),
  description: z.string().trim().max(5000).optional().nullable(),
  ranking: z.coerce.number().int().positive().optional().nullable(),
  rankingType: z.string().trim().max(120).optional().nullable(),
  strongMajors: z.string().trim().max(10000).optional().nullable(),
  researchAreas: z.string().trim().max(10000).optional().nullable(),
  admissionRequirements: z.string().trim().max(10000).optional().nullable(),
  interviewTips: z.string().trim().max(10000).optional().nullable(),
  programLanguage: z.string().trim().max(120).optional().nullable(),
  campusInfo: z.string().trim().max(10000).optional().nullable(),
  notableAlumni: z.string().trim().max(10000).optional().nullable(),
  achievements: z.string().trim().max(10000).optional().nullable(),
  isActive: z.boolean().optional()
});

type SchoolInput = z.infer<typeof schoolSchema>;
type SchoolTextKey = Exclude<keyof SchoolInput, "isActive" | "ranking">;
type CleanSchoolData = Partial<
  Pick<
    Prisma.SchoolUncheckedCreateInput,
    | "achievements"
    | "admissionRequirements"
    | "campusInfo"
    | "city"
    | "description"
    | "interviewTips"
    | "isActive"
    | "name"
    | "nameEn"
    | "nameZh"
    | "notableAlumni"
    | "programLanguage"
    | "province"
    | "ranking"
    | "rankingType"
    | "researchAreas"
    | "strongMajors"
    | "websiteUrl"
  >
>;

function cleanSchoolData(input: Partial<SchoolInput>): CleanSchoolData {
  return {
    achievements: cleanNullableText(input, "achievements"),
    admissionRequirements: cleanNullableText(input, "admissionRequirements"),
    campusInfo: cleanNullableText(input, "campusInfo"),
    city: cleanNullableText(input, "city"),
    description: cleanNullableText(input, "description"),
    interviewTips: cleanNullableText(input, "interviewTips"),
    isActive: input.isActive,
    name: "name" in input ? input.name : undefined,
    nameEn: cleanNullableText(input, "nameEn"),
    nameZh: cleanNullableText(input, "nameZh"),
    notableAlumni: cleanNullableText(input, "notableAlumni"),
    programLanguage: cleanNullableText(input, "programLanguage"),
    province: cleanNullableText(input, "province"),
    ranking: "ranking" in input ? input.ranking ?? null : undefined,
    rankingType: cleanNullableText(input, "rankingType"),
    researchAreas: cleanNullableText(input, "researchAreas"),
    strongMajors: cleanNullableText(input, "strongMajors"),
    websiteUrl: cleanNullableText(input, "websiteUrl")
  };
}

function cleanNullableText(input: Partial<SchoolInput>, key: SchoolTextKey): string | null | undefined {
  if (!(key in input)) return undefined;
  const value = input[key];
  return typeof value === "string" ? value.trim() || null : null;
}

// GET /api/schools - list all (public)
schoolsRouter.get("/", async (req, res) => {
  try {
    const { search, city, province, active } = req.query;
    const requester = await getOptionalAuthenticatedUser(req);
    const canReadInactive = requester?.role === "ADMIN" || requester?.role === "SUPER_ADMIN";
    const where: any = {};
    const { limit, page, skip } = parsePagination(req.query);
    const searchText = String(search ?? "").trim();

    if (active !== "all" || !canReadInactive) where.isActive = true;
    if (city) where.city = { equals: String(city), mode: "insensitive" };
    if (province) where.province = { equals: String(province), mode: "insensitive" };

    if (!searchText && !city && !province && active !== "all") {
      const cachedSchools = await getCachedSchools();
      const schools = cachedSchools.slice(skip, skip + limit);
      res.json(paginatedResponse(schools, cachedSchools.length, page, limit));
      return;
    }

    if (searchText) {
      const candidates = await prisma.school.findMany({
        where,
        orderBy: { name: "asc" },
        select: schoolListSelect,
        take: 2000
      });
      const ranked = candidates
        .map((school) => ({
          ...school,
          _rank: rankSearchCandidate(searchText, schoolSearchFields(school))
        }))
        .filter((school) => school._rank > 0)
        .sort((left, right) => right._rank - left._rank || left.name.localeCompare(right.name));
      const schools = ranked.slice(skip, skip + limit).map(({ _rank, ...school }) => school);

      res.json(paginatedResponse(schools, ranked.length, page, limit));
      return;
    }

    const [schools, total] = await Promise.all([
      prisma.school.findMany({
        where,
        orderBy: { name: "asc" },
        select: schoolListSelect,
        skip,
        take: limit
      }),
      prisma.school.count({ where })
    ]);
    res.json(paginatedResponse(schools, total, page, limit));
  } catch {
    res.status(500).json({ message: "Lỗi server" });
  }
});

function schoolSearchFields(school: SchoolListItem) {
  return [
    school.name,
    school.nameEn,
    school.nameZh,
    school.city,
    school.province,
    school.strongMajors,
    school.researchAreas,
    school.programLanguage,
    school.campusInfo,
    school.achievements
  ];
}

// GET /api/schools/:id
schoolsRouter.get("/:id", async (req, res) => {
  try {
    const requester = await getOptionalAuthenticatedUser(req);
    const canReadInactive = requester?.role === "ADMIN" || requester?.role === "SUPER_ADMIN";
    const school = await prisma.school.findFirst({
      where: {
        id: req.params.id,
        ...(canReadInactive ? {} : { isActive: true })
      }
    });
    if (!school) { res.status(404).json({ message: "Không tìm thấy trường" }); return; }
    res.json(school);
  } catch {
    res.status(500).json({ message: "Lỗi server" });
  }
});

// POST /api/schools (admin)
schoolsRouter.post("/", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), async (req, res) => {
  const parsed = schoolSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Dữ liệu không hợp lệ", errors: parsed.error.flatten().fieldErrors });
    return;
  }

  try {
    const user = res.locals.user as AuthenticatedUser;
    const school = await prisma.school.create({
      data: {
        ...cleanSchoolData(parsed.data),
        name: parsed.data.name,
        isActive: parsed.data.isActive ?? true
      },
    });
    await writeAdminAuditLog(req, { action: "SCHOOL_CREATE", adminUserId: user.id, afterData: school, entityId: school.id, entityType: "school" });
    res.status(201).json(school);
  } catch (err: any) {
    if (err.code === "P2002") { res.status(409).json({ message: "Trường đã tồn tại" }); return; }
    res.status(500).json({ message: "Lỗi server" });
  }
});

// PUT /api/schools/:id (admin)
schoolsRouter.put("/:id", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), async (req, res) => {
  const parsed = schoolSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Dữ liệu không hợp lệ", errors: parsed.error.flatten().fieldErrors });
    return;
  }

  try {
    const user = res.locals.user as AuthenticatedUser;
    const before = await prisma.school.findUnique({ where: { id: req.params.id } });
    const school = await prisma.school.update({
      where: { id: req.params.id },
      data: cleanSchoolData(parsed.data),
    });
    await writeAdminAuditLog(req, { action: "SCHOOL_UPDATE", adminUserId: user.id, afterData: school, beforeData: before, entityId: school.id, entityType: "school" });
    res.json(school);
  } catch (err: any) {
    if (err.code === "P2025") { res.status(404).json({ message: "Không tìm thấy trường" }); return; }
    if (err.code === "P2002") { res.status(409).json({ message: "Tên trường đã tồn tại" }); return; }
    res.status(500).json({ message: "Lỗi server" });
  }
});

// DELETE /api/schools/:id (admin)
schoolsRouter.delete("/:id", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), async (req, res) => {
  try {
    const user = res.locals.user as AuthenticatedUser;
    const before = await prisma.school.findUnique({ where: { id: req.params.id } });
    const school = await prisma.school.update({ where: { id: req.params.id }, data: { isActive: false } });
    await writeAdminAuditLog(req, { action: "SCHOOL_DEACTIVATE", adminUserId: user.id, afterData: school, beforeData: before, entityId: school.id, entityType: "school" });
    res.json({ message: "Đã xoá trường" });
  } catch (err: any) {
    if (err.code === "P2025") { res.status(404).json({ message: "Không tìm thấy trường" }); return; }
    res.status(500).json({ message: "Lỗi server" });
  }
});
