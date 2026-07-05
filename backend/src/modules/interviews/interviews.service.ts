import {
  DegreeLevel,
  DifficultyLevel,
  type InterviewSessionQuestion,
  InterviewStatus,
  LanguageCode,
  Prisma,
  QuestionCategory,
  QuestionSource
} from "@prisma/client";
import type { Response } from "express";
import { prisma } from "../../db/prisma.js";
import { generateInterviewQuestions } from "../ai/ai.service.js";
import { buildSessionAnalysis } from "./detailed-scoring.service.js";
import { awardBadgesForUser } from "../gamification/gamification.service.js";
import { normalizeSearchText, rankSearchCandidate } from "../../utils/search-normalize.js";

export { checkAiCallBudget, maxAiCallsPerUserPerDay } from "../ai/ai-budget.service.js";

// ── Constants ──────────────────────────────────────────────────────────
const defaultPlannedDurationMinutes = 30;
const estimatedMinutesPerQuestion = 6;
const minSessionQuestions = 3;
export const maxSessionQuestions = 30;
export const initialSessionQuestions = 5;

// ── Types ──────────────────────────────────────────────────────────────
export type PreparedQuestion = {
  aiReason?: string | null;
  category: QuestionCategory;
  difficulty: DifficultyLevel;
  expectedAnswerLogic?: string | null;
  language: LanguageCode;
  questionId?: string | null;
  questionText: string;
  source: QuestionSource;
};

export type AnalysisSession = Prisma.InterviewSessionGetPayload<{
  include: {
    answers: {
      include: {
        sessionQuestion: {
          include: {
            question: {
              select: {
                keywords: true;
                sampleAnswer: true;
                suggestedAnswerLogic: true;
              };
            };
          };
        };
      };
    };
  };
}>;

export type PersistedReport = {
  id: string;
  language_feedback: string | null;
  logic_feedback: string | null;
  next_steps: string | null;
  overall_score: Prisma.Decimal | null;
  recommended_practice: string | null;
  repeated_mistakes: string | null;
  summary: string | null;
};

// ── Default Question Sets ──────────────────────────────────────────────
export const defaultQuestionSets: Record<
  LanguageCode,
  Array<Pick<PreparedQuestion, "category" | "difficulty" | "expectedAnswerLogic" | "questionText">>
