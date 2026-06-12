import { DegreeLevel, DifficultyLevel, LanguageCode, QuestionCategory, audio_source } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import { requireAuth, requireRole, type AuthenticatedUser } from "../auth/auth.middleware.js";

export const questionsRouter = Router();

const questionSchema = z.object({
  questionText: z.string().trim().min(1, "Nội dung câu hỏi là bắt buộc").max(5000),
  category: z.nativeEnum(QuestionCategory).optional(),
  difficulty: z.nativeEnum(DifficultyLevel).optional(),
  language: z.nativeEnum(LanguageCode).optional(),
  degreeLevel: z.nativeEnum(DegreeLevel).optional().nullable(),
  schoolId: z.string().uuid().optional().nullable(),
  majorId: z.string().uuid().optional().nullable(),
  scholarshipId: z.string().uuid().optional().nullable(),
  suggestedAnswerLogic: z.string().trim().max(5000).optional().nullable(),
  sampleAnswer: z.string().trim().max(10000).optional().nullable(),
  keywords: z.string().trim().max(5000).optional().nullable(),
  commonMistakes: z.string().trim().max(5000).optional().nullable(),
  scoringRubric: z.any().optional().nullable(),
  isActive: z.boolean().optional()
});

const csvImportSchema = z.object({
  csv: z.string().min(1, "CSV không được để trống")
});

const audioSchema = z.object({
  audioFileBase64: z.string().trim().optional().nullable(),
  durationSeconds: z.number().nonnegative().optional().nullable(),
  fileName: z.string().trim().max(255).optional().nullable(),
  fileUrl: z.string().trim().max(20000).optional().nullable(),
  language: z.nativeEnum(LanguageCode).default(LanguageCode.VI),
  mimeType: z.string().trim().max(120).optional().nullable(),
  source: z.nativeEnum(audio_source).default(audio_source.AI_TTS),
  transcript: z.string().trim().max(10000).optional().nullable(),
  voiceName: z.string().trim().max(120).optional().nullable()
}).refine((data) => Boolean(data.fileUrl || data.audioFileBase64), {
  message: "Cần nhập File URL hoặc upload file audio"
});

const maxAudioUploadBytes = 8 * 1024 * 1024;
const allowedAudioExtensions = new Set([".aac", ".m4a", ".mp3", ".ogg", ".wav", ".webm"]);
const audioExtensionByMime: Record<string, string> = {
  "audio/aac": ".aac",
  "audio/mp4": ".m4a",
  "audio/mpeg": ".mp3",
  "audio/mp3": ".mp3",
  "audio/ogg": ".ogg",
  "audio/wav": ".wav",
  "audio/webm": ".webm",
  "audio/x-wav": ".wav"
};

// GET /api/questions - list with filters
questionsRouter.get("/", async (req, res) => {
  try {
    const { search, category, difficulty, language, degreeLevel, schoolId, majorId, scholarshipId, active, page, limit } = req.query;
    const where: any = {};

    if (active !== "all") where.isActive = true;
    where.deletedAt = null;
    if (search) where.questionText = { contains: String(search), mode: "insensitive" };
    if (category) where.category = String(category);
    if (difficulty) where.difficulty = String(difficulty);
    if (language) where.language = String(language);
    if (degreeLevel) where.degreeLevel = String(degreeLevel);
    if (schoolId) where.schoolId = String(schoolId);
    if (majorId) where.majorId = String(majorId);
    if (scholarshipId) where.scholarshipId = String(scholarshipId);

    const currentPage = Math.max(Number(page) || 1, 1);
    const take = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const skip = (currentPage - 1) * take;

    const [questions, total] = await Promise.all([
      prisma.question.findMany({
        where,
        select: {
          category: true,
          createdAt: true,
          degreeLevel: true,
          difficulty: true,
          id: true,
          isActive: true,
          keywords: true,
          language: true,
          majorId: true,
          questionText: true,
          sampleAnswer: true,
          scholarshipId: true,
          schoolId: true,
          suggestedAnswerLogic: true,
          school: { select: { id: true, name: true } },
          major: { select: { id: true, name: true } },
          scholarship: { select: { id: true, name: true } }
        },
        orderBy: { createdAt: "desc" },
        take,
        skip,
      }),
      prisma.question.count({ where }),
    ]);

    res.json({ data: questions, total, page: currentPage, totalPages: Math.max(1, Math.ceil(total / take)) });
  } catch (err) {
    res.status(500).json({ message: "Lỗi server" });
  }
});

