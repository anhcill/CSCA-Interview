import { DegreeLevel } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import { requireAuth, type AuthenticatedUser } from "../auth/auth.middleware.js";
import {
  cleanStudyPlanText,
  createStudyPlanParseMetadata,
  decodeBase64DocumentPayload,
  extractTextFromDocument,
  minimumStudyPlanTextLength,
  type StudyPlanParseMetadata,
  uploadToCloudinary
} from "./document-parser.js";
import { uploadStudyPlanToR2 } from "../storage/r2.service.js";

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

  let studyPlanText = cleanStudyPlanText(parsed.data.studyPlan || existingProfile?.studyPlan || "").text;
  let studyPlanFileName = parsed.data.studyPlanFileName !== undefined ? parsed.data.studyPlanFileName : existingProfile?.studyPlanFileName;
  let studyPlanFileContent = existingProfile?.studyPlanFileContent || null;
  let studyPlanFileUrl = existingProfile?.studyPlanFileUrl || null;
  let studyPlanParseMetadata: StudyPlanParseMetadata | null = null;

  // Nếu người dùng tải lên tệp mới
  if (parsed.data.studyPlanFileContent && parsed.data.studyPlanFileName) {
    try {
      const buffer = decodeBase64DocumentPayload(parsed.data.studyPlanFileContent);
      const fileSize = buffer.byteLength;

      // 1. Trích xuất văn bản từ tệp để AI đọc
      const parsedDocument = await extractTextFromDocument(buffer, parsed.data.studyPlanFileName);
      studyPlanText = parsedDocument.text;
      studyPlanParseMetadata = parsedDocument.metadata;

      if (studyPlanText.trim().length < minimumStudyPlanTextLength || studyPlanParseMetadata.parseStatus === "failed") {
        res.status(400).json({
          message: buildParseErrorMessage(studyPlanParseMetadata),
          studyPlanParseMetadata
        });
        return;
      }

      studyPlanFileName = parsed.data.studyPlanFileName;

      // 2. Phân tách lưu trữ: dưới 10MB lưu Cloudinary, trên 10MB lưu DB
      if (fileSize <= cloudinaryRawUploadLimitBytes) {
        studyPlanFileUrl = await uploadToCloudinary(buffer, parsed.data.studyPlanFileName);
        studyPlanFileContent = null;
      } else {
        studyPlanFileUrl = await uploadStudyPlanToR2({
          buffer,
          fileName: parsed.data.studyPlanFileName,
          userId: user.id
        });
        studyPlanFileContent = null;
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
  if (!studyPlanText || studyPlanText.trim().length < minimumStudyPlanTextLength) {
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
    profile: toProfileDto(profile, studyPlanParseMetadata),
    studyPlanParseMetadata: studyPlanParseMetadata ?? toStudyPlanParseMetadata(profile)
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

function toProfileDto(profile: any, studyPlanParseMetadata?: StudyPlanParseMetadata | null) {
  return {
    ...profile,
    studyPlanParseMetadata: studyPlanParseMetadata ?? toStudyPlanParseMetadata(profile)
  };
}

function toStudyPlanParseMetadata(profile: any) {
  return createStudyPlanParseMetadata({
    fileName: profile.studyPlanFileName ?? null,
    text: profile.studyPlan ?? ""
  });
}

function buildParseErrorMessage(metadata: StudyPlanParseMetadata) {
  return metadata.warnings[0] ?? "Không thể trích xuất nội dung Study Plan từ file. Vui lòng upload PDF/DOCX/TXT có text hoặc OCR file scan.";
}
