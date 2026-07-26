import { DegreeLevel, Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { logger } from "../../config/logger.js";
import { prisma } from "../../db/prisma.js";
import { requireAuth, type AuthenticatedUser } from "../auth/auth.middleware.js";
import {
  cleanStudyPlanText,
  createStudyPlanParseMetadata,
  decodeBase64DocumentPayload,
  extractTextFromDocument,
  extractTextFromImageDocuments,
  minimumStudyPlanTextLength,
  type StudyPlanParseMetadata,
  uploadToCloudinary
} from "./document-parser.js";
import { getStudyPlanContentType, uploadStudyPlanToR2 } from "../storage/r2.service.js";
import { InvalidApplicationTargetError, resolveApplicationTargets } from "./application-targets.service.js";
import { normalizeOtherLanguagesInput } from "./profile-autosave.js";
import { normalizeAndValidateGpa } from "./profile-gpa.js";

export const profilesRouter = Router();
const cloudinaryRawUploadLimitBytes = 10 * 1024 * 1024;
const maxStudyPlanImageBytes = 5 * 1024 * 1024;
const maxStudyPlanImageCount = 6;
const maxStudyPlanImagesTotalBytes = 20 * 1024 * 1024;

const studyPlanImageSchema = z.object({
  fileContent: z.string().trim().min(1),
  fileName: z.string().trim().min(1).max(255)
});

const otherLanguagesUpdateSchema = z.object({
  otherLanguages: z.string().trim().max(10_000).nullable()
}).strict();

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
  studyPlanImages: z.array(studyPlanImageSchema).max(maxStudyPlanImageCount).optional().nullable(),
  targetMajor: z.string().trim().min(1, "Vui lòng nhập ngành apply"),
  targetSchool: z.string().trim().min(1, "Vui lòng nhập trường apply"),
  toeflScore: z.string().trim().optional().nullable(),
  weaknesses: z.string().trim().optional().nullable(),
  workExperience: z.string().trim().optional().nullable()
}).superRefine((profile, context) => {
  const gpa = normalizeAndValidateGpa(profile.degreeLevel, profile.gpa);
  if (gpa.error) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: gpa.error,
      path: ["gpa"]
    });
  }
});

profilesRouter.use(requireAuth);

profilesRouter.get("/me", async (_req, res) => {
  const user = res.locals.user as AuthenticatedUser;
  const profile = await prisma.userProfile.findUnique({
    where: { userId: user.id }
  });

  res.json({ profile: profile ? toProfileDto(profile) : null });
});

profilesRouter.patch("/me/other-languages", async (req, res) => {
  const user = res.locals.user as AuthenticatedUser;
  const parsed = otherLanguagesUpdateSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      code: "PROFILE_OTHER_LANGUAGES_INVALID",
      message: "Nội dung ngoại ngữ/chứng chỉ khác không hợp lệ."
    });
    return;
  }

  const otherLanguages = normalizeOtherLanguagesInput(parsed.data.otherLanguages);
  const result = await prisma.userProfile.updateMany({
    where: { userId: user.id },
    data: { otherLanguages }
  });

  if (!result.count) {
    res.status(404).json({
      code: "PROFILE_NOT_FOUND",
      message: "Chưa có hồ sơ để cập nhật."
    });
    return;
  }

  res.json({
    message: "Đã tự động lưu ngoại ngữ/chứng chỉ khác.",
    otherLanguages
  });
});