> = {
  [LanguageCode.ZH]: [
    {
      category: QuestionCategory.PERSONAL,
      difficulty: DifficultyLevel.EASY,
      expectedAnswerLogic: "Bạn hãy giới thiệu bản thân ngắn gọn, nêu nền tảng học tập và mục tiêu apply.",
      questionText: "请介绍一下你自己。"
    },
    {
      category: QuestionCategory.SCHOOL_MAJOR,
      difficulty: DifficultyLevel.MEDIUM,
      expectedAnswerLogic: "Nêu lý do chọn trường/ngành, liên hệ với năng lực và kế hoạch học tập.",
      questionText: "你为什么选择我们学校和这个专业？"
    },
    {
      category: QuestionCategory.STUDY_PLAN,
      difficulty: DifficultyLevel.MEDIUM,
      expectedAnswerLogic: "Trình bày kế hoạch học theo giai đoạn và kết quả mong muốn.",
      questionText: "你未来的学习计划是什么？"
    },
    {
      category: QuestionCategory.SCHOLARSHIP,
      difficulty: DifficultyLevel.MEDIUM,
      expectedAnswerLogic: "Giải thích học bổng phù hợp với mục tiêu và cam kết học tập của bạn.",
      questionText: "你为什么申请这个奖学金？"
    },
    {
      category: QuestionCategory.CAREER_PLAN,
      difficulty: DifficultyLevel.MEDIUM,
      expectedAnswerLogic: "Nêu định hướng nghề nghiệp sau tốt nghiệp và cách chương trình học hỗ trợ mục tiêu đó.",
      questionText: "毕业以后你有什么职业规划？"
    },
    {
      category: QuestionCategory.SITUATION,
      difficulty: DifficultyLevel.MEDIUM,
      expectedAnswerLogic: "Đưa cách xử lý cụ thể nếu gặp rào cản ngôn ngữ hoặc môi trường mới.",
      questionText: "如果遇到语言困难，你会怎么解决？"
    },
    {
      category: QuestionCategory.LANGUAGE,
      difficulty: DifficultyLevel.EASY,
      expectedAnswerLogic: "Cho thấy bạn đã tìm hiểu văn hóa và có thái độ học hỏi nghiêm túc.",
      questionText: "你对中国文化有什么了解？"
    }
  ],
  [LanguageCode.VI]: [
    {
      category: QuestionCategory.PERSONAL,
      difficulty: DifficultyLevel.EASY,
      expectedAnswerLogic: "Giới thiệu ngắn gọn, có thông tin học tập, điểm mạnh và mục tiêu apply.",
      questionText: "Bạn hãy giới thiệu bản thân."
    },
    {
      category: QuestionCategory.SCHOOL_MAJOR,
      difficulty: DifficultyLevel.MEDIUM,
      expectedAnswerLogic: "Nêu lý do chọn trường/ngành và liên hệ với năng lực hiện tại.",
      questionText: "Vì sao bạn chọn trường và ngành này?"
    },
    {
      category: QuestionCategory.STUDY_PLAN,
      difficulty: DifficultyLevel.MEDIUM,
      expectedAnswerLogic: "Trả lời theo từng giai đoạn học tập và mục tiêu đầu ra.",
      questionText: "Kế hoạch học tập của bạn là gì?"
    }
  ],
  [LanguageCode.EN]: [
    {
      category: QuestionCategory.PERSONAL,
      difficulty: DifficultyLevel.EASY,
      expectedAnswerLogic: "Introduce your background, academic strengths, and application goal.",
      questionText: "Please introduce yourself."
    },
    {
      category: QuestionCategory.SCHOOL_MAJOR,
      difficulty: DifficultyLevel.MEDIUM,
      expectedAnswerLogic: "Explain your school/major choice and connect it with your experience.",
      questionText: "Why did you choose this university and major?"
    },
    {
      category: QuestionCategory.STUDY_PLAN,
      difficulty: DifficultyLevel.MEDIUM,
      expectedAnswerLogic: "Describe your study plan by stages with clear academic outcomes.",
      questionText: "What is your future study plan?"
    }
  ]
};

// ── Helpers ────────────────────────────────────────────────────────────

export function rejectLockedSession(res: Response, status: InterviewStatus) {
  if (status === InterviewStatus.PAUSED) {
    res.status(409).json({ message: "Buổi phỏng vấn đang tạm dừng" });
    return true;
  }
  if (status === InterviewStatus.COMPLETED) {
    res.status(409).json({ message: "Buổi phỏng vấn đã hoàn thành" });
    return true;
  }
  if (status === InterviewStatus.CANCELLED) {
    res.status(409).json({ message: "Buổi phỏng vấn đã bị hủy" });
    return true;
  }
  return false;
}

export function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export function getQuestionLimitForDuration(plannedDurationMinutes?: number | null) {
  const minutes = Number(plannedDurationMinutes ?? defaultPlannedDurationMinutes);
  if (!Number.isFinite(minutes) || minutes <= 0) return initialSessionQuestions;

  return clampQuestionLimit(Math.round(minutes / estimatedMinutesPerQuestion));
}

function clampQuestionLimit(value: number) {
  if (!Number.isFinite(value)) return initialSessionQuestions;
  return Math.max(minSessionQuestions, Math.min(maxSessionQuestions, Math.floor(value)));
}

type BankQuestionLookupInput = {
  degreeLevel?: DegreeLevel | null;
  language: LanguageCode;
  limit?: number;
  majorId?: string | null;
  schoolId?: string | null;
  scholarshipId?: string | null;
  scholarshipType?: string | null;
  targetMajor?: string | null;
  targetSchool?: string | null;
};

