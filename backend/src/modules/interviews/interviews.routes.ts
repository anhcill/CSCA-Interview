import {
  DegreeLevel,
  DifficultyLevel,
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
import { awardBadgesForUser, getGamificationSummary, getWeekStart } from "../gamification/gamification.service.js";
import { paginatedResponse, parsePagination } from "../../utils/pagination.js";

export const interviewsRouter = Router();

const createInterviewSchema = z.object({
  age: z.coerce.number().int().min(13).max(80).optional(),
  degreeLevel: z.nativeEnum(DegreeLevel).optional(),
  fullName: z.string().trim().min(2).max(150).optional(),
  language: z.nativeEnum(LanguageCode).default(LanguageCode.ZH),
  mode: z.nativeEnum(InterviewMode).default(InterviewMode.PRACTICE),
  scholarshipType: z.string().trim().optional(),
  studyPlan: z.string().trim().optional(),
  targetMajor: z.string().trim().optional(),
  targetSchool: z.string().trim().optional()
});

const submitAnswerSchema = z.object({
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
  const { age, degreeLevel, fullName, language, mode, scholarshipType, studyPlan, targetMajor, targetSchool } = parsed.data;

  try {
    let profile = await prisma.userProfile.findUnique({
      where: { userId: user.id }
    });

    const sessionDegreeLevel = degreeLevel ?? profile?.degreeLevel ?? DegreeLevel.BACHELOR;
    const sessionScholarshipType = scholarshipType || profile?.scholarshipType || "học bổng mục tiêu";
    const sessionStudyPlan = studyPlan || profile?.studyPlan || "";
    const sessionTargetMajor = targetMajor || profile?.targetMajor || "ngành bạn apply";
    const sessionTargetSchool = targetSchool || profile?.targetSchool || "trường bạn apply";

    const shouldSyncProfile = Boolean(age ?? degreeLevel ?? scholarshipType ?? studyPlan ?? targetMajor ?? targetSchool);

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

    const bankQuestions = await findBankQuestions(language, sessionDegreeLevel);
    const aiBudget = await checkAiCallBudget(user.id);
    if (!aiBudget.ok) {
      res.status(429).json({ message: aiBudget.message });
      return;
    }
    const aiQuestions = await generateInterviewQuestions({
      degreeLevel: sessionDegreeLevel ?? "BACHELOR",
      language,
      scholarshipType: sessionScholarshipType,
      studyPlan: sessionStudyPlan,
      targetMajor: sessionTargetMajor,
      targetSchool: sessionTargetSchool,
      userId: user.id
    });

    const preparedQuestions = buildPreparedQuestions({
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
        profileId: profile?.id ?? null,
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
        label: `Buoi ${index + 1}`,
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
    prisma.interviewSession.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: {
        answeredQuestions: true,
        createdAt: true,
        id: true,
        language: true,
        mode: true,
        status: true,
        targetMajor: true,
        targetSchool: true,
        totalQuestions: true
      }
    }),
    prisma.interviewSession.count({ where: { userId: user.id } })
  ]);

  res.json({ sessions, ...paginatedResponse(sessions, total, page, limit) });
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
    rejectLockedSession(res, session.status);
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
    rejectLockedSession(res, session.status);
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
  const { answerText, sessionQuestionId } = parsed.data;

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

  const aiBudget = await checkAiCallBudget(user.id);
  if (!aiBudget.ok) {
    res.status(429).json({ message: aiBudget.message });
    return;
  }
  const evaluation = await scoreInterviewAnswerWithAi({
    answerText,
    expectedAnswerLogic: sessionQuestion.expectedAnswerLogic,
    language: sessionQuestion.language,
    questionText: sessionQuestion.questionText,
    scholarshipType: session.scholarshipType,
    targetMajor: session.targetMajor,
    targetSchool: session.targetSchool,
    userId: user.id
  });

  const answer = await prisma.interviewAnswer.upsert({
    where: {
      sessionId_sessionQuestionId: {
        sessionId: session.id,
        sessionQuestionId
      }
    },
    create: {
      answerText,
      feedback: evaluation.feedback,
      improvedAnswer: evaluation.improvedAnswer,
      scoreLanguage: evaluation.language,
      scoreLogic: evaluation.logic,
      scoreRelevance: evaluation.expertise,
      scoreSpecificity: evaluation.content,
      scoreTotal: evaluation.total,
      sessionId: session.id,
      sessionQuestionId,
      strengths: evaluation.strengths.join("\n"),
      userId: user.id,
      weaknesses: evaluation.weaknesses.join("\n")
    },
    update: {
      answerText,
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

  const answeredQuestions = await prisma.interviewAnswer.count({
    where: { sessionId: session.id }
  });
  const isCompleted = answeredQuestions >= maxSessionQuestions;
  const sessionScore = isCompleted
    ? await prisma.interviewAnswer.aggregate({
        where: { sessionId: session.id, scoreTotal: { not: null } },
        _avg: { scoreTotal: true }
      })
    : null;

  await prisma.interviewSession.update({
    where: { id: session.id },
    data: {
      answeredQuestions,
      endedAt: isCompleted ? new Date() : null,
      status: isCompleted ? InterviewStatus.COMPLETED : InterviewStatus.IN_PROGRESS,
      totalScore: isCompleted ? sessionScore?._avg.scoreTotal : undefined
    }
  });

  if (isCompleted) {
    await persistInterviewReport(session.id, user.id);
    await awardBadgesForUser(user.id);
  }

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
      sessionQuestionId: answer.sessionQuestionId
    },
    session: {
      answeredQuestions,
      status: isCompleted ? InterviewStatus.COMPLETED : InterviewStatus.IN_PROGRESS
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
  const isCompleted = answeredQuestions >= maxSessionQuestions;
  const sessionScore = isCompleted
    ? await prisma.interviewAnswer.aggregate({
        where: { sessionId: session.id, scoreTotal: { not: null } },
        _avg: { scoreTotal: true }
      })
    : null;

  await prisma.interviewSession.update({
    where: { id: session.id },
    data: {
      answeredQuestions,
      endedAt: isCompleted ? new Date() : null,
      status: isCompleted ? InterviewStatus.COMPLETED : InterviewStatus.IN_PROGRESS,
      totalScore: isCompleted ? sessionScore?._avg.scoreTotal : undefined
    }
  });

  if (isCompleted) {
    await persistInterviewReport(session.id, user.id);
    await awardBadgesForUser(user.id);
  }

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
      status: isCompleted ? InterviewStatus.COMPLETED : InterviewStatus.IN_PROGRESS
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
    send("status", { status: "scoring" });

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

    const aiBudget = await checkAiCallBudget(user.id);
    if (!aiBudget.ok) {
      send("error", { message: aiBudget.message });
      res.end();
      return;
    }

    const evaluation = await scoreInterviewAnswerWithAi({
      answerText,
      expectedAnswerLogic: sessionQuestion.expectedAnswerLogic,
      language: sessionQuestion.language,
      questionText: sessionQuestion.questionText,
      scholarshipType: session.scholarshipType,
      targetMajor: session.targetMajor,
      targetSchool: session.targetSchool,
      userId: user.id
    });

    const answer = await prisma.interviewAnswer.upsert({
      where: {
        sessionId_sessionQuestionId: {
          sessionId: session.id,
          sessionQuestionId
        }
      },
      create: {
        answerText,
        feedback: evaluation.feedback,
        improvedAnswer: evaluation.improvedAnswer,
        scoreLanguage: evaluation.language,
        scoreLogic: evaluation.logic,
        scoreRelevance: evaluation.expertise,
        scoreSpecificity: evaluation.content,
        scoreTotal: evaluation.total,
        sessionId: session.id,
        sessionQuestionId,
        strengths: evaluation.strengths.join("\n"),
        userId: user.id,
        weaknesses: evaluation.weaknesses.join("\n")
      },
      update: {
        answerText,
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

    const answeredQuestions = await prisma.interviewAnswer.count({
      where: { sessionId: session.id }
    });
    const isCompleted = answeredQuestions >= maxSessionQuestions;
    const sessionScore = isCompleted
      ? await prisma.interviewAnswer.aggregate({
          where: { sessionId: session.id, scoreTotal: { not: null } },
          _avg: { scoreTotal: true }
        })
      : null;

    await prisma.interviewSession.update({
      where: { id: session.id },
      data: {
        answeredQuestions,
        endedAt: isCompleted ? new Date() : null,
        status: isCompleted ? InterviewStatus.COMPLETED : InterviewStatus.IN_PROGRESS,
        totalScore: isCompleted ? sessionScore?._avg.scoreTotal : undefined
      }
    });

    if (isCompleted) {
      await persistInterviewReport(session.id, user.id);
      await awardBadgesForUser(user.id);
    }

    const feedbackText = `Nhận xét nhanh: ${evaluation.feedback}`;
    const tokens = feedbackText.split(/\s+/).filter(Boolean);
    for (const token of tokens) {
      send("token", { token: `${token} ` });
      await delay(35);
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
        status: isCompleted ? InterviewStatus.COMPLETED : InterviewStatus.IN_PROGRESS
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

    if (rejectLockedSession(res, session.status)) return;

    const answeredQuestionIds = new Set(session.answers.map((answer) => answer.sessionQuestionId));
    const existingNext = session.sessionQuestions.find((question) => !answeredQuestionIds.has(question.id));

    if (existingNext) {
      res.json({
        question: toQuestionDto(existingNext),
        generated: false,
        aiThinking: false
      });
      return;
    }

    if (session.sessionQuestions.length >= maxSessionQuestions) {
      if (existingNext) {
        res.json({
          aiThinking: false,
          generated: false,
          question: toQuestionDto(existingNext)
        });
        return;
      }

      res.status(409).json({ message: "Buổi phỏng vấn đã đạt giới hạn số câu hỏi." });
      return;
    }

    const shouldGenerateAi = parsed.data.forceAi || !existingNext || session.answers.length > 0 && session.answers.length % 2 === 0;

    if (existingNext && !shouldGenerateAi) {
      res.json({
        question: toQuestionDto(existingNext),
        generated: false,
        aiThinking: false
      });
      return;
    }

    const aiBudget = await checkAiCallBudget(user.id);
    if (!aiBudget.ok) {
      if (existingNext) {
        res.json({
          aiThinking: false,
          generated: false,
          question: toQuestionDto(existingNext)
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
      question: toQuestionDto(createdQuestion)
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

  const scoredAnswers = session.answers
    .map((answer) => Number(answer.scoreTotal ?? 0))
    .filter((score) => score > 0);
  const averageScore = scoredAnswers.length
    ? scoredAnswers.reduce((total, score) => total + score, 0) / scoredAnswers.length
    : null;

  const updatedSession = await prisma.interviewSession.update({
    where: { id: session.id },
    data: {
      endedAt: new Date(),
      status: InterviewStatus.COMPLETED,
      totalScore: averageScore
    },
    include: {
      answers: true,
      sessionQuestions: {
        orderBy: { orderIndex: "asc" }
      }
    }
  });

  await persistInterviewReport(session.id, user.id);
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

async function checkAiCallBudget(userId: string) {
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

async function findBankQuestions(language: LanguageCode, degreeLevel?: DegreeLevel | null) {
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

function toSessionDto(
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
