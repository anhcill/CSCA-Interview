import { DegreeLevel } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import { requireAuth, type AuthenticatedUser } from "../auth/auth.middleware.js";
import { extractTextFromDocument, uploadToCloudinary } from "./document-parser.js";

export const profilesRouter = Router();
const cloudinaryRawUploadLimitBytes = 10 * 1024 * 1024;

const profileSchema = z.object({
  additionalNotes: z.string().trim().optional().nullable(),
  age: z.coerce.number().int().min(12).max(80).optional().nullable(),
  awards: z.string().trim().optional().nullable(),
  careerPlan: z.string().trim().optional().nullable(),
  degreeLevel: z.nativeEnum(DegreeLevel),
  extracurricularActivities: z.string().trim().optional().nullable(),
  gpa: z.string().trim().optional().nullable(),
  hskLevel: z.string().trim().optional().nullable(),
  hskkLevel: z.string().trim().optional().nullable(),
  ieltsScore: z.string().trim().optional().nullable(),
  otherLanguages: z.string().trim().optional().nullable(),
  researchExperience: z.string().trim().optional().nullable(),
  schoolId: z.string().uuid().optional().nullable(),
  majorId: z.string().uuid().optional().nullable(),
  scholarshipId: z.string().uuid().optional().nullable(),
  scholarshipType: z.string().trim().min(1, "Vui lòng nhập loại học bổng"),
  strengths: z.string().trim().optional().nullable(),
  studyPlan: z.string().trim().optional().nullable(),
  studyPlanFileName: z.string().trim().optional().nullable(),
  studyPlanFileContent: z.string().trim().optional().nullable(),
  targetMajor: z.string().trim().min(1, "Vui lòng nhập ngành apply"),
  targetSchool: z.string().trim().min(1, "Vui lòng nhập trường apply"),
  toeflScore: z.string().trim().optional().nullable(),
  weaknesses: z.string().trim().optional().nullable(),
  workExperience: z.string().trim().optional().nullable()
});

profilesRouter.use(requireAuth);

profilesRouter.get("/me", async (_req, res) => {
  const user = res.locals.user as AuthenticatedUser;
  const profile = await prisma.userProfile.findUnique({
    where: { userId: user.id }
  });

  res.json({ profile: profile ? toProfileDto(profile) : null });
});

profilesRouter.put("/me", async (req, res) => {
  const parsed = profileSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      message: "Dữ liệu profile không hợp lệ",
      errors: parsed.error.flatten().fieldErrors
    });
    return;
  }

  const user = res.locals.user as AuthenticatedUser;
  const existingProfile = await prisma.userProfile.findUnique({
    where: { userId: user.id }
  });

  let studyPlanText = parsed.data.studyPlan || existingProfile?.studyPlan || "";
  let studyPlanFileName = parsed.data.studyPlanFileName !== undefined ? parsed.data.studyPlanFileName : existingProfile?.studyPlanFileName;
  let studyPlanFileContent = existingProfile?.studyPlanFileContent || null;
  let studyPlanFileUrl = existingProfile?.studyPlanFileUrl || null;

  // Nếu người dùng tải lên tệp mới
  if (parsed.data.studyPlanFileContent && parsed.data.studyPlanFileName) {
    try {
      const base64Data = parsed.data.studyPlanFileContent.replace(/^data:[^;]+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      const fileSize = buffer.byteLength;

      // 1. Trích xuất văn bản từ tệp để AI đọc
      studyPlanText = await extractTextFromDocument(buffer, parsed.data.studyPlanFileName);
      if (studyPlanText.trim().length < 10) {
        res.status(400).json({
          message: "Nội dung văn bản trích xuất được từ tệp quá ngắn (tối thiểu 10 ký tự)."
        });
        return;
      }

      studyPlanFileName = parsed.data.studyPlanFileName;

      // 2. Phân tách lưu trữ: dưới 10MB lưu Cloudinary, trên 10MB lưu DB
      if (fileSize <= cloudinaryRawUploadLimitBytes) {
        studyPlanFileUrl = await uploadToCloudinary(buffer, parsed.data.studyPlanFileName);
        studyPlanFileContent = null; // Xóa trong DB
      } else {
        studyPlanFileContent = base64Data;
        studyPlanFileUrl = null; // Xóa URL Cloudinary
      }
    } catch (err) {
      console.error("[StudyPlan Upload Error]", err);
      res.status(400).json({
        message: err instanceof Error ? err.message : "Không thể xử lý tệp kế hoạch học tập"
      });
      return;
    }
  } else if (parsed.data.studyPlanFileName === null) {
    // Xóa tệp hiện tại
    studyPlanFileName = null;
    studyPlanFileContent = null;
    studyPlanFileUrl = null;
  }

  // Bắt buộc phải có Kế hoạch học tập (hoặc qua file, hoặc qua text)
  if (!studyPlanText || studyPlanText.trim().length < 10) {
    res.status(400).json({
      message: "Vui lòng tải lên tệp Kế hoạch học tập (Study Plan) hợp lệ."
    });
    return;
  }

  const data = normalizeProfileInput(parsed.data);

  // Đè các trường thông tin file đã được resolve thủ công ở trên
  const finalData = {
    ...data,
    studyPlan: studyPlanText,
    studyPlanFileName,
    studyPlanFileContent,
    studyPlanFileUrl
  };

  const profile = await prisma.userProfile.upsert({
    where: { userId: user.id },
    create: {
      ...finalData,
      userId: user.id
    },
    update: finalData
  });

  res.json({
    message: "Cập nhật profile thành công",
    profile: toProfileDto(profile)
  });
});

type ProfileInput = z.infer<typeof profileSchema>;

function emptyToNull(value?: string | null) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeProfileInput(input: ProfileInput) {
  return {
    additionalNotes: emptyToNull(input.additionalNotes),
    age: input.age ?? null,
    awards: emptyToNull(input.awards),
    careerPlan: emptyToNull(input.careerPlan),
    degreeLevel: input.degreeLevel,
    extracurricularActivities: emptyToNull(input.extracurricularActivities),
    gpa: emptyToNull(input.gpa),
    hskLevel: emptyToNull(input.hskLevel),
    hskkLevel: emptyToNull(input.hskkLevel),
    ieltsScore: emptyToNull(input.ieltsScore),
    otherLanguages: emptyToNull(input.otherLanguages),
    researchExperience: emptyToNull(input.researchExperience),
    schoolId: input.schoolId ?? null,
    majorId: input.majorId ?? null,
    scholarshipId: input.scholarshipId ?? null,
    scholarshipType: input.scholarshipType.trim(),
    strengths: emptyToNull(input.strengths),
    targetMajor: input.targetMajor.trim(),
    targetSchool: input.targetSchool.trim(),
    toeflScore: emptyToNull(input.toeflScore),
    weaknesses: emptyToNull(input.weaknesses),
    workExperience: emptyToNull(input.workExperience)
  };
}

function toProfileDto(profile: any) {
  return profile;
}
