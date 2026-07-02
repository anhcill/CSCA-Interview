import { prisma } from "../../db/prisma.js";

function round(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export async function getAdminOverviewStats() {
  const [totalUsers, activeUsers7d, newUsersToday, totalSessions, sessionsToday, avgScoreAgg, totalQuestions, aiCostAgg] = await Promise.all([
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.user.count({
      where: {
        deletedAt: null,
        lastLoginAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      }
    }),
    prisma.user.count({
      where: {
        deletedAt: null,
        createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) }
      }
    }),
    prisma.interviewSession.count(),
    prisma.interviewSession.count({
      where: {
        createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) }
      }
    }),
    prisma.interviewSession.aggregate({
      where: { status: "COMPLETED", totalScore: { not: null } },
      _avg: { totalScore: true }
    }),
    prisma.question.count({ where: { deletedAt: null, isActive: true } }),
    prisma.ai_usage_logs.aggregate({
      _sum: { cost_usd: true }
    })
  ]);

  return {
    totalUsers,
    activeUsers7d,
    newUsersToday,
    totalSessions,
    sessionsToday,
    avgScore: avgScoreAgg._avg.totalScore ? round(Number(avgScoreAgg._avg.totalScore)) : 0,
    totalQuestions,
    aiCostEstimate: aiCostAgg._sum.cost_usd ? round(Number(aiCostAgg._sum.cost_usd), 4) : 0
  };
}

export async function getSessionsByDay(days = 30) {
  const safeDays = Math.min(Math.max(days, 7), 90);
  const rows = await prisma.$queryRaw<Array<{ date: Date; count: number; avg_score: number }>>`
    SELECT
      date_trunc('day', created_at)::date AS date,
      COUNT(*)::int AS count,
      COALESCE(AVG(total_score), 0) AS avg_score
    FROM interview_sessions
    WHERE created_at >= now() - (${safeDays}::int * interval '1 day')
    GROUP BY 1
    ORDER BY 1 ASC
  `;

  return rows.map((row) => ({
    date: row.date.toISOString().slice(0, 10),
    count: row.count,
    avgScore: round(Number(row.avg_score))
  }));
}

export async function getScoreDistribution() {
  const rows = await prisma.$queryRaw<Array<{ range: string; count: number }>>`
    SELECT
      CASE
        WHEN total_score >= 9 THEN '9-10'
        WHEN total_score >= 7 AND total_score < 9 THEN '7-8'
        WHEN total_score >= 5 AND total_score < 7 THEN '5-6'
        WHEN total_score >= 3 AND total_score < 5 THEN '3-4'
        ELSE '0-2'
      END AS range,
      COUNT(*)::int AS count
    FROM interview_sessions
    WHERE status = 'COMPLETED' AND total_score IS NOT NULL
    GROUP BY 1
  `;

  const ranges = ["0-2", "3-4", "5-6", "7-8", "9-10"];
  const map = new Map(rows.map((row) => [row.range, row.count]));

  return ranges.map((range) => ({
    range,
    count: map.get(range) ?? 0
  }));
}

export async function getTopActiveUsers(limit = 10) {
  const safeLimit = Math.min(Math.max(limit, 1), 50);
  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      fullName: true,
      email: true,
      lastLoginAt: true,
      _count: {
        select: { interviewSessions: true }
      },
      interviewSessions: {
        where: { status: "COMPLETED", totalScore: { not: null } },
        select: { totalScore: true }
      }
    },
    orderBy: {
      interviewSessions: { _count: "desc" }
    },
    take: safeLimit
  });

  return users.map((user) => {
    const scores = user.interviewSessions.map((s) => Number(s.totalScore));
    const avgScore = scores.length ? round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    return {
      userId: user.id,
      fullName: user.fullName,
      email: user.email,
      sessionCount: user._count.interviewSessions,
      avgScore,
      lastActive: user.lastLoginAt?.toISOString() ?? null
    };
  });
}

export async function getWeakestQuestions(limit = 10) {
  const safeLimit = Math.min(Math.max(limit, 1), 50);
  const rows = await prisma.$queryRaw<Array<{ question_id: string; question_text: string; category: string; avg_score: number; answer_count: number }>>`
    SELECT
      isq.question_id,
      isq.question_text,
      isq.category::text,
      AVG(ia.score_total) AS avg_score,
      COUNT(*)::int AS answer_count
    FROM interview_answers ia
    JOIN interview_session_questions isq ON isq.id = ia.session_question_id
    WHERE ia.score_total IS NOT NULL
      AND isq.question_id IS NOT NULL
    GROUP BY 1, 2, 3
    ORDER BY AVG(ia.score_total) ASC
    LIMIT ${safeLimit}
  `;

  return rows.map((row) => ({
    questionId: row.question_id,
    questionText: row.question_text,
    category: row.category,
    avgScore: round(Number(row.avg_score)),
    answerCount: row.answer_count
  }));
}

export async function getUserDistribution() {
  const [schools, scholarships] = await Promise.all([
    prisma.$queryRaw<Array<{ name: string; count: number }>>`
      SELECT target_school AS name, COUNT(*)::int AS count
      FROM user_profiles
      WHERE target_school != ''
      GROUP BY 1
      ORDER BY count DESC
      LIMIT 10
    `,
    prisma.$queryRaw<Array<{ name: string; count: number }>>`
      SELECT scholarship_type AS name, COUNT(*)::int AS count
      FROM user_profiles
      WHERE scholarship_type != ''
      GROUP BY 1
      ORDER BY count DESC
      LIMIT 10
    `
  ]);

  return {
    bySchool: schools,
    byScholarship: scholarships
  };
}

export async function getActivityHeatmap() {
  const rows = await prisma.$queryRaw<Array<{ dow: number; hour: number; count: number }>>`
    SELECT
      EXTRACT(DOW FROM created_at)::int AS dow,
      EXTRACT(HOUR FROM created_at)::int AS hour,
      COUNT(*)::int AS count
    FROM interview_sessions
    WHERE created_at >= now() - interval '90 day'
    GROUP BY 1, 2
    ORDER BY 1, 2
  `;

  return rows.map((row) => ({
    dayOfWeek: row.dow,
    hour: row.hour,
    count: row.count
  }));
}

export async function getAICostTracking(days = 30) {
  const safeDays = Math.min(Math.max(days, 7), 90);
  const rows = await prisma.$queryRaw<Array<{ date: Date; cost: number; requests: number }>>`
    SELECT
      date_trunc('day', created_at)::date AS date,
      COALESCE(SUM(cost_usd), 0)::float AS cost,
      COUNT(*)::int AS requests
    FROM ai_usage_logs
    WHERE created_at >= now() - (${safeDays}::int * interval '1 day')
    GROUP BY 1
    ORDER BY 1 ASC
  `;

  return rows.map((row) => ({
    date: row.date.toISOString().slice(0, 10),
    cost: round(row.cost, 4),
    requests: row.requests
  }));
}
