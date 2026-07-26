import { DegreeLevel, InterviewMode, LanguageCode } from "@prisma/client";
import { z } from "zod";

export const createInterviewSchema = z.object({
  age: z.coerce.number().int().min(13).max(80).optional(),
  degreeLevel: z.nativeEnum(DegreeLevel).optional(),
  fullName: z.string().trim().min(2).max(150).optional(),
  language: z.nativeEnum(LanguageCode).default(LanguageCode.ZH),
  mode: z.nativeEnum(InterviewMode).default(InterviewMode.PRACTICE),
  plannedDurationMinutes: z.coerce.number().int().min(10).max(180).optional(),
  schoolId: z.string().uuid().optional().nullable(),
  majorId: z.string().uuid().optional().nullable(),
  scholarshipId: z.string().uuid().optional().nullable(),
  scholarshipType: z.string().trim().optional(),
  studyPlan: z.string().trim().optional(),
  targetMajor: z.string().trim().optional(),
  targetSchool: z.string().trim().optional()
});

export const submitAnswerSchema = z.object({
  answerText: z.string().trim().min(1, "Vui lòng nhập câu trả lời"),
  submissionId: z.string().uuid("Mã gửi câu trả lời không hợp lệ"),
  sessionQuestionId: z.string().uuid("Câu hỏi không hợp lệ")
});

export const streamAnswerSchema = z.object({
  answerText: z.string().trim().min(1),
  sessionQuestionId: z.string().uuid()
});

export const nextQuestionSchema = z.object({
  forceAi: z.boolean().optional().default(false)
});

export const skipQuestionSchema = z.object({
  sessionQuestionId: z.string().uuid("Câu hỏi không hợp lệ")
});