export async function findBankQuestions(input: BankQuestionLookupInput | LanguageCode, degreeLevel?: DegreeLevel | null) {
  const lookup = typeof input === "string" ? { degreeLevel, language: input } : input;
  const limit = clampQuestionLimit(lookup.limit ?? 7);
  const [school, major, scholarship] = await Promise.all([
    findSchoolTarget(lookup.schoolId, lookup.targetSchool),
    findMajorTarget(lookup.majorId, lookup.targetMajor),
    findScholarshipTarget(lookup.scholarshipId, lookup.scholarshipType)
  ]);
  const where: Prisma.QuestionWhereInput = {
    deletedAt: null,
    isActive: true,
    language: lookup.language
  };

  if (lookup.degreeLevel) {
    where.OR = [{ degreeLevel: lookup.degreeLevel }, { degreeLevel: null }];
  }

  where.AND = [
    scopeQuestionField("schoolId", school?.id ?? null),
    scopeQuestionField("majorId", major?.id ?? null),
    scopeQuestionField("scholarshipId", scholarship?.id ?? null)
  ];

  const questions = await prisma.question.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50
  });

  return questions
    .sort((left, right) => questionTargetScore(right, { majorId: major?.id, scholarshipId: scholarship?.id, schoolId: school?.id })
      - questionTargetScore(left, { majorId: major?.id, scholarshipId: scholarship?.id, schoolId: school?.id }))
    .slice(0, limit);
}

function scopeQuestionField(field: "majorId" | "scholarshipId" | "schoolId", id: string | null): Prisma.QuestionWhereInput {
  return id
    ? { OR: [{ [field]: null }, { [field]: id }] }
    : { [field]: null };
}

function questionTargetScore(
  question: { majorId: string | null; scholarshipId: string | null; schoolId: string | null },
  target: { majorId?: string; scholarshipId?: string; schoolId?: string }
) {
  let score = 0;
  if (target.schoolId && question.schoolId === target.schoolId) score += 5;
  if (target.majorId && question.majorId === target.majorId) score += 3;
  if (target.scholarshipId && question.scholarshipId === target.scholarshipId) score += 2;
  return score;
}

function cleanTargetName(value?: string | null) {
  const cleaned = value?.trim();
  const normalized = normalizeSearchText(cleaned ?? "");
  if (!cleaned || ["truong ban apply", "nganh ban apply", "hoc bong muc tieu"].includes(normalized)) return null;
  return cleaned;
}

function cleanTargetId(value?: string | null) {
  const cleaned = value?.trim();
  return cleaned && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cleaned)
    ? cleaned
    : null;
}

async function findSchoolTarget(id?: string | null, name?: string | null) {
  const targetId = cleanTargetId(id);
  if (targetId) {
    const school = await prisma.school.findFirst({
      where: { id: targetId, isActive: true },
      select: { id: true }
    });
    if (school) return school;
  }

  const target = cleanTargetName(name);
  if (!target) return null;

  const exact = await prisma.school.findFirst({
    where: {
      isActive: true,
      OR: [
        { name: { equals: target, mode: "insensitive" } },
        { nameEn: { equals: target, mode: "insensitive" } },
        { nameZh: { equals: target, mode: "insensitive" } }
      ]
    },
    select: { city: true, id: true, name: true, nameEn: true, nameZh: true, province: true }
  });

  if (exact) return { id: exact.id };

  const candidates = await prisma.school.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { city: true, id: true, name: true, nameEn: true, nameZh: true, province: true },
    take: 2000
  });
  const best = candidates
    .map((school) => ({
      id: school.id,
      rank: rankSearchCandidate(target, [school.name, school.nameEn, school.nameZh, school.city, school.province])
    }))
    .filter((school) => school.rank > 0)
    .sort((left, right) => right.rank - left.rank)[0];

  return best ? { id: best.id } : null;
}

async function findMajorTarget(id?: string | null, name?: string | null) {
  const targetId = cleanTargetId(id);
  if (targetId) {
    const major = await prisma.major.findFirst({
      where: { id: targetId, isActive: true },
      select: { id: true }
    });
    if (major) return major;
  }

  const target = cleanTargetName(name);
  if (!target) return null;

  return prisma.major.findFirst({
    where: {
      isActive: true,
      OR: [
        { name: { equals: target, mode: "insensitive" } },
        { nameEn: { equals: target, mode: "insensitive" } },
        { nameZh: { equals: target, mode: "insensitive" } }
      ]
    },
    select: { id: true }
  });
}

async function findScholarshipTarget(id?: string | null, name?: string | null) {
  const targetId = cleanTargetId(id);
  if (targetId) {
    const scholarship = await prisma.scholarship.findFirst({
      where: { id: targetId, isActive: true },
      select: { id: true }
    });
    if (scholarship) return scholarship;
  }

  const target = cleanTargetName(name);
  if (!target) return null;

  return prisma.scholarship.findFirst({
    where: {
      isActive: true,
      OR: [
        { name: { equals: target, mode: "insensitive" } },
        { code: { equals: target, mode: "insensitive" } }
      ]
    },
    select: { id: true }
  });
}

