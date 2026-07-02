import { DegreeLevel } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import { requireAuth, type AuthenticatedUser } from "../auth/auth.middleware.js";

export const profilesRouter = Router();

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
  studyPlan: z.string().trim().min(10, "Kế hoạch học tập cần có ít nhất 10 ký tự"),
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
  const data = normalizeProfileInput(parsed.data);

  const profile = await prisma.userProfile.upsert({
    where: { userId: user.id },
    create: {
      ...data,
      userId: user.id
    },
    update: data
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
    studyPlan: input.studyPlan.trim(),
    targetMajor: input.targetMajor.trim(),
    targetSchool: input.targetSchool.trim(),
    toeflScore: emptyToNull(input.toeflScore),
    weaknesses: emptyToNull(input.weaknesses),
    workExperience: emptyToNull(input.workExperience)
  };
}

function toProfileDto(profile: Awaited<ReturnType<typeof prisma.userProfile.findUnique>> & {}) {
  return profile;
}
