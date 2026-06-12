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

// ── Constants ──────────────────────────────────────────────────────────
export const maxSessionQuestions = 10;
export const initialSessionQuestions = 5;
export const maxAiCallsPerUserPerDay = Number(process.env.AI_DAILY_CALL_LIMIT ?? 40);

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

export async function checkAiCallBudget(userId: string) {
  if (!Number.isFinite(maxAiCallsPerUserPerDay) || maxAiCallsPerUserPerDay <= 0) {
    return { ok: true as const };
  }

  const since = new Date();
  since.setHours(0, 0, 0, 0);

  const used = await prisma.ai_usage_logs.count({
    where: {
      created_at: { gte: since },
      error_message: null,
      user_id: userId
    }
  });

  if (used >= maxAiCallsPerUserPerDay) {
    return {
      ok: false as const,
      message: `Bạn đã đạt giới hạn ${maxAiCallsPerUserPerDay} lượt AI hôm nay. Vui lòng thử lại ngày mai.`
    };
  }

  return { ok: true as const };
}

export async function findBankQuestions(language: LanguageCode, degreeLevel?: DegreeLevel | null) {
  const where: Prisma.QuestionWhereInput = {
    deletedAt: null,
    isActive: true,
    language
  };

  if (degreeLevel) {
    where.OR = [{ degreeLevel }, { degreeLevel: null }];
  }

  return prisma.question.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 7
  });
}

export function buildPreparedQuestions({
  aiQuestions,
  bankQuestions,
  language
}: {
  aiQuestions: Awaited<ReturnType<typeof generateInterviewQuestions>>;
  bankQuestions: Awaited<ReturnType<typeof findBankQuestions>>;
  language: LanguageCode;
}): PreparedQuestion[] {
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
    .slice(0, initialSessionQuestions);
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