export async function getUserInterviewSessionsList(userId: string, limit = 10, skip = 0) {
  return prisma.interviewSession.findMany({
    where: { userId },
    take: limit,
    skip,
    select: {
      answeredQuestions: true,
      createdAt: true,
      endedAt: true,
      id: true,
      language: true,
      mode: true,
      plannedDurationMinutes: true,
      startedAt: true,
      status: true,
      targetMajor: true,
      targetSchool: true,
      totalQuestions: true,
      totalScore: true
    },
    orderBy: { createdAt: "desc" }
  });
}

export function buildPreparedQuestions({
  aiQuestions,
  bankQuestions,
  language,
  targetQuestionCount
}: {
  aiQuestions: Awaited<ReturnType<typeof generateInterviewQuestions>>;
  bankQuestions: Awaited<ReturnType<typeof findBankQuestions>>;
  language: LanguageCode;
  targetQuestionCount?: number;
}): PreparedQuestion[] {
  const questionLimit = clampQuestionLimit(targetQuestionCount ?? initialSessionQuestions);
  const bankPrepared = bankQuestions.map((question) => ({
    category: question.category,
    difficulty: question.difficulty,
    expectedAnswerLogic: question.suggestedAnswerLogic,
    language: question.language,
    questionId: question.id,
    questionText: question.questionText,
    source: QuestionSource.ADMIN_BANK
  }));

  const aiPrepared = aiQuestions.map((question) => ({
    aiReason: question.aiReason,
    category: toQuestionCategory(question.category),
    difficulty: toDifficultyLevel(question.difficulty),
    expectedAnswerLogic: question.expectedAnswerLogic,
    language,
    questionText: question.questionText,
    source: QuestionSource.AI_GENERATED
  }));

  const fallbackPrepared = defaultQuestionSets[language].map((question) => ({
    ...question,
    language,
    source: QuestionSource.ADMIN_BANK
  }));

  return [...bankPrepared, ...aiPrepared, ...fallbackPrepared]
    .filter((question, index, questions) => {
      return questions.findIndex((item) => item.questionText === question.questionText) === index;
    })
    .slice(0, questionLimit);
}

export function toQuestionCategory(category: string): QuestionCategory {
  const map: Record<string, QuestionCategory> = {
    ACADEMIC: QuestionCategory.ACADEMIC,
    CAREER_PLAN: QuestionCategory.CAREER_PLAN,
    LANGUAGE: QuestionCategory.LANGUAGE,
    MOTIVATION: QuestionCategory.OTHER,
    OTHER: QuestionCategory.OTHER,
    PERSONAL: QuestionCategory.PERSONAL,
    RESEARCH: QuestionCategory.RESEARCH,
    SCHOLARSHIP: QuestionCategory.SCHOLARSHIP,
    SCHOOL_MAJOR: QuestionCategory.SCHOOL_MAJOR,
    SITUATION: QuestionCategory.SITUATION,
    STUDY_PLAN: QuestionCategory.STUDY_PLAN
  };
  return map[category] ?? QuestionCategory.STUDY_PLAN;
}

export function toDifficultyLevel(difficulty: string): DifficultyLevel {
  return difficulty === "EASY"
    ? DifficultyLevel.EASY
    : difficulty === "HARD"
      ? DifficultyLevel.HARD
      : DifficultyLevel.MEDIUM;
}

export function toSessionDto(
  session: Prisma.InterviewSessionGetPayload<{
    include: {
      answers: true;
      sessionQuestions: true;
    };
  }>
) {
  return {
    answers: session.answers.map((answer) => ({
      answerText: answer.answerText,
      feedback: answer.feedback,
      id: answer.id,
      improvedAnswer: answer.improvedAnswer,
      scoreLanguage: answer.scoreLanguage?.toString() ?? null,
      scoreLogic: answer.scoreLogic?.toString() ?? null,
      scoreRelevance: answer.scoreRelevance?.toString() ?? null,
      scoreSpecificity: answer.scoreSpecificity?.toString() ?? null,
      scoreTotal: answer.scoreTotal?.toString() ?? null,
      strengths: answer.strengths,
      weaknesses: answer.weaknesses,
      sessionQuestionId: answer.sessionQuestionId
    })),
    answeredQuestions: session.answeredQuestions,
    degreeLevel: session.degreeLevel,
    id: session.id,
    language: session.language,
    mode: session.mode,
    questions: session.sessionQuestions.map((question) => ({
      category: question.category,
      difficulty: question.difficulty,
      expectedAnswerLogic: question.expectedAnswerLogic,
      id: question.id,
      language: question.language,
      orderIndex: question.orderIndex,
      questionText: question.questionText,
      source: question.source
    })),
    status: session.status,
    targetMajor: session.targetMajor,
    targetSchool: session.targetSchool,
    totalQuestions: session.totalQuestions
  };
}