profilesRouter.put("/me", async (req, res) => {
  const user = res.locals.user as AuthenticatedUser;
  const parsed = profileSchema.safeParse(req.body);

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    logger.warn({
      code: "PROFILE_VALIDATION_FAILED",
      fields: Object.keys(fieldErrors),
      reqId: req.requestId,
      userId: user.id,
      validationErrors: fieldErrors
    }, "Profile update rejected");
    res.status(400).json({
      code: "PROFILE_VALIDATION_FAILED",
      message: buildProfileValidationError(fieldErrors),
      errors: fieldErrors
    });
    return;
  }

  const existingProfile = await prisma.userProfile.findUnique({
    where: { userId: user.id }
  });
  let applicationTargets: Awaited<ReturnType<typeof resolveApplicationTargets>>;
  try {
    applicationTargets = await resolveApplicationTargets({
      degreeLevel: parsed.data.degreeLevel,
      majorId: parsed.data.majorId,
      scholarshipId: parsed.data.scholarshipId,
      scholarshipType: parsed.data.scholarshipType,
      schoolId: parsed.data.schoolId,
      targetMajor: parsed.data.targetMajor,
      targetSchool: parsed.data.targetSchool
    });
  } catch (error) {
    if (error instanceof InvalidApplicationTargetError) {
      res.status(400).json({ message: error.message });
      return;
    }
    throw error;
  }

  let studyPlanText = cleanStudyPlanText(parsed.data.studyPlan || existingProfile?.studyPlan || "").text;
  let studyPlanFileName = parsed.data.studyPlanFileName !== undefined ? parsed.data.studyPlanFileName : existingProfile?.studyPlanFileName;
  let studyPlanFileContent = existingProfile?.studyPlanFileContent || null;
  let studyPlanFileUrl = existingProfile?.studyPlanFileUrl || null;
  let studyPlanImageFiles = normalizeStoredStudyPlanImages(existingProfile?.studyPlanImageFiles);
  let studyPlanParseMetadata: StudyPlanParseMetadata | null = null;

  if (parsed.data.studyPlanImages?.length) {
    try {
      const imageFiles = parsed.data.studyPlanImages.map((image) => {
        assertSupportedStudyPlanImage(image.fileName);
        const buffer = decodeBase64DocumentPayload(image.fileContent);
        if (buffer.byteLength > maxStudyPlanImageBytes) {
          throw new Error(`Ảnh "${image.fileName}" vượt quá 5MB.`);
        }
        return { buffer, fileName: image.fileName };
      });
      const totalBytes = imageFiles.reduce((total, image) => total + image.buffer.byteLength, 0);
      if (totalBytes > maxStudyPlanImagesTotalBytes) {
        throw new Error("Tổng dung lượng ảnh Study Plan vượt quá 20MB.");
      }

      const parsedDocument = await extractTextFromImageDocuments(imageFiles);
      studyPlanText = parsedDocument.text;
      studyPlanParseMetadata = parsedDocument.metadata;
      if (studyPlanText.trim().length < minimumStudyPlanTextLength || studyPlanParseMetadata.parseStatus === "failed") {
        logStudyPlanExtractionFailure(req.requestId, user.id, studyPlanParseMetadata);
        res.status(400).json({
          code: "STUDY_PLAN_EXTRACTION_FAILED",
          message: buildParseErrorMessage(studyPlanParseMetadata),
          studyPlanParseMetadata
        });
        return;
      }

      studyPlanImageFiles = await Promise.all(imageFiles.map(async (image) => {
        const fileUrl = image.buffer.byteLength <= cloudinaryRawUploadLimitBytes
          ? await uploadToCloudinary(image.buffer, image.fileName)
          : await uploadStudyPlanToR2({ buffer: image.buffer, fileName: image.fileName, userId: user.id });
        return {
          contentType: getStudyPlanContentType(image.fileName),
          fileName: image.fileName,
          fileUrl,
          sizeBytes: image.buffer.byteLength
        };
      }));
      studyPlanFileName = `${studyPlanImageFiles.length} ảnh Study Plan`;
      studyPlanFileContent = null;
      studyPlanFileUrl = null;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Không thể xử lý ảnh Study Plan";
      logStudyPlanProcessingFailure(req.requestId, user.id, message, "multiple-images");
      res.status(400).json({
        code: "STUDY_PLAN_PROCESSING_FAILED",
        message: `Không thể xử lý ảnh Study Plan: ${message}`
      });
      return;
    }
  }

  // Nếu người dùng tải lên tệp mới
  if (!parsed.data.studyPlanImages?.length && parsed.data.studyPlanFileContent && parsed.data.studyPlanFileName) {
    try {
      const buffer = decodeBase64DocumentPayload(parsed.data.studyPlanFileContent);
      const fileSize = buffer.byteLength;

      // 1. Trích xuất văn bản từ tệp để AI đọc
      const parsedDocument = await extractTextFromDocument(buffer, parsed.data.studyPlanFileName);
      studyPlanText = parsedDocument.text;
      studyPlanParseMetadata = parsedDocument.metadata;

      if (studyPlanText.trim().length < minimumStudyPlanTextLength || studyPlanParseMetadata.parseStatus === "failed") {
        logStudyPlanExtractionFailure(req.requestId, user.id, studyPlanParseMetadata);
        res.status(400).json({
          code: "STUDY_PLAN_EXTRACTION_FAILED",
          message: buildParseErrorMessage(studyPlanParseMetadata),
          studyPlanParseMetadata
        });
        return;
      }

      studyPlanFileName = parsed.data.studyPlanFileName;
      studyPlanImageFiles = [];

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
      const message = err instanceof Error ? err.message : "Không thể xử lý tệp kế hoạch học tập";
      logStudyPlanProcessingFailure(req.requestId, user.id, message, getFileExtension(parsed.data.studyPlanFileName));
      res.status(400).json({
        code: "STUDY_PLAN_PROCESSING_FAILED",
        message: `Không thể xử lý file Study Plan: ${message}`
      });
      return;
    }
  } else if (!parsed.data.studyPlanImages?.length && (parsed.data.studyPlanFileName === null || parsed.data.studyPlanImages === null)) {
    // Xóa tệp hiện tại
    studyPlanFileName = null;
    studyPlanFileContent = null;
    studyPlanFileUrl = null;
    studyPlanImageFiles = [];
  }

  // Bắt buộc phải có Kế hoạch học tập (hoặc qua file, hoặc qua text)
  if (!studyPlanText || studyPlanText.trim().length < minimumStudyPlanTextLength) {
    logger.warn({
      code: "STUDY_PLAN_REQUIRED",
      extractedTextLength: studyPlanText.trim().length,
      minimumTextLength: minimumStudyPlanTextLength,
      reqId: req.requestId,
      userId: user.id
    }, "Profile update rejected");
    res.status(400).json({
      code: "STUDY_PLAN_REQUIRED",
      message: `Study Plan chưa có đủ nội dung: hệ thống đọc được ${studyPlanText.trim().length} ký tự, cần tối thiểu ${minimumStudyPlanTextLength}. Vui lòng tải file PDF/DOCX/TXT có text hoặc ảnh scan rõ hơn.`
    });
    return;
  }

  const data = normalizeProfileInput(parsed.data);

  // Đè các trường thông tin file đã được resolve thủ công ở trên
  const finalData = {
    ...data,
    ...applicationTargets,
    studyPlan: studyPlanText,
    studyPlanFileName,
    studyPlanFileContent,
    studyPlanFileUrl,
    studyPlanImageFiles: studyPlanImageFiles.length ? studyPlanImageFiles : Prisma.DbNull
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
  const normalizedGpa = normalizeAndValidateGpa(input.degreeLevel, input.gpa);
  return {
    additionalNotes: emptyToNull(input.additionalNotes),
    age: input.age ?? null,
    awards: emptyToNull(input.awards),
    careerPlan: emptyToNull(input.careerPlan),
    degreeLevel: input.degreeLevel,
    extracurricularActivities: emptyToNull(input.extracurricularActivities),
    gpa: normalizedGpa.value,
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
    studyPlanImageFiles: normalizeStoredStudyPlanImages(profile.studyPlanImageFiles),
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
  const failureWarning = metadata.warnings.find((warning) => (
    /không|chưa|bị khóa|quá ít|rất ít|lỗi/i.test(warning)
  ));
  const fileType = metadata.fileType ? metadata.fileType.toUpperCase() : "đã tải lên";
  const reason = failureWarning ?? "File không có đủ text để hệ thống phân tích.";

  return `Không thể đọc Study Plan ${fileType}: đọc được ${metadata.extractedTextLength} ký tự, cần tối thiểu ${minimumStudyPlanTextLength}. ${reason}`;
}

function buildProfileValidationError(fieldErrors: Record<string, string[] | undefined>) {
  const fieldLabels: Record<string, string> = {
    age: "Tuổi",
    degreeLevel: "Hệ apply",
    majorId: "Mã ngành",
    scholarshipId: "Mã học bổng",
    scholarshipType: "Loại học bổng",
    schoolId: "Mã trường",
    targetMajor: "Ngành apply",
    targetSchool: "Trường apply"
  };
  const invalidField = Object.entries(fieldErrors).find(([, errors]) => errors?.length);
  if (!invalidField) return "Dữ liệu profile không hợp lệ. Vui lòng kiểm tra lại các trường đã nhập.";

  const [field, errors] = invalidField;
  return `${fieldLabels[field] ?? field}: ${errors?.[0] ?? "dữ liệu không hợp lệ"}`;
}

function getFileExtension(fileName?: string | null) {
  return fileName?.split(".").pop()?.toLowerCase() ?? null;
}

type StoredStudyPlanImage = {
  contentType: string;
  fileName: string;
  fileUrl: string;
  sizeBytes: number;
};

function normalizeStoredStudyPlanImages(value: unknown): StoredStudyPlanImage[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    if (
      typeof record.contentType !== "string"
      || typeof record.fileName !== "string"
      || typeof record.fileUrl !== "string"
      || typeof record.sizeBytes !== "number"
    ) {
      return [];
    }
    return [{
      contentType: record.contentType,
      fileName: record.fileName,
      fileUrl: record.fileUrl,
      sizeBytes: record.sizeBytes
    }];
  });
}

