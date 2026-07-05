import { Prisma, QuestionCategory } from "@prisma/client";
import { prisma } from "../../db/prisma.js";

type ProgressRow = {
  avg_score: Prisma.Decimal | null;
  date: Date;
  session_count: number;
};

type SkillRow = {
  avg_confidence: Prisma.Decimal | null;
  avg_expertise: Prisma.Decimal | null;
  avg_impression: Prisma.Decimal | null;
  avg_language: Prisma.Decimal | null;
  avg_logic: Prisma.Decimal | null;
  avg_relevance: Prisma.Decimal | null;
  week: Date;
};

type WeakAreaRow = {
  avg_score: Prisma.Decimal | null;
  category: QuestionCategory;
  total_answers: number;
};

function toNumber(value: Prisma.Decimal | number | null | undefined, fallback = 0) {
  if (value == null) return fallback;
  return Number(value);
}

function round(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function dateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function suggestionForCategory(category: QuestionCategory) {
  const suggestions: Record<QuestionCategory, string> = {
    ACADEMIC: "Ôn lại nền tảng học thuật và chuẩn bị ví dụ từ môn học/dự án.",
    CAREER_PLAN: "Liên kết ngành học với kế hoạch nghề nghiệp 3-5 năm sau tốt nghiệp.",
    LANGUAGE: "Luyện câu trả lời ngắn bằng tiếng Trung, ưu tiên phát âm rõ và câu nối.",
    OTHER: "Bổ sung ví dụ cá nhân cụ thể để câu trả lời bớt chung chung.",
    PERSONAL: "Chuẩn bị câu chuyện cá nhân, điểm mạnh và động lực nộp hồ sơ.",
    RESEARCH: "Nêu rõ hướng nghiên cứu, phương pháp và lý do phù hợp với trường.",
    SCHOLARSHIP: "Làm rõ vì sao bạn phù hợp với học bổng và cam kết sau nhận học bổng.",
    SCHOOL_MAJOR: "Nêu lý do chọn trường/ngành bằng môn học, lab, ranking hoặc giảng viên.",
    SITUATION: "Luyện cấu trúc STAR: tình huống, hành động, kết quả, bài học.",
    STUDY_PLAN: "Tách kế hoạch học tập thành mục tiêu, kế hoạch từng kỳ và đầu ra mong muốn."
  };

  return suggestions[category] ?? suggestions.OTHER;
}

export async function getScoreProgressTimeline(userId: string, days = 30) {
  const safeDays = Math.min(Math.max(days, 7), 90);
  const rows = await prisma.$queryRaw<ProgressRow[]>`
    SELECT
      date_trunc('day', created_at)::date AS date,
      AVG(total_score) AS avg_score,
      COUNT(*)::int AS session_count
    FROM interview_sessions
    WHERE user_id = ${userId}::uuid
      AND status = 'COMPLETED'
      AND total_score IS NOT NULL
      AND created_at >= now() - (${safeDays}::int * interval '1 day')
    GROUP BY 1
    ORDER BY 1 ASC
  `;

  return rows.map((row) => ({
    avgScore: round(toNumber(row.avg_score)),
    date: dateKey(row.date),
    sessionCount: row.session_count
  }));
}

export async function getSkillProgressTimeline(userId: string, days = 30) {
  const safeDays = Math.min(Math.max(days, 7), 90);
  const rows = await prisma.$queryRaw<SkillRow[]>`
    SELECT
      date_trunc('week', ia.answered_at)::date AS week,
      AVG(ia.score_relevance) AS avg_relevance,
      AVG(ia.score_logic) AS avg_logic,
      AVG(ia.score_specificity) AS avg_expertise,
      AVG(ia.score_language) AS avg_language,
      AVG(vr.fluency_score) AS avg_confidence,
      AVG(ia.score_total) AS avg_impression
    FROM interview_answers ia
    JOIN interview_sessions s ON s.id = ia.session_id
    LEFT JOIN voice_recordings vr ON vr.answer_id = ia.id
    WHERE s.user_id = ${userId}::uuid
      AND ia.answered_at >= now() - (${safeDays}::int * interval '1 day')
    GROUP BY 1
    ORDER BY 1 ASC
  `;

  return rows.map((row) => ({
    confidence: round(toNumber(row.avg_confidence, toNumber(row.avg_impression))),
    expertise: round(toNumber(row.avg_expertise)),
    impression: round(toNumber(row.avg_impression)),
    language: round(toNumber(row.avg_language)),
    logic: round(toNumber(row.avg_logic)),
    relevance: round(toNumber(row.avg_relevance)),
    week: dateKey(row.week)
  }));
}

export async function compareSessionScores(sessionId1: string, sessionId2: string, userId: string) {
  const sessions = await prisma.interviewSession.findMany({
    where: {
      id: { in: [sessionId1, sessionId2] },
      userId
    },
    select: {
      answeredQuestions: true,
      createdAt: true,
      id: true,
      targetMajor: true,
      targetSchool: true,
      totalQuestions: true,
      totalScore: true
    }
  });

  const session1 = sessions.find((session) => session.id === sessionId1);
  const session2 = sessions.find((session) => session.id === sessionId2);

  if (!session1 || !session2) {
    return null;
  }

  const score1 = toNumber(session1.totalScore);
  const score2 = toNumber(session2.totalScore);
  const diff = score2 - score1;

  return {
    improvement: {
      diff: round(diff),
      percent: score1 ? round((diff / score1) * 100) : 0
    },
    session1: {
      ...session1,
      totalScore: score1
    },
    session2: {
      ...session2,
      totalScore: score2
    }
  };
}

export async function getWeakAreas(userId: string, limit = 5) {
  const safeLimit = Math.min(Math.max(limit, 1), 10);
  const rows = await prisma.$queryRaw<WeakAreaRow[]>`
    SELECT
      isq.category,
      AVG(ia.score_total) AS avg_score,
      COUNT(*)::int AS total_answers
    FROM interview_answers ia
    JOIN interview_sessions s ON s.id = ia.session_id
    JOIN interview_session_questions isq ON isq.id = ia.session_question_id
    WHERE s.user_id = ${userId}::uuid
      AND ia.score_total IS NOT NULL
    GROUP BY isq.category
    HAVING COUNT(*) > 0
    ORDER BY AVG(ia.score_total) ASC
    LIMIT ${safeLimit}
  `;

  return rows.map((row) => ({
    avgScore: round(toNumber(row.avg_score)),
    category: row.category,
    suggestion: suggestionForCategory(row.category),
    totalAnswers: row.total_answers
  }));
}
