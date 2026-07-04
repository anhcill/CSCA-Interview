import { DegreeLevel } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import { analyzeStudyPlanWithAi } from "../ai/ai.service.js";
import {
  cleanStudyPlanText,
  createStudyPlanParseMetadata,
  minimumStudyPlanTextLength,
  type StudyPlanParseMetadata
} from "../profiles/document-parser.js";
import { buildInterviewRagContext } from "./rag-context.service.js";

export interface StudyPlanAnalysisResult {
  strengths: string[];
  weaknesses: string[];
  missingPoints: string[];
  suggestions: string[];
  alignmentScore: number;
  generatedQuestions: string[];
  parseMetadata?: StudyPlanParseMetadata;
}

export async function analyzeStudyPlan(
  userId: string,
  studyPlan: string,
  schoolId?: string | null,
  majorId?: string | null,
  scholarshipId?: string | null,
  scholarshipType?: string | null,
  targetSchool?: string | null,
  targetMajor?: string | null,
  degreeLevel?: DegreeLevel | null,
  parseMetadata?: StudyPlanParseMetadata | null
): Promise<StudyPlanAnalysisResult> {
  // 1. Lấy thông tin profile và các đối tượng liên quan để sinh context RAG
  const profile = await prisma.userProfile.findUnique({
    where: { userId }
  });

  if (!profile) {
    throw new Error("Không tìm thấy hồ sơ người dùng");
  }

  const finalDegreeLevel = degreeLevel ?? profile.degreeLevel ?? DegreeLevel.BACHELOR;
  const finalSchoolId = schoolId !== undefined ? schoolId : profile.schoolId;
  const finalMajorId = majorId !== undefined ? majorId : profile.majorId;
  const finalScholarshipId = scholarshipId !== undefined ? scholarshipId : profile.scholarshipId;
  const finalSchoolName = targetSchool || profile.targetSchool || "";
  const finalMajorName = targetMajor || profile.targetMajor || "";
  const finalScholarshipType = scholarshipType || profile.scholarshipType || "";
  const cleanedStudyPlan = cleanStudyPlanText(studyPlan);
  const finalParseMetadata = createStudyPlanParseMetadata({
    fileName: parseMetadata?.fileName ?? profile.studyPlanFileName ?? null,
    fileType: parseMetadata?.fileType,
    originalTextLength: parseMetadata?.originalTextLength ?? cleanedStudyPlan.originalLength,
    pageCount: parseMetadata?.pageCount,
    text: cleanedStudyPlan.text,
    truncated: Boolean(parseMetadata?.truncated || cleanedStudyPlan.truncated),
    warnings: parseMetadata?.warnings ?? []
  });

  if (cleanedStudyPlan.text.length < minimumStudyPlanTextLength) {
    throw new Error(finalParseMetadata.warnings[0] ?? "Kế hoạch học tập quá ngắn hoặc không hợp lệ");
  }

  // 2. Build RAG Context
  const ragContext = await buildInterviewRagContext({
    majorId: finalMajorId,
    schoolId: finalSchoolId,
    scholarshipId: finalScholarshipId,
    scholarshipType: finalScholarshipType,
    targetMajor: finalMajorName,
    targetSchool: finalSchoolName
  });

  // 3. Gọi OpenAI GPT thông qua ai.service
  const aiResult = await analyzeStudyPlanWithAi({
    studyPlan: cleanedStudyPlan.text,
    degreeLevel: finalDegreeLevel,
    targetSchool: finalSchoolName,
    targetMajor: finalMajorName,
    scholarshipType: finalScholarshipType,
    ragContext: ragContext.contextText,
    userId
  });

  // 4. Lưu kết quả phân tích vào DB trong bảng study_plan_analyses
  await prisma.study_plan_analyses.create({
    data: {
      user_id: userId,
      profile_id: profile.id,
      strengths: aiResult.strengths.join("\n"),
      weaknesses: aiResult.weaknesses.join("\n"),
      missing_points: aiResult.missingPoints.join("\n"),
      suggested_improvements: aiResult.suggestions.join("\n"),
      generated_questions: aiResult.generatedQuestions as any
    }
  });

  return {
    ...aiResult,
    parseMetadata: finalParseMetadata
  };
}
