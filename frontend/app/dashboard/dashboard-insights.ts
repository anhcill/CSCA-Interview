export type DashboardRecentSession = {
  answeredQuestions: number;
  createdAt: string;
  id: string;
  status: string;
  targetMajor: string | null;
  targetSchool: string | null;
  totalQuestions: number;
  totalScore: number | null;
};

export type DashboardWeakArea = {
  category: string;
  score: number;
};

export type PracticePlanItem = {
  day: number;
  focus: string;
  task: string;
};

export type DashboardProfileFields = {
  scholarshipType?: string | null;
  studyPlan?: string | null;
  targetMajor?: string | null;
  targetSchool?: string | null;
};

const resumableStatuses = new Set(["DRAFT", "IN_PROGRESS", "PAUSED"]);

export function findResumableSession(sessions: DashboardRecentSession[] = []) {
  return sessions.find((session) => resumableStatuses.has(session.status)) ?? null;
}

export function getReadinessScore(input: {
  averageScore: number | null;
  skillOverall?: number | null;
}) {
  const source = input.skillOverall != null && Number.isFinite(input.skillOverall)
    ? input.skillOverall
    : input.averageScore != null && Number.isFinite(input.averageScore)
      ? input.averageScore
      : null;

  return source == null ? null : Math.max(0, Math.min(100, Math.round(source * 10)));
}

export function getScoreTrend(sessions: DashboardRecentSession[] = []) {
  const completed = sessions
    .filter((session) => session.status === "COMPLETED" && session.totalScore != null)
    .slice(0, 2);

  if (completed.length < 2) return null;
  return Number((completed[0].totalScore! - completed[1].totalScore!).toFixed(1));
}

export function getPriorityWeakAreas(areas: DashboardWeakArea[] = [], limit = 3) {
  return areas
    .filter((area) => Number.isFinite(area.score) && area.category.trim().length > 0)
    .sort((first, second) => first.score - second.score)
    .slice(0, limit);
}

export function getProfileCompleteness(profile: DashboardProfileFields | null) {
  const values = [
    profile?.targetSchool,
    profile?.targetMajor,
    profile?.scholarshipType,
    profile?.studyPlan
  ];
  const completed = values.filter((value) => typeof value === "string" && value.trim().length > 0).length;

  return {
    completed,
    percent: completed * 25,
    total: values.length
  };
}

export function buildSevenDayPlan(
  areas: DashboardWeakArea[] = [],
  fallbackFocus: string,
  tasks: readonly string[] = [
    "Trả lời 3 câu ngắn và xem lại phản hồi",
    "Luyện cấu trúc mở bài, luận điểm và kết luận",
    "Bổ sung ví dụ cụ thể cho từng luận điểm",
    "Luyện trả lời câu hỏi đào sâu theo cùng chủ đề",
    "Tự ghi âm, nghe lại và sửa một lần",
    "Thực hiện một lượt luyện tập có giới hạn thời gian",
    "Phỏng vấn thử trọn buổi và so sánh kết quả"
  ]
): PracticePlanItem[] {
  const priorities = getPriorityWeakAreas(areas, 3);
  const focusForDay = (index: number) => priorities[index % Math.max(1, priorities.length)]?.category ?? fallbackFocus;

  return [
    { day: 1, focus: focusForDay(0), task: tasks[0] },
    { day: 2, focus: focusForDay(1), task: tasks[1] },
    { day: 3, focus: focusForDay(2), task: tasks[2] },
    { day: 4, focus: focusForDay(0), task: tasks[3] },
    { day: 5, focus: focusForDay(1), task: tasks[4] },
    { day: 6, focus: focusForDay(2), task: tasks[5] },
    { day: 7, focus: fallbackFocus, task: tasks[6] }
  ];
}
