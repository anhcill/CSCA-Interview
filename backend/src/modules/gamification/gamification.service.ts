import { LanguageCode, Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma.js";

export type GamificationSummary = {
  badges: Array<{
    code: string;
    description: string;
    earned: boolean;
    earnedAt: Date | null;
    icon: string;
    label: string;
  }>;
  preferences: {
    browserNotificationsEnabled: boolean;
    onboardingCompleted: boolean;
    preferredLanguage: LanguageCode;
    theme: string;
    weeklyGoalTarget: number;
  };
  weeklyGoal: {
    completed: number;
    target: number;
    weekStart: string;
  };
};

export type GamificationStatsSnapshot = {
  completedSessions: number;
  maxScore: number;
  streak: number;
  weeklyCompleted: number;
};

const localizedBadgeText: Record<string, { description: string; label: string }> = {
  FIRST_SESSION: {
    description: "Hoàn thành buổi phỏng vấn đầu tiên.",
    label: "Phỏng vấn đầu tiên"
  },
  HIGH_SCORE_8: {
    description: "Đạt điểm trung bình từ 8 trở lên.",
    label: "Điểm 8+"
  },
  SEVEN_DAY_STREAK: {
    description: "Luyện tập 7 ngày liên tiếp.",
    label: "7 ngày liên tiếp"
  },
  THREE_SESSION_WEEK: {
    description: "Hoàn thành 3 buổi trong một tuần.",
    label: "Mục tiêu tuần"
  },
  TWENTY_SESSIONS: {
    description: "Hoàn thành 20 buổi phỏng vấn.",
    label: "Học không ngừng"
  }
};

export function getWeekStart(date = new Date()) {
  const cursor = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = cursor.getUTCDay() || 7;
  cursor.setUTCDate(cursor.getUTCDate() - day + 1);
  return cursor;
}

export async function ensureUserPreferences(userId: string) {
  const existing = await prisma.user_preferences.findUnique({ where: { user_id: userId } });
  if (existing) return existing;

  return prisma.user_preferences.create({ data: { user_id: userId } });
}

export async function updateUserPreferences(
  userId: string,
  input: {
    browserNotificationsEnabled?: boolean;
    onboardingCompleted?: boolean;
    preferredLanguage?: LanguageCode;
    theme?: string;
    weeklyGoalTarget?: number;
  }
) {
  await ensureUserPreferences(userId);

  return prisma.user_preferences.update({
    where: { user_id: userId },
    data: {
      browser_notifications_enabled: input.browserNotificationsEnabled,
      onboarding_completed: input.onboardingCompleted,
      preferred_language: input.preferredLanguage,
      theme: input.theme,
      weekly_goal_target: input.weeklyGoalTarget
    }
  });
}

export async function syncWeeklyGoal(
  userId: string,
  options: {
    completed?: number;
    preferences?: Awaited<ReturnType<typeof ensureUserPreferences>>;
    weekStart?: Date;
  } = {}
) {
  const preferences = options.preferences ?? await ensureUserPreferences(userId);
  const weekStart = options.weekStart ?? getWeekStart();
  const completed = options.completed ?? await prisma.interviewSession.count({
    where: {
      createdAt: { gte: weekStart },
      status: "COMPLETED",
      userId
    }
  });

  const existing = await prisma.user_weekly_goals.findUnique({
    where: { user_id_week_start: { user_id: userId, week_start: weekStart } }
  });

  if (!existing) {
    return prisma.user_weekly_goals.create({
      data: {
        completed_sessions: completed,
        target_sessions: preferences.weekly_goal_target,
        user_id: userId,
        week_start: weekStart
      }
    });
  }

  if (existing.completed_sessions === completed && existing.target_sessions === preferences.weekly_goal_target) {
    return existing;
  }

  return prisma.user_weekly_goals.update({
    where: { user_id_week_start: { user_id: userId, week_start: weekStart } },
    data: {
      completed_sessions: completed,
      target_sessions: preferences.weekly_goal_target
    }
  });
}

export async function awardBadgesForUser(userId: string, snapshot?: GamificationStatsSnapshot) {
  const stats = snapshot ?? (await buildGamificationStats(userId));
  const badges = await prisma.gamification_badges.findMany();
  const earnedBadgeIds = badges
    .filter((badge) => meetsRequirement(badge.requirement_type, badge.requirement_value, {
      completedSessions: stats.completedSessions,
      maxScore: stats.maxScore,
      streak: stats.streak,
      weeklyCompleted: stats.weeklyCompleted
    }))
    .map((badge) => badge.id);

  if (!earnedBadgeIds.length) return;

  const existing = await prisma.user_badges.findMany({
    select: { badge_id: true },
    where: { user_id: userId, badge_id: { in: earnedBadgeIds } }
  });
  const existingIds = new Set(existing.map((badge) => badge.badge_id));
  const missingBadgeIds = earnedBadgeIds.filter((badgeId) => !existingIds.has(badgeId));

  if (missingBadgeIds.length) {
    await prisma.user_badges.createMany({
      data: missingBadgeIds.map((badgeId) => ({
        badge_id: badgeId,
        metadata: {
          completedSessions: stats.completedSessions,
          maxScore: stats.maxScore,
          streak: stats.streak,
          weeklyCompleted: stats.weeklyCompleted
        } satisfies Prisma.InputJsonValue,
        user_id: userId
      })),
      skipDuplicates: true
    });
  }
}

export async function getGamificationSummary(userId: string, snapshot?: GamificationStatsSnapshot): Promise<GamificationSummary> {
  const preferences = await ensureUserPreferences(userId);
  const stats = snapshot ?? (await buildGamificationStats(userId));
  const weeklyGoal = await syncWeeklyGoal(userId, {
    completed: stats.weeklyCompleted,
    preferences
  });
  await awardBadgesForUser(userId, {
    ...stats,
    weeklyCompleted: weeklyGoal.completed_sessions
  });

  const [badges, earned] = await Promise.all([
    prisma.gamification_badges.findMany({ orderBy: { requirement_value: "asc" } }),
    prisma.user_badges.findMany({ where: { user_id: userId } })
  ]);
  const earnedMap = new Map(earned.map((badge) => [badge.badge_id, badge.earned_at]));

  return {
    badges: badges.map((badge) => {
      const text = getLocalizedBadgeText(badge);
      return {
        code: badge.code,
        description: text.description,
        earned: earnedMap.has(badge.id),
        earnedAt: earnedMap.get(badge.id) ?? null,
        icon: badge.icon,
        label: text.label
      };
    }),
    preferences: {
      browserNotificationsEnabled: preferences.browser_notifications_enabled,
      onboardingCompleted: preferences.onboarding_completed,
      preferredLanguage: preferences.preferred_language,
      theme: preferences.theme,
      weeklyGoalTarget: preferences.weekly_goal_target
    },
    weeklyGoal: {
      completed: weeklyGoal.completed_sessions,
      target: weeklyGoal.target_sessions,
      weekStart: weeklyGoal.week_start.toISOString().slice(0, 10)
    }
  };
}

function getLocalizedBadgeText(badge: { code: string; description: string; label: string }) {
  return localizedBadgeText[badge.code] ?? {
    description: badge.description,
    label: badge.label
  };
}

function meetsRequirement(
  requirementType: string,
  requirementValue: number,
  stats: { completedSessions: number; maxScore: number; streak: number; weeklyCompleted: number }
) {
  switch (requirementType) {
    case "completed_sessions":
      return stats.completedSessions >= requirementValue;
    case "max_score":
      return stats.maxScore >= requirementValue;
    case "streak_days":
      return stats.streak >= requirementValue;
    case "weekly_completed":
      return stats.weeklyCompleted >= requirementValue;
    default:
      return false;
  }
}

async function buildGamificationStats(userId: string): Promise<GamificationStatsSnapshot> {
  const weekStart = getWeekStart();
  const [summaryRows, sessionDates] = await Promise.all([
    prisma.$queryRaw<Array<{
      completed_sessions: number;
      max_score: Prisma.Decimal | null;
      weekly_completed: number;
    }>>`
      SELECT
        COUNT(*) FILTER (WHERE status = 'COMPLETED')::int AS completed_sessions,
        MAX(total_score) FILTER (WHERE status = 'COMPLETED') AS max_score,
        COUNT(*) FILTER (WHERE status = 'COMPLETED' AND created_at >= ${weekStart})::int AS weekly_completed
      FROM interview_sessions
      WHERE user_id = ${userId}::uuid
    `,
    prisma.$queryRaw<Array<{ day: Date }>>`
      SELECT DISTINCT (created_at AT TIME ZONE 'UTC')::date AS day
      FROM interview_sessions
      WHERE user_id = ${userId}::uuid AND status = 'COMPLETED'
      ORDER BY day DESC
      LIMIT 60
    `
  ]);
  const summary = summaryRows[0];

  return {
    completedSessions: summary?.completed_sessions ?? 0,
    maxScore: Number(summary?.max_score ?? 0),
    streak: calculateStreak(sessionDates.map((row) => new Date(row.day))),
    weeklyCompleted: summary?.weekly_completed ?? 0
  };
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
