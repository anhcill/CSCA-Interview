import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import { requireAuth, requireRole } from "../auth/auth.middleware.js";
import { paginatedResponse, parsePagination } from "../../utils/pagination.js";

export const scholarshipsRouter = Router();

const scholarshipSchema = z.object({
  name: z.string().trim().min(1, "Tên học bổng là bắt buộc").max(500),
  code: z.string().trim().max(100).optional().nullable(),
  description: z.string().trim().max(5000).optional().nullable(),
  isActive: z.boolean().optional()
});

// GET /api/scholarships
scholarshipsRouter.get("/", async (req, res) => {
  try {
    const { search, active } = req.query;
    const where: any = {};
    const { limit, page, skip } = parsePagination(req.query);

    if (active !== "all") where.isActive = true;
    if (search) where.name = { contains: String(search), mode: "insensitive" };

    const [scholarships, total] = await Promise.all([
      prisma.scholarship.findMany({
        where,
        orderBy: { name: "asc" },
        select: {
          code: true,
          description: true,
          id: true,
          isActive: true,
          name: true
        },
        skip,
        take: limit
      }),
      prisma.scholarship.count({ where })
    ]);
    res.json(paginatedResponse(scholarships, total, page, limit));
  } catch (err) {
    res.status(500).json({ message: "Lỗi server" });
  }
});

// GET /api/scholarships/:id
scholarshipsRouter.get("/:id", async (req, res) => {
  try {
    const s = await prisma.scholarship.findUnique({ where: { id: req.params.id } });
    if (!s) { res.status(404).json({ message: "Không tìm thấy học bổng" }); return; }
    res.json(s);
  } catch (err) {
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
    const { name, code, description } = parsed.data;
    const s = await prisma.scholarship.create({ data: { name, code: code || null, description: description || null } });
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
    const s = await prisma.scholarship.update({
      where: { id: req.params.id },
      data: parsed.data,
    });
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
    await prisma.scholarship.delete({ where: { id: req.params.id } });
    res.json({ message: "Đã xoá học bổng" });
  } catch (err: any) {
    if (err.code === "P2025") { res.status(404).json({ message: "Không tìm thấy học bổng" }); return; }
    res.status(500).json({ message: "Lỗi server" });
  }
});
