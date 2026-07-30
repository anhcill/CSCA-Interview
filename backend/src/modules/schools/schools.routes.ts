import { Router } from "express";
import { DegreeLevel, type Prisma } from "@prisma/client";
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

const majorCreateSchema = z.object({
  degreeLevel: z.nativeEnum(DegreeLevel),
  name: z.string().trim().min(1).max(500),
  nameEn: z.string().trim().max(500).optional().nullable(),
  nameZh: z.string().trim().max(500).optional().nullable()
});

const schoolWithMajorsSchema = z.object({
  majors: z.array(majorCreateSchema).min(1, "Cần nhập ít nhất một ngành").max(300),
  school: schoolSchema
});

const schoolMajorsSyncSchema = z.object({
  majors: z.array(z.union([
    z.object({ id: z.string().uuid() }),
    majorCreateSchema
  ])).max(300)
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

schoolsRouter.get("/:id/majors", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), async (req, res) => {
  try {
    const school = await prisma.school.findUnique({
      where: { id: req.params.id },
      select: { id: true }
    });
    if (!school) {
      res.status(404).json({ message: "Không tìm thấy trường" });
      return;
    }

    const links = await prisma.school_majors.findMany({
      where: {
        admission_season_id: null,
        school_id: school.id
      },
      include: {
        majors: {
          select: {
            degreeLevel: true,
            id: true,
            isActive: true,
            name: true,
            nameEn: true,
            nameZh: true
          }
        }
      },
      orderBy: [
        { majors: { degreeLevel: "asc" } },
        { majors: { name: "asc" } }
      ]
    });
    res.json({
      data: links.map((link) => ({
        linkId: link.id,
        ...link.majors
      }))
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Không thể tải ngành của trường" });
  }
});

schoolsRouter.put("/:id/majors", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), async (req, res) => {
  const parsed = schoolMajorsSyncSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({
      message: "Danh sách ngành không hợp lệ",
      errors: parsed.error.flatten()
    });
    return;
  }

  try {
    const user = res.locals.user as AuthenticatedUser;
    const result = await prisma.$transaction(async (tx) => {
      const school = await tx.school.findUnique({
        where: { id: req.params.id },
        select: { id: true, name: true }
      });
      if (!school) throw new Error("SCHOOL_NOT_FOUND");

      const desiredMajorIds: string[] = [];
      let createdMajors = 0;
      for (const input of parsed.data.majors) {
        if ("id" in input) {
          const existing = await tx.major.findUnique({
            where: { id: input.id },
            select: { id: true }
          });
          if (existing) desiredMajorIds.push(existing.id);
          continue;
        }

        const existing = await tx.major.findUnique({
          where: {
            name_degreeLevel: {
              degreeLevel: input.degreeLevel,
              name: input.name
            }
          },
          select: { id: true }
        });
        const major = existing
          ? await tx.major.update({
              where: { id: existing.id },
              data: {
                isActive: true,
                nameEn: input.nameEn?.trim() || undefined,
                nameZh: input.nameZh?.trim() || undefined
              },
              select: { id: true }
            })
          : await tx.major.create({
              data: {
                degreeLevel: input.degreeLevel,
                isActive: true,
                name: input.name,
                nameEn: input.nameEn?.trim() || null,
                nameZh: input.nameZh?.trim() || null
              },
              select: { id: true }
            });
        if (!existing) createdMajors += 1;
        desiredMajorIds.push(major.id);
      }

      const uniqueMajorIds = [...new Set(desiredMajorIds)];
      const removed = await tx.school_majors.deleteMany({
        where: {
          admission_season_id: null,
          school_id: school.id,
          ...(uniqueMajorIds.length ? { major_id: { notIn: uniqueMajorIds } } : {})
        }
      });
      const existingLinks = uniqueMajorIds.length
        ? await tx.school_majors.findMany({
            where: {
              admission_season_id: null,
              major_id: { in: uniqueMajorIds },
              school_id: school.id
            },
            select: { major_id: true }
          })
        : [];
      const existingIds = new Set(existingLinks.map((link) => link.major_id));
      const idsToAdd = uniqueMajorIds.filter((id) => !existingIds.has(id));
      for (const majorId of idsToAdd) {
        await tx.school_majors.create({
          data: {
            admission_season_id: null,
            major_id: majorId,
            note: "Đồng bộ từ màn sửa trường",
            school_id: school.id
          }
        });
      }

      return {
        addedLinks: idsToAdd.length,
        createdMajors,
        linkedMajors: uniqueMajorIds.length,
        removedLinks: removed.count,
        school
      };
    });

    await writeAdminAuditLog(req, {
      action: "SCHOOL_MAJORS_SYNC",
      adminUserId: user.id,
      afterData: result,
      entityId: result.school.id,
      entityType: "school"
    });
    res.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "SCHOOL_NOT_FOUND") {
      res.status(404).json({ message: "Không tìm thấy trường" });
      return;
    }
    console.error(error);
    res.status(500).json({ message: "Không thể cập nhật ngành của trường" });
  }
});

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
schoolsRouter.post("/with-majors", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), async (req, res) => {
  const parsed = schoolWithMajorsSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({
      message: "Thông tin trường và ngành không hợp lệ",
      errors: parsed.error.flatten()
    });
    return;
  }

  try {
    const user = res.locals.user as AuthenticatedUser;
    const uniqueMajors = [...new Map(parsed.data.majors.map((major) => [
      `${major.degreeLevel}:${major.name.toLocaleLowerCase("vi")}`,
      major
    ])).values()];

    const result = await prisma.$transaction(async (tx) => {
      const school = await tx.school.create({
        data: {
          ...cleanSchoolData(parsed.data.school),
          isActive: parsed.data.school.isActive ?? true,
          name: parsed.data.school.name
        }
      });
      let createdMajors = 0;
      const linkedMajors = [];

      for (const majorInput of uniqueMajors) {
        const existing = await tx.major.findUnique({
          where: {
            name_degreeLevel: {
              degreeLevel: majorInput.degreeLevel,
              name: majorInput.name
            }
          },
          select: { id: true }
        });
        const major = existing
          ? await tx.major.update({
              where: { id: existing.id },
              data: {
                isActive: true,
                nameEn: majorInput.nameEn?.trim() || undefined,
                nameZh: majorInput.nameZh?.trim() || undefined
              },
              select: { degreeLevel: true, id: true, name: true }
            })
          : await tx.major.create({
              data: {
                degreeLevel: majorInput.degreeLevel,
                isActive: true,
                name: majorInput.name,
                nameEn: majorInput.nameEn?.trim() || null,
                nameZh: majorInput.nameZh?.trim() || null
              },
              select: { degreeLevel: true, id: true, name: true }
            });
        if (!existing) createdMajors += 1;

        await tx.school_majors.create({
          data: {
            admission_season_id: null,
            major_id: major.id,
            note: "Tạo cùng trường bằng luồng nhập nhanh",
            school_id: school.id
          }
        });
        linkedMajors.push(major);
      }

      return {
        createdMajors,
        linkedMajors,
        school
      };
    });

    await writeAdminAuditLog(req, {
      action: "SCHOOL_WITH_MAJORS_CREATE",
      adminUserId: user.id,
      afterData: {
        createdMajors: result.createdMajors,
        linkedMajorIds: result.linkedMajors.map((major) => major.id),
        school: result.school
      },
      entityId: result.school.id,
      entityType: "school"
    });
    res.status(201).json(result);
  } catch (error: any) {
    if (error.code === "P2002") {
      res.status(409).json({ message: "Trường này đã tồn tại" });
      return;
    }
    console.error(error);
    res.status(500).json({ message: "Không thể tạo trường cùng danh sách ngành" });
  }
});

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