questionsRouter.get("/export", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), async (_req, res) => {
  try {
    const questions = await prisma.question.findMany({
      where: { deletedAt: null },
      include: {
        major: { select: { name: true } },
        scholarship: { select: { name: true } },
        school: { select: { name: true } }
      },
      orderBy: { createdAt: "desc" }
    });
    const headers = [
      "questionText",
      "category",
      "difficulty",
      "language",
      "degreeLevel",
      "schoolName",
      "majorName",
      "scholarshipName",
      "suggestedAnswerLogic",
      "sampleAnswer",
      "keywords",
      "commonMistakes",
      "isActive"
    ];
    const rows = questions.map((question) => [
      question.questionText,
      question.category,
      question.difficulty,
      question.language,
      question.degreeLevel ?? "",
      question.school?.name ?? "",
      question.major?.name ?? "",
      question.scholarship?.name ?? "",
      question.suggestedAnswerLogic ?? "",
      question.sampleAnswer ?? "",
      question.keywords ?? "",
      question.commonMistakes ?? "",
      String(question.isActive)
    ]);
    const csv = [headers, ...rows].map((row) => row.map(escapeCsvCell).join(",")).join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="questions-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(`\uFEFF${csv}`);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Không thể export CSV câu hỏi" });
  }
});

questionsRouter.post("/import", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), async (req, res) => {
  const parsed = csvImportSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ message: "Dữ liệu CSV không hợp lệ", errors: parsed.error.flatten().fieldErrors });
    return;
  }

  try {
    const user = res.locals.user as AuthenticatedUser;
    const rows = parseCsv(parsed.data.csv);
    if (!rows.length) {
      res.status(400).json({ message: "CSV không có dòng dữ liệu" });
      return;
    }

    const [schools, majors, scholarships] = await Promise.all([
      prisma.school.findMany({ select: { id: true, name: true } }),
      prisma.major.findMany({ select: { id: true, name: true } }),
      prisma.scholarship.findMany({ select: { id: true, name: true } })
    ]);
    const schoolMap = toNameMap(schools);
    const majorMap = toNameMap(majors);
    const scholarshipMap = toNameMap(scholarships);
    const skipped: Array<{ line: number; reason: string }> = [];
    const created = [];

    for (const [index, row] of rows.entries()) {
      const questionText = getCsvValue(row, "questionText", "question_text", "question", "text");
      if (!questionText) {
        skipped.push({ line: index + 2, reason: "Thiếu questionText" });
        continue;
      }

      const category = normalizeEnum(QuestionCategory, getCsvValue(row, "category"), QuestionCategory.OTHER);
      const difficulty = normalizeEnum(DifficultyLevel, getCsvValue(row, "difficulty"), DifficultyLevel.MEDIUM);
      const language = normalizeEnum(LanguageCode, getCsvValue(row, "language"), LanguageCode.VI);
      const degreeLevelRaw = getCsvValue(row, "degreeLevel", "degree_level");
      const degreeLevel = degreeLevelRaw ? normalizeEnum(DegreeLevel, degreeLevelRaw, null) : null;
      const schoolName = getCsvValue(row, "schoolName", "school", "school_name");
      const majorName = getCsvValue(row, "majorName", "major", "major_name");
      const scholarshipName = getCsvValue(row, "scholarshipName", "scholarship", "scholarship_name");

      created.push(await prisma.question.create({
        data: {
          category,
          commonMistakes: getCsvValue(row, "commonMistakes", "common_mistakes") || null,
          createdBy: user.id,
          degreeLevel,
          difficulty,
          isActive: normalizeBoolean(getCsvValue(row, "isActive", "is_active"), true),
          keywords: getCsvValue(row, "keywords") || null,
          language,
          majorId: majorName ? majorMap.get(normalizeName(majorName)) ?? null : null,
          questionText,
          sampleAnswer: getCsvValue(row, "sampleAnswer", "sample_answer") || null,
          scholarshipId: scholarshipName ? scholarshipMap.get(normalizeName(scholarshipName)) ?? null : null,
          schoolId: schoolName ? schoolMap.get(normalizeName(schoolName)) ?? null : null,
          suggestedAnswerLogic: getCsvValue(row, "suggestedAnswerLogic", "suggested_answer_logic") || null
        }
      }));
    }

    res.status(201).json({ created: created.length, skipped });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Không thể import CSV câu hỏi" });
  }
});

