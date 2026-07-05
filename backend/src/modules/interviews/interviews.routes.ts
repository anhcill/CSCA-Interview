import {
  DegreeLevel,
  DifficultyLevel,
  type InterviewAnswer,
  InterviewMode,
  type InterviewSessionQuestion,
  InterviewStatus,
  LanguageCode,
  Prisma,
  QuestionCategory,
  QuestionSource
} from "@prisma/client";
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import { requireAuth, type AuthenticatedUser } from "../auth/auth.middleware.js";
import { generateInterviewQuestions, scoreInterviewAnswerWithAi } from "../ai/ai.service.js";
import { createAdaptiveQuestion } from "./adaptive-interview.engine.js";
import { buildSessionAnalysis } from "./detailed-scoring.service.js";
import { buildInterviewRagContext } from "./rag-context.service.js";
import {
  buildPreparedQuestions as buildPreparedQuestionsFromService,
  checkAiCallBudget as checkAiCallBudgetFromService,
  delay as delayFromService,
  findBankQuestions as findBankQuestionsFromService,
  getUserInterviewSessionsList,
  maxSessionQuestions as serviceMaxSessionQuestions,
  rejectLockedSession as rejectLockedSessionFromService,
  toQuestionDto as toQuestionDtoFromService
} from "./interviews.service.js";
import { awardBadgesForUser, getGamificationSummary, getWeekStart } from "../gamification/gamification.service.js";
import { paginatedResponse, parsePagination } from "../../utils/pagination.js";
import { normalizeSearchText, rankSearchCandidate } from "../../utils/search-normalize.js";
import { getScoreProgressTimeline, getSkillProgressTimeline, compareSessionScores, getWeakAreas } from "./interview-stats.service.js";
import { analyzeStudyPlan } from "./study-plan-analysis.service.js";
import { consumeInterviewPayment, getInterviewPaymentEntitlement, paymentRequiredPayload } from "../payments/payments.service.js";
import {
  cleanStudyPlanText,
  createStudyPlanParseMetadata,
  decodeBase64DocumentPayload,
  extractTextFromDocument,
  minimumStudyPlanTextLength,
  type StudyPlanParseMetadata,
  type StudyPlanParseStatus,
  type SupportedDocumentType
} from "../profiles/document-parser.js";

export const interviewsRouter = Router();