function assertSupportedStudyPlanImage(fileName: string) {
  const extension = getFileExtension(fileName);
  if (!extension || !["png", "jpg", "jpeg", "webp"].includes(extension)) {
    throw new Error(`Ảnh "${fileName}" không đúng định dạng PNG/JPG/WEBP.`);
  }
}

function logStudyPlanExtractionFailure(reqId: string, userId: string, metadata: StudyPlanParseMetadata) {
  logger.warn({
    code: "STUDY_PLAN_EXTRACTION_FAILED",
    extractedTextLength: metadata.extractedTextLength,
    fileType: metadata.fileType,
    minimumTextLength: minimumStudyPlanTextLength,
    ocrModel: metadata.ocrModel,
    ocrPageCount: metadata.ocrPageCount,
    ocrProvider: metadata.ocrProvider,
    ocrUsed: Boolean(metadata.ocrUsed),
    parseStatus: metadata.parseStatus,
    reqId,
    userId,
    warnings: metadata.warnings
  }, "Profile update rejected");
}

function logStudyPlanProcessingFailure(reqId: string, userId: string, message: string, fileType: string | null) {
  logger.warn({
    code: "STUDY_PLAN_PROCESSING_FAILED",
    error: message,
    fileType,
    reqId,
    userId
  }, "Profile update rejected");
}