questionsRouter.get("/:id/audios", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), async (req, res) => {
  try {
    const audios = await prisma.question_audios.findMany({
      where: { question_id: req.params.id },
      orderBy: { created_at: "desc" }
    });
    res.json({ data: audios });
  } catch (error) {
    res.status(500).json({ message: "Không thể tải audio câu hỏi" });
  }
});

questionsRouter.post("/:id/audios", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), async (req, res) => {
  const parsed = audioSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ message: "Dữ liệu audio không hợp lệ", errors: parsed.error.flatten().fieldErrors });
    return;
  }

  try {
    const user = res.locals.user as AuthenticatedUser;
    const question = await prisma.question.findFirst({ where: { deletedAt: null, id: req.params.id } });
    if (!question) {
      res.status(404).json({ message: "Không tìm thấy câu hỏi" });
      return;
    }

    const fileUrl = parsed.data.fileUrl?.trim()
      || await saveQuestionAudioUpload({
        audioFileBase64: parsed.data.audioFileBase64 ?? "",
        fileName: parsed.data.fileName ?? "",
        mimeType: parsed.data.mimeType ?? "",
        questionId: question.id
      });

    const audio = await prisma.question_audios.create({
      data: {
        created_by: user.id,
        duration_seconds: parsed.data.durationSeconds ?? null,
        file_url: fileUrl,
        language: parsed.data.language,
        question_id: question.id,
        source: parsed.data.source,
        transcript: parsed.data.transcript ?? null,
        voice_name: parsed.data.voiceName ?? null
      }
    });

    res.status(201).json(audio);
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_AUDIO_UPLOAD") {
      res.status(400).json({ message: "File audio không hợp lệ hoặc vượt quá 8MB" });
      return;
    }
    console.error(error);
    res.status(500).json({ message: "Không thể lưu audio câu hỏi" });
  }
});

questionsRouter.delete("/:questionId/audios/:audioId", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), async (req, res) => {
  try {
    const result = await prisma.question_audios.deleteMany({
      where: {
        id: req.params.audioId,
        question_id: req.params.questionId
      }
    });
    if (!result.count) {
      res.status(404).json({ message: "Không tìm thấy audio" });
      return;
    }
    res.json({ message: "Đã xóa audio" });
  } catch (error: any) {
    res.status(500).json({ message: "Không thể xóa audio" });
  }
});

// GET /api/questions/:id
questionsRouter.get("/:id", async (req, res) => {
  try {
    const q = await prisma.question.findUnique({
      where: { id: req.params.id },
      include: { school: { select: { id: true, name: true } }, major: { select: { id: true, name: true } }, scholarship: { select: { id: true, name: true } } },
    });
    if (!q || q.deletedAt) { res.status(404).json({ message: "Không tìm thấy câu hỏi" }); return; }
    res.json(q);
  } catch (err) {
    res.status(500).json({ message: "Lỗi server" });
  }
});

function escapeCsvCell(value: unknown) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) return `"${text.replaceAll("\"", "\"\"")}"`;
  return text;
}

function parseCsv(csv: string) {
  const normalized = csv.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    const next = normalized[index + 1];

    if (quoted) {
      if (char === "\"" && next === "\"") {
        cell += "\"";
        index += 1;
      } else if (char === "\"") {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === "\"") {
      quoted = true;
    } else if (char === ",") {
      row.push(cell.trim());
      cell = "";
    } else if (char === "\n") {
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  if (cell || row.length) {
    row.push(cell.trim());
    rows.push(row);
  }

  const [headerRow, ...dataRows] = rows.filter((entry) => entry.some(Boolean));
  if (!headerRow) return [];
  const headers = headerRow.map((header) => normalizeHeader(header));

  return dataRows.map((dataRow) => {
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = dataRow[index]?.trim() ?? "";
    });
    return record;
  });
}

function normalizeHeader(value: string) {
  return value.trim().replace(/^\uFEFF/, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function getCsvValue(row: Record<string, string>, ...keys: string[]) {
  for (const key of keys) {
    const value = row[normalizeHeader(key)];
    if (value) return value;
  }
  return "";
}

function normalizeEnum<T extends Record<string, string>>(enumType: T, value: string | undefined, fallback: T[keyof T] | null) {
  if (!value) return fallback as T[keyof T];
  const normalized = value.trim().toUpperCase();
  return Object.values(enumType).includes(normalized as T[keyof T])
    ? normalized as T[keyof T]
    : fallback as T[keyof T];
}

function normalizeBoolean(value: string | undefined, fallback: boolean) {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "y", "active"].includes(normalized)) return true;
  if (["0", "false", "no", "n", "inactive"].includes(normalized)) return false;
  return fallback;
}