const createInterviewSchema = z.object({
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

const speechMetricsSchema = z.object({
  avgPauseSec: z.number().finite().optional(),
  confidenceScore: z.number().finite().optional(),
  durationSec: z.number().finite().optional(),
  fillerWordTotal: z.number().finite().optional(),
  fluencyScore: z.number().finite().optional(),
  language: z.string().optional(),
  longestPauseSec: z.number().finite().optional(),
  pauseCount: z.number().finite().optional(),
  speedRating: z.string().optional(),
  wordCount: z.number().finite().optional(),
  wpm: z.number().finite().optional()
}).passthrough();

const pronunciationSchema = z.object({
  accuracyScore: z.number().finite().optional(),
  completenessScore: z.number().finite().optional(),
  fluencyScore: z.number().finite().optional(),
  language: z.string().optional(),
  pronunciationScore: z.number().finite().optional(),
  recognizedText: z.string().optional()
}).passthrough();

const submitAnswerSchema = z.object({
  pronunciation: pronunciationSchema.optional().nullable(),
  speechDurationSec: z.number().finite().optional().nullable(),
  speechLanguage: z.string().trim().max(12).optional().nullable(),
  speechMetrics: speechMetricsSchema.optional().nullable(),
  speechMimeType: z.string().trim().max(120).optional().nullable(),
  speechTranscript: z.string().trim().optional().nullable(),
  answerText: z.string().trim().min(1, "Vui lòng nhập câu trả lời"),
  sessionQuestionId: z.string().uuid("Câu hỏi không hợp lệ")
});

const streamAnswerSchema = z.object({
  answerText: z.string().trim().min(1),
  sessionQuestionId: z.string().uuid()
});

const nextQuestionSchema = z.object({
  forceAi: z.boolean().optional().default(false)
});

const skipQuestionSchema = z.object({
  sessionQuestionId: z.string().uuid("Câu hỏi không hợp lệ")
});

const maxSessionQuestions = 10;
const initialSessionQuestions = 5;
const maxAiCallsPerUserPerDay = Number(process.env.AI_DAILY_CALL_LIMIT ?? 40);

function rejectLockedSession(res: Response, status: InterviewStatus) {
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

type PreparedQuestion = {
  aiReason?: string | null;
  category: QuestionCategory;
  difficulty: DifficultyLevel;
  expectedAnswerLogic?: string | null;
  language: LanguageCode;
  questionId?: string | null;
  questionText: string;
  source: QuestionSource;
};

const defaultQuestionSets: Record<
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

const completionSessionInclude = {
  answers: {
    include: {
      voice_recordings: {
        orderBy: { created_at: "desc" as const },
        take: 1
      },
      sessionQuestion: {
        include: {
          question: {
            select: {
              commonMistakes: true,
              keywords: true,
              sampleAnswer: true,
              scoringRubric: true,
              suggestedAnswerLogic: true,
              major: { select: { name: true } },
              scholarship: { select: { name: true } },
              school: { select: { name: true } }
            }
          }
        }
      }
    },
    orderBy: { answeredAt: "asc" as const }
  },
  sessionQuestions: {
    orderBy: { orderIndex: "asc" as const }
  }
} satisfies Prisma.InterviewSessionInclude;

interviewsRouter.use(requireAuth);

interviewsRouter.post("/", async (req, res) => {
  const parsed = createInterviewSchema.safeParse(req.body ?? {});

  if (!parsed.success) {
    res.status(400).json({
      message: "Dữ liệu tạo buổi phỏng vấn không hợp lệ",
      errors: parsed.error.flatten().fieldErrors
    });
    return;
  }

  const user = res.locals.user as AuthenticatedUser;
  const {
    age,
    degreeLevel,
    fullName,
    language,
    majorId,
    mode,
    plannedDurationMinutes,
    scholarshipId,
    scholarshipType,
    schoolId,
    studyPlan,
    targetMajor,
    targetSchool
  } = parsed.data;
  const requiredPaymentMinutes = plannedDurationMinutes ?? 30;

  try {
    const entitlement = await getInterviewPaymentEntitlement(user.id, requiredPaymentMinutes);
    if (!entitlement.hasAccess) {
      res.status(402).json(entitlement);
      return;
    }

    let profile = await prisma.userProfile.findUnique({
      where: { userId: user.id }
    });

    const sessionDegreeLevel = degreeLevel ?? profile?.degreeLevel ?? DegreeLevel.BACHELOR;
    const sessionScholarshipType = scholarshipType || profile?.scholarshipType || "học bổng mục tiêu";
    const sessionStudyPlan = studyPlan || profile?.studyPlan || "";
    const sessionTargetMajor = targetMajor || profile?.targetMajor || "ngành bạn apply";
    const sessionTargetSchool = targetSchool || profile?.targetSchool || "trường bạn apply";
    const sessionMajorId = majorId !== undefined ? majorId : profile?.majorId ?? null;
    const sessionScholarshipId = scholarshipId !== undefined ? scholarshipId : profile?.scholarshipId ?? null;
    const sessionSchoolId = schoolId !== undefined ? schoolId : profile?.schoolId ?? null;

    const shouldSyncProfile = Boolean(age ?? degreeLevel ?? majorId ?? scholarshipId ?? scholarshipType ?? schoolId ?? studyPlan ?? targetMajor ?? targetSchool);

    if (fullName && fullName !== user.fullName) {
      await prisma.user.update({
        where: { id: user.id },
        data: { fullName }
      });
    }

    if (shouldSyncProfile) {
      const profileData = {
        age: age ?? profile?.age ?? null,
        degreeLevel: sessionDegreeLevel,
        majorId: sessionMajorId,
        scholarshipId: sessionScholarshipId,
        schoolId: sessionSchoolId,
        scholarshipType: sessionScholarshipType,
        studyPlan: sessionStudyPlan || "Study plan will be updated during interview setup.",
        targetMajor: sessionTargetMajor,
        targetSchool: sessionTargetSchool
      };

      profile = profile
        ? await prisma.userProfile.update({
            where: { userId: user.id },
            data: profileData
          })
        : await prisma.userProfile.create({
            data: {
              ...profileData,
              userId: user.id
            }
          });
    }

    const ragContext = await buildInterviewRagContext({
      majorId: sessionMajorId,
      schoolId: sessionSchoolId,
      scholarshipId: sessionScholarshipId,
      scholarshipType: sessionScholarshipType,
      targetMajor: sessionTargetMajor,
      targetSchool: sessionTargetSchool
    });
    const bankQuestions = await findBankQuestionsFromService({
      degreeLevel: sessionDegreeLevel,
      language,
      majorId: ragContext.majorId ?? sessionMajorId,
      schoolId: ragContext.schoolId ?? sessionSchoolId,
      scholarshipId: ragContext.scholarshipId ?? sessionScholarshipId,
      scholarshipType: sessionScholarshipType,
      targetMajor: sessionTargetMajor,
      targetSchool: sessionTargetSchool
    });
    const aiBudget = await checkAiCallBudgetFromService(user.id);
    if (!aiBudget.ok) {
      res.status(429).json({ message: aiBudget.message });
      return;
    }
    const aiQuestions = await generateInterviewQuestions({
      degreeLevel: sessionDegreeLevel ?? "BACHELOR",
      language,
      questionBankContext: bankQuestions.slice(0, 8).map((question) => ({
        category: question.category,
        commonMistakes: question.commonMistakes,
        expectedAnswerLogic: question.suggestedAnswerLogic,
        keywords: question.keywords,
        questionText: question.questionText,
        sampleAnswer: question.sampleAnswer,
        scoringRubric: question.scoringRubric
      })),
      ragContext: ragContext.contextText,
      scholarshipType: sessionScholarshipType,
      studyPlan: sessionStudyPlan,
      targetMajor: sessionTargetMajor,
      targetSchool: sessionTargetSchool,
      userId: user.id
    });

    const preparedQuestions = buildPreparedQuestionsFromService({
      aiQuestions,
      bankQuestions,
      language
    });

    const session = await prisma.interviewSession.create({
      data: {
        answeredQuestions: 0,
        degreeLevel: sessionDegreeLevel,
        language,
        mode,
        plannedDurationMinutes: plannedDurationMinutes ?? null,
        profileId: profile?.id ?? null,
        majorId: ragContext.majorId ?? sessionMajorId,
        schoolId: ragContext.schoolId ?? sessionSchoolId,
        scholarshipId: ragContext.scholarshipId ?? sessionScholarshipId,
        scholarshipType: sessionScholarshipType,
        sessionQuestions: {
          create: preparedQuestions.map((question, index) => ({
            aiReason: question.aiReason ?? null,
            category: question.category,
            difficulty: question.difficulty,
            expectedAnswerLogic: question.expectedAnswerLogic ?? null,
            language: question.language,
            orderIndex: index + 1,
            questionId: question.questionId ?? null,
            questionText: question.questionText,
            source: question.source
          }))
        },
        startedAt: new Date(),
        status: InterviewStatus.IN_PROGRESS,
        targetMajor: sessionTargetMajor,
        targetSchool: sessionTargetSchool,
        totalQuestions: preparedQuestions.length,
        userId: user.id
      },
      include: {
        answers: true,
        sessionQuestions: {
          orderBy: { orderIndex: "asc" }
        }
      }
    });
    const consumedPayment = await consumeInterviewPayment(user.id, session.id, requiredPaymentMinutes);
    if (!consumedPayment) {
      await prisma.interviewSession.update({
        data: {
          endedAt: new Date(),
          status: InterviewStatus.CANCELLED
        },
        where: { id: session.id }
      });
      res.status(402).json(paymentRequiredPayload(requiredPaymentMinutes));
      return;
    }

    res.status(201).json({ session: toSessionDto(session) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Không thể tạo buổi phỏng vấn" });
  }
});

interviewsRouter.get("/stats", async (_req, res) => {
  const user = res.locals.user as AuthenticatedUser;

  try {
    const weekStart = getWeekStart();
    const [summaryRows, recentSessions, progressSessions, streakDays, answers] = await Promise.all([
      prisma.$queryRaw<Array<{
        avg_score: Prisma.Decimal | null;
        completed_sessions: number;
        max_score: Prisma.Decimal | null;
        total_sessions: number;
        weekly_completed: number;
      }>>`
        SELECT
          COUNT(*)::int AS total_sessions,
          COUNT(*) FILTER (WHERE status = 'COMPLETED')::int AS completed_sessions,
          AVG(total_score) FILTER (WHERE status = 'COMPLETED' AND total_score IS NOT NULL) AS avg_score,
          MAX(total_score) FILTER (WHERE status = 'COMPLETED') AS max_score,
          COUNT(*) FILTER (WHERE status = 'COMPLETED' AND created_at >= ${weekStart})::int AS weekly_completed
        FROM interview_sessions
        WHERE user_id = ${user.id}::uuid
      `,
      prisma.interviewSession.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 7,
        select: {
          answeredQuestions: true,
          createdAt: true,
          id: true,
          status: true,
          targetMajor: true,
          targetSchool: true,
          totalQuestions: true,
          totalScore: true
        }
      }),
      prisma.interviewSession.findMany({
        where: { userId: user.id, status: "COMPLETED", totalScore: { not: null } },
        orderBy: { createdAt: "desc" },
        take: 7,
        select: {
          createdAt: true,
          totalScore: true
        }
      }),
      prisma.$queryRaw<Array<{ day: Date }>>`
        SELECT DISTINCT (created_at AT TIME ZONE 'UTC')::date AS day
        FROM interview_sessions
        WHERE user_id = ${user.id}::uuid AND status = 'COMPLETED'
        ORDER BY day DESC
        LIMIT 60
      `,
      prisma.interviewAnswer.findMany({
        where: { userId: user.id },
        orderBy: { answeredAt: "desc" },
        take: 100,
        select: {
          answeredAt: true,
          scoreLanguage: true,
          scoreLogic: true,
          scoreRelevance: true,
          scoreSpecificity: true,
          scoreTotal: true,
          sessionQuestion: { select: { category: true } }
        }
      })
    ]);

    const summary = summaryRows[0];
    const totalSessions = summary?.total_sessions ?? 0;
    const completedSessions = summary?.completed_sessions ?? 0;
    const avgScore = summary?.avg_score ? Number(summary.avg_score) : null;
    const maxScore = Number(summary?.max_score ?? 0);
    const scoreNumbers = answers.map((answer) => Number(answer.scoreTotal ?? 0)).filter((score) => score > 0);
    const weakAreas = buildWeakAreas(answers);
    const skillAverages = buildSkillAverages(answers);
    const progress = progressSessions
      .slice()
      .reverse()
      .map((session, index) => ({
        label: `Buổi ${index + 1}`,
        score: Number(session.totalScore ?? 0)
      }));
    const streak = calculateStreak(streakDays.map((row) => new Date(row.day)));
    const gamification = await getGamificationSummary(user.id, {
      completedSessions,
      maxScore,
      streak,
      weeklyCompleted: summary?.weekly_completed ?? 0
    });
    const xp = Math.round(scoreNumbers.reduce((total, score) => total + score * 10, 0));

    res.setHeader("Cache-Control", "private, max-age=20, stale-while-revalidate=60");
    res.json({
      badges: gamification.badges,
      completedSessions,
      level: buildLevel(xp),
      preferences: gamification.preferences,
      progress,
      recentSessions: recentSessions.map((session) => ({
        ...session,
        totalScore: session.totalScore?.toNumber() ?? null
      })),
      skillAverages,
      streak,
      totalSessions,
      avgScore,
      weakAreas,
      weeklyGoal: gamification.weeklyGoal,
      xp
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Không thể tải thống kê" });
  }
});

interviewsRouter.get("/progress", async (req, res) => {
  const user = res.locals.user as AuthenticatedUser;
  const days = req.query.days ? parseInt(String(req.query.days)) : 30;

  try {
    const [timeline, skills] = await Promise.all([
      getScoreProgressTimeline(user.id, days),
      getSkillProgressTimeline(user.id, days)
    ]);
    res.json({ timeline, skills });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Không thể tải tiến trình học tập" });
  }
});

interviewsRouter.get("/weak-areas", async (req, res) => {
  const user = res.locals.user as AuthenticatedUser;
  const limit = req.query.limit ? parseInt(String(req.query.limit)) : 5;

  try {
    const weakAreas = await getWeakAreas(user.id, limit);
    res.json(weakAreas);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Không thể tải danh sách chủ đề yếu" });
  }
});

interviewsRouter.get("/compare", async (req, res) => {
  const user = res.locals.user as AuthenticatedUser;
  const { session1, session2 } = req.query;

  if (!session1 || !session2) {
    res.status(400).json({ message: "Thiếu session1 hoặc session2 để so sánh" });
    return;
  }

  try {
    const result = await compareSessionScores(String(session1), String(session2), user.id);
    if (!result) {
      res.status(404).json({ message: "Không tìm thấy phiên phỏng vấn hợp lệ để so sánh" });
      return;
    }
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi khi so sánh điểm" });
  }
});

interviewsRouter.post("/re-practice", async (req, res) => {
  const user = res.locals.user as AuthenticatedUser;
  const { sourceSessionId, questionIds, mode } = req.body ?? {};

  if (!sourceSessionId || !Array.isArray(questionIds) || questionIds.length === 0) {
    res.status(400).json({ message: "Dữ liệu luyện tập lại không hợp lệ" });
    return;
  }

  try {
    const sourceSession = await prisma.interviewSession.findFirst({
      where: { id: sourceSessionId, userId: user.id },
      include: {
        sessionQuestions: {
          where: { id: { in: questionIds } }
        }
      }
    });

    if (!sourceSession) {
      res.status(404).json({ message: "Không tìm thấy phiên phỏng vấn nguồn" });
      return;
    }

    if (sourceSession.sessionQuestions.length === 0) {
      res.status(400).json({ message: "Không tìm thấy câu hỏi hợp lệ để luyện tập lại" });
      return;
    }

    // Tạo phiên phỏng vấn mới sao chép cấu hình từ phiên cũ
    const newSession = await prisma.interviewSession.create({
      data: {
        userId: user.id,
        sourceSessionId: sourceSession.id,
        rePracticeType: "weak_questions",
        mode: mode || sourceSession.mode,
        language: sourceSession.language,
        degreeLevel: sourceSession.degreeLevel,
        schoolId: sourceSession.schoolId,
        majorId: sourceSession.majorId,
        scholarshipId: sourceSession.scholarshipId,
        scholarshipType: sourceSession.scholarshipType,
        targetSchool: sourceSession.targetSchool,
        targetMajor: sourceSession.targetMajor,
        profileId: sourceSession.profileId,
        status: InterviewStatus.IN_PROGRESS,
        startedAt: new Date(),
        totalQuestions: sourceSession.sessionQuestions.length,
        answeredQuestions: 0,
        sessionQuestions: {
          create: sourceSession.sessionQuestions.map((q, index) => ({
            questionId: q.questionId,
            source: q.source,
            orderIndex: index + 1,
            questionText: q.questionText,
            category: q.category,
            difficulty: q.difficulty,
            language: q.language,
            aiReason: q.aiReason,
            expectedAnswerLogic: q.expectedAnswerLogic
          }))
        }
      },
      include: {
        answers: true,
        sessionQuestions: {
          orderBy: { orderIndex: "asc" }
        }
      }
    });

    res.status(201).json({ session: toSessionDto(newSession) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi khi tạo phiên luyện tập lại" });
  }
});

interviewsRouter.post("/analyze-study-plan", async (req, res) => {
  const user = res.locals.user as AuthenticatedUser;
  const {
    studyPlan,
    studyPlanFileContent,
    studyPlanFileName,
    studyPlanParseMetadata,
    schoolId,
    majorId,
    scholarshipId,
    scholarshipType,
    targetSchool,
    targetMajor,
    degreeLevel
  } = req.body ?? {};

  try {
    const resolvedStudyPlan = await resolveStudyPlanAnalysisInput({
      studyPlan,
      studyPlanFileContent,
      studyPlanFileName,
      studyPlanParseMetadata
    });

    if (resolvedStudyPlan.studyPlan.trim().length < minimumStudyPlanTextLength || resolvedStudyPlan.parseMetadata.parseStatus === "failed") {
      res.status(400).json({
        message: resolvedStudyPlan.parseMetadata.warnings[0] ?? "Kế hoạch học tập quá ngắn hoặc không hợp lệ",
        parseMetadata: resolvedStudyPlan.parseMetadata
      });
      return;
    }

    const result = await analyzeStudyPlan(
      user.id,
      resolvedStudyPlan.studyPlan,
      schoolId,
      majorId,
      scholarshipId,
      scholarshipType,
      targetSchool,
      targetMajor,
      degreeLevel,
      resolvedStudyPlan.parseMetadata
    );
    res.json(result);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ message: error.message || "Lỗi khi phân tích kế hoạch học tập" });
  }
});

async function resolveStudyPlanAnalysisInput(input: {
  studyPlan: unknown;
  studyPlanFileContent: unknown;
  studyPlanFileName: unknown;
  studyPlanParseMetadata: unknown;
}) {
  const fileName = typeof input.studyPlanFileName === "string" ? input.studyPlanFileName.trim() : "";

  if (typeof input.studyPlanFileContent === "string" && input.studyPlanFileContent.trim()) {
    if (!fileName) {
      throw new Error("Thiếu tên file Study Plan để phân tích.");
    }

    const parsedDocument = await extractTextFromDocument(
      decodeBase64DocumentPayload(input.studyPlanFileContent),
      fileName
    );

    return {
      parseMetadata: parsedDocument.metadata,
      studyPlan: parsedDocument.text
    };
  }

  const cleaned = cleanStudyPlanText(typeof input.studyPlan === "string" ? input.studyPlan : "");
  const incomingMetadata = coerceStudyPlanParseMetadata(input.studyPlanParseMetadata);
  const parseMetadata = createStudyPlanParseMetadata({
    fileName: incomingMetadata?.fileName ?? (fileName || null),
    fileType: incomingMetadata?.fileType,
    originalTextLength: incomingMetadata?.originalTextLength ?? cleaned.originalLength,
    pageCount: incomingMetadata?.pageCount,
    text: cleaned.text,
    truncated: Boolean(incomingMetadata?.truncated || cleaned.truncated),
    warnings: incomingMetadata?.warnings ?? []
  });

  return {
    parseMetadata,
    studyPlan: cleaned.text
  };
}

function coerceStudyPlanParseMetadata(value: unknown): StudyPlanParseMetadata | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const fileName = typeof record.fileName === "string" ? record.fileName : null;
  const extractedTextLength = typeof record.extractedTextLength === "number" ? record.extractedTextLength : 0;

  return {
    extractedTextLength,
    fileName,
    fileType: coerceSupportedDocumentType(record.fileType),
    ocrPageCount: typeof record.ocrPageCount === "number" ? record.ocrPageCount : undefined,
    ocrProvider: record.ocrProvider === "openai" ? "openai" : undefined,
    ocrUsed: typeof record.ocrUsed === "boolean" ? record.ocrUsed : undefined,
    originalTextLength: typeof record.originalTextLength === "number" ? record.originalTextLength : undefined,
    pageCount: typeof record.pageCount === "number" ? record.pageCount : undefined,
    parseStatus: coerceParseStatus(record.parseStatus),
    truncated: typeof record.truncated === "boolean" ? record.truncated : undefined,
    warnings: Array.isArray(record.warnings) ? record.warnings.map(String).filter(Boolean) : []
  };
}

function coerceParseStatus(value: unknown): StudyPlanParseStatus {
  return value === "failed" || value === "warning" || value === "success" ? value : "success";
}

function coerceSupportedDocumentType(value: unknown): SupportedDocumentType | undefined {
  return value === "pdf" || value === "docx" || value === "txt" || value === "image" ? value : undefined;
}

interviewsRouter.get("/stats-legacy", async (_req, res) => {
  const user = res.locals.user as AuthenticatedUser;

  try {
    const [totalSessions, completedSessions, avgResult, recentSessions, answers] = await Promise.all([
      prisma.interviewSession.count({ where: { userId: user.id } }),
      prisma.interviewSession.count({ where: { userId: user.id, status: "COMPLETED" } }),
      prisma.interviewSession.aggregate({
        where: { userId: user.id, status: "COMPLETED", totalScore: { not: null } },
        _avg: { totalScore: true }
      }),
      prisma.interviewSession.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 7,
        select: {
          answeredQuestions: true,
          createdAt: true,
          id: true,
          status: true,
          targetMajor: true,
          targetSchool: true,
          totalQuestions: true,
          totalScore: true
        }
      }),
      prisma.interviewAnswer.findMany({
        where: { userId: user.id },
        orderBy: { answeredAt: "desc" },
        take: 100,
        select: {
          answeredAt: true,
          scoreLanguage: true,
          scoreLogic: true,
          scoreRelevance: true,
          scoreSpecificity: true,
          scoreTotal: true,
          sessionQuestion: { select: { category: true } }
        }
      })
    ]);

    const scoreNumbers = answers.map((answer) => Number(answer.scoreTotal ?? 0)).filter((score) => score > 0);
    const weakAreas = buildWeakAreas(answers);
    const skillAverages = buildSkillAverages(answers);
    const progress = recentSessions
      .slice()
      .reverse()
      .map((session, index) => ({
        label: `Buổi ${index + 1}`,
        score: Number(session.totalScore ?? 0)
      }));
    const streak = calculateStreak(recentSessions.map((session) => session.createdAt));
    const gamification = await getGamificationSummary(user.id);
    const xp = Math.round(scoreNumbers.reduce((total, score) => total + score * 10, 0));

    res.json({
      badges: gamification.badges,
      completedSessions,
      level: buildLevel(xp),
      preferences: gamification.preferences,
      progress,
      recentSessions: recentSessions.map((session) => ({
        ...session,
        totalScore: session.totalScore?.toNumber() ?? null
      })),
      skillAverages,
      streak,
      totalSessions,
      avgScore: avgResult._avg?.totalScore?.toNumber() ?? null,
      weakAreas,
      weeklyGoal: gamification.weeklyGoal,
      xp
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Không thể tải thống kê" });
  }
});

function buildSkillAverages(answers: Array<{ scoreLanguage: Prisma.Decimal | null; scoreLogic: Prisma.Decimal | null; scoreRelevance: Prisma.Decimal | null; scoreSpecificity: Prisma.Decimal | null; scoreTotal: Prisma.Decimal | null }>) {
  const average = (values: Array<Prisma.Decimal | null>) => {
    const scores = values.map((value) => Number(value ?? 0)).filter((value) => value > 0);
    return scores.length ? Number((scores.reduce((total, score) => total + score, 0) / scores.length).toFixed(1)) : 0;
  };

  return {
    content: average(answers.map((answer) => answer.scoreSpecificity)),
    expertise: average(answers.map((answer) => answer.scoreRelevance)),
    language: average(answers.map((answer) => answer.scoreLanguage)),
    logic: average(answers.map((answer) => answer.scoreLogic)),
    overall: average(answers.map((answer) => answer.scoreTotal))
  };
}

function buildWeakAreas(answers: Array<{ scoreTotal: Prisma.Decimal | null; sessionQuestion: { category: QuestionCategory } }>) {
  const groups = new Map<QuestionCategory, number[]>();
  answers.forEach((answer) => {
    const score = Number(answer.scoreTotal ?? 0);
    if (score <= 0) return;
    const current = groups.get(answer.sessionQuestion.category) ?? [];
    current.push(score);
    groups.set(answer.sessionQuestion.category, current);
  });

  return Array.from(groups.entries())
    .map(([category, scores]) => ({
      category,
      score: Number((scores.reduce((total, score) => total + score, 0) / scores.length).toFixed(1))
    }))
    .sort((a, b) => a.score - b.score)
    .slice(0, 3);
}

function calculateStreak(dates: Date[]) {
  const daySet = new Set(dates.map((date) => date.toISOString().slice(0, 10)));
  let streak = 0;
  const cursor = new Date();
  while (daySet.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function _buildBadges({ completedSessions, maxScore, streak }: { completedSessions: number; maxScore: number; streak: number }) {
  return [
    { earned: completedSessions >= 1, icon: "🎯", label: "Phỏng vấn đầu tiên" },
    { earned: streak >= 7, icon: "🔥", label: "7 ngày liên tiếp" },
    { earned: maxScore >= 9, icon: "⭐", label: "Điểm 9+" },
    { earned: completedSessions >= 20, icon: "📚", label: "Học không ngừng" }
  ];
}

function buildLevel(xp: number) {
  if (xp >= 8500) return "Master";
  if (xp >= 4000) return "Advanced";
  if (xp >= 1200) return "Intermediate";
  return "Beginner";
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function _isThisWeek(date: Date) {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay() + 1);
  start.setHours(0, 0, 0, 0);
  return date >= start;
}

interviewsRouter.get("/", async (req, res) => {
  const user = res.locals.user as AuthenticatedUser;
  const { limit, page, skip } = parsePagination(req.query);

  const [sessions, total] = await Promise.all([
    getUserInterviewSessionsList(user.id, limit, skip),
    prisma.interviewSession.count({ where: { userId: user.id } })
  ]);

  res.json({ sessions, ...paginatedResponse(sessions, total, page, limit) });
});

interviewsRouter.delete("/:sessionId", async (req, res) => {
  const user = res.locals.user as AuthenticatedUser;
  const sessionId = req.params.sessionId;

  if (!z.string().uuid().safeParse(sessionId).success) {
    res.status(400).json({ message: "Mã buổi phỏng vấn không hợp lệ" });
    return;
  }

  await prisma.voice_recordings.deleteMany({
    where: {
      session_id: sessionId,
      user_id: user.id
    }
  });

  const result = await prisma.interviewSession.deleteMany({
    where: {
      id: sessionId,
      userId: user.id
    }
  });

  if (result.count === 0) {
    res.status(404).json({ message: "Không tìm thấy buổi phỏng vấn" });
    return;
  }

  res.json({ message: "Đã xóa lịch sử phỏng vấn" });
});

interviewsRouter.get("/:sessionId", async (req, res) => {
  const user = res.locals.user as AuthenticatedUser;
  const session = await prisma.interviewSession.findFirst({
    where: {
      id: req.params.sessionId,
      userId: user.id
    },
    include: {
      answers: true,
      sessionQuestions: {
        orderBy: { orderIndex: "asc" }
      }
    }
  });

  if (!session) {
    res.status(404).json({ message: "Không tìm thấy buổi phỏng vấn" });
    return;
  }

  res.json({ session: toSessionDto(session) });
});

interviewsRouter.get("/:sessionId/analysis", async (req, res) => {
  const user = res.locals.user as AuthenticatedUser;
  const session = await prisma.interviewSession.findFirst({
    where: {
      id: req.params.sessionId,
      userId: user.id
    },
    include: {
      answers: {
        include: {
          voice_recordings: {
            orderBy: { created_at: "desc" },
            take: 1
          },
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

  if (!session) {
    res.status(404).json({ message: "Không tìm thấy buổi phỏng vấn" });
    return;
  }

  const analysis = buildSessionAnalysis(session);
  const existingReport = await prisma.interview_reports.findUnique({
    where: { session_id: session.id }
  });
  const report = existingReport ?? (
    session.status === InterviewStatus.COMPLETED
      ? await persistInterviewReport(session.id, user.id, session)
      : null
  );

  res.json({
    analysis: report ? mergePersistedReportIntoAnalysis(analysis, report) : analysis,
    report: report ? toReportDto(report) : null
  });
});

interviewsRouter.post("/:sessionId/pause", async (req, res) => {
  const user = res.locals.user as AuthenticatedUser;
  const session = await prisma.interviewSession.findFirst({
    where: {
      id: req.params.sessionId,
      userId: user.id
    }
  });

  if (!session) {
    res.status(404).json({ message: "Không tìm thấy buổi phỏng vấn" });
    return;
  }

  if (session.status === InterviewStatus.COMPLETED || session.status === InterviewStatus.CANCELLED) {
    rejectLockedSessionFromService(res, session.status);
    return;
  }

  const updatedSession = await prisma.interviewSession.update({
    where: { id: session.id },
    data: { status: InterviewStatus.PAUSED },
    include: {
      answers: true,
      sessionQuestions: {
        orderBy: { orderIndex: "asc" }
      }
    }
  });

  res.json({ session: toSessionDto(updatedSession) });
});

interviewsRouter.post("/:sessionId/resume", async (req, res) => {
  const user = res.locals.user as AuthenticatedUser;
  const session = await prisma.interviewSession.findFirst({
    where: {
      id: req.params.sessionId,
      userId: user.id
    }
  });

  if (!session) {
    res.status(404).json({ message: "Không tìm thấy buổi phỏng vấn" });
    return;
  }

  if (session.status === InterviewStatus.COMPLETED || session.status === InterviewStatus.CANCELLED) {
    rejectLockedSessionFromService(res, session.status);
    return;
  }

  const updatedSession = await prisma.interviewSession.update({
    where: { id: session.id },
    data: { status: InterviewStatus.IN_PROGRESS },
    include: {
      answers: true,
      sessionQuestions: {
        orderBy: { orderIndex: "asc" }
      }
    }
  });

  res.json({ session: toSessionDto(updatedSession) });
});

interviewsRouter.post("/:sessionId/answers", async (req, res) => {
  const parsed = submitAnswerSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      message: "Dữ liệu câu trả lời không hợp lệ",
      errors: parsed.error.flatten().fieldErrors
    });
    return;
  }

  const user = res.locals.user as AuthenticatedUser;
  const {
    answerText,
    pronunciation,
    sessionQuestionId,
    speechDurationSec,
    speechLanguage,
    speechMetrics,
    speechMimeType,
    speechTranscript
  } = parsed.data;

  const session = await prisma.interviewSession.findFirst({
    where: {
      id: req.params.sessionId,
      userId: user.id
    }
  });

  if (!session) {
    res.status(404).json({ message: "Không tìm thấy buổi phỏng vấn" });
    return;
  }

  if (session.status === InterviewStatus.PAUSED) {
    res.status(409).json({ message: "Buổi phỏng vấn đang tạm dừng" });
    return;
  }

  if (session.status === InterviewStatus.COMPLETED) {
    res.status(409).json({ message: "Buổi phỏng vấn đã hoàn thành" });
    return;
  }

  const sessionQuestion = await prisma.interviewSessionQuestion.findFirst({
    where: {
      id: sessionQuestionId,
      sessionId: session.id
    }
  });

  if (!sessionQuestion) {
    res.status(404).json({ message: "Không tìm thấy câu hỏi trong buổi phỏng vấn" });
    return;
  }

  const answer = await prisma.interviewAnswer.upsert({
    where: {
      sessionId_sessionQuestionId: {
        sessionId: session.id,
        sessionQuestionId
      }
    },
    create: {
      answerText,
      sessionId: session.id,
      sessionQuestionId,
      userId: user.id
    },
    update: {
      answerText,
      feedback: null,
      improvedAnswer: null,
      scoreLanguage: null,
      scoreLogic: null,
      scoreRelevance: null,
      scoreSpecificity: null,
      scoreTotal: null,
      strengths: null,
      weaknesses: null
    }
  });

  const voiceRecording = await upsertVoiceRecordingForAnswer({
    answerId: answer.id,
    answerText,
    fallbackLanguage: session.language,
    pronunciation,
    sessionId: session.id,
    speechDurationSec,
    speechLanguage,
    speechMetrics,
    speechMimeType,
    speechTranscript,
    userId: user.id
  });

  const answeredQuestions = await prisma.interviewAnswer.count({
    where: { sessionId: session.id }
  });

  await prisma.interviewSession.update({
    where: { id: session.id },
    data: {
      answeredQuestions,
      status: InterviewStatus.IN_PROGRESS
    }
  });

  res.json({
    answer: {
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
      voiceRecording: voiceRecording ? toVoiceRecordingDto(voiceRecording) : null,
      sessionQuestionId: answer.sessionQuestionId
    },
    session: {
      answeredQuestions,
      status: InterviewStatus.IN_PROGRESS
    }
  });
});

interviewsRouter.post("/:sessionId/skip", async (req, res) => {
  const parsed = skipQuestionSchema.safeParse(req.body ?? {});

  if (!parsed.success) {
    res.status(400).json({
      message: "Dữ liệu bỏ qua câu hỏi không hợp lệ",
      errors: parsed.error.flatten().fieldErrors
    });
    return;
  }

  const user = res.locals.user as AuthenticatedUser;
  const { sessionQuestionId } = parsed.data;

  const session = await prisma.interviewSession.findFirst({
    where: {
      id: req.params.sessionId,
      userId: user.id
    }
  });

  if (!session) {
    res.status(404).json({ message: "Không tìm thấy buổi phỏng vấn" });
    return;
  }

  if (session.status === InterviewStatus.PAUSED) {
    res.status(409).json({ message: "Buổi phỏng vấn đang tạm dừng" });
    return;
  }

  if (session.status === InterviewStatus.COMPLETED) {
    res.status(409).json({ message: "Buổi phỏng vấn đã hoàn thành" });
    return;
  }

  const sessionQuestion = await prisma.interviewSessionQuestion.findFirst({
    where: {
      id: sessionQuestionId,
      sessionId: session.id
    }
  });

  if (!sessionQuestion) {
    res.status(404).json({ message: "Không tìm thấy câu hỏi trong buổi phỏng vấn" });
    return;
  }

  const answer = await prisma.interviewAnswer.upsert({
    where: {
      sessionId_sessionQuestionId: {
        sessionId: session.id,
        sessionQuestionId
      }
    },
    create: {
      answerText: null,
      feedback: "Người dùng đã bỏ qua câu hỏi này.",
      sessionId: session.id,
      sessionQuestionId,
      userId: user.id
    },
    update: {
      answerText: null,
      feedback: "Người dùng đã bỏ qua câu hỏi này.",
      improvedAnswer: null,
      scoreLanguage: null,
      scoreLogic: null,
      scoreRelevance: null,
      scoreSpecificity: null,
      scoreTotal: null,
      strengths: null,
      weaknesses: null
    }
  });

  const answeredQuestions = await prisma.interviewAnswer.count({
    where: { sessionId: session.id }
  });

  await prisma.interviewSession.update({
    where: { id: session.id },
    data: {
      answeredQuestions,
      status: InterviewStatus.IN_PROGRESS
    }
  });

  res.json({
    answer: {
      answerText: answer.answerText,
      feedback: answer.feedback,
      id: answer.id,
      improvedAnswer: answer.improvedAnswer,
      scoreTotal: answer.scoreTotal?.toString() ?? null,
      sessionQuestionId: answer.sessionQuestionId
    },
    session: {
      answeredQuestions,
      status: InterviewStatus.IN_PROGRESS
    }
  });
});

const streamAnswerFeedbackHandler = async (req: Request, res: Response) => {
  const parsed = streamAnswerSchema.safeParse({
    answerText: req.method === "GET" ? req.query.answerText : req.body?.answerText,
    sessionQuestionId: req.method === "GET" ? req.query.sessionQuestionId : req.body?.sessionQuestionId
  });

  if (!parsed.success) {
    res.status(400).json({ message: "Dữ liệu câu trả lời không hợp lệ" });
    return;
  }

  const user = res.locals.user as AuthenticatedUser;
  const { answerText, sessionQuestionId } = parsed.data;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (event: string, payload: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
  };

  try {
    send("status", { status: "saving" });

    const session = await prisma.interviewSession.findFirst({
      where: {
        id: req.params.sessionId,
        userId: user.id
      }
    });

    if (!session) {
      send("error", { message: "Không tìm thấy buổi phỏng vấn" });
      res.end();
      return;
    }

    if (session.status === InterviewStatus.PAUSED) {
      send("error", { message: "Buổi phỏng vấn đang tạm dừng" });
      res.end();
      return;
    }

    if (session.status === InterviewStatus.COMPLETED) {
      send("error", { message: "Buổi phỏng vấn đã hoàn thành" });
      res.end();
      return;
    }

    const sessionQuestion = await prisma.interviewSessionQuestion.findFirst({
      where: {
        id: sessionQuestionId,
        sessionId: session.id
      }
    });

    if (!sessionQuestion) {
      send("error", { message: "Không tìm thấy câu hỏi trong buổi phỏng vấn" });
      res.end();
      return;
    }

    const answer = await prisma.interviewAnswer.upsert({
      where: {
        sessionId_sessionQuestionId: {
          sessionId: session.id,
          sessionQuestionId
        }
      },
      create: {
        answerText,
        sessionId: session.id,
        sessionQuestionId,
        userId: user.id
      },
      update: {
        answerText,
        feedback: null,
        improvedAnswer: null,
        scoreLanguage: null,
        scoreLogic: null,
        scoreRelevance: null,
        scoreSpecificity: null,
        scoreTotal: null,
        strengths: null,
        weaknesses: null
      }
    });

    const answeredQuestions = await prisma.interviewAnswer.count({
      where: { sessionId: session.id }
    });

    await prisma.interviewSession.update({
      where: { id: session.id },
      data: {
        answeredQuestions,
        status: InterviewStatus.IN_PROGRESS
      }
    });

    const feedbackText = "Đã lưu câu trả lời. AI sẽ chấm điểm sau khi hoàn thành buổi phỏng vấn.";
    const tokens = feedbackText.split(/\s+/).filter(Boolean);
    for (const token of tokens) {
      send("token", { token: `${token} ` });
      await delayFromService(35);
    }

    send("done", {
      answer: {
        answerText: answer.answerText,
        feedback: answer.feedback,
        id: answer.id,
        improvedAnswer: answer.improvedAnswer,
        scoreTotal: answer.scoreTotal?.toString() ?? null,
        sessionQuestionId: answer.sessionQuestionId
      },
      session: {
        answeredQuestions,
        status: InterviewStatus.IN_PROGRESS
      }
    });
    res.end();
  } catch (error) {
    console.error(error);
    send("error", { message: "Không thể stream feedback AI" });
    res.end();
  }
};

interviewsRouter.get("/:sessionId/answers/stream", streamAnswerFeedbackHandler);
interviewsRouter.post("/:sessionId/answers/stream", streamAnswerFeedbackHandler);

interviewsRouter.post("/:sessionId/next-question", async (req, res) => {
  const parsed = nextQuestionSchema.safeParse(req.body ?? {});

  if (!parsed.success) {
    res.status(400).json({
      message: "Dữ liệu lấy câu hỏi tiếp theo không hợp lệ",
      errors: parsed.error.flatten().fieldErrors
    });
    return;
  }

  const user = res.locals.user as AuthenticatedUser;

  try {
    const session = await prisma.interviewSession.findFirst({
      where: {
        id: req.params.sessionId,
        userId: user.id
      },
      include: {
        answers: true,
        sessionQuestions: {
          orderBy: { orderIndex: "asc" }
        }
      }
    });

    if (!session) {
      res.status(404).json({ message: "Không tìm thấy buổi phỏng vấn" });
      return;
    }

    if (rejectLockedSessionFromService(res, session.status)) return;

    const answeredQuestionIds = new Set(session.answers.map((answer) => answer.sessionQuestionId));
    const existingNext = session.sessionQuestions.find((question) => !answeredQuestionIds.has(question.id));

    if (existingNext) {
      res.json({
        question: toQuestionDtoFromService(existingNext),
        generated: false,
        aiThinking: false
      });
      return;
    }

    if (session.sessionQuestions.length >= serviceMaxSessionQuestions) {
      if (existingNext) {
        res.json({
          aiThinking: false,
          generated: false,
          question: toQuestionDtoFromService(existingNext)
        });
        return;
      }

      res.status(409).json({ message: "Buổi phỏng vấn đã đạt giới hạn số câu hỏi." });
      return;
    }

    const shouldGenerateAi = parsed.data.forceAi || !existingNext || session.answers.length > 0 && session.answers.length % 2 === 0;

    if (existingNext && !shouldGenerateAi) {
      res.json({
        question: toQuestionDtoFromService(existingNext),
        generated: false,
        aiThinking: false
      });
      return;
    }

    const aiBudget = await checkAiCallBudgetFromService(user.id);
    if (!aiBudget.ok) {
      if (existingNext) {
        res.json({
          aiThinking: false,
          generated: false,
          question: toQuestionDtoFromService(existingNext)
        });
        return;
      }

      res.status(429).json({ message: aiBudget.message });
      return;
    }

    const adaptiveQuestion = await createAdaptiveQuestion(session);
    const createdQuestion = await prisma.interviewSessionQuestion.create({
      data: {
        aiReason: adaptiveQuestion.aiReason,
        category: adaptiveQuestion.category,
        difficulty: adaptiveQuestion.difficulty,
        expectedAnswerLogic: adaptiveQuestion.expectedAnswerLogic,
        language: adaptiveQuestion.language,
        orderIndex: session.sessionQuestions.length + 1,
        questionText: adaptiveQuestion.questionText,
        sessionId: session.id,
        source: adaptiveQuestion.source
      }
    });

    await prisma.interviewSession.update({
      where: { id: session.id },
      data: { totalQuestions: session.totalQuestions + 1 }
    });

    res.json({
      aiThinking: false,
      generated: true,
      isFollowUp: adaptiveQuestion.isFollowUp,
      followUpDepth: adaptiveQuestion.followUpDepth,
      aiReason: adaptiveQuestion.aiReason,
      question: toQuestionDtoFromService(createdQuestion)
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Không thể tạo câu hỏi tiếp theo" });
  }
});

interviewsRouter.post("/:sessionId/complete", async (req, res) => {
  const user = res.locals.user as AuthenticatedUser;
  const session = await prisma.interviewSession.findFirst({
    where: {
      id: req.params.sessionId,
      userId: user.id
    },
    include: completionSessionInclude
  });

  if (!session) {
    res.status(404).json({ message: "Không tìm thấy buổi phỏng vấn" });
    return;
  }

  const answersToScore = session.answers.filter((answer) => {
    return Boolean(answer.answerText?.trim()) && !answer.scoreTotal;
  });
  const aiBudget = await checkAiCallBudgetFromService(user.id, answersToScore.length);
  if (!aiBudget.ok) {
    res.status(429).json({ message: aiBudget.message });
    return;
  }

  const ragContext = await buildInterviewRagContext({
    majorId: session.majorId,
    schoolId: session.schoolId,
    scholarshipId: session.scholarshipId,
    scholarshipType: session.scholarshipType,
    targetMajor: session.targetMajor,
    targetSchool: session.targetSchool
  });

  for (const answer of answersToScore) {
    const sessionQuestion = answer.sessionQuestion;
    const sourceQuestion = sessionQuestion.question;
    const evaluation = await scoreInterviewAnswerWithAi({
      answerText: answer.answerText?.trim() ?? "",
      commonMistakes: sourceQuestion?.commonMistakes ?? null,
      expectedAnswerLogic: sessionQuestion.expectedAnswerLogic ?? sourceQuestion?.suggestedAnswerLogic ?? null,
      keywords: sourceQuestion?.keywords ?? null,
      language: sessionQuestion.language,
      questionText: sessionQuestion.questionText,
      ragContext: ragContext.contextText,
      sampleAnswer: sourceQuestion?.sampleAnswer ?? null,
      scholarshipType: sourceQuestion?.scholarship?.name ?? session.scholarshipType,
      scoringRubric: sourceQuestion?.scoringRubric ?? null,
      targetMajor: sourceQuestion?.major?.name ?? session.targetMajor,
      targetSchool: sourceQuestion?.school?.name ?? session.targetSchool,
      userId: user.id
    });

    if (evaluation.scoringSource !== "ai") {
      continue;
    }

    await prisma.interviewAnswer.update({
      where: { id: answer.id },
      data: {
        feedback: evaluation.feedback,
        improvedAnswer: evaluation.improvedAnswer,
        scoreLanguage: evaluation.language,
        scoreLogic: evaluation.logic,
        scoreRelevance: evaluation.expertise,
        scoreSpecificity: evaluation.content,
        scoreTotal: evaluation.total,
        strengths: evaluation.strengths.join("\n"),
        weaknesses: evaluation.weaknesses.join("\n")
      }
    });
  }

  const scoredSession = answersToScore.length
    ? await prisma.interviewSession.findFirst({
        where: {
          id: session.id,
          userId: user.id
        },
        include: completionSessionInclude
      })
    : session;

  if (!scoredSession) {
    res.status(404).json({ message: "Không tìm thấy buổi phỏng vấn" });
    return;
  }

  const answeredQuestions = scoredSession.answers.length;
  const scoredAnswers = scoredSession.answers
    .map((answer) => Number(answer.scoreTotal ?? 0))
    .filter((score) => score > 0);
  const averageScore = scoredAnswers.length
    ? scoredAnswers.reduce((total, score) => total + score, 0) / scoredAnswers.length
    : null;

  const updatedSession = await prisma.interviewSession.update({
    where: { id: scoredSession.id },
    data: {
      answeredQuestions,
      endedAt: new Date(),
      status: InterviewStatus.COMPLETED,
      totalScore: averageScore
    },
    include: completionSessionInclude
  });

  await persistInterviewReport(scoredSession.id, user.id);
  await awardBadgesForUser(user.id);

  res.json({ session: toSessionDto(updatedSession) });
});

type AnalysisSession = Prisma.InterviewSessionGetPayload<{
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

type PersistedReport = {
  id: string;
  language_feedback: string | null;
  logic_feedback: string | null;
  next_steps: string | null;
  overall_score: Prisma.Decimal | null;
  recommended_practice: string | null;
  repeated_mistakes: string | null;
  summary: string | null;
};

async function loadAnalysisSession(sessionId: string, userId?: string): Promise<AnalysisSession | null> {
  return prisma.interviewSession.findFirst({
    where: {
      id: sessionId,
      ...(userId ? { userId } : {})
    },
    include: {
      answers: {
        include: {
          voice_recordings: {
            orderBy: { created_at: "desc" },
            take: 1
          },
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

async function persistInterviewReport(sessionId: string, userId: string, loadedSession?: AnalysisSession) {
  const session = loadedSession ?? await loadAnalysisSession(sessionId, userId);
  if (!session) return null;

  const analysis = buildSessionAnalysis(session);
  const overallScore = Math.round(analysis.overallScore * 100) / 10;
  const nextSteps = [analysis.progressHint, analysis.speechSummary, ...analysis.improvementTips.slice(0, 4)].filter(Boolean).join("\n");
  const summary = [analysis.sessionSummary, analysis.speechSummary].filter(Boolean).join(" ");
  const data = {
    language_feedback: `Ngôn ngữ đạt ${analysis.criteriaAverages.language}/10. Ưu tiên câu ngắn, rõ ý và dùng thuật ngữ học thuật phù hợp.`,
    logic_feedback: `Logic đạt ${analysis.criteriaAverages.logic}/10. Cần mở câu trả lời theo cấu trúc: mục tiêu, lý do, ví dụ, kế hoạch.`,
    next_steps: nextSteps,
    overall_score: overallScore,
    recommended_practice: analysis.improvementTips.join("\n"),
    repeated_mistakes: analysis.weaknesses.join("\n"),
    summary
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

function mergePersistedReportIntoAnalysis(analysis: ReturnType<typeof buildSessionAnalysis>, report: PersistedReport) {
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

function toReportDto(report: PersistedReport) {
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

function splitReportLines(value: string | null | undefined) {
  return (value ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

type SpeechMetricsPayload = z.infer<typeof speechMetricsSchema>;
type PronunciationPayload = z.infer<typeof pronunciationSchema>;

type VoiceRecordingDtoSource = {
  id: string;
  transcript: string | null;
  pronunciation_score: Prisma.Decimal | null;
  fluency_score: Prisma.Decimal | null;
  speed_words_per_minute: Prisma.Decimal | null;
  feedback: string | null;
  language: LanguageCode;
  created_at: Date;
};

async function upsertVoiceRecordingForAnswer(input: {
  answerId: string;
  answerText: string;
  fallbackLanguage: LanguageCode;
  pronunciation?: PronunciationPayload | null;
  sessionId: string;
  speechDurationSec?: number | null;
  speechLanguage?: string | null;
  speechMetrics?: SpeechMetricsPayload | null;
  speechMimeType?: string | null;
  speechTranscript?: string | null;
  userId: string;
}) {
  const hasVoiceData = Boolean(input.speechMetrics || input.pronunciation || input.speechTranscript?.trim());
  if (!hasVoiceData) return null;

  const feedback = JSON.stringify({
    pronunciation: input.pronunciation ?? null,
    speechDurationSec: input.speechDurationSec ?? input.speechMetrics?.durationSec ?? null,
    speechMetrics: input.speechMetrics ?? null,
    speechMimeType: input.speechMimeType ?? null
  });

  const data = {
    feedback,
    fluency_score: toDecimalScore(input.speechMetrics?.fluencyScore ?? input.pronunciation?.fluencyScore),
    language: toVoiceLanguage(input.speechLanguage ?? input.speechMetrics?.language ?? input.pronunciation?.language, input.fallbackLanguage),
    pronunciation_score: toDecimalScore(input.pronunciation?.pronunciationScore),
    session_id: input.sessionId,
    speed_words_per_minute: toDecimalScore(input.speechMetrics?.wpm),
    transcript: input.speechTranscript?.trim() || input.answerText
  };

  const existing = await prisma.voice_recordings.findFirst({
    where: { answer_id: input.answerId }
  });

  if (existing) {
    return prisma.voice_recordings.update({
      data,
      where: { id: existing.id }
    });
  }

  return prisma.voice_recordings.create({
    data: {
      ...data,
      answer_id: input.answerId,
      user_id: input.userId
    }
  });
}

function toVoiceRecordingDto(recording?: VoiceRecordingDtoSource | null) {
  if (!recording) return null;

  return {
    createdAt: recording.created_at,
    feedback: parseVoiceFeedback(recording.feedback),
    fluencyScore: recording.fluency_score?.toString() ?? null,
    id: recording.id,
    language: recording.language,
    pronunciationScore: recording.pronunciation_score?.toString() ?? null,
    speedWordsPerMinute: recording.speed_words_per_minute?.toString() ?? null,
    transcript: recording.transcript
  };
}

function parseVoiceFeedback(value: string | null) {
  if (!value) return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return { raw: value };
  }
}

function toDecimalScore(value: unknown) {
  const numeric = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(numeric)) return null;
  return Math.round(Math.max(0, numeric) * 100) / 100;
}

function toVoiceLanguage(value: string | null | undefined, fallback: LanguageCode) {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "vi" || normalized === "vi-vn") return LanguageCode.VI;
  if (normalized === "zh" || normalized === "zh-cn" || normalized === "cn") return LanguageCode.ZH;
  if (normalized === "en" || normalized === "en-us") return LanguageCode.EN;
  return fallback;
}

async function checkAiCallBudget(userId: string, requestedCalls = 1) {
  if (requestedCalls <= 0) {
    return { ok: true as const };
  }

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

  if (used + requestedCalls > maxAiCallsPerUserPerDay) {
    return {
      ok: false as const,
      message: `Bạn đã đạt giới hạn ${maxAiCallsPerUserPerDay} lượt AI hôm nay. Vui lòng thử lại ngày mai.`
    };
  }

  return { ok: true as const };
}

async function findBankQuestions(input: {
  degreeLevel?: DegreeLevel | null;
  language: LanguageCode;
  majorId?: string | null;
  schoolId?: string | null;
  scholarshipId?: string | null;
  scholarshipType?: string | null;
  targetMajor?: string | null;
  targetSchool?: string | null;
}) {
  const [school, major, scholarship] = await Promise.all([
    findSchoolTarget(input.schoolId, input.targetSchool),
    findMajorTarget(input.majorId, input.targetMajor),
    findScholarshipTarget(input.scholarshipId, input.scholarshipType)
  ]);
  const where: Prisma.QuestionWhereInput = {
    deletedAt: null,
    isActive: true,
    language: input.language
  };

  if (input.degreeLevel) {
    where.OR = [{ degreeLevel: input.degreeLevel }, { degreeLevel: null }];
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
    .slice(0, 7);
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

function buildPreparedQuestions({
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

function toQuestionCategory(category: string): QuestionCategory {
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

function toDifficultyLevel(difficulty: string): DifficultyLevel {
  return difficulty === "EASY"
    ? DifficultyLevel.EASY
    : difficulty === "HARD"
      ? DifficultyLevel.HARD
      : DifficultyLevel.MEDIUM;
}

type SessionDtoInput = Omit<
  Prisma.InterviewSessionGetPayload<{
    include: {
      answers: true;
      sessionQuestions: true;
    };
  }>,
  "answers"
> & {
  answers: Array<InterviewAnswer & { voice_recordings?: VoiceRecordingDtoSource[] }>;
};

function toSessionDto(session: SessionDtoInput) {
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
      voiceRecording: toVoiceRecordingDto(answer.voice_recordings?.[0] ?? null),
      sessionQuestionId: answer.sessionQuestionId
    })),
    answeredQuestions: session.answeredQuestions,
    degreeLevel: session.degreeLevel,
    id: session.id,
    language: session.language,
    majorId: session.majorId,
    mode: session.mode,
    plannedDurationMinutes: session.plannedDurationMinutes,
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
    schoolId: session.schoolId,
    scholarshipId: session.scholarshipId,
    status: session.status,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    targetMajor: session.targetMajor,
    targetSchool: session.targetSchool,
    totalQuestions: session.totalQuestions
  };
}

function toQuestionDto(question: InterviewSessionQuestion) {
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
