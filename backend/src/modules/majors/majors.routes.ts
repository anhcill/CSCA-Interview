import { DegreeLevel } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import { requireAuth, requireRole } from "../auth/auth.middleware.js";
import { paginatedResponse, parsePagination } from "../../utils/pagination.js";

export const majorsRouter = Router();

const majorSchema = z.object({
  name: z.string().trim().min(1, "Tên ngành là bắt buộc").max(500),
  nameZh: z.string().trim().max(500).optional().nullable(),
  nameEn: z.string().trim().max(500).optional().nullable(),
  degreeLevel: z.nativeEnum(DegreeLevel, { errorMap: () => ({ message: "Bậc học không hợp lệ" }) }),
  description: z.string().trim().max(5000).optional().nullable(),
  isActive: z.boolean().optional()
});

// GET /api/majors
majorsRouter.get("/", async (req, res) => {
  try {
    const { search, degreeLevel, active } = req.query;
    const where: any = {};
    const { limit, page, skip } = parsePagination(req.query);

    if (active !== "all") where.isActive = true;
    if (search) where.name = { contains: String(search), mode: "insensitive" };
    if (degreeLevel) where.degreeLevel = String(degreeLevel);

    const [majors, total] = await Promise.all([
      prisma.major.findMany({
        where,
        orderBy: { name: "asc" },
        select: {
          degreeLevel: true,
          description: true,
          id: true,
          isActive: true,
          name: true,
          nameEn: true,
          nameZh: true
        },
        skip,
        take: limit
      }),
      prisma.major.count({ where })
    ]);
    res.json(paginatedResponse(majors, total, page, limit));
  } catch (err) {
    res.status(500).json({ message: "Lỗi server" });
  }
});

// GET /api/majors/:id
majorsRouter.get("/:id", async (req, res) => {
  try {
    const major = await prisma.major.findUnique({ where: { id: req.params.id } });
    if (!major) { res.status(404).json({ message: "Không tìm thấy ngành" }); return; }
    res.json(major);
  } catch (err) {
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
    const { name, nameZh, nameEn, degreeLevel, description } = parsed.data;
    const major = await prisma.major.create({
      data: { name, nameZh: nameZh || null, nameEn: nameEn || null, degreeLevel, description: description || null },
    });
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
    const major = await prisma.major.update({
      where: { id: req.params.id },
      data: parsed.data,
    });
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
    await prisma.major.delete({ where: { id: req.params.id } });
    res.json({ message: "Đã xoá ngành" });
  } catch (err: any) {
    if (err.code === "P2025") { res.status(404).json({ message: "Không tìm thấy ngành" }); return; }
    res.status(500).json({ message: "Lỗi server" });
  }
});
