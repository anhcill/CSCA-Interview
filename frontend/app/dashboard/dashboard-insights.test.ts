import { describe, expect, it } from "vitest";
import {
  buildSevenDayPlan,
  findResumableSession,
  getPriorityWeakAreas,
  getProfileCompleteness,
  getReadinessScore,
  getScoreTrend,
  type DashboardRecentSession
} from "./dashboard-insights";

const session = (input: Partial<DashboardRecentSession>): DashboardRecentSession => ({
  answeredQuestions: 2,
  createdAt: "2026-07-26T00:00:00.000Z",
  id: "session-1",
  status: "COMPLETED",
  targetMajor: "Thương mại điện tử",
  targetSchool: "Đại học A",
  totalQuestions: 5,
  totalScore: 7,
  ...input
});

describe("dashboard insights", () => {
  it("chỉ chọn phiên có thể tiếp tục", () => {
    const active = session({ id: "active", status: "PAUSED" });
    expect(findResumableSession([session({}), active])?.id).toBe("active");
  });

  it("tính mức sẵn sàng từ điểm thật và giới hạn trong 100", () => {
    expect(getReadinessScore({ averageScore: 7.2, skillOverall: 8.1 })).toBe(81);
    expect(getReadinessScore({ averageScore: 7.2, skillOverall: 0 })).toBe(0);
    expect(getReadinessScore({ averageScore: null, skillOverall: null })).toBeNull();
    expect(getReadinessScore({ averageScore: 11 })).toBe(100);
  });

  it("so sánh hai buổi hoàn thành gần nhất", () => {
    expect(getScoreTrend([session({ totalScore: 8 }), session({ id: "old", totalScore: 6.5 })])).toBe(1.5);
  });

  it("xếp điểm yếu theo điểm tăng dần và tạo đủ kế hoạch 7 ngày", () => {
    const areas = [
      { category: "Ngôn ngữ", score: 6 },
      { category: "Logic", score: 4 },
      { category: "Chuyên môn", score: 5 }
    ];
    expect(getPriorityWeakAreas(areas).map((area) => area.category)).toEqual(["Logic", "Chuyên môn", "Ngôn ngữ"]);

    const plan = buildSevenDayPlan(areas, "Phỏng vấn tổng hợp");
    expect(plan).toHaveLength(7);
    expect(plan[0].focus).toBe("Logic");
    expect(plan[6].focus).toBe("Phỏng vấn tổng hợp");
  });

  it("tính độ hoàn thiện hồ sơ chỉ từ bốn trường bắt buộc", () => {
    expect(getProfileCompleteness({
      scholarshipType: "CSC",
      studyPlan: " ",
      targetMajor: "Thương mại điện tử",
      targetSchool: "Đại học A"
    })).toEqual({ completed: 3, percent: 75, total: 4 });
    expect(getProfileCompleteness(null)).toEqual({ completed: 0, percent: 0, total: 4 });
  });
});