function normalizeName(value: string) {
  return value.trim().toLowerCase();
}

function toNameMap(items: Array<{ id: string; name: string }>) {
  return new Map(items.map((item) => [normalizeName(item.name), item.id]));
}

async function saveQuestionAudioUpload({
  audioFileBase64,
  fileName,
  mimeType,
  questionId
}: {
  audioFileBase64: string;
  fileName: string;
  mimeType: string;
  questionId: string;
}) {
  const cleanedBase64 = audioFileBase64.includes(",")
    ? audioFileBase64.slice(audioFileBase64.indexOf(",") + 1)
    : audioFileBase64;
  const normalizedBase64 = cleanedBase64.replace(/\s/g, "");

  if (!normalizedBase64 || !/^[A-Za-z0-9+/=]+$/.test(normalizedBase64)) {
    throw new Error("INVALID_AUDIO_UPLOAD");
  }

  const buffer = Buffer.from(normalizedBase64, "base64");
  if (!buffer.length || buffer.byteLength > maxAudioUploadBytes) {
    throw new Error("INVALID_AUDIO_UPLOAD");
  }

  const extension = getAudioExtension(fileName, mimeType);
  const uploadDir = path.join(process.cwd(), "uploads", "question-audios");
  const storedName = `${questionId}-${randomUUID()}${extension}`;

  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, storedName), buffer);

  return `/uploads/question-audios/${storedName}`;
}

function getAudioExtension(fileName: string, mimeType: string) {
  const extensionFromName = path.extname(fileName).toLowerCase();
  if (allowedAudioExtensions.has(extensionFromName)) return extensionFromName;

  return audioExtensionByMime[mimeType.toLowerCase()] ?? ".webm";
}

// POST /api/questions (admin)
questionsRouter.post("/", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), async (req, res) => {
  const parsed = questionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Dữ liệu không hợp lệ", errors: parsed.error.flatten().fieldErrors });
    return;
  }

  try {
    const user = res.locals.user as AuthenticatedUser;
    const data = parsed.data;

    const q = await prisma.question.create({
      data: {
        questionText: data.questionText,
        category: data.category,
        difficulty: data.difficulty,
        language: data.language,
        degreeLevel: data.degreeLevel ?? null,
        schoolId: data.schoolId || null,
        majorId: data.majorId || null,
        scholarshipId: data.scholarshipId || null,
        suggestedAnswerLogic: data.suggestedAnswerLogic ?? null,
        sampleAnswer: data.sampleAnswer ?? null,
        keywords: data.keywords ?? null,
        commonMistakes: data.commonMistakes ?? null,
        scoringRubric: data.scoringRubric ?? null,
        createdBy: user.id,
      },
    });
    res.status(201).json(q);
  } catch (err) {
    res.status(500).json({ message: "Lỗi server" });
  }
});

// PUT /api/questions/:id (admin)
questionsRouter.put("/:id", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), async (req, res) => {
  const parsed = questionSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Dữ liệu không hợp lệ", errors: parsed.error.flatten().fieldErrors });
    return;
  }

  try {
    const user = res.locals.user as AuthenticatedUser;
    const data = parsed.data;

    const q = await prisma.question.update({
      where: { id: req.params.id },
      data: {
        ...data,
        schoolId: data.schoolId !== undefined ? (data.schoolId || null) : undefined,
        majorId: data.majorId !== undefined ? (data.majorId || null) : undefined,
        scholarshipId: data.scholarshipId !== undefined ? (data.scholarshipId || null) : undefined,
        updatedBy: user.id,
      },
    });
    res.json(q);
  } catch (err: any) {
    if (err.code === "P2025") { res.status(404).json({ message: "Không tìm thấy câu hỏi" }); return; }
    res.status(500).json({ message: "Lỗi server" });
  }
});

// DELETE /api/questions/:id (soft delete, admin)
questionsRouter.delete("/:id", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), async (req, res) => {
  try {
    await prisma.question.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date(), isActive: false },
    });
    res.json({ message: "Đã xoá câu hỏi" });
  } catch (err: any) {
    if (err.code === "P2025") { res.status(404).json({ message: "Không tìm thấy câu hỏi" }); return; }
    res.status(500).json({ message: "Lỗi server" });
  }
});
