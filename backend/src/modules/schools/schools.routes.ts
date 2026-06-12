import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import { requireAuth, requireRole } from "../auth/auth.middleware.js";
import { paginatedResponse, parsePagination } from "../../utils/pagination.js";

export const schoolsRouter = Router();

const schoolSchema = z.object({
  name: z.string().trim().min(1, "Tên trường là bắt buộc").max(500),
  nameZh: z.string().trim().max(500).optional().nullable(),
  nameEn: z.string().trim().max(500).optional().nullable(),
  city: z.string().trim().max(200).optional().nullable(),
  province: z.string().trim().max(200).optional().nullable(),
  websiteUrl: z.string().trim().url("URL không hợp lệ").max(1000).optional().nullable().or(z.literal("")),
  description: z.string().trim().max(5000).optional().nullable(),
  isActive: z.boolean().optional()
});

// GET /api/schools - list all (public)
schoolsRouter.get("/", async (req, res) => {
  try {
    const { search, city, province, active } = req.query;
    const where: any = {};
    const { limit, page, skip } = parsePagination(req.query);

    if (active !== "all") where.isActive = true;
    if (search) where.name = { contains: String(search), mode: "insensitive" };
    if (city) where.city = String(city);
    if (province) where.province = String(province);

    const [schools, total] = await Promise.all([
      prisma.school.findMany({
        where,
        orderBy: { name: "asc" },
        select: {
          city: true,
          description: true,
          id: true,
          isActive: true,
          name: true,
          nameEn: true,
          nameZh: true,
          province: true,
          websiteUrl: true
        },
        skip,
        take: limit
      }),
      prisma.school.count({ where })
    ]);
    res.json(paginatedResponse(schools, total, page, limit));
  } catch (err) {
    res.status(500).json({ message: "Lỗi server" });
  }
});

// GET /api/schools/:id
schoolsRouter.get("/:id", async (req, res) => {
  try {
    const school = await prisma.school.findUnique({ where: { id: req.params.id } });
    if (!school) { res.status(404).json({ message: "Không tìm thấy trường" }); return; }
    res.json(school);
  } catch (err) {
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
    const { name, nameZh, nameEn, city, province, websiteUrl, description } = parsed.data;
    const school = await prisma.school.create({
      data: { name, nameZh: nameZh || null, nameEn: nameEn || null, city: city || null, province: province || null, websiteUrl: websiteUrl || null, description: description || null },
    });
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
    const school = await prisma.school.update({
      where: { id: req.params.id },
      data: parsed.data,
    });
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
    await prisma.school.delete({ where: { id: req.params.id } });
    res.json({ message: "Đã xoá trường" });
  } catch (err: any) {
    if (err.code === "P2025") { res.status(404).json({ message: "Không tìm thấy trường" }); return; }
    res.status(500).json({ message: "Lỗi server" });
  }
});