export function toQuestionDto(question: InterviewSessionQuestion) {
  return {
    aiReason: question.aiReason,
    category: question.category,
    difficulty: question.difficulty,
    expectedAnswerLogic: question.expectedAnswerLogic,
    id: question.id,
    language: question.language,
    orderIndex: question.orderIndex,
    questionText: question.questionText,
    source: question.source
  };
}

export async function loadAnalysisSession(sessionId: string, userId?: string): Promise<AnalysisSession | null> {
  return prisma.interviewSession.findFirst({
    where: {
      id: sessionId,
      ...(userId ? { userId } : {})
    },
    include: {
      answers: {
        include: {
          sessionQuestion: {
            include: {
              question: {
                select: {
                  keywords: true,
                  sampleAnswer: true,
                  suggestedAnswerLogic: true
                }
              }
            }
          }
        },
        orderBy: { answeredAt: "asc" }
      }
    }
  });
}

export async function persistInterviewReport(sessionId: string, userId: string, loadedSession?: AnalysisSession) {
  const session = loadedSession ?? await loadAnalysisSession(sessionId, userId);
  if (!session) return null;

  const analysis = buildSessionAnalysis(session);
  const overallScore = Math.round(analysis.overallScore * 100) / 10;
  const nextSteps = [analysis.progressHint, ...analysis.improvementTips.slice(0, 4)].filter(Boolean).join("\n");
  const data = {
    language_feedback: `Ngôn ngữ đạt ${analysis.criteriaAverages.language}/10. Ưu tiên câu ngắn, rõ ý và dùng thuật ngữ học thuật phù hợp.`,
    logic_feedback: `Logic đạt ${analysis.criteriaAverages.logic}/10. Cần mở câu trả lời theo cấu trúc: mục tiêu, lý do, ví dụ, kế hoạch.`,
    next_steps: nextSteps,
    overall_score: overallScore,
    recommended_practice: analysis.improvementTips.join("\n"),
    repeated_mistakes: analysis.weaknesses.join("\n"),
    summary: analysis.sessionSummary
  };

  return prisma.interview_reports.upsert({
    where: { session_id: session.id },
    create: {
      ...data,
      session_id: session.id,
      user_id: userId
    },
    update: {
      ...data,
      updated_at: new Date()
    }
  });
}

export function mergePersistedReportIntoAnalysis(analysis: ReturnType<typeof buildSessionAnalysis>, report: PersistedReport) {
  const repeatedMistakes = splitReportLines(report.repeated_mistakes);
  const recommendedPractice = splitReportLines(report.recommended_practice);
  const nextSteps = splitReportLines(report.next_steps);
  const overallScore = Number(report.overall_score ?? 0);

  return {
    ...analysis,
    improvementTips: recommendedPractice.length ? recommendedPractice : analysis.improvementTips,
    overallScore: overallScore > 0 ? Math.round(overallScore) / 10 : analysis.overallScore,
    progressHint: nextSteps[0] ?? analysis.progressHint,
    sessionSummary: report.summary ?? analysis.sessionSummary,
    weaknesses: repeatedMistakes.length ? repeatedMistakes : analysis.weaknesses
  };
}

export function toReportDto(report: PersistedReport) {
  return {
    id: report.id,
    languageFeedback: report.language_feedback,
    logicFeedback: report.logic_feedback,
    nextSteps: splitReportLines(report.next_steps),
    overallScore: Number(report.overall_score ?? 0),
    recommendedPractice: splitReportLines(report.recommended_practice),
    repeatedMistakes: splitReportLines(report.repeated_mistakes),
    summary: report.summary
  };
}

export function splitReportLines(value: string | null | undefined) {
  return (value ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}
